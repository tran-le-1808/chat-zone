"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { useRoom } from "../../monopoly/_context/RoomContext";
import {
  DEFAULT_PHYSICS,
  checkCueClearance,
  sanitizeShot,
  validateShotInput,
  type BallId,
  type CueClearance,
  type ShotCommand,
} from "../_lib/physics";
import { useShotInput, type ShotInput } from "../../_shared/shot/useShotInput";
import { getShotSettings, useShotSettings, type ShotSettings } from "../../_shared/shot/shotSettings";
import { powerCurve } from "../../_shared/shot/shotMath";
import { restSamples, sampleFrames, type BallSample } from "../_lib/playback";
import { billiardSound } from "../_lib/sound";
import type { BilliardMatch, ShotRecord } from "../_lib/types";

/**
 * Đường cong lực của Bida Carom: engine tuyến tính (v = vmin + (vmax − vmin)·p) nên UI áp
 * p = d^1.4 để vùng lực thấp (cú chạm nhẹ, kiểm soát vị trí bi) có độ phân giải cao hơn.
 */
export const CAROM_POWER_EXP = 1.4;
/** Góc nâng cơ mặc định của Bida Carom (độ) */
export const DEFAULT_ELEVATION = 5;

/** Cài đặt riêng của người chơi (lưu trên trình duyệt) */
export interface BilliardPrefs {
  sfxVolume: number;
  camera: "top" | "angle";
  debug: boolean;
}
const DEFAULT_PREFS: BilliardPrefs = {
  sfxVolume: 0.7,
  camera: "angle",
  debug: false,
};
const PREFS_KEY = "billiard-prefs";

/** Trạng thái ngắm hiện tại của người đang có lượt (chỉ ở máy mình) */
export interface AimState {
  dirX: number;
  dirY: number;
  power: number;
  tipX: number;
  tipY: number;
  /** Góc nâng cơ (độ) 0..90 — độc lập với hướng ngang */
  elevation: number;
}

interface Playback {
  shot: ShotRecord;
  /** performance.now() tương ứng t = 0 của cú đánh */
  startMs: number;
  /** Chỉ số sự kiện âm thanh tiếp theo */
  nextEvent: number;
}

interface BilliardGameContextType {
  match: BilliardMatch | null;
  myIndex: number;
  isMyTurn: boolean;
  /** Bi đang lăn (đang phát lại cú đánh) */
  animating: boolean;
  canShoot: boolean;
  shooting: boolean;
  aim: AimState;
  setAim: (patch: Partial<AimState>) => void;
  /** pullD: mức kéo cơ 0..1 lúc thả tay (đã qua đường cong lực ở đây) */
  shoot: (pullD?: number) => Promise<void>;
  /** Điều khiển đánh bi: kéo cơ -> thả = đánh */
  shot: ShotInput;
  shotSettings: ShotSettings;
  /** Xoay hướng ngắm (độ, dương = ngược chiều kim đồng hồ) */
  rotateAim: (deg: number) => void;
  /** Cú vừa thả tay (để vẽ cơ đẩy tới chạm bi trước khi bi chạy) */
  strokeRef: React.MutableRefObject<StrokeInfo | null>;
  /** Kiểm tra cơ có vướng bàn / băng / bi khác không (null khi chưa tới lượt) */
  clearance: CueClearance | null;
  /** Thời điểm hết lượt theo đồng hồ máy mình (ms) */
  turnDeadlineLocal: number;
  /** Kết quả cú vừa đánh (hiện thông báo sau khi bi dừng) */
  lastVerdict: ShotRecord | null;
  prefs: BilliardPrefs;
  setPrefs: (patch: Partial<BilliardPrefs>) => void;
  /** Đọc vị trí / spin các bi tại thời điểm hiện tại (gọi trong vòng render 3D) */
  sampleBalls: () => BallSample[];
  /** Độ lệch đồng hồ server - client (ms) */
  clockOffset: number;
  /** Lượt & điểm HIỂN THỊ: giữ như trước cú đánh cho tới khi bi dừng (không lộ kết quả sớm) */
  displayTurn: number;
  displayScores: number[];
}

/** Thời gian cây cơ đẩy tới chạm bi (ms) */
export const STROKE_MS = 100;
export interface StrokeInfo {
  t0: number;
  d: number;
  aim: AimState;
  cue: [number, number];
}

const Ctx = createContext<BilliardGameContextType | null>(null);

