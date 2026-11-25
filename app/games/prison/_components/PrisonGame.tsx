"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BarChart3,
  Map as MapIcon,
  Backpack,
  BookOpen,
  Swords,
  ClipboardList,
  DoorOpen,
  FastForward,
  Hammer,
  HelpCircle,
  LogOut,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import RotateDeviceOverlay from "../../monopoly/_components/ui/RotateDeviceOverlay";
import { getAudio } from "../_lib/audio/audioManager";
import { PRISON_CONFIG as C, ROLE_INFO, ROUTINE } from "../_lib/engine/config";
import { METHOD_NAMES } from "../_lib/engine/escape";
import { expectedDamage } from "../_lib/engine/combat";
import { ITEM_DEFS } from "../_lib/engine/items";
import { FLOOR } from "../_lib/engine/floor";
import type { PlayerAction } from "../_lib/engine/types";
import { PRISON_MAP, zoneAt, zoneName } from "../_lib/engine/map";
import {
  computePassFlags,
  nextPeriod,
  PERIOD_INFO,
  playerSolid,
} from "../_lib/engine/rules";
import { findPath } from "../_lib/engine/geometry";
import { gymMachineSpot } from "../_lib/engine/gym";
import {
  findInteraction,
  type HintAction,
  type Panel,
} from "../_lib/session/interaction";
import {
  playerColor,
  type ClientView,
  type Notice,
  type PrisonSession,
} from "../_lib/session/types";
import Panels, { ChallengeModal, LootPanel, useToastAct } from "./Panels";
import { GymOverlay, gymPressAndBuzz } from "./GymOverlay";
import PrisonScene, { SceneRuntime } from "./PrisonScene";
import { drawMinimap } from "./mapTexture";
import MapPopup from "./MapPopup";
import UI from "../_lib/engine/data/ui.json";
import { useGameAudio } from "./useGameAudio";

const KEYMAP: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function Bar({
  value,
  max,
  color,
  label,
  title,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <span className="w-4 text-center text-[11px]">{label}</span>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10 sm:w-28">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function Minimap({ view }: { view: ClientView }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = useMemo(
    () => (typeof document === "undefined" ? null : drawMinimap(3)),
    [],
  );
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !base) return;
    const g = cv.getContext("2d")!;
    g.drawImage(base, 0, 0);
    const s = 3;
    if (view.meta.intelRemaining > 0)
      for (const gd of view.guards) {
        g.fillStyle = gd.state === "CHASE" ? "#ef4444" : "#60a5fa";
        g.fillRect(gd.x * s - 2, gd.y * s - 2, 4, 4);
      }
    for (const p of view.players) {
      if (p.status === "ESCAPED") continue;
      // mặc đồ cai ngục: minimap vẽ màu cai ngục
      g.fillStyle =
        p.outfit === "guard" ? "#60a5fa" : playerColor(p.colorIndex);
      g.beginPath();
      g.arc(p.x * s, p.y * s, p.id === view.meId ? 3.2 : 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }, [view, base]);
  return (
    <canvas
      ref={ref}
      width={PRISON_MAP.width * 3}
      height={PRISON_MAP.height * 3}
      className="h-auto w-32 rounded-lg border border-white/10 [image-rendering:pixelated] sm:w-40"
    />
  );
}

