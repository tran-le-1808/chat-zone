"use client";

import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { configForPreset } from "../../_lib/physics/config";
import { tableFor } from "../../_lib/physics/table";
import { simulateShot } from "../../_lib/physics/simulator";
import { liftShot, type CueClearance } from "../../_lib/physics/clearance";
import { sanitizeShot } from "../../_lib/physics/cue";
import type { ShotCommand, ShotTrace } from "../../_lib/physics/types";
import { autoCall } from "../../_lib/aim";
import { poolSound } from "../../_lib/poolSound";
import { useShotInput, type ShotInput } from "../../../_shared/shot/useShotInput";
import { useShotSettings, type ShotSettings } from "../../../_shared/shot/shotSettings";
import { legalTargets } from "../../_lib/rules/common";
import { clampCuePlacement, isValidCuePlacement, withCueAt } from "../../_lib/rules/rack";
import type { CallShot, DecisionChoice, PlayerIndex, RuleMessage } from "../../_lib/rules/types";
import { ballsHash, POOL_PROTOCOL_VERSION, shotCommandFromInput, type AimUpdate } from "../../_lib/protocol";
import {
  defaultAimFor,
  makePlayback,
  useBanners,
  usePrefsState,
  type OnlineInfo,
  type Phase,
  type Playback,
  type PoolController,
  type PoolSetup,
} from "../PoolContext";
import type { PoolSnapshot, ShotRecord } from "./types";

interface DeclState {
  call: CallShot | null;
  manual: boolean;
  safety: boolean;
  pushOut: boolean;
}
const NO_DECL: DeclState = { call: null, manual: false, safety: false, pushOut: false };
const AIM_SEND_MS = 80; // ~12 Hz

/**
 * BỘ ĐIỀU KHIỂN ONLINE: server là nguồn chân lý (vật lý, luật, đồng hồ).
 * - Mình đánh: mô phỏng cục bộ NGAY khi bấm (không trễ), gửi SHOT; khi nhận SHOT_RESULT
 *   so hash — khác thì nội suy về trạng thái của server (~150 ms).
 * - Đối thủ / khán giả: tự mô phỏng lại từ input (engine xác định) & kiểm tra hash.
 * - Chỉ áp dụng phán quyết (lỗi, bi trong tay, thắng/thua) của server.
 */
