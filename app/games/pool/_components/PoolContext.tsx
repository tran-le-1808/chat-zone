"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { poolSound } from "../_lib/poolSound";
import { useShotInput, type ShotInput } from "../../_shared/shot/useShotInput";
import { useShotSettings, type ShotSettings } from "../../_shared/shot/shotSettings";
import { POOL_PHYSICS as C, configForPreset } from "../_lib/physics/config";
import { tableFor } from "../_lib/physics/table";
import { simulateShot } from "../_lib/physics/simulator";
import { liftShot, type CueClearance } from "../_lib/physics/clearance";
import { sanitizeShot } from "../_lib/physics/cue";
import type { BallSpot, ShotCommand, ShotTrace } from "../_lib/physics/types";
import { autoCall } from "../_lib/aim";
import { aiDecision, planShot } from "../_lib/ai";
import { legalTargets } from "../_lib/rules/common";
import {
  applyDecision,
  nextRack,
  recordRackWin,
  resolvePractice,
  resolveShot,
  startMatch,
  newRack,
  type MatchState,
} from "../_lib/rules/engine";
import {
  clampCuePlacement,
  isValidCuePlacement,
  withCueAt,
} from "../_lib/rules/rack";
import type {
  CallShot,
  DecisionChoice,
  GameType,
  MatchConfig,
  PlayerIndex,
  RackState,
  RuleMessage,
  ShotDeclaration,
} from "../_lib/rules/types";

export type GameMode = "match" | "practice";
export interface PoolSetup {
  mode: GameMode;
  config: MatchConfig;
}
export type CameraMode = "top" | "angle" | "behind";
export type GuideMode = "basic" | "ghost" | "full";

export type Quality = "low" | "medium" | "high";
export interface Prefs {
  camera: CameraMode;
  guide: GuideMode;
  sound: boolean;
  cloth: "green" | "blue";
  quality: Quality;
  /** Vẽ đè hình học lỗ (mũi băng, mũi lỗ, hố) để so khớp */
  debugPockets: boolean;
  /** Camera theo bi cái khi đang đánh (góc nghiêng / sau cơ) rồi trở về góc mặc định */
  followCam: boolean;
}

export interface Playback {
  trace: ShotTrace;
  t0: number;
  /** Thời điểm & lỗ mỗi bi rơi (để vẽ bi tụt xuống lỗ) */
  pocketAt: Map<number, { t: number; pocket: number }>;
  /** Bi bay khỏi bàn: vị trí, vận tốc và độ cao lúc vượt băng (để vẽ tiếp quỹ đạo rơi xuống sàn) */
  offAt: Map<number, { t: number; x: number; y: number; vx: number; vy: number; vz: number; h: number }>;
  evIdx: number;
  onDone: () => void;
  done: boolean;
  /** Có hoạt cảnh đẩy cơ trước khi bi chạy */
  stroke: boolean;
  /** Lệnh đánh (để vẽ cây cơ đẩy tới) */
  cmd?: ShotCommand;
}

export interface Banner extends RuleMessage {
  id: number;
}

interface DeclState {
  call: CallShot | null;
  manual: boolean;
  safety: boolean;
  pushOut: boolean;
}

export type Phase = "idle" | "rolling" | "thinking" | "replay";

const R = C.ballRadius;
/** power = mức kéo cơ hiện tại (0 = chưa kéo); lực thật được đặt khi thả tay */
const DEFAULT_AIM: ShotCommand = { dirX: 1, dirY: 0, power: 0, tipX: 0, tipY: 0, elevation: 0 };
export const PREFS_KEY = "pool-prefs";