const newShotId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function loadPrefs(): BilliardPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function BilliardGameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { myUserId } = useRoom();
  const [match, setMatch] = useState<BilliardMatch | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [lastVerdict, setLastVerdict] = useState<ShotRecord | null>(null);
  const [shooting, setShooting] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [prefs, setPrefsState] = useState<BilliardPrefs>(DEFAULT_PREFS);
  const [aim, setAimState] = useState<AimState>({
    dirX: 1,
    dirY: 0,
    // power = mức kéo cơ hiện tại (0 = chưa kéo)
    power: 0,
    tipX: 0,
    tipY: 0,
    elevation: DEFAULT_ELEVATION,
  });

  const strokeRef = useRef<StrokeInfo | null>(null);
  const matchRef = useRef<BilliardMatch | null>(null);
  const playbackRef = useRef<Playback | null>(null);

  useEffect(() => {
    // Đọc cài đặt sau khi mount (tránh lệch dữ liệu khi render phía server)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefsState(loadPrefs());
  }, []);

  const setPrefs = useCallback((patch: Partial<BilliardPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    billiardSound.setVolume(prefs.sfxVolume);
  }, [prefs.sfxVolume]);

  const shotSettings = useShotSettings();
  const setAim = useCallback((patch: Partial<AimState>) => {
    setAimState((prev) => ({ ...prev, ...patch }));
  }, []);
  const rotateAim = useCallback((deg: number) => {
    setAimState((a) => {
      const r = (deg * Math.PI) / 180;
      const c = Math.cos(r);
      const sn = Math.sin(r);
      return { ...a, dirX: a.dirX * c - a.dirY * sn, dirY: a.dirX * sn + a.dirY * c };
    });
  }, []);

  // ---------- Nhận trạng thái chính thức từ server ----------
  const applyMatch = useCallback((next: BilliardMatch | null) => {
    if (!next) return;
    const prev = matchRef.current;
    // Bỏ snapshot cũ / trùng / sai thứ tự (trừ khi là trận mới)
    if (prev && next.startedAt === prev.startedAt && next.seq < prev.seq)
      return;
    if (next.serverNow) setClockOffset(next.serverNow - Date.now());
    matchRef.current = next;
    setMatch(next);

    const shot = next.lastShot;
    const isNewShot =
      !!shot &&
      (!prev ||
        prev.startedAt !== next.startedAt ||
        prev.lastShot?.seq !== shot.seq);
    if (shot && isNewShot) {
      // Vào lại giữa lúc bi đang lăn -> phát tiếp từ đúng thời điểm
      const serverNow = next.serverNow ?? Date.now();
      const elapsed = Math.max(0, (serverNow - shot.at) / 1000);
      if (elapsed < shot.duration) {
        const pb: Playback = {
          shot,
          startMs: performance.now() - elapsed * 1000,
          nextEvent: shot.events.findIndex((e) => e.t >= elapsed),
        };
        if (pb.nextEvent < 0) pb.nextEvent = shot.events.length;
        playbackRef.current = pb;
        setPlayback(pb);
        setLastVerdict(null);
        return;
      }
    }
    if (!shot) {
      playbackRef.current = null;
      setPlayback(null);
    }
  }, []);

  useEffect(() => {
    const onState = (m: BilliardMatch | null) => applyMatch(m);
    socket.on("bida:state", onState);
    const sync = () =>
      void monoEmit<BilliardMatch | null>("bida:sync").then((res) => {
        if (res.ok && res.data) applyMatch(res.data);
      });
    sync();
    // Kết nối lại -> lấy snapshot mới nhất
    const onReconnect = () => setTimeout(sync, 800);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("bida:state", onState);
      socket.off("connect", onReconnect);
    };
  }, [applyMatch]);

  // ---------- Bàn đã ổn định (qua busyUntil của server) -> được đánh ----------
  const [settledSeq, setSettledSeq] = useState(-1);
  useEffect(() => {
    if (!match) return;
    const wait = match.busyUntil - (Date.now() + clockOffset);
    const t = setTimeout(() => setSettledSeq(match.seq), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [match, clockOffset]);

  // ---------- Kết thúc phát lại khi bi dừng ----------
  useEffect(() => {
    if (!playback) return;
    const remain =
      playback.shot.duration * 1000 - (performance.now() - playback.startMs);
    const t = setTimeout(
      () => {
        if (playbackRef.current !== playback) return;
        playbackRef.current = null;
        setPlayback(null);
        setLastVerdict(playback.shot);
        const scored = playback.shot.verdict.scored;
        billiardSound.play(scored ? "score" : "miss");
      },
      Math.max(0, remain),
    );
    return () => clearTimeout(t);
  }, [playback]);

  // ---------- Đọc vị trí bi cho vòng render 3D (không re-render React) ----------
  const sampleBalls = useCallback((): BallSample[] => {
    const pb = playbackRef.current;
    const m = matchRef.current;
    if (pb) {
      const t = (performance.now() - pb.startMs) / 1000;
      // Âm thanh theo sự kiện va chạm đã tới thời điểm
      const evs = pb.shot.events;
      while (pb.nextEvent < evs.length && evs[pb.nextEvent].t <= t) {
        const e = evs[pb.nextEvent++];
        const k = Math.min(1, e.speed / 3);
        billiardSound.play(e.type, e.type === "cue" ? k + 0.2 : k);
      }
      const s = sampleFrames(pb.shot.frames, t);
      if (s) return s;
    }
    return m ? restSamples(m.balls) : restSamples([]);
  }, []);

  // ---------- Gửi cú đánh ----------
  const myIndex = match && myUserId ? match.players.indexOf(myUserId) : -1;
  const isMyTurn =
    !!match && match.winner === null && myIndex >= 0 && match.turn === myIndex;
  const animating = !!playback;
  const canShoot =
    isMyTurn && !animating && !shooting && settledSeq === match?.seq;

  const shoot = useCallback(async (pullD?: number) => {
    const m = matchRef.current;
    if (!m || shooting) return;
    billiardSound.unlock();
    const cmd: Omit<ShotCommand, "cue"> & {
      shotId: string;
      expectedSeq: number;
    } = {
      dirX: aim.dirX,
      dirY: aim.dirY,
      power: powerCurve(pullD ?? aim.power, CAROM_POWER_EXP),
      tipX: aim.tipX,
      tipY: aim.tipY,
      elevation: aim.elevation,
      shotId: newShotId(),
      expectedSeq: m.seq,
    };
    // Kiểm tra cùng quy tắc với server (góc cơ 0–90°, không NaN...) trước khi gửi
    const invalid = validateShotInput(cmd);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setShooting(true);
    strokeRef.current = { t0: performance.now(), d: pullD ?? aim.power, aim: { ...aim }, cue: m.balls[m.turn] };
    // Cơ trở về vị trí đầu; tuỳ chọn tự đưa điểm chạm về tâm và góc cơ về mặc định sau mỗi cú
    setAimState((a) => ({ ...a, power: 0, ...(getShotSettings().resetAfterShot ? { tipX: 0, tipY: 0, elevation: DEFAULT_ELEVATION } : null) }));
    let res = await monoEmit("bida:shoot", cmd);
    // Mất kết nối giữa chừng -> gửi lại CÙNG shotId (server không xử lý 2 lần)
    if (!res.ok && res.error?.startsWith("Mất kết nối"))
      res = await monoEmit("bida:shoot", cmd);
    setShooting(false);
    if (!res.ok) toast.error(res.error ?? "Không đánh được, hãy thử lại");
  }, [aim, shooting]);

  // Cơ vướng bàn / băng / bi khác -> thả tay = huỷ, không đánh
  const aimGeom = useMemo(
    () => ({ dirX: aim.dirX, dirY: aim.dirY, tipX: aim.tipX, tipY: aim.tipY, elevation: aim.elevation }),
    [aim.dirX, aim.dirY, aim.tipX, aim.tipY, aim.elevation],
  );
  const clearance = useMemo<CueClearance | null>(() => {
    if (!match || !isMyTurn) return null;
    return checkCueClearance(
      match.balls,
      sanitizeShot({ ...aimGeom, power: 0.5 }, match.turn as BallId),
      DEFAULT_PHYSICS,
    );
  }, [match, isMyTurn, aimGeom]);
  const clearanceOk = useRef(true);
  useEffect(() => {
    clearanceOk.current = !clearance || clearance.ok;
  });
  const shot: ShotInput = useShotInput({
    enabled: canShoot,
    onPower: (d) => setAimState((a) => ({ ...a, power: d })),
    onShoot: (d) => void shoot(d),
    canRelease: () => {
      if (clearanceOk.current) return true;
      toast.error("Cơ đang vướng — hãy nâng góc cơ hoặc đổi hướng ngắm");
      return false;
    },
    onTick: (d) => billiardSound.play("pull", d),
    haptics: shotSettings.haptics,
  });

  // Đổi lượt -> âm báo nhẹ
  const turnKey = match ? `${match.startedAt}:${match.turn}` : "";
  useEffect(() => {
    if (turnKey && isMyTurn) billiardSound.play("turn");
  }, [turnKey, isMyTurn]);

  // Trận kết thúc
  const finished =
    match?.winner !== null && match?.winner !== undefined && !playback;
  useEffect(() => {
    if (finished) billiardSound.play("win");
  }, [finished]);

  const displayTurn = playback ? playback.shot.by : (match?.turn ?? 0);
  const displayScores = useMemo(() => {
    const scores = match?.scores ?? [];
    if (!playback?.shot.verdict.scored) return scores;
    return scores.map((v, i) => (i === playback.shot.by ? v - 1 : v));
  }, [match?.scores, playback]);

  const value = useMemo<BilliardGameContextType>(
    () => ({
      match,
      myIndex,
      isMyTurn,
      animating,
      canShoot,
      shooting,
      aim,
      setAim,
      shoot,
      shot,
      shotSettings,
      rotateAim,
      clearance,
      strokeRef,
      turnDeadlineLocal: (match?.turnDeadline ?? 0) - clockOffset,
      lastVerdict,
      prefs,
      setPrefs,
      sampleBalls,
      clockOffset,
      displayTurn,
      displayScores,
    }),
    [
      match,
      myIndex,
      isMyTurn,
      animating,
      canShoot,
      shooting,
      aim,
      setAim,
      shoot,
      shot,
      shotSettings,
      rotateAim,
      clearance,
      strokeRef,
      clockOffset,
      lastVerdict,
      prefs,
      setPrefs,
      sampleBalls,
      displayTurn,
      displayScores,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilliard() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBilliard phải dùng trong BilliardGameProvider");
  return c;
}

export type { BallId };