export function useOnlinePoolController(): PoolController {
  const { room, myUserId, initialSnapshot, isHost, leaveRoom, resetToLobby } = useRoom();
  const [snap, setSnap] = useState<PoolSnapshot | null>((initialSnapshot as PoolSnapshot | null) ?? null);
  const [phaseLocal, setPhaseLocal] = useState<"idle" | "rolling" | "replay">("idle");
  const [aimState, setAimState] = useState<ShotCommand>(() => (snap ? defaultAimFor(snap.match.rack) : { dirX: 1, dirY: 0, power: 0, tipX: 0, tipY: 0, elevation: 0 }));
  const [remoteAim, setRemoteAim] = useState<AimUpdate | null>(null);
  const [decl, setDeclState] = useState<DeclState>(NO_DECL);
  const [placing, setPlacingState] = useState(false);
  const [cueOverride, setCueOverride] = useState<{ x: number; y: number } | null>(null);
  const [rackOver, setRackOver] = useState<{ winner: PlayerIndex; reason: string } | null>(null);
  const [hasReplay, setHasReplay] = useState(false);
  const [mismatches, setMismatches] = useState(0);
  const [ping, setPing] = useState(0);
  const { banners, pushBanners } = useBanners();
  const { prefs, setPrefs } = usePrefsState();
  const shotSettings = useShotSettings();

  const playback = useRef<Playback | null>(null);
  const pendingState = useRef<PoolSnapshot | null>(null);
  const myPending = useRef<{ shotId: string; hash: string } | null>(null);
  const lastTrace = useRef<ShotTrace | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const snapRef = useRef(snap);
  const lastRackOverKey = useRef<string | null>(null);

  const getPlayback = useCallback(() => playback.current, []);

  /** Áp trạng thái server (bỏ qua bản cũ hơn) */
  const applySnap = useCallback((s: PoolSnapshot | null) => {
    if (!s) return;
    const cur = snapRef.current;
    if (cur && s.seq < cur.seq && s.match.rackNo === cur.match.rackNo) return;
    setClockOffset(s.clock.serverNow - Date.now());
    snapRef.current = s;
    setSnap(s);
    setCueOverride(null);
    if (s.rackOver) {
      const key = `${s.rackOver.rackNo}:${s.match.score.join("-")}`;
      if (key !== lastRackOverKey.current) {
        lastRackOverKey.current = key;
        setRackOver({ winner: s.rackOver.winner as PlayerIndex, reason: s.rackOver.reason });
        poolSound.play("win");
      }
    } else if (s.match.matchWinner !== null && lastRackOverKey.current !== "end") {
      lastRackOverKey.current = "end";
      setRackOver({ winner: s.match.matchWinner, reason: s.endReason ?? "" });
    }
  }, []);

  /** Trạng thái tới khi bi đang lăn -> giữ lại, áp khi phát lại xong */
  const applyOrQueue = useCallback(
    (s: PoolSnapshot | null) => {
      if (!s) return;
      if (playback.current && !playback.current.done) {
        if (!pendingState.current || s.seq >= pendingState.current.seq) pendingState.current = s;
      } else applySnap(s);
    },
    [applySnap],
  );

  const finishPlayback = useCallback(
    (msgs: RuleMessage[]) => {
      playback.current = null;
      setPhaseLocal("idle");
      pushBanners(msgs);
      if (msgs.some((m) => m.tone === "foul")) poolSound.play("foul");
      const p = pendingState.current;
      pendingState.current = null;
      if (p) applySnap(p);
    },
    [applySnap, pushBanners],
  );

  const physicsOf = (s: PoolSnapshot | null) => configForPreset(s?.settings.pocketPreset ?? "wpa");

  /** SHOT_RESULT: cú của mình -> đối chiếu hash; cú của người khác -> tự mô phỏng lại từ input */
  const onShot = useCallback(
    ({ shot, state }: { shot: ShotRecord; state: PoolSnapshot }) => {
      const mine = myPending.current?.shotId === shot.shotId;
      if (mine) {
        if (myPending.current!.hash !== shot.hash) setMismatches((n) => n + 1);
        myPending.current = null;
        if (playback.current && !playback.current.done) {
          pendingState.current = state;
          const done = playback.current.onDone;
          playback.current.onDone = () => {
            done();
            pushBanners(shot.messages);
          };
        } else {
          applySnap(state);
          pushBanners(shot.messages);
        }
        return;
      }
      const cfg = physicsOf(state);
      // Server mô phỏng với góc cơ đã tự nâng qua băng (liftShot): người xem phải làm y hệt để bi đi trùng
      const cmd = liftShot(shot.start, shotCommandFromInput(shot.input), cfg).shot;
      const trace = simulateShot(shot.start, cmd, { record: true, config: cfg });
      if (trace.hash !== shot.hash) setMismatches((n) => n + 1);
      lastTrace.current = trace;
      setHasReplay(true);
      pendingState.current = state;
      setRemoteAim(null);
      playback.current = makePlayback(trace, () => finishPlayback(shot.messages));
      playback.current.cmd = cmd;
      poolSound.unlock();
      setPhaseLocal("rolling");
    },
    [applySnap, finishPlayback, pushBanners],
  );

  // ---- Đăng ký sự kiện socket ----
  useEffect(() => {
    const onState = (s: PoolSnapshot) => applyOrQueue(s);
    // Bỏ qua AIM_UPDATE đến trễ sau khi trạng thái đã sang cú mới (tránh cơ đối thủ lùi lại khi bi đang lăn)
    const onAim = ({ seq, aim }: { seq?: number; aim: AimUpdate }) => {
      if (seq !== undefined && snapRef.current && seq < snapRef.current.seq) return;
      setRemoteAim(aim);
    };
    const resync = async () => {
      const r = await monoEmit<PoolSnapshot | null>("pool:sync");
      if (r.ok) applyOrQueue(r.data ?? null);
    };
    socket.on("pool:state", onState);
    socket.on("pool:shot", onShot);
    socket.on("pool:aim", onAim);
    socket.on("connect", resync);
    void resync();
    const pinger = setInterval(async () => {
      const t = performance.now();
      const r = await monoEmit("pool:ping", { t });
      if (r.ok) setPing(Math.round(performance.now() - t));
    }, 5000);
    return () => {
      socket.off("pool:state", onState);
      socket.off("pool:shot", onShot);
      socket.off("pool:aim", onAim);
      socket.off("connect", resync);
      clearInterval(pinger);
    };
  }, [applyOrQueue, onShot]);

  // ---- Dẫn xuất trạng thái ----
  const match = snap?.match;
  const mySeat = snap && myUserId ? snap.players.indexOf(myUserId) : -1;
  const spectator = mySeat < 0;
  const baseRack = match?.rack;
  const rack = useMemo(
    () => (baseRack && cueOverride ? { ...baseRack, balls: withCueAt(baseRack.balls, cueOverride.x, cueOverride.y) } : baseRack),
    [baseRack, cueOverride],
  );
  const actor = rack ? (rack.decision?.by ?? rack.turn) : 0;
  const isMyTurn = !!rack && !spectator && actor === mySeat && match!.matchWinner === null;
  const physics = useMemo(() => physicsOf(snap), [snap?.settings.pocketPreset]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useMemo(() => tableFor(physics), [physics]);
  const names = useMemo<[string, string]>(() => snap?.names ?? ["", ""], [snap?.names]);
  const setup = useMemo<PoolSetup>(
    () => ({
      mode: "match",
      config: {
        ...(match?.config ?? { type: "eight", raceTo: 1, breakRule: "alternate", autoCall: true, seed: 0 }),
        players: [
          { name: names[0], ai: null },
          { name: names[1], ai: null },
        ],
        pocketPreset: snap?.settings.pocketPreset ?? "wpa",
        allowFullGuide: snap?.settings.allowFullGuide ?? false,
        autoCall: snap?.settings.autoCall ?? true,
      },
    }),
    [match?.config, names, snap?.settings.pocketPreset, snap?.settings.allowFullGuide, snap?.settings.autoCall],
  );

  // Lượt mới -> đặt lại ngắm / khai báo; bi trong tay -> bật chế độ đặt bi
  const turnKey = rack ? `${match!.rackNo}:${snap!.seq}:${actor}` : "";
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (rack && seenTurn !== turnKey) {
    setSeenTurn(turnKey);
    if (isMyTurn) {
      // Sang cú mới: điểm chạm và góc cơ về mặc định (tuỳ chọn "tự reset sau mỗi cú"; tắt thì giữ nguyên)
      setAimState((prev) => {
        const keep = !shotSettings.resetAfterShot;
        return { ...defaultAimFor(rack), tipX: keep ? prev.tipX : 0, tipY: keep ? prev.tipY : 0, elevation: keep ? prev.elevation : 0 };
      });
      setDeclState(NO_DECL);
      setPlacingState(!!rack.ballInHand && !rack.decision && !rack.isBreak);
    } else setPlacingState(false);
  }

  const targets = useMemo(() => (rack ? legalTargets(rack) : []), [rack]);
  const needsCall = !!rack && rack.type === "eight" && !rack.isBreak && !decl.safety;
  const aim: ShotCommand = isMyTurn || !remoteAim ? aimState : remoteAim;
  const effectiveCall = useMemo<CallShot | null>(() => {
    if (!rack || !needsCall) return null;
    if (!isMyTurn) return remoteAim?.call ?? null;
    if (decl.manual || !setup.config.autoCall) return decl.call;
    return autoCall(rack.balls, aim.dirX, aim.dirY, targets, table);
  }, [rack, needsCall, isMyTurn, remoteAim, decl.manual, decl.call, setup.config.autoCall, aim.dirX, aim.dirY, targets, table]);

  // Gửi AIM_UPDATE ~12 Hz để đối thủ thấy cơ di chuyển
  const lastAimSent = useRef(0);
  const aimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isMyTurn || phaseLocal !== "idle") return;
    const send = () => {
      lastAimSent.current = Date.now();
      socket.emit("pool:aim", { v: POOL_PROTOCOL_VERSION, ...aimState, call: effectiveCall });
    };
    const wait = AIM_SEND_MS - (Date.now() - lastAimSent.current);
    if (aimTimer.current) clearTimeout(aimTimer.current);
    if (wait <= 0) send();
    else aimTimer.current = setTimeout(send, wait);
  }, [aimState, effectiveCall, isMyTurn, phaseLocal]);

  const phase: Phase = phaseLocal !== "idle" ? phaseLocal : isMyTurn ? "idle" : "thinking";
  const cueOnTable = !!rack?.balls.some((b) => b.n === 0);
  const ended = match?.matchWinner !== null && match?.matchWinner !== undefined;
  const canShoot = phase === "idle" && isMyTurn && !!rack && !rack.decision && cueOnTable && !placing && !rackOver && !ended;

  const setAim = useCallback(
    (p: Partial<ShotCommand>) => {
      if (isMyTurn) setAimState((a) => ({ ...a, ...p }));
    },
    [isMyTurn],
  );
  const rotateAim = useCallback(
    (deg: number) => {
      if (!isMyTurn) return;
      setAimState((a) => {
        const r = (deg * Math.PI) / 180;
        const c = Math.cos(r);
        const sn = Math.sin(r);
        return { ...a, dirX: a.dirX * c - a.dirY * sn, dirY: a.dirX * sn + a.dirY * c };
      });
    },
    [isMyTurn],
  );
  const setDecl = useCallback((p: Partial<DeclState>) => setDeclState((d) => ({ ...d, ...p })), []);

  const toastErr = (res: { error?: string }) => res.error && toast.error(res.error);

  /** Gửi vị trí bi cái đã đặt (PLACE_CUE_BALL) */
  const sendPlace = useCallback(async (): Promise<PoolSnapshot | null> => {
    const s = snapRef.current;
    if (!s || !cueOverride) return s;
    const r = await monoEmit<PoolSnapshot | null>("pool:place", { v: POOL_PROTOCOL_VERSION, seq: s.seq, ...cueOverride });
    if (!r.ok) {
      toastErr(r);
      setCueOverride(null);
      if (r.data) applySnap(r.data);
      return null;
    }
    // Server sẽ phát pool:state; chờ snapshot mới nhất (seq tăng)
    for (let i = 0; i < 40 && (snapRef.current?.seq ?? 0) <= s.seq; i++) await new Promise((res) => setTimeout(res, 25));
    return snapRef.current;
  }, [cueOverride, applySnap]);

  const setPlacing = useCallback(
    (v: boolean) => {
      setPlacingState(v);
      if (!v) void sendPlace();
    },
    [sendPlace],
  );

  const moveCue = useCallback(
    (x: number, y: number) => {
      if (!isMyTurn || !baseRack?.ballInHand) return;
      const kitchen = baseRack.ballInHand === "kitchen";
      const p = clampCuePlacement(x, y, kitchen);
      const others = baseRack.balls.filter((b) => b.n !== 0);
      if (isValidCuePlacement(others, p.x, p.y, kitchen)) setCueOverride(p);
    },
    [isMyTurn, baseRack],
  );

  const shoot = useCallback(async (pullPower?: number) => {
    if (!canShoot || !snapRef.current) return;
    poolSound.unlock();
    let s: PoolSnapshot | null = snapRef.current;
    if (cueOverride) s = await sendPlace();
    if (!s) return;
    const r = s.match.rack;
    const input = {
      v: POOL_PROTOCOL_VERSION,
      seq: s.seq,
      shotId: `${myUserId}-${s.seq}-${Math.random().toString(36).slice(2, 8)}`,
      aimAngle: Math.atan2(aimState.dirY, aimState.dirX),
      // Bida Lỗ: engine đã có đường cong lực p^1.5 nên power = mức kéo cơ
      power: pullPower ?? aimState.power,
      tipX: aimState.tipX,
      tipY: aimState.tipY,
      elevation: aimState.elevation,
      call: effectiveCall,
      safety: r.type === "eight" && !r.isBreak && decl.safety,
      pushOut: r.type === "nine" && r.pushOutAvailable && !r.isBreak && decl.pushOut,
      clientStateHash: ballsHash(r.balls),
    };
    // Cơ không được xuyên bi / thành băng (server cũng kiểm tra); vướng băng nhẹ thì tự nâng đuôi cơ
    const lift = liftShot(r.balls, shotCommandFromInput(input), physicsOf(s));
    if (!lift.clearance.ok) {
      pushBanners([{ tone: "warn", text: `${lift.clearance.reason ?? "Cơ đang vướng"} — hãy nâng góc cơ hoặc đổi hướng ngắm` }]);
      return;
    }
    // Dự đoán cục bộ ngay lập tức (engine xác định -> trùng kết quả server)
    const cmd = lift.shot;
    const trace = simulateShot(r.balls, cmd, { record: true, config: physicsOf(s) });
    myPending.current = { shotId: input.shotId, hash: trace.hash };
    lastTrace.current = trace;
    setHasReplay(true);
    playback.current = makePlayback(trace, () => finishPlayback([]));
    playback.current.cmd = cmd;
    setPhaseLocal("rolling");
    setAimState((a) => ({ ...a, power: 0 }));
    const res = await monoEmit<PoolSnapshot | null>("pool:shoot", input);
    if (!res.ok) {
      // Server từ chối: huỷ phát lại, đồng bộ lại
      myPending.current = null;
      playback.current = null;
      pendingState.current = null;
      setPhaseLocal("idle");
      toastErr(res);
      if (res.data) applySnap(res.data);
    }
  }, [canShoot, cueOverride, sendPlace, myUserId, aimState, effectiveCall, decl.safety, decl.pushOut, finishPlayback, applySnap, pushBanners]);

  // Cơ có vướng bi / thành băng không (cảnh báo & chặn cú đánh)
  const aimGeom = useMemo(
    () => ({ dirX: aimState.dirX, dirY: aimState.dirY, tipX: aimState.tipX, tipY: aimState.tipY, elevation: aimState.elevation }),
    [aimState.dirX, aimState.dirY, aimState.tipX, aimState.tipY, aimState.elevation],
  );
  const clearance = useMemo<CueClearance | null>(() => {
    if (!canShoot || !cueOnTable || !rack) return null;
    return liftShot(rack.balls, sanitizeShot({ ...aimGeom, power: 0.5 }, physics), physics).clearance;
  }, [canShoot, cueOnTable, rack, aimGeom, physics]);
  const clearanceOk = useRef(true);
  useEffect(() => {
    clearanceOk.current = !clearance || clearance.ok;
  });

  /** Điều khiển đánh bi: kéo cơ -> thả = đánh */
  const shot: ShotInput = useShotInput({
    canRelease: () => clearanceOk.current,
    enabled: canShoot,
    onPower: (d) => setAimState((a) => ({ ...a, power: d })),
    onShoot: (d) => void shoot(d),
    onTick: (d) => poolSound.play("pull", d),
    haptics: shotSettings.haptics,
  });

  const replay = useCallback(() => {
    const tr = lastTrace.current;
    if (!tr || phaseLocal !== "idle") return;
    playback.current = makePlayback(tr, () => {
      playback.current = null;
      setPhaseLocal("idle");
    }, false);
    setPhaseLocal("replay");
  }, [phaseLocal]);

  const decide = useCallback(async (choice: DecisionChoice) => {
    const s = snapRef.current;
    if (!s) return;
    const r = await monoEmit<PoolSnapshot | null>("pool:option", { v: POOL_PROTOCOL_VERSION, seq: s.seq, choice });
    if (!r.ok) {
      toastErr(r);
      if (r.data) applySnap(r.data);
    }
  }, [applySnap]);

  const extend = useCallback(async () => toastErr(await monoEmit("pool:extend")), []);
  const resign = useCallback(async () => {
    const ok = await confirmDialog({
      title: "Xin thua trận này?",
      message: "Đối thủ sẽ được tính thắng cả trận.",
      confirmText: "Xin thua",
      cancelText: "Đấu tiếp",
      tone: "danger",
      icon: Flag,
    });
    if (ok) toastErr(await monoEmit("pool:resign"));
  }, []);

  const connected = useMemo<[boolean, boolean]>(() => {
    const c = (uid?: string) => !!room?.players.find((p) => p.userId === uid)?.connected;
    return [c(snap?.players[0]), c(snap?.players[1])];
  }, [room?.players, snap?.players]);

  const online: OnlineInfo = {
    mySeat,
    spectator,
    deadline: snap?.clock.deadline ? snap.clock.deadline - clockOffset : 0,
    paused: snap?.clock.pausedAt != null,
    extensions: snap?.clock.extensions ?? [0, 0],
    extend: () => void extend(),
    resign: () => void resign(),
    leave: () => void leaveRoom(),
    isHost,
    connected,
    ranked: !!snap?.settings.ranked,
    eloChange: snap?.eloChange,
    mismatches,
    ping,
  };

  const noop = useCallback(() => {}, []);
  return {
    setup,
    physics,
    table,
    practice: false,
    names,
    match: match!,
    rack: rack!,
    aim,
    setAim,
    decl,
    setDecl,
    effectiveCall,
    needsCall: needsCall && isMyTurn,
    targets,
    phase,
    canShoot,
    isHumanTurn: isMyTurn,
    cueOnTable,
    placing,
    setPlacing,
    arrange: false,
    setArrange: noop as (v: boolean) => void,
    moveCue,
    moveBall: noop as (n: number, x: number, y: number) => void,
    shoot: (p?: number) => void shoot(p),
    replay,
    hasReplay,
    getPlayback,
    banners,
    prefs,
    setPrefs,
    rackOver,
    continueAfterRack: () => setRackOver(null),
    rematch: () => void resetToLobby(),
    decide: (c: DecisionChoice) => void decide(c),
    practiceRerack: noop as (t: "eight" | "nine") => void,
    undo: noop,
    canUndo: false,
    online,
    shot,
    shotSettings: shotSettings as ShotSettings,
    rotateAim,
    clearance,
  };
}
