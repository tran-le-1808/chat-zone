"use client";

/** SẢNH CỜ CARO: chơi với bot, ghép trận nhanh, tạo phòng, vào bằng mã, phòng công khai */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Hash, Loader2, Lock, Plus, RefreshCw, Swords, Users, X, Zap } from "lucide-react";
import { Patrick_Hand } from "next/font/google";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { RULE_HINT, RULE_LABEL, type CaroRule, type Stone } from "../_lib/rules";
import { CARO_BOT_LEVELS, type CaroBotLevel } from "../_lib/bot";
import type { BotSetup } from "./CaroBotGame";
import type { CaroPublicRoom } from "./online/types";

const RULES: CaroRule[] = ["block2", "free"];
const TURN_OPTIONS = [15, 30, 60];

const hand = Patrick_Hand({ weight: "400", subsets: ["latin", "vietnamese"], display: "swap" });

/** Bảng màu "giấy kẻ ô học trò": giấy ngà, mực xanh, bút đỏ, bút dạ quang */
const P = {
  paper: "#fbf5e6",
  grid: "#e6d9b8",
  ink: "#24325f",
  inkSoft: "#5b6690",
  red: "#e0393e",
  blue: "#2f6fdc",
  hi: "#fff07a",
};
const GRID_BG = {
  backgroundColor: P.paper,
  backgroundImage: `linear-gradient(${P.grid} 1px, transparent 1px), linear-gradient(90deg, ${P.grid} 1px, transparent 1px)`,
  backgroundSize: "22px 22px",
} as const;