function Joystick({ onMove }: { onMove: (dx: number, dy: number) => void }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 48;
  const end = () => {
    origin.current = null;
    setKnob(null);
    onMove(0, 0);
  };
  return (
    <div
      className="pointer-events-auto relative h-32 w-32 touch-none select-none rounded-full border border-white/15 bg-white/5"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          id: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (!o || o.id !== e.pointerId) return;
        let dx = e.clientX - o.x;
        let dy = e.clientY - o.y;
        const len = Math.hypot(dx, dy);
        if (len < 8) return onMove(0, 0); // ngưỡng nhỏ tránh chạm nhầm
        if (len > R) {
          dx = (dx / len) * R;
          dy = (dy / len) * R;
        }
        setKnob({ x: dx, y: dy });
        onMove(dx / R, dy / R);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-[#f4b942]/40"
        style={{
          transform: `translate(calc(-50% + ${knob?.x ?? 0}px), calc(-50% + ${knob?.y ?? 0}px))`,
        }}
      />
    </div>
  );
}

function EndScreen({ view, onExit }: { view: ClientView; onExit: () => void }) {
  const win = view.meta.outcome === "ALL_ESCAPED";
  const j = view.meta.journal;
  const count = (k: string) => j.filter((e) => e.kind === k).length;
  const method = view.meta.escape.method;
  const hh = `${String(view.clock.hour).padStart(2, "0")}:${String(view.clock.minute).padStart(2, "0")}`;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[#f4b942]/40 bg-[#11132a] p-6 shadow-2xl">
        <p className="text-center text-5xl">{win ? "🏆" : "⌛"}</p>
        <h2 className="mt-2 bg-linear-to-r from-[#ffd166] via-[#f4b942] to-[#ff6b4a] bg-clip-text text-center text-2xl font-extrabold text-transparent">
          {win ? "Vượt ngục thành công!" : "Hết thời gian"}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-300">
          {win
            ? `${view.mode === "multi" ? "Cả đội đã ra ngoài — không ai bị bỏ lại" : "Bạn đã trốn khỏi " + PRISON_MAP.name}${method ? ` bằng cách ${METHOD_NAMES[method]}` : ""}.`
            : `Đã quá ${view.meta.dayLimit} ngày mà chưa thoát được.`}{" "}
          Ngày {view.clock.day}, {hh}.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {(
            [
              ["Nhắc nhở", count("warning")],
              ["Bị phạt", count("penalty")],
              ["Vi phạm nặng", count("violation")],
              ["Bị khám ra", count("search")],
              ["Bị bắt", count("capture")],
              ["Đồ chế tạo", count("craft")],
            ] as const
          ).map(([k, n]) => (
            <div key={k} className="rounded-xl bg-white/[0.05] p-2">
              <p className="text-lg font-extrabold text-[#ffd166]">{n}</p>
              <p className="text-slate-400">{k}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-4 text-sm font-bold text-[#ffd166]">
          Nhật ký kế hoạch
        </h3>
        <div className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-300">
          {j.slice(-14).map((e) => (
            <p key={e.id}>
              <span className="text-slate-500">
                N{Math.floor(e.t / 1440) + 1}{" "}
                {String(Math.floor((e.t % 1440) / 60)).padStart(2, "0")}:
                {String(e.t % 60).padStart(2, "0")}
              </span>{" "}
              {e.text}
            </p>
          ))}
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {view.players.map((p) => (
            <p key={p.id}>
              <span style={{ color: playerColor(p.colorIndex) }}>●</span>{" "}
              {p.name} — {ROLE_INFO[p.role].name}, cấp {p.level}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="mt-5 w-full rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold shadow-[0_4px_0_#7f1118]"
        >
          Về sảnh
        </button>
      </div>
    </div>
  );
}

export interface PrisonGameProps {
  session: PrisonSession;
  title: string;
  onExit: () => void;
}

export default function PrisonGame({
  session,
  title,
  onExit,
}: PrisonGameProps) {
  const subscribe = useCallback(
    (fn: () => void) => session.subscribe(fn),
    [session],
  );
  const getView = useCallback(() => session.getView(), [session]);
  const view = useSyncExternalStore(subscribe, getView, getView);
  const [runtime] = useState(() => new SceneRuntime(session));
  const [panel, setPanelRaw] = useState<Panel | null>(null);
  const [panelTarget, setPanelTarget] = useState<string | null>(null);
  const [tradeTarget, setTradeTargetRaw] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  // phím Q: chạm = vứt, giữ = ném; giữ E = nhặt tất cả
  const slotRef = useRef<number | null>(null);
  const qDown = useRef<{ at: number; shift: boolean } | null>(null);
  const eHold = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);
  const [zoom, setZoom] = useState(1);
  const keys = useRef(new Set<string>());
  const stick = useRef({ dx: 0, dy: 0, sprint: false });
  const pad = useRef({ dx: 0, dy: 0, sprint: false });
  const act = useToastAct((a) => session.act(a));
  const me = view.players.find((p) => p.id === view.meId);
  useGameAudio(session, runtime);

  const setPanel = useCallback(
    (p: Panel | null, target: string | null = null) => {
      setPanelRaw(p);
      setPanelTarget(target);
    },
    [],
  );
  // gợi ý chữ (mặc định tắt — ui.json showHints); bật lại trong Cài đặt
  const [showHints, setShowHints] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("prison:showHints");
      return v === null ? UI.showHints : v === "1";
    } catch {
      return UI.showHints;
    }
  });
  useEffect(() => {
    const on = () => {
      try {
        setShowHints(localStorage.getItem("prison:showHints") === "1");
      } catch {
        /* bỏ qua */
      }
    };
    window.addEventListener("prison:hints", on);
    return () => window.removeEventListener("prison:hints", on);
  }, []);
  const togglePanel = useCallback(
    (p: Panel) => setPanelRaw((cur) => (cur === p ? null : p)),
    [],
  );
  const setTradeTarget = useCallback(
    (id: string | null) => {
      setTradeTargetRaw(id);
      setPanel(id ? "trade" : null);
    },
    [setPanel],
  );

  useEffect(
    () =>
      session.onNotice((n) => {
        setNotices((list) => [n, ...list].slice(0, UI.maxToasts));
        setTimeout(
          () => setNotices((list) => list.filter((x) => x.id !== n.id)),
          UI.toastSeconds * 1000,
        );
      }),
    [session],
  );
  // cảnh thức dậy ngắn (≤ 2 giây, bấm để bỏ qua) lúc bắt đầu và mỗi 08:00
  const [waking, setWaking] = useState(
    () =>
      session.getView().clock.minuteOfDay < 8 * 60 + 5 &&
      session.getView().clock.minuteOfDay >= 8 * 60,
  );
  // chơi một mình bị bắt: cảnh "ngủ qua đêm trong phòng biệt giam" rồi thức dậy
  const [soloNight, setSoloNight] = useState<{
    day: number;
    nights: number;
  } | null>(null);
  useEffect(
    () =>
      session.onEvent((e) => {
        if (e.type === "game:wake") setWaking(true);
        if (e.playerId !== session.getView().meId) return;
        if (e.type === "player:item-picked" || e.type === "player:item-dropped" || e.type === "player:item-thrown") buzz(12);
        if (e.type === "player:solo-night")
          setSoloNight({
            day: Number(e.data?.day ?? 0),
            nights: Number(e.data?.nights ?? 1),
          });
        // bị bắt mà có đồ bị tịch thu: mở bảng "Đã bị tịch thu"
        if (
          e.type === "player:captured" &&
          Number(e.data?.confiscated ?? 0) > 0
        ) {
          setPanelRaw("confiscated");
          setPanelTarget(null);
        }
      }),
    [session],
  );
  useEffect(() => {
    if (!soloNight) return;
    const t = setTimeout(() => setSoloNight(null), 3500);
    return () => clearTimeout(t);
  }, [soloNight]);
  useEffect(() => {
    if (!waking) return;
    const t = setTimeout(() => setWaking(false), 2000);
    return () => clearTimeout(t);
  }, [waking]);
  useEffect(() => {
    const t = setInterval(
      () => setNotices((l) => l.filter((n) => Date.now() - n.at < 9000)),
      1000,
    );
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    runtime.setZoom(zoom);
  }, [runtime, zoom]);

  const pushInput = useCallback(() => {
    // đang trên máy tập: phím trái/phải là nhịp tập, nhân vật đứng yên
    if (session.getView().me?.gym) return session.setInput(0, 0, false);
    let dx = stick.current.dx + pad.current.dx;
    let dy = stick.current.dy + pad.current.dy;
    for (const k of keys.current) {
      const v = KEYMAP[k];
      if (v) {
        dx += v[0];
        dy += v[1];
      }
    }
    const sprint =
      keys.current.has("ShiftLeft") ||
      keys.current.has("ShiftRight") ||
      stick.current.sprint ||
      pad.current.sprint;
    session.setInput(
      Math.max(-1, Math.min(1, dx)),
      Math.max(-1, Math.min(1, dy)),
      sprint,
    );
  }, [session]);

  // ---- gym: bấm vào máy là tập (ở xa thì tự đi tới máy rồi tập)
  const walkRef = useRef<{
    path: { x: number; y: number }[];
    then: () => void;
  } | null>(null);
  const pickMachine = useCallback(
    (mid: string) => {
      const v = session.getView();
      const mePub = v.players.find((p) => p.id === v.meId);
      if (!mePub || !v.me) return;
      if (v.me.gym?.machineId === mid) return void act({ type: "gymStop" });
      const m = v.meta.gym.machines.find((x) => x.id === mid);
      if (!m) return;
      if (m.occupantId && m.occupantId !== v.meId)
        return void toast("Máy đang bận", { duration: 1200 });
      const spot = gymMachineSpot(m.kind, m.index, v.meta.gym.perKind);
      if (
        zoneAt(PRISON_MAP, mePub.x, mePub.y) === "gym" &&
        Math.hypot(spot.x - mePub.x, spot.y - mePub.y) < 2.5
      )
        return void act({ type: "gymStart", machineId: mid });
      const e = v.meta.escape.status;
      const inv = v.me.inventory;
      const solid = playerSolid(
        computePassFlags({
          ventOpen: v.meta.routes.ventOpen,
          fenceGaps: v.meta.routes.fenceGaps,
          escapeActive: e === "EXECUTING" || e === "RESCUE_REQUIRED",
          minuteOfDay: v.clock.minuteOfDay,
          has: (id) => inv.some((i) => i.itemId === id),
          disguised: mePub.disguised,
          doorsLocked: v.meta.doorsLocked,
          holes: Object.keys(v.meta.dig?.holes ?? {}),
          tunnels: Object.keys(v.meta.dig?.tunnels ?? {}),
          underground: mePub.underground,
        }),
      );
      const path = findPath(PRISON_MAP, (x, y) => !solid(x, y), mePub, spot);
      if (!path)
        return void toast("Không tìm được đường tới máy", { duration: 1200 });
      walkRef.current = {
        path,
        then: () => void act({ type: "gymStart", machineId: mid }),
      };
    },
    [session, act],
  );
  useEffect(() => {
    const id = setInterval(() => {
      const w = walkRef.current;
      if (!w) return;
      // người chơi tự bấm di chuyển: huỷ tự đi
      if (keys.current.size || stick.current.dx || stick.current.dy) {
        walkRef.current = null;
        return;
      }
      const v = session.getView();
      const mePub = v.players.find((p) => p.id === v.meId);
      if (!mePub || mePub.status !== "ACTIVE") {
        walkRef.current = null;
        return session.setInput(0, 0, false);
      }
      while (
        w.path.length &&
        Math.hypot(w.path[0].x - mePub.x, w.path[0].y - mePub.y) < 0.3
      )
        w.path.shift();
      const wp = w.path[0];
      if (!wp) {
        walkRef.current = null;
        session.setInput(0, 0, false);
        w.then();
        return;
      }
      const dx = wp.x - mePub.x;
      const dy = wp.y - mePub.y;
      const d = Math.hypot(dx, dy) || 1;
      session.setInput(dx / d, dy / d, false);
    }, 50);
    return () => clearInterval(id);
  }, [session]);

  const hint = me ? findInteraction(view, me) : null;
  // số phút game tới chuông điểm danh (trong khoảng cảnh báo), null nếu không
  const rollcallIn = (() => {
    const md = view.totalGameMinutes % 1440;
    for (const p of ROUTINE.periods)
      if ((C.rollcall.periods as string[]).includes(p.id)) {
        const d = p.startMinute - md;
        if (d > 0 && d <= C.rollcall.warningMinutes) return d;
      }
    return null;
  })();

  // ---- đánh nhau: giữ phím để đánh liên tục (server vẫn áp hồi chiêu), R đổi vũ khí
  const attackTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const attackOnce = useCallback(async () => {
    const res = await session.act({ type: "attack" });
    if (!res.ok && res.code !== "RATE_LIMITED" && res.code !== "INVALID_STATE")
      toast.error(res.message);
  }, [session]);
  const startAttack = useCallback(() => {
    getAudio().unlock();
    void attackOnce();
    if (attackTimer.current) return;
    attackTimer.current = setInterval(() => void attackOnce(), 120);
  }, [attackOnce]);
  const stopAttack = useCallback(() => {
    if (attackTimer.current) clearInterval(attackTimer.current);
    attackTimer.current = null;
  }, []);
  useEffect(() => stopAttack, [stopAttack]);

  /** R: rút / cất vũ khí đang mang trong ô vũ khí */
  const cycleWeapon = useCallback(() => {
    const v = session.getView();
    const mine = v.players.find((p) => p.id === v.meId);
    if (!v.me || !mine) return;
    const w = v.me.gear.weapon;
    if (!w)
      return void toast(
        "Ô vũ khí trống — chế tạo (C), nhặt hoặc lục soát dùi cui của cai ngục bị ngất",
      );
    void act({ type: "equip", itemId: mine.weaponDrawn ? null : w.itemId });
  }, [session, act]);

  const runHint = useCallback(
    async (action: HintAction, disabledReason?: string) => {
      if (disabledReason) {
        toast.error(disabledReason);
        getAudio().play("error");
        return;
      }
      if (action.type === "openPanel") {
        setPanel(action.panel, action.targetId ?? null);
        return;
      }
      const res = await session.act(action);
      if (!res.ok) {
        toast.error(res.message);
        getAudio().play("error");
      } else if (action.type === "bribe")
        toast(
          res.data?.reported
            ? "Bị tố cáo hối lộ!"
            : `Đã mua chuộc (${res.data?.cost}$)`,
        );
    },
    [session, setPanel],
  );

  const doInteract = useCallback(() => {
    const v = session.getView();
    const m = v.players.find((p) => p.id === v.meId);
    if (!m) return;
    const h = findInteraction(v, m);
    if (h) void runHint(h.action, h.disabledReason);
  }, [session, runHint]);

  const pressSlot = useCallback(
    (i: number) => {
      const v = session.getView();
      // đang bị cai ngục hỏi: phím số là chọn câu trả lời
      if (v.me?.challenge) {
        if (i < v.me.challenge.options.length)
          void act({ type: "answerChallenge", choice: i });
        return;
      }
      const it = v.me?.inventory[i];
      setSlot(i);
      if (!it) return;
      const def = ITEM_DEFS[it.itemId];
      if (slot === i && def.slotType === "outfit")
        void act({ type: "wear", index: i });
      else if (slot === i && def.type === "usable")
        void act({ type: "useItem", itemId: it.itemId });
      else
        toast(`${def.glyph} ${def.name}: ${def.description}`, {
          duration: 2500,
        });
    },
    [session, slot, act],
  );

  /** Vứt 1 món / cả chồng ra ô trước mặt, hoặc ném theo hướng đang nhìn — món ở ô đang chọn */
  const dropOrThrow = useCallback(
    (how: "one" | "stack" | "throw") => {
      const v = session.getView();
      const i = slotRef.current;
      const it = i === null ? undefined : v.me?.inventory[i];
      if (!it) {
        buzz(40);
        toast("Chọn một ô túi (phím 1–6) trước khi vứt", { duration: 1800 });
        return;
      }
      const a: PlayerAction =
        how === "throw"
          ? { type: "throwItem", itemId: it.itemId, dirX: 0, dirY: 0 }
          : { type: "dropItem", itemId: it.itemId, quantity: how === "stack" ? it.quantity : 1 };
      void act(a);
    },
    [session, act],
  );

  // bàn phím
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      // máy tập: ← / A = trái, → / D = phải (không giữ phím để lặp), X / Esc = Nghỉ
      if (session.getView().me?.gym) {
        const side =
          e.code === "ArrowLeft" || e.code === "KeyA"
            ? 0
            : e.code === "ArrowRight" || e.code === "KeyD"
              ? 1
              : null;
        if (side !== null) {
          e.preventDefault();
          if (!e.repeat) void gymPressAndBuzz(session, side);
          return;
        }
        if (e.code === "KeyX" || e.code === "Escape") {
          e.preventDefault();
          void session.act({ type: "gymStop" });
          return;
        }
        if (e.code === "ArrowUp" || e.code === "ArrowDown") return;
      }
      if (KEYMAP[e.code] || e.code.startsWith("Shift")) {
        e.preventDefault();
        keys.current.add(e.code);
        pushInput();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyA") {
        e.preventDefault();
        startAttack();
        return;
      }
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit) return pressSlot(Number(digit[1]) - 1);
      if (e.code === "KeyQ") {
        e.preventDefault();
        qDown.current = { at: Date.now(), shift: e.shiftKey };
        return;
      }
      // đang tập: lên / xuống hoặc Esc = rời máy
      if (
        session.getView().me?.gym &&
        ["KeyW", "KeyS", "ArrowUp", "ArrowDown", "Escape"].includes(e.code)
      ) {
        void act({ type: "gymStop" });
        if (e.code !== "Escape") return;
      }
      switch (e.code) {
        case "KeyE":
          e.preventDefault();
          doInteract();
          // giữ E: nhặt hết đồ quanh chân (gần -> xa) tới khi đầy túi
          if (eHold.current) clearTimeout(eHold.current);
          eHold.current = setTimeout(() => {
            eHold.current = null;
            if (session.getView().meta.floorItems.length) void session.act({ type: "pickupAll" }).then((r) => !r.ok && r.code === "OVER_CAPACITY" && buzz(40));
          }, FLOOR.pickupAllHoldMs);
          break;
        case "Space":
          e.preventDefault();
          if (session.setPaused) session.setPaused(!session.getView().paused);
          else doInteract();
          break;
        case "Tab":
          e.preventDefault();
          togglePanel("journal");
          break;
        case "KeyI":
          togglePanel("inventory");
          break;
        case "KeyC":
          togglePanel("stats");
          break;
        case "KeyM":
          togglePanel("map");
          break;
        case "KeyF":
          togglePanel("craft");
          break;
        case "KeyJ":
          togglePanel("quests");
          break;
        case "KeyT":
          togglePanel("team");
          break;
        case "KeyP":
          togglePanel("escape");
          break;
        case "KeyH":
          togglePanel("help");
          break;
        case "KeyX":
          void act({ type: "cancelChannel" });
          break;
        case "KeyR":
          cycleWeapon();
          break;
        case "Equal":
          setZoom((z) => Math.min(2, z + 0.15));
          break;
        case "Minus":
          setZoom((z) => Math.max(0.6, z - 0.15));
          break;
        case "Escape":
          setPanel(null);
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.code === "KeyE" && eHold.current) {
        clearTimeout(eHold.current);
        eHold.current = null;
      }
      if (e.code === "KeyQ" && qDown.current) {
        const q = qDown.current;
        qDown.current = null;
        dropOrThrow(Date.now() - q.at >= FLOOR.pickupAllHoldMs ? "throw" : q.shift || e.shiftKey ? "stack" : "one");
      }
      if (e.code === "KeyA") stopAttack();
      pushInput();
    };
    const blur = () => {
      keys.current.clear();
      stopAttack();
      pushInput();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [
    pushInput,
    doInteract,
    act,
    session,
    togglePanel,
    setPanel,
    pressSlot,
    startAttack,
    stopAttack,
    cycleWeapon,
    dropOrThrow,
  ]);

  // tay cầm (Gamepad API): cần trái di chuyển, A tương tác, B đóng, X túi đồ, Y nhật ký, RB chạy, Start tạm dừng
  useEffect(() => {
    let raf = 0;
    let lastPadAttack = 0;
    const prev: boolean[] = [];
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const gp =
        typeof navigator !== "undefined" && navigator.getGamepads
          ? navigator.getGamepads()[0]
          : null;
      if (!gp) return;
      const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
      const dx = dz(gp.axes[0] ?? 0);
      const dy = dz(gp.axes[1] ?? 0);
      const sprint = !!gp.buttons[5]?.pressed || !!gp.buttons[7]?.pressed;
      if (
        dx !== pad.current.dx ||
        dy !== pad.current.dy ||
        sprint !== pad.current.sprint
      ) {
        pad.current = { dx, dy, sprint };
        pushInput();
      }
      const edge = (i: number) => {
        const now = !!gp.buttons[i]?.pressed;
        const was = prev[i];
        prev[i] = now;
        return now && !was;
      };
      if (gp.buttons[4]?.pressed && performance.now() - lastPadAttack > 130) {
        lastPadAttack = performance.now();
        void attackOnce();
      }
      if (edge(6)) cycleWeapon();
      if (edge(0)) {
        getAudio().unlock();
        doInteract();
      }
      if (edge(1)) setPanel(null);
      if (edge(2)) togglePanel("inventory");
      if (edge(3)) togglePanel("journal");
      if (edge(9) && session.setPaused)
        session.setPaused(!session.getView().paused);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [
    pushInput,
    doInteract,
    setPanel,
    togglePanel,
    session,
    attackOnce,
    cycleWeapon,
  ]);

  const clockText = `${String(view.clock.hour).padStart(2, "0")}:${String(view.clock.minute).padStart(2, "0")}`;
  const period = PERIOD_INFO[view.clock.period];
  const next = nextPeriod(view.clock.minuteOfDay);
  const bellSoon = next.inMinutes <= ROUTINE.bellBeforeMinutes;
  const zone = me ? zoneName(zoneAt(PRISON_MAP, me.x, me.y)) : "";
  const ended = !!view.meta.outcome;
  const toneCls: Record<Notice["tone"], string> = {
    info: "border-white/10 text-slate-200",
    good: "border-emerald-400/40 text-emerald-200",
    warn: "border-amber-400/40 text-amber-200",
    danger: "border-red-500/50 text-red-200",
  };
  const iconBtn =
    "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#11132a]/85 text-slate-200 transition hover:border-[#f4b942]/50 hover:text-[#ffd166] active:scale-95";
  const channelText: Record<string, string> = {
    openVent: "Đang cậy lưới thông gió…",
    attachRope: "Đang buộc dây leo lên rào…",
    cutFence: "Đang cắt hàng rào…",
    board: "Đang trèo lên xe…",
    blackout: "Đang gắn thiết bị phá điện…",
    revive: "Đang hồi sinh…",
    rescue: "Đang phá khóa biệt giam…",
    craft: "Đang chế tạo…",
    hide: "Đang giấu đồ…",
    flush: "Đang xả đất…",
    dig: "Đang đào hầm…",
    support: "Đang chống hầm…",
    cover: "Đang che miệng hầm…",
    work: "Đang làm việc…",
    sleep: "Đang nằm nghỉ… (di chuyển để dậy)",
    gym: "Đang tập gym…",
    shower: "Đang tắm…",
    cameraPanel: "Đang tắt camera…",
    loot: "Đang mở túi người bị ngất…",
    read: "Đang đọc sách…",
    lootTake: "Đang lấy đồ…",
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0b0d16] text-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <PrisonScene
        runtime={runtime}
        view={view}
        highlight={hint?.tile ?? null}
        onPickMachine={pickMachine}
      />
      <RotateDeviceOverlay />

      {/* Thanh trên: đồng hồ & lịch */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start gap-2 p-2 sm:p-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onExit}
          className={iconBtn}
          aria-label="Thoát"
          title="Thoát"
        >
          <LogOut className="h-5 w-5 rotate-180" />
        </button>
        {/* chế độ chơi */}
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#11132a]/85 px-3 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Chế độ
          </p>
          <p className="text-sm font-extrabold">{title}</p>
          {view.meta.dayLimit !== null && (
            <p className="text-[10px] text-slate-400">
              còn {Math.max(0, view.meta.dayLimit - view.clock.day + 1)} ngày
            </p>
          )}
        </div>
        {/* ngày & giờ */}
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#11132a]/85 px-3 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Ngày {view.clock.day}
          </p>
          <p className="text-lg font-extrabold leading-tight text-[#ffd166] tabular-nums">
            {clockText}
          </p>
        </div>
        {/* nhiệm vụ theo lịch hiện tại + chuông kế tiếp */}
        <div className="pointer-events-auto max-w-[min(60vw,260px)] rounded-2xl border border-white/10 bg-[#11132a]/85 px-3 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Nhiệm vụ
          </p>
          <p className="text-sm font-extrabold">{period?.name}</p>
          <p className="text-[10px] text-slate-400">{period?.rule}</p>
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#11132a]/85 px-3 py-1.5">
          <p className="text-[10px] uppercase text-slate-400">Báo động trại</p>
          <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-400 to-red-600"
              style={{ width: `${view.teamHeat}%` }}
            />
          </div>
          {view.meta.prisonState === "LOCKDOWN" && (
            <p className="mt-0.5 animate-pulse text-[11px] font-bold text-red-400">
              🔒 PHONG TỎA {Math.ceil(view.meta.lockdownRemaining ?? 0)}s
            </p>
          )}
          {view.meta.camerasOffRemaining > 0 && (
            <p className="mt-0.5 text-[11px] text-sky-300">
              📴 Camera tắt {Math.ceil(view.meta.camerasOffRemaining)}s
            </p>
          )}
          {view.meta.doorsLocked && (
            <p className="mt-0.5 animate-pulse text-[11px] font-bold text-red-400">
              🚪 Cửa khu bị phong toả
            </p>
          )}
          {view.meta.nightRollcallRemaining > 0 && (
            <p className="mt-0.5 text-[11px] font-bold text-amber-300">
              📢 Điểm danh đêm {Math.ceil(view.meta.nightRollcallRemaining)}s
            </p>
          )}
        </div>
        {view.connection !== "online" && (
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200">
            <WifiOff className="h-4 w-4" /> Đang kết nối lại…
          </div>
        )}
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          {session.setSpeed && (
            <button
              type="button"
              className={`${iconBtn} w-auto! px-2 text-xs font-bold`}
              title="Tốc độ thời gian"
              onClick={() =>
                session.setSpeed?.(
                  view.speed >= 4 ? 1 : view.speed >= 2 ? 4 : 2,
                )
              }
            >
              <FastForward className="mr-1 h-4 w-4" />×{view.speed}
            </button>
          )}
          {session.setPaused && (
            <button
              type="button"
              className={iconBtn}
              title={view.paused ? "Tiếp tục (Space)" : "Tạm dừng (Space)"}
              onClick={() => session.setPaused?.(!view.paused)}
            >
              {view.paused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </button>
          )}
          {session.save && (
            <button
              type="button"
              className={`${iconBtn} max-sm:hidden`}
              title="Lưu nhanh (ô tự động)"
              onClick={() =>
                void session
                  .save?.("auto")
                  .then((ok) =>
                    ok
                      ? toast.success("Đã lưu ván")
                      : toast.error("Không lưu được"),
                  )
              }
            >
              <Save className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            className={`${iconBtn} max-sm:hidden`}
            title="Thu nhỏ (-)"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
          >
            <Minus className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={`${iconBtn} max-sm:hidden`}
            title="Phóng to (+)"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={iconBtn}
            title="Âm thanh"
            onClick={() => togglePanel("settings")}
          >
            <Settings2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={iconBtn}
            title="Cách chơi (H)"
            onClick={() => togglePanel("help")}
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* HUD tối giản: sức khoẻ, thể lực, đói (chỉ số chi tiết: phím C; bản đồ: phím M) */}
      {me && (
        <div className="pointer-events-none absolute left-2 top-[118px] z-10 space-y-2 sm:left-3 sm:top-28">
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#11132a]/85 p-2.5">
            {/* mức truy nã luôn hiển thị (0–3 sao); máu của mình vẽ trên đầu nhân vật */}
            <p
              className={`mb-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${me.wanted > 0 ? "animate-pulse bg-red-600/30 text-red-200" : "bg-white/5 text-slate-400"}`}
              title="Mức truy nã — không để cai ngục thấy một lúc để giảm dần"
            >
              {me.wanted > 0 ? "🚨 TRUY NÃ" : "Truy nã"}{" "}
              <span className="text-yellow-300">{"★".repeat(me.wanted)}</span>
              <span
                className={me.wanted > 0 ? "text-red-200/40" : "text-slate-600"}
              >
                {"★".repeat(3 - me.wanted)}
              </span>
            </p>
            <div
              className={
                me.energy < C.stamina.lowThreshold ? "animate-pulse" : ""
              }
            >
              <Bar
                label="⚡"
                title={`Thể lực ${Math.round(me.energy)}/${me.maxEnergy}${me.energy < C.stamina.lowThreshold ? " — thấp, đi chậm 15%" : ""}`}
                value={me.energy}
                max={me.maxEnergy}
                color={
                  me.energy < C.stamina.lowThreshold ? "#ef4444" : "#38bdf8"
                }
              />
            </div>
            <Bar
              label="🍞"
              title="Đói (đầy = đói lả)"
              value={me.hunger}
              max={100}
              color={me.hunger >= C.needs.slowThreshold ? "#ef4444" : "#a3e635"}
            />
            <Bar
              label="🔥"
              title="Độ nghi ngờ"
              value={me.heat}
              max={100}
              color="#ef4444"
            />
            {(view.me?.inventory.length ?? 0) >= (view.me?.maxSlots ?? 6) && (
              <p className="mt-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200" title="Túi chính đã đầy — vứt (Q) hoặc cất bớt đồ để nhặt thêm">
                🎒 Túi đầy
              </p>
            )}
            {me.disguised && (
              <p
                className="mt-1 rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-200"
                title="Đang mặc bộ đồ cai ngục: cai ngục coi bạn là đồng nghiệp. Chỉ bị lộ khi bị thấy phạm tội."
              >
                🧥 Cải trang cai ngục
              </p>
            )}
            {!me.outfit && (
              <p className="mt-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">
                🩲 Chỉ mặc đồ lót
              </p>
            )}
          </div>
          {/* chỉ khi có tin tình báo (sơ đồ chép tay / đồng đội báo): bản đồ nhỏ hiện vị trí cai ngục */}
          {view.meta.intelRemaining > 0 && (
            <div className="pointer-events-auto">
              <Minimap view={view} />
              <p className="mt-0.5 text-[10px] text-sky-300">
                📡 Thấy vị trí cai ngục · {Math.ceil(view.meta.intelRemaining)}s
              </p>
            </div>
          )}
        </div>
      )}

      {view.mode === "multi" && (
        <div className="pointer-events-none absolute right-2 top-[230px] z-10 w-44 space-y-1.5 max-sm:hidden sm:right-3 sm:top-[220px]">
          {view.players
            .filter((p) => p.id !== view.meId)
            .map((p) => (
              <div
                key={p.id}
                className="pointer-events-auto rounded-xl border border-white/10 bg-[#11132a]/85 px-2.5 py-1.5 text-xs"
              >
                <p className="flex items-center gap-1.5 font-bold">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: playerColor(p.colorIndex) }}
                  />
                  <span className="truncate">{p.name}</span>
                  {!p.connected && (
                    <WifiOff className="h-3 w-3 text-slate-400" />
                  )}
                </p>
                <p
                  className={
                    p.status === "ACTIVE"
                      ? "text-slate-400"
                      : p.status === "ESCAPED"
                        ? "text-emerald-300"
                        : "text-red-300"
                  }
                >
                  {p.status === "ACTIVE"
                    ? zoneName(zoneAt(PRISON_MAP, p.x, p.y))
                    : p.status === "KNOCKED_OUT"
                      ? `💫 Hạ gục · ${Math.ceil(p.knockoutRemaining ?? 0)}s`
                      : p.status === "CAPTURED"
                        ? `⛓️ Biệt giam · ${Math.ceil(p.solitaryRemaining ?? 0)}s`
                        : "🌄 Đã thoát"}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Thông báo nổi */}
      <div className="pointer-events-none absolute right-2 top-[118px] z-10 w-[min(70vw,280px)] space-y-1 sm:right-3 sm:top-24">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`rounded-lg border bg-[#0b0d16]/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${toneCls[n.tone]}`}
          >
            {n.text}
          </div>
        ))}
      </div>

      {me && me.status !== "ACTIVE" && !ended && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center">
          <p className="inline-block rounded-2xl bg-black/60 px-5 py-3 text-lg font-extrabold">
            {me.status === "KNOCKED_OUT" &&
              `💫 Bạn bị hạ gục — chờ đồng đội hồi sinh (${Math.ceil(me.knockoutRemaining ?? 0)}s)`}
            {me.status === "CAPTURED" &&
              `⛓️ Biệt giam — mãn hạn sau ${Math.ceil(me.solitaryRemaining ?? 0)}s${view.mode === "single" ? " (thời gian tua nhanh)" : " hoặc chờ đồng đội giải cứu"}`}
            {me.status === "ESCAPED" &&
              "🌄 Bạn đã ra ngoài! Hỗ trợ đồng đội (T → Báo vị trí lính gác)"}
          </p>
        </div>
      )}
      {view.paused && !ended && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/55">
          <button
            type="button"
            className="rounded-2xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-8 py-4 text-xl font-extrabold shadow-[0_4px_0_#7f1118]"
            onClick={() => session.setPaused?.(false)}
          >
            ▶ Tiếp tục
          </button>
          {session.save && (
            <div className="flex gap-2">
              {(["slot1", "slot2", "slot3"] as const).map((slotId, i) => (
                <button
                  key={slotId}
                  type="button"
                  className="rounded-xl border border-[#f4b942]/40 bg-[#f4b942]/10 px-4 py-3 text-sm font-bold text-[#ffd166]"
                  onClick={() =>
                    void session
                      .save?.(slotId)
                      .then((ok) =>
                        ok
                          ? toast.success(`Đã lưu vào ô ${i + 1}`)
                          : toast.error("Không lưu được"),
                      )
                  }
                >
                  💾 Lưu ô {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {me?.channel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-44 z-10 flex justify-center sm:bottom-32">
          <div className="w-64 rounded-xl bg-black/70 p-2 text-center text-xs font-bold">
            {channelText[me.channel.kind]}{" "}
            {showHints && (
              <span className="text-slate-400">
                {me.channel.kind !== "sleep" && "(di chuyển / X để huỷ)"}
              </span>
            )}
            {me.channel.kind !== "sleep" && (
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${me.channel.progress * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gợi ý tương tác + hotbar 9 ô */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-2 sm:p-3"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* mặc định không có chữ hướng dẫn giữa màn hình: vật gần nhất có viền sáng, bấm E; lựa chọn khác là chip nhỏ ở góc phải */}
        {hint && !me?.channel && !showHints && (
          <div className="pointer-events-none flex w-full flex-wrap justify-end gap-1 pr-1">
            {[hint, ...hint.options].map((o) => (
              <button
                key={o.label}
                type="button"
                title={o.disabledReason ?? o.label}
                onClick={() => void runHint(o.action, o.disabledReason)}
                className={`pointer-events-auto rounded-lg border px-2 py-1 text-[11px] font-semibold ${o.disabledReason ? "border-white/10 bg-black/50 text-slate-500" : o === hint ? "border-[#f4b942]/40 bg-black/50 text-[#ffd166]" : "border-white/10 bg-black/50 text-slate-300"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {hint && !me?.channel && showHints && (
          <div className="flex max-w-full flex-wrap justify-center gap-1.5">
            <button
              type="button"
              onClick={() => void runHint(hint.action, hint.disabledReason)}
              className={`pointer-events-auto rounded-xl border px-4 py-2 text-sm font-bold ${hint.disabledReason ? "border-white/10 bg-black/60 text-slate-400" : "border-[#f4b942]/50 bg-[#f4b942]/15 text-[#ffd166]"}`}
            >
              <span className="mr-2 rounded bg-white/15 px-1.5 max-sm:hidden">
                E
              </span>
              {hint.label}
              {hint.disabledReason && ` — ${hint.disabledReason}`}
            </button>
            {hint.options.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => void runHint(o.action, o.disabledReason)}
                className="pointer-events-auto rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#11132a]/85 p-1.5">
          {Array.from(
            { length: view.me?.maxSlots ?? 9 },
            (_, i) => view.me?.inventory[i],
          ).map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pressSlot(i)}
              title={
                it
                  ? `${ITEM_DEFS[it.itemId].name} (phím ${i + 1})`
                  : `Ô ${i + 1}`
              }
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl ${slot === i ? "bg-[#f4b942]/25 ring-1 ring-[#f4b942]" : "bg-white/5"} ${it && ITEM_DEFS[it.itemId].contraband ? "shadow-[inset_0_-3px_0_rgba(200,29,37,0.6)]" : ""}`}
            >
              {it && ITEM_DEFS[it.itemId].glyph}
              {it && it.quantity > 1 && (
                <span className="absolute bottom-0 right-1 text-[10px] font-bold">
                  {it.quantity}
                </span>
              )}
              <span className="absolute left-1 top-0 text-[9px] text-slate-500">
                {i + 1}
              </span>
            </button>
          ))}
          <div className="mx-1 w-px bg-white/10" />
          {view.me &&
            (
              [
                ["weapon", "🗡️", "Ô vũ khí (R rút/cất)"],
                ["outfit", "🩲", "Bộ đồ"],
              ] as const
            ).map(([k, ghostGlyph, label]) => {
              const g = view.me!.gear[k];
              const drawn = k === "weapon" && !!g && me?.weaponDrawn;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={
                    k === "weapon"
                      ? cycleWeapon
                      : () => togglePanel("inventory")
                  }
                  title={
                    g
                      ? `${label}: ${ITEM_DEFS[g.itemId].name}${g.owner ? ` · ${g.owner}` : ""}`
                      : `${label} (trống)`
                  }
                  className={`relative flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed text-lg ${drawn ? "border-orange-400 bg-orange-500/20" : "border-white/15 bg-black/20"}`}
                >
                  {g ? (
                    ITEM_DEFS[g.itemId].glyph
                  ) : (
                    <span className="opacity-25 grayscale">{ghostGlyph}</span>
                  )}
                  {k === "weapon" && (
                    <span className="absolute left-1 top-0 text-[9px] text-slate-500">
                      R
                    </span>
                  )}
                </button>
              );
            })}
          <div className="mx-1 w-px bg-white/10" />
          {(
            [
              ["inventory", Backpack, "Túi đồ", "I"],
              ["craft", Hammer, "Chế tạo", "F"],
              ["stats", BarChart3, "Chỉ số", "C"],
              ["map", MapIcon, "Bản đồ", "M"],
              ["quests", ClipboardList, "Nhiệm vụ", "J"],
              ["journal", BookOpen, "Nhật ký", "Tab"],
              ["team", Users, "Đồng đội", "T"],
              ["escape", DoorOpen, "Đào tẩu", "P"],
            ] as const
          ).map(([p, Icon, label, key]) => (
            <button
              key={p}
              type="button"
              title={`${label} (${key})`}
              aria-label={`${label}, phím ${key}`}
              onClick={() => togglePanel(p)}
              className={`relative flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg ${panel === p ? "bg-[#f4b942]/25 text-[#ffd166]" : "bg-white/5 text-slate-300 hover:text-white"}`}
            >
              <Icon className="h-5 w-5" />
              <span
                className={`rounded px-1 text-[9px] font-extrabold leading-3 [@media(hover:none)]:hidden ${panel === p ? "bg-[#ffd166] text-[#11132a]" : "bg-white/15 text-slate-200"}`}
              >
                {key}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Điều khiển cảm ứng (vùng chạm ≥ 48 px) */}
      <div className="pointer-events-none absolute bottom-28 left-3 z-10 [@media(hover:hover)]:hidden">
        <Joystick
          onMove={(dx, dy) => {
            stick.current.dx = dx;
            stick.current.dy = dy;
            stick.current.sprint = Math.hypot(dx, dy) > 0.95;
            pushInput();
          }}
        />
      </div>
      <div className="pointer-events-none absolute bottom-32 right-3 z-10 flex flex-col items-center gap-2 [@media(hover:hover)]:hidden">
        <button
          type="button"
          aria-label="Đánh"
          onPointerDown={startAttack}
          onPointerUp={stopAttack}
          onPointerLeave={stopAttack}
          onPointerCancel={stopAttack}
          className="pointer-events-auto flex h-16 w-16 touch-none items-center justify-center rounded-full bg-[#c81d25]/40 text-[#ffb4a8] active:scale-95"
        >
          <Swords className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={doInteract}
          className="pointer-events-auto h-16 w-16 rounded-full bg-[#f4b942]/30 text-lg font-extrabold text-[#ffd166] active:scale-95"
        >
          E
        </button>
      </div>

      <Panels
        panel={panel}
        panelTarget={panelTarget}
        view={view}
        act={act}
        onClose={() => setPanel(null)}
        tradeTarget={tradeTarget}
        setTradeTarget={setTradeTarget}
      />
      <LootPanel view={view} act={act} />
      {/* Popup chỉ số (phím C) — chỉ hiện khi bấm, bấm lại / Esc / chạm ra ngoài để đóng */}
      {panel === "stats" && me && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setPanel(null)}
        >
          <div
            className="w-[min(92vw,380px)] space-y-1 rounded-2xl border border-white/10 bg-[#11132a]/95 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="mb-1 text-xs font-bold"
              style={{ color: playerColor(me.colorIndex) }}
            >
              {me.name} · {ROLE_INFO[me.role].name} · Cấp {me.level}{" "}
              {me.disguised && "🧥"}
            </p>
            <Bar
              label="❤"
              title="Sức khoẻ"
              value={me.health}
              max={me.maxHealth}
              color="#f43f5e"
            />
            <Bar
              label="⚡"
              title="Thể lực"
              value={me.energy}
              max={me.maxEnergy}
              color="#38bdf8"
            />
            {view.me && (
              <Bar
                label="🧠"
                title={`Thông minh ${view.me.stats.intelligence}/50 — đọc sách ở thư viện; mỗi 08:00 −2`}
                value={view.me.stats.intelligence}
                max={50}
                color="#c084fc"
              />
            )}
            <p className="mt-1 text-[11px] text-slate-300">
              💰 {view.me?.money ?? 0}$ · 🧠 {view.me?.stats.intelligence ?? 0}
              /50 · 📍 {zone}
            </p>
            {view.me && (
              <p className="text-[11px] text-slate-300">
                💪 Sức mạnh {view.me.stats.strength} · 🏃 Nhanh nhẹn{" "}
                {view.me.stats.agility} · 🛡️ Uy tín cai ngục{" "}
                {view.me.reputation.guards} · tù nhân{" "}
                {view.me.reputation.inmates}
              </p>
            )}
            {view.me && (
              <button
                type="button"
                onClick={cycleWeapon}
                title="Phím A: đánh · phím R: rút/cất vũ khí"
                className="mt-1.5 flex w-full items-center gap-2 rounded-lg bg-white/[0.06] px-2 py-1 text-left hover:bg-white/10"
              >
                <span className="text-xl">
                  {me.weapon ? ITEM_DEFS[me.weapon].glyph : "👊"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold">
                    {me.weapon ? ITEM_DEFS[me.weapon].name : "Tay không"}
                    {!me.weapon && view.me.gear.weapon && (
                      <span className="font-normal text-slate-400">
                        {" "}
                        · {ITEM_DEFS[view.me.gear.weapon.itemId].name} đang cất
                      </span>
                    )}
                  </span>
                  <span className="mb-0.5 block text-[10px] font-bold text-[#ffd166] [@media(hover:none)]:hidden">
                    <kbd className="rounded bg-[#ffd166] px-1 text-[#11132a]">
                      A
                    </kbd>{" "}
                    đánh ·{" "}
                    <kbd className="rounded bg-white/20 px-1 text-white">R</kbd>{" "}
                    {me.weaponDrawn ? "cất" : "rút"} vũ khí
                  </span>
                  <span className="block text-[10px] text-orange-300">
                    ⚔️{" "}
                    {expectedDamage({
                      gear: view.me.gear,
                      weaponDrawn: me.weaponDrawn,
                      stats: view.me.stats,
                      skills: view.me.skills,
                    })}{" "}
                    sát thương
                  </span>
                  {me.weapon &&
                    me.weaponDurability !== null &&
                    ITEM_DEFS[me.weapon].maxDurability && (
                      <span className="mt-0.5 block h-1 overflow-hidden rounded bg-black/50">
                        <span
                          className="block h-full bg-emerald-400"
                          style={{
                            width: `${(me.weaponDurability / ITEM_DEFS[me.weapon].maxDurability!) * 100}%`,
                          }}
                        />
                      </span>
                    )}
                </span>
              </button>
            )}
            <p className="text-center text-[10px] text-slate-500">
              C / Esc để đóng
            </p>
          </div>
        </div>
      )}
      {panel === "map" && (
        <MapPopup view={view} onClose={() => setPanel(null)} />
      )}

      <GymOverlay view={view} session={session} />
      <ChallengeModal view={view} act={act} />

      {/* ngủ trên giường: màn hơi tối, +4 thể lực/giây, nút Dậy, tua nhanh */}
      {me?.bed && !ended && (
        <div className="pointer-events-none absolute inset-x-0 bottom-40 z-20 flex justify-center sm:bottom-32">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#11132a]/90 px-3 py-1.5 text-xs">
            <span className="font-bold">
              💤 {me.channel?.kind === "sleep" ? "Đang ngủ" : "Đang nằm"}
            </span>
            <span className="text-sky-300">
              {Math.round(me.energy)}/{me.maxEnergy}
            </span>
            <button
              type="button"
              className="rounded-lg bg-[#f4b942]/20 px-3 py-1 font-bold text-[#ffd166]"
              onClick={() => void act({ type: "wake" })}
            >
              Dậy
            </button>
            {session.setSpeed &&
              [1, 2, 4].map((sp) => (
                <button
                  key={sp}
                  type="button"
                  className={`rounded-lg px-2 py-1 font-bold ${view.speed === sp ? "bg-white/25" : "bg-white/10"}`}
                  onClick={() => session.setSpeed?.(sp)}
                >
                  ×{sp}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* bị truy nã: viền đỏ nhấp nháy (mạnh dần theo số sao) */}
      {me && me.wanted > 0 && !ended && (
        <div
          className="pointer-events-none absolute inset-0 z-10 animate-pulse"
          style={{
            boxShadow: `inset 0 0 ${40 + me.wanted * 30}px rgba(220, 38, 38, ${0.25 + me.wanted * 0.15})`,
          }}
        />
      )}

      {/* đếm ngược chuông điểm danh */}
      {rollcallIn !== null && !ended && (
        <div className="pointer-events-none absolute left-1/2 top-[96px] z-20 w-64 -translate-x-1/2 rounded-xl bg-black/70 p-2 text-center text-xs font-bold text-[#ffd166]">
          🔔 Điểm danh sau{" "}
          {Math.max(1, Math.ceil(rollcallIn / C.clock.gameMinutesPerSecond))}{" "}
          giây — ra vạch sân!
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[#ffd166]"
              style={{
                width: `${(1 - rollcallIn / C.rollcall.warningMinutes) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {soloNight && !ended && (
        <button
          type="button"
          onClick={() => setSoloNight(null)}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-center"
          aria-label="Bỏ qua"
        >
          <span className="text-6xl">⛓️🌙</span>
          <span className="mt-3 text-2xl font-extrabold text-[#ffd166]">
            08:00 — Ngày {soloNight.day}
          </span>
          <span className="mt-1 max-w-sm text-sm text-slate-300">
            Bạn ngủ {soloNight.nights} đêm trong phòng biệt giam và thức dậy ở
            đó. Thể lực đầy, thông minh −2. Lát nữa bạn được thả về xà lim.
          </span>
          <span className="mt-4 text-xs text-slate-500">Bấm để bỏ qua</span>
        </button>
      )}

      {waking && !ended && !soloNight && (
        <button
          type="button"
          onClick={() => setWaking(false)}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 text-center"
          aria-label="Bỏ qua cảnh thức dậy"
        >
          <span className="animate-pulse text-6xl">🛏️☀️</span>
          <span className="mt-3 text-2xl font-extrabold text-[#ffd166]">
            08:00 — Ngày {view.clock.day}
          </span>
          <span className="mt-1 text-sm text-slate-300">
            Bạn thức dậy trên giường trong xà lim. Điểm danh lúc 08:30 ở vạch
            sân.
          </span>
          <span className="mt-4 text-xs text-slate-500">Bấm để bỏ qua</span>
        </button>
      )}

      {ended && <EndScreen view={view} onExit={onExit} />}
    </div>
  );
}

/** Rung nhẹ trên điện thoại (nhặt / vứt / túi đầy) — trình duyệt không hỗ trợ thì bỏ qua */
function buzz(ms: number): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* bỏ qua */
  }
}