export const DEFAULT_PREFS: Prefs = { camera: "top", guide: "ghost", sound: true, cloth: "green", quality: "medium", debugPockets: false, followCam: true };
export function loadPrefs(): Prefs {
  const def: Prefs = { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch {}
  return def;
}

/** Hướng ngắm mặc định: về bi hợp lệ gần nhất */
export function defaultAimFor(rack: RackState): ShotCommand {
  const cue = rack.balls.find((b) => b.n === 0);
  if (!cue) return DEFAULT_AIM;
  const targets = legalTargets(rack);
  const pool = rack.balls.filter((b) => (targets.length ? targets.includes(b.n) : b.n !== 0));
  let best: BallSpot | null = null;
  let bd = Infinity;
  for (const b of pool) {
    const d = Math.hypot(b.x - cue.x, b.y - cue.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  if (rack.isBreak) {
    best = rack.type === "nine" ? rack.balls.find((b) => b.n === 1) ?? best : [...pool].sort((a, b) => a.x - b.x)[0] ?? best;
  }
  if (!best) return DEFAULT_AIM;
  return {
    ...DEFAULT_AIM,
    dirX: best.x - cue.x,
    dirY: best.y - cue.y,
    power: 0,
  };
}

/** Thời gian cây cơ đẩy tới chạm bi trước khi bi chạy (s) */
export const STROKE_TIME = 0.1;

export function makePlayback(trace: ShotTrace, onDone: () => void, stroke = true): Playback {
  const pocketAt = new Map<number, { t: number; pocket: number }>();
  const offAt: Playback["offAt"] = new Map();
  for (const e of trace.events) {
    if (e.type === "pocket") pocketAt.set(e.ball, { t: e.t, pocket: e.pocket });
    else if (e.type === "offtable") offAt.set(e.ball, { t: e.t, x: e.x, y: e.y, vx: e.vx, vy: e.vy, vz: e.vz, h: e.h });
  }
  return { trace, t0: performance.now() + (stroke ? STROKE_TIME * 1000 : 0), pocketAt, offAt, evIdx: 0, onDone, done: false, stroke };
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thông tin riêng của trận online (đồng hồ, ghế, đầu hàng…) */
export interface OnlineInfo {
  mySeat: number;
  spectator: boolean;
  /** Hạn chót của cú hiện tại theo giờ máy này (ms), 0 = không có đồng hồ */
  deadline: number;
  paused: boolean;
  extensions: [number, number];
  extend: () => void;
  resign: () => void;
  leave: () => void;
  isHost: boolean;
  connected: [boolean, boolean];
  ranked: boolean;
  eloChange?: [number, number];
  /** Số cú mà kết quả dự đoán cục bộ khác server (phải luôn bằng 0) */
  mismatches: number;
  ping: number;
}

/** Thông báo trọng tài (banner) tự ẩn */
export function useBanners(): { banners: Banner[]; pushBanners: (msgs: RuleMessage[]) => void } {
  const [banners, setBanners] = useState<Banner[]>([]);
  const bannerId = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const pushBanners = useCallback((msgs: RuleMessage[]) => {
    if (!msgs.length) return;
    const add = msgs.map((m) => ({ ...m, id: ++bannerId.current }));
    setBanners((b) => [...b, ...add].slice(-4));
    for (const a of add) {
      setTimeout(() => {
        if (alive.current) setBanners((b) => b.filter((x) => x.id !== a.id));
      }, a.tone === "foul" || a.tone === "warn" ? 6500 : 4200);
    }
  }, []);
  return { banners, pushBanners };
}

/** Tuỳ chọn hiển thị (lưu ở trình duyệt) */
export function usePrefsState(): { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void } {
  const [prefs, setPrefsState] = useState<Prefs>(() => (typeof window === "undefined" ? DEFAULT_PREFS : loadPrefs()));
  useEffect(() => {
    poolSound.setVolume(prefs.sound ? 0.8 : 0);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);
  const setPrefs = useCallback((p: Partial<Prefs>) => setPrefsState((s) => ({ ...s, ...p })), []);
  return { prefs, setPrefs };
}

function usePoolController(setup: PoolSetup) {
  const { config, mode } = setup;
  const practice = mode === "practice";
  /** Vật lý & hình học lỗ theo preset của trận */
  const physics = useMemo(() => configForPreset(config.pocketPreset ?? "wpa"), [config.pocketPreset]);
  const table = useMemo(() => tableFor(physics), [physics]);
  const T = table;
  const names = useMemo<[string, string]>(
    () => [config.players[0].name, config.players[1].name],
    [config.players],
  );

  const [match, setMatch] = useState<MatchState>(() => startMatch(config, 0));
  const rack = match.rack;
  const [aim, setAimState] = useState<ShotCommand>(() => defaultAimFor(match.rack));
  const [decl, setDeclState] = useState<DeclState>({ call: null, manual: false, safety: false, pushOut: false });
  const [phase, setPhase] = useState<Phase>("idle");
  const { banners, pushBanners } = useBanners();
  const [placing, setPlacing] = useState(false);
  const [arrange, setArrange] = useState(false);
  const [rackOver, setRackOver] = useState<{ winner: PlayerIndex; reason: string } | null>(null);
  const { prefs, setPrefs } = usePrefsState();
  const shotSettings = useShotSettings();
  const [hasReplay, setHasReplay] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const playback = useRef<Playback | null>(null);
  /** Đọc quỹ đạo đang phát (dùng trong vòng lặp khung hình của three.js) */
  const getPlayback = useCallback(() => playback.current, []);
  const lastTrace = useRef<ShotTrace | null>(null);
  const undoStack = useRef<RackState[]>([]);
  const aiJob = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setAim = useCallback((p: Partial<ShotCommand>) => setAimState((a) => ({ ...a, ...p })), []);
  /** Xoay hướng ngắm (độ, dương = ngược chiều kim đồng hồ); dùng state mới nhất nên kéo liên tục không mất bước */
  const rotateAim = useCallback((deg: number) => {
    setAimState((a) => {
      const r = (deg * Math.PI) / 180;
      const c = Math.cos(r);
      const sn = Math.sin(r);
      return { ...a, dirX: a.dirX * c - a.dirY * sn, dirY: a.dirX * sn + a.dirY * c };
    });
  }, []);
  const setDecl = useCallback((p: Partial<DeclState>) => setDeclState((d) => ({ ...d, ...p })), []);

  const shooter = config.players[rack.turn];
  const isHumanTurn = practice || !shooter.ai;
  const cueOnTable = rack.balls.some((b) => b.n === 0);
  const blocked = phase !== "idle" || !!rack.decision || !!rackOver || match.matchWinner !== null;
  const canShoot = !blocked && isHumanTurn && cueOnTable && !placing && !arrange;
  const targets = useMemo(() => (practice ? rack.balls.filter((b) => b.n !== 0).map((b) => b.n) : legalTargets(rack)), [rack, practice]);

  // Gọi bi (8 bi): tự gọi theo đường ngắm, trừ khi người chơi đã chọn tay
  const needsCall = !practice && rack.type === "eight" && !rack.isBreak && !decl.safety;
  const effectiveCall = useMemo<CallShot | null>(() => {
    if (!needsCall) return null;
    if (decl.manual) return decl.call;
    if (!config.autoCall) return decl.call;
    return autoCall(rack.balls, aim.dirX, aim.dirY, targets, table);
  }, [needsCall, decl.manual, decl.call, config.autoCall, rack.balls, aim.dirX, aim.dirY, targets, table]);

  // Lượt mới -> đặt lại ngắm, khai báo; bi trong tay của người -> bật chế độ đặt bi
  const turnKey = `${match.rackNo}:${rack.shotNo}:${rack.turn}:${rack.decision?.kind ?? ""}`;
  // Điều chỉnh state ngay trong render khi sang lượt mới (không cần effect)
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (seenTurn !== turnKey) {
    setSeenTurn(turnKey);
    // Sang cú mới: điểm chạm và góc cơ về mặc định (tuỳ chọn "tự reset sau mỗi cú"; tắt thì giữ nguyên)
    setAimState((prev) => {
      const keep = !shotSettings.resetAfterShot;
      return { ...defaultAimFor(rack), tipX: keep ? prev.tipX : 0, tipY: keep ? prev.tipY : 0, elevation: keep ? prev.elevation : 0 };
    });
    setDeclState({ call: null, manual: false, safety: false, pushOut: false });
    setPlacing(!!rack.ballInHand && !rack.decision && (practice || !config.players[rack.turn].ai) && !rack.isBreak);
  }

  /** Kết thúc cú đánh: trọng tài phán quyết từ ShotResult */
  const finishShot = useCallback(
    (rackAtShot: RackState, d: ShotDeclaration, trace: ShotTrace) => {
      const res = trace.result;
      if (practice) {
        undoStack.current = [...undoStack.current.slice(-19), rackAtShot];
        setUndoCount(undoStack.current.length);
        // Bi văng khỏi bàn / rơi lỗ: bi cái luôn quay lại để đặt, bi khác văng thì đặt lại lên bàn
        const out = resolvePractice(rackAtShot, res, (id) => T.pockets[id].name.toLowerCase());
        pushBanners(out.messages);
        setMatch((m) => ({ ...m, rack: out.rack }));
        setPhase("idle");
        return;
      }
      const v = resolveShot(rackAtShot, d, res, names);
      pushBanners(v.messages);
      if (v.rack.winner !== null) {
        const winner = v.rack.winner;
        poolSound.play("win");
        setMatch((m) => recordRackWin({ ...m, rack: v.rack }, winner));
        setRackOver({ winner, reason: v.rack.winReason ?? "" });
      } else {
        if (v.foul) poolSound.play("foul");
        else if (!v.continues) poolSound.play("turn");
        setMatch((m) => ({ ...m, rack: v.rack }));
      }
      setPhase("idle");
    },
    [practice, names, pushBanners, T],
  );

  /** Đánh: mô phỏng trọn cú đánh ngay (xác định), rồi phát lại theo thời gian thực */
  const executeShot = useCallback(
    (wanted: ShotCommand, d: ShotDeclaration, start: RackState, auto = false) => {
      poolSound.unlock();
      // Cơ không được xuyên bi / thành băng; vướng băng nhẹ thì tự nâng đuôi cơ (giống server)
      let lift = liftShot(start.balls, wanted, physics);
      if (!lift.clearance.ok) {
        if (!auto || lift.clearance.minElevation === null) {
          pushBanners([{ tone: "warn", text: `${lift.clearance.reason ?? "Cơ đang vướng"} — hãy nâng góc cơ hoặc đổi hướng ngắm` }]);
          return false;
        }
        // Máy đánh: tự nâng cơ tới mức hết vướng
        lift = liftShot(start.balls, { ...wanted, elevation: lift.clearance.minElevation }, physics);
      }
      const cmd = lift.shot;
      const trace = simulateShot(start.balls, cmd, { record: true, config: physics });
      lastTrace.current = trace;
      setHasReplay(true);
      playback.current = makePlayback(trace, () => {
        playback.current = null;
        if (mounted.current) finishShot(start, d, trace);
      });
      playback.current.cmd = cmd;
      setPlacing(false);
      setArrange(false);
      setPhase("rolling");
      return true;
    },
    [finishShot, physics, pushBanners],
  );

  const shoot = useCallback((pullPower?: number) => {
    if (!canShoot) return;
    const d: ShotDeclaration = practice
      ? {}
      : {
          call: needsCall ? effectiveCall : null,
          safety: rack.type === "eight" && !rack.isBreak ? decl.safety : false,
          pushOut: rack.type === "nine" && rack.pushOutAvailable && !rack.isBreak ? decl.pushOut : false,
        };
    // Bida Lỗ: engine đã có đường cong lực v = vmin + (vmax − vmin)·p^1.5 nên power = mức kéo
    const done = executeShot(pullPower === undefined ? aim : { ...aim, power: pullPower }, d, rack);
    setAimState((a) => ({ ...a, power: 0 }));
    return done;
  }, [canShoot, practice, needsCall, effectiveCall, rack, decl.safety, decl.pushOut, aim, executeShot]);

  // Cơ có vướng bi / thành băng không (để cảnh báo & chặn cú đánh); tự nâng đuôi cơ nhẹ qua băng
  const aimGeom = useMemo(
    () => ({ dirX: aim.dirX, dirY: aim.dirY, tipX: aim.tipX, tipY: aim.tipY, elevation: aim.elevation }),
    [aim.dirX, aim.dirY, aim.tipX, aim.tipY, aim.elevation],
  );
  const clearance = useMemo<CueClearance | null>(() => {
    if (!canShoot || !cueOnTable) return null;
    return liftShot(rack.balls, sanitizeShot({ ...aimGeom, power: 0.5 }, physics), physics).clearance;
  }, [canShoot, cueOnTable, rack.balls, aimGeom, physics]);
  const clearanceOk = useRef(true);
  useEffect(() => {
    clearanceOk.current = !clearance || clearance.ok;
  });

  /** Điều khiển đánh bi: kéo cơ -> thả = đánh (dùng chung với thanh lực, phím Space, kéo cơ trên bàn) */
  const shot: ShotInput = useShotInput({
    canRelease: () => clearanceOk.current,
    enabled: canShoot,
    onPower: (d) => setAimState((a) => ({ ...a, power: d })),
    onShoot: (d) => shoot(d),
    onTick: (d) => poolSound.play("pull", d),
    haptics: shotSettings.haptics,
  });

  const replay = useCallback(() => {
    const tr = lastTrace.current;
    if (!tr || phase !== "idle") return;
    playback.current = makePlayback(
      tr,
      () => {
        playback.current = null;
        if (mounted.current) setPhase("idle");
      },
      false,
    );
    setPhase("replay");
  }, [phase]);

  /** Đặt bi cái khi có bi trong tay (kẹp về vùng hợp lệ, không chồng bi) */
  const moveCue = useCallback(
    (x: number, y: number) => {
      setMatch((m) => {
        const r = m.rack;
        if (!r.ballInHand && !practice) return m;
        const kitchen = r.ballInHand === "kitchen";
        const p = clampCuePlacement(x, y, kitchen);
        const others = r.balls.filter((b) => b.n !== 0);
        if (!isValidCuePlacement(others, p.x, p.y, kitchen)) return m;
        return { ...m, rack: { ...r, balls: withCueAt(r.balls, p.x, p.y) } };
      });
    },
    [practice],
  );

  /** Tập luyện: kéo thả bi bất kỳ */
  const moveBall = useCallback((n: number, x: number, y: number) => {
    setMatch((m) => {
      const r = m.rack;
      const p = clampCuePlacement(x, y, false);
      const ok = r.balls.every((b) => b.n === n || Math.hypot(b.x - p.x, b.y - p.y) >= 2 * R + 1e-6);
      if (!ok) return m;
      return { ...m, rack: { ...r, balls: r.balls.map((b) => (b.n === n ? { ...b, ...p } : b)) } };
    });
  }, []);

  const decide = useCallback(
    (choice: DecisionChoice) => {
      const out = applyDecision(rack, choice, names);
      pushBanners(out.messages);
      setMatch((m) => ({ ...m, rack: out.rack }));
    },
    [rack, names, pushBanners],
  );

  const continueAfterRack = useCallback(() => {
    setRackOver(null);
    setMatch((m) => (m.matchWinner !== null ? m : nextRack(m)));
  }, []);

  const rematch = useCallback(() => {
    setRackOver(null);
    setMatch(startMatch({ ...config, seed: (Date.now() >>> 0) % 1e9 }, 0));
  }, [config]);

  // ---- Tập luyện ----
  const practiceRerack = useCallback((type: GameType) => {
    undoStack.current = [];
    setUndoCount(0);
    setMatch((m) => ({
      ...m,
      config: { ...m.config, type },
      rack: newRack(type, 0, (Date.now() >>> 0) % 1e9),
    }));
  }, []);
  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (prev) setMatch((m) => ({ ...m, rack: prev }));
  }, []);

  // ---- Máy đánh ----
  useEffect(() => {
    if (practice || phase !== "idle" || rackOver || match.matchWinner !== null) return;
    const key = `${turnKey}:${match.rackNo}`;
    if (aiJob.current === key) return;
    if (rack.decision) {
      const decider = config.players[rack.decision.by];
      if (!decider.ai) return;
      aiJob.current = key;
      void delay(1100).then(() => {
        if (mounted.current) decide(aiDecision(rack));
      });
      return;
    }
    const level = shooter.ai;
    if (!level) return;
    aiJob.current = key;
    void (async () => {
      await delay(0);
      if (!mounted.current) return;
      setPhase("thinking");
      await delay(450);
      const plan = await planShot(rack, level, names, physics);
      if (!mounted.current) return;
      let start = rack;
      if (plan.cue) {
        start = { ...rack, balls: withCueAt(rack.balls, plan.cue.x, plan.cue.y) };
        setMatch((m) => ({ ...m, rack: start }));
      }
      // Cho người xem thấy cây cơ ngắm trước khi đánh
      setAimState(plan.shot);
      if (plan.decl.call) setDeclState((dd) => ({ ...dd, call: plan.decl.call ?? null, manual: true, safety: false }));
      if (plan.decl.safety) setDeclState((dd) => ({ ...dd, safety: true }));
      pushBanners([{ tone: "info", text: `${shooter.name}: ${plan.label}` }]);
      await delay(900);
      if (!mounted.current) return;
      executeShot(plan.shot, plan.decl, start, true);
    })();
  }, [practice, phase, rackOver, match.matchWinner, match.rackNo, turnKey, rack, config.players, shooter, names, decide, executeShot, pushBanners, physics]);

  return {
    setup,
    physics,
    table,
    practice,
    names,
    match,
    rack,
    aim,
    setAim,
    decl,
    setDecl,
    effectiveCall,
    needsCall,
    targets,
    phase,
    canShoot,
    isHumanTurn,
    cueOnTable,
    placing,
    setPlacing: setPlacing as (v: boolean) => void,
    arrange,
    setArrange: setArrange as (v: boolean) => void,
    moveCue,
    moveBall,
    shoot,
    replay,
    hasReplay,
    getPlayback,
    banners,
    prefs,
    setPrefs,
    rackOver,
    continueAfterRack,
    rematch,
    decide,
    practiceRerack,
    undo,
    canUndo: undoCount > 0,
    online: undefined as OnlineInfo | undefined,
    shot,
    shotSettings: shotSettings as ShotSettings,
    rotateAim,
    clearance,
  };
}

export type PoolController = ReturnType<typeof usePoolController>;
const Ctx = createContext<PoolController | null>(null);

/** Cung cấp bộ điều khiển có sẵn (bản online) */
export function PoolValueProvider({ value, children }: { value: PoolController; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function PoolProvider({ setup, children }: { setup: PoolSetup; children: ReactNode }) {
  const value = usePoolController(setup);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePool(): PoolController {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePool phải nằm trong PoolProvider");
  return v;
}