/** Nét X / O vẽ tay (SVG) */
function Mark({ s, size = 22, className = "" }: { s: Stone; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {s === 1 ? (
        <g stroke={P.red} strokeWidth={3.6} strokeLinecap="round">
          <path d="M5 5.5 L19 18.5" />
          <path d="M18.5 5 L5.5 19" />
        </g>
      ) : (
        <path d="M12 4.2c4.6-.2 7.8 3.2 7.6 7.9-.2 4.4-3.6 7.7-7.8 7.6C7.5 19.6 4.3 16.4 4.4 12 4.5 7.6 7.6 4.4 12.4 4.6" fill="none" stroke={P.blue} strokeWidth={3.2} strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Hình minh hoạ: 5 quân X liền được gạch bút đỏ, O chặn một đầu */
function HeroBoard() {
  const C = 22;
  const xs: [number, number][] = [[1, 4], [2, 3], [3, 2], [4, 1], [5, 0]];
  const os: [number, number][] = [[0, 5], [3, 3], [4, 2], [2, 2], [5, 1]];
  return (
    <svg viewBox={`0 0 ${C * 7} ${C * 6}`} className="h-[110px] w-auto shrink-0 sm:h-[132px]" aria-hidden>
      {xs.map(([x, y]) => (
        <g key={`x${x}${y}`} stroke={P.red} strokeWidth={3} strokeLinecap="round" transform={`translate(${x * C + 4} ${y * C + 4})`}>
          <path d="M1 1 L13 13" />
          <path d="M13 1 L1 13" />
        </g>
      ))}
      {os.map(([x, y]) => (
        <circle key={`o${x}${y}`} cx={x * C + 11} cy={y * C + 11} r={6.5} fill="none" stroke={P.blue} strokeWidth={2.8} />
      ))}
      <path d={`M${1 * C + 2} ${5 * C - 2} L${6 * C - 2} ${C * 0 + 2}`} stroke={P.ink} strokeWidth={2.4} strokeLinecap="round" opacity={0.75} strokeDasharray="4 3" />
    </svg>
  );
}

/** Ô lựa chọn: chọn thì được tô dạ quang + viền mực đậm */
function Pick({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-xl px-3 py-2 text-left text-sm transition active:translate-y-px ${className}`}
      style={{
        background: on ? P.hi : "rgba(255,255,255,.7)",
        border: `2px ${on ? "solid" : "dashed"} ${on ? P.ink : "#b9ab88"}`,
        boxShadow: on ? `3px 3px 0 ${P.ink}` : "none",
        color: P.ink,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

/** Nút chính kiểu "đóng dấu": nền màu, viền mực, bóng lệch */
function InkButton({ color = P.red, children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={`${hand.className} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xl text-white transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ background: color, border: `2.5px solid ${P.ink}`, boxShadow: `4px 4px 0 ${P.ink}` }}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${hand.className} mb-1.5 text-lg leading-none`} style={{ color: P.red }}>
      {children}
    </p>
  );
}

/** Một "tờ giấy" có lề đỏ như vở học sinh */
function Sheet({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl py-4 pl-9 pr-4 sm:pl-12 sm:pr-5 ${className}`}
      style={{ ...GRID_BG, border: `2.5px solid ${P.ink}`, boxShadow: `5px 5px 0 rgba(36,50,95,.85)`, color: P.ink }}
    >
      <span aria-hidden className="absolute inset-y-0 left-6 w-[2px] sm:left-8" style={{ background: "#f08a8d" }} />
      <div className="relative">{children}</div>
    </section>
  );
}

export default function CaroLobby({ onBot }: { onBot: (s: BotSetup) => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "online">("bot");
  // chơi với bot
  const [rule, setRule] = useState<CaroRule>("block2");
  const [level, setLevel] = useState<CaroBotLevel>("medium");
  const [human, setHuman] = useState<Stone>(1);
  // online
  const [rooms, setRooms] = useState<CaroPublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<{ rule: CaroRule; since: number } | null>(null);
  const [now, setNow] = useState(0);
  const [roomRule, setRoomRule] = useState<CaroRule>("block2");
  const [turnSeconds, setTurnSeconds] = useState(30);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<CaroPublicRoom[]>("caro:list");
    if (r.ok) setRooms(r.data ?? []);
  }, []);

  useEffect(() => {
    if (tab !== "online") return;
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 8000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [tab, refresh]);

  useEffect(() => {
    const onMatched = ({ code }: { code: string }) => {
      setQueue(null);
      toast.success("Đã tìm thấy đối thủ!");
      router.push(`/games/caro/room/${code}`);
    };
    socket.on("caro:matched", onMatched);
    return () => {
      socket.off("caro:matched", onMatched);
    };
  }, [router]);

  // rời trang khi đang chờ ghép -> huỷ hàng chờ
  useEffect(() => () => void monoEmit("caro:quick:cancel"), []);

  useEffect(() => {
    if (!queue) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = useCallback(async (r: CaroRule) => {
    if (!(await waitForSocket())) return toast.error("Chưa kết nối được máy chủ");
    const res = await monoEmit<{ waiting: number }>("caro:quick", { rule: r });
    if (!res.ok) return toast.error(res.error ?? "Không vào hàng chờ được");
    const since = Date.now();
    setNow(since);
    setQueue({ rule: r, since });
  }, []);
  const cancel = async () => {
    await monoEmit("caro:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("caro:create", { rule: roomRule, turnSeconds, isPrivate });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/caro/room/${r.data.room.code}`);
  };

  const waited = queue ? Math.max(0, Math.round((now - queue.since) / 1000)) : 0;
  const tabs = [
    { id: "bot" as const, icon: Bot, text: "Chơi với bot" },
    { id: "online" as const, icon: Swords, text: "Chơi online" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:py-8" style={{ fontFamily: "inherit" }}>
      {/* Tiêu đề */}
      <Sheet>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className={`${hand.className} text-5xl leading-none sm:text-6xl`} style={{ color: P.ink }}>
              Cờ <span style={{ color: P.red }}>Ca</span><span style={{ color: P.blue }}>ro</span>
            </h1>
            <p className="mt-2 text-sm font-semibold" style={{ color: P.inkSoft }}>
              Bàn 20×20 · xếp <b style={{ color: P.red }}>5 quân liền</b> là thắng — như những giờ ra chơi trên vở ô li.
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <Mark s={1} size={18} /> <span className="text-xs font-bold">đi trước</span>
              <span className="mx-1 opacity-30">|</span>
              <Mark s={2} size={18} /> <span className="text-xs font-bold">đi sau</span>
            </div>
          </div>
          <HeroBoard />
        </div>
      </Sheet>

      {/* Chọn chế độ: 2 tab giấy */}
      <div className="grid grid-cols-2 gap-3" role="tablist">
        {tabs.map(({ id, icon: Icon, text }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={`${hand.className} flex items-center justify-center gap-2 rounded-xl py-2.5 text-xl transition ${on ? "-translate-y-0.5" : "opacity-80 hover:opacity-100"}`}
              style={{
                background: on ? P.hi : P.paper,
                color: P.ink,
                border: `2.5px solid ${P.ink}`,
                boxShadow: on ? `4px 4px 0 ${P.ink}` : `2px 2px 0 rgba(36,50,95,.5)`,
              }}
            >
              <Icon className="h-5 w-5" /> {text}
            </button>
          );
        })}
      </div>

      {tab === "bot" && (
        <Sheet className="space-y-4">
          <div>
            <Label>Luật chơi</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {RULES.map((r) => (
                <Pick key={r} on={rule === r} onClick={() => setRule(r)}>
                  {RULE_LABEL[r]}
                  <span className="block text-[11px] font-semibold opacity-70">{RULE_HINT[r]}</span>
                </Pick>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Label>Độ khó của bot</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(CARO_BOT_LEVELS) as CaroBotLevel[]).map((l, i) => (
                <Pick key={l} on={level === l} onClick={() => setLevel(l)} className="text-center">
                  {CARO_BOT_LEVELS[l]}
                  <span className="block text-[11px] tracking-widest" style={{ color: P.red }}>{"★".repeat(i + 1)}</span>
                </Pick>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Label>Bạn cầm quân</Label>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as Stone[]).map((s) => (
                <Pick key={s} on={human === s} onClick={() => setHuman(s)} className="flex items-center gap-2">
                  <Mark s={s} size={30} />
                  <span>
                    {s === 1 ? "X" : "O"}
                    <span className="block text-[11px] font-semibold opacity-70">{s === 1 ? "Bạn đi trước" : "Bot đi trước"}</span>
                  </span>
                </Pick>
              ))}
            </div>
          </div>
          <InkButton className="mt-5 w-full" onClick={() => onBot({ rule, level, human })}>
            ✏️ Vào bàn
          </InkButton>
        </Sheet>
      )}

      {tab === "online" && (
        <div className="space-y-5">
          {/* Ghép trận nhanh */}
          <Sheet>
            <Label>Ghép trận nhanh</Label>
            <p className="mb-3 text-xs font-semibold" style={{ color: P.inkSoft }}>Ai đang chờ là vào bàn ngay · 30 giây mỗi nước</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {RULES.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={!!queue}
                  onClick={() => void quick(r)}
                  className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  style={{ background: "#fff", border: `2.5px solid ${P.ink}`, boxShadow: `3px 3px 0 ${P.ink}`, color: P.ink }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: r === "block2" ? "#ffe1e1" : "#dde8ff" }}>
                    <Zap className="h-6 w-6" style={{ color: r === "block2" ? P.red : P.blue }} />
                  </span>
                  <span className="min-w-0">
                    <b className={`${hand.className} block text-xl leading-tight`}>{RULE_LABEL[r]}</b>
                    <span className="text-[11px] font-semibold opacity-70">{RULE_HINT[r]}</span>
                  </span>
                </button>
              ))}
            </div>
            {queue && (
              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: P.hi, border: `2px solid ${P.ink}` }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: P.red }} />
                <span className="flex-1">Đang tìm đối thủ ({RULE_LABEL[queue.rule]})… {waited}s</span>
                <button type="button" onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs" style={{ border: `2px solid ${P.ink}`, background: "#fff" }}>
                  <X className="h-3.5 w-3.5" /> Huỷ
                </button>
              </div>
            )}
          </Sheet>

          {/* Tạo phòng */}
          <Sheet>
            <Label>Tạo phòng mới</Label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {RULES.map((r) => (
                  <Pick key={r} on={roomRule === r} onClick={() => setRoomRule(r)} className="text-center">{RULE_LABEL[r]}</Pick>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TURN_OPTIONS.map((s) => (
                  <Pick key={s} on={turnSeconds === s} onClick={() => setTurnSeconds(s)} className="text-center">
                    ⏱ {s}s<span className="block text-[11px] font-semibold opacity-70">mỗi nước</span>
                  </Pick>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md"
                  style={{ border: `2px solid ${P.ink}`, background: isPrivate ? P.hi : "#fff" }}
                >
                  {isPrivate && <Mark s={1} size={16} />}
                </span>
                <input type="checkbox" className="sr-only" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                <Lock className="h-4 w-4" /> Phòng riêng (chỉ vào bằng mã)
              </label>
              <InkButton className="w-full" color={P.blue} onClick={() => void create()} disabled={busy}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Tạo phòng
              </InkButton>
            </div>
          </Sheet>

          {/* Vào bằng mã */}
          <form
            className="flex items-center gap-2 rounded-xl p-1.5 pl-3"
            style={{ ...GRID_BG, border: `2.5px solid ${P.ink}`, boxShadow: `4px 4px 0 ${P.ink}`, color: P.ink }}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) router.push(`/games/caro/room/${c}`);
              else toast.error("Mã phòng gồm 6 ký tự");
            }}
          >
            <Hash className="h-5 w-5 shrink-0" style={{ color: P.red }} />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Nhập mã phòng"
              aria-label="Mã phòng"
              className={`${hand.className} w-full min-w-0 bg-transparent text-2xl tracking-[0.3em] outline-none placeholder:text-lg placeholder:tracking-normal placeholder:text-[#9a9278]`}
            />
            <InkButton type="submit" className="px-4! py-1.5! text-lg!">Vào</InkButton>
          </form>

          {/* Phòng công khai */}
          <Sheet>
            <div className="mb-1 flex items-center justify-between">
              <Label>Phòng đang mở</Label>
              <button type="button" onClick={() => void refresh()} aria-label="Làm mới" className="rounded-lg p-1.5 transition hover:rotate-90" style={{ color: P.ink }}>
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className={`${hand.className} py-4 text-center text-xl`} style={{ color: P.inkSoft }}>
                Trang giấy còn trống… hãy tạo phòng hoặc ghép trận ✍️
              </p>
            ) : (
              <ul>
                {rooms.map((r) => {
                  const open = r.status === "lobby" && r.players.length < 2;
                  return (
                    <li key={r.code} className="flex items-center gap-2 py-2 text-sm" style={{ borderBottom: `1.5px dashed #c9b98f` }}>
                      <span className={`${hand.className} text-lg tracking-widest`} style={{ color: P.red }}>{r.code}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {RULE_LABEL[r.settings.rule]} · {r.settings.turnSeconds}s · {r.players.map((p) => p.name).join(" vs ")}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold opacity-70">
                        <Users className="h-3.5 w-3.5" /> {r.players.length}/2
                      </span>
                      <button
                        type="button"
                        disabled={!open}
                        onClick={() => router.push(`/games/caro/room/${r.code}`)}
                        className="rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-40"
                        style={{ border: `2px solid ${P.ink}`, background: open ? P.hi : "#eee", color: P.ink }}
                      >
                        {r.status === "lobby" ? (open ? "Vào" : "Đầy") : "Đang đấu"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Sheet>
        </div>
      )}
    </div>
  );
}
