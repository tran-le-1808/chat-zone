"use client";

/** SẢNH CỜ TƯỚNG: chơi với máy, ghép trận nhanh, tạo phòng, vào bằng mã, phòng đang mở */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Hash, Loader2, Lock, Plus, RefreshCw, Swords, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import type { Side } from "../_lib/rules";
import { XQ_BOT_LEVELS, type XqBotLevel } from "../_lib/engine/search";
import type { BotSetup } from "./XiangqiBotGame";
import { PieceSvg } from "./XiangqiBoard";
import { CJK_FONT, LACQUER_FRAME, PAPER_BG, serif, XQ } from "./theme";
import { TIME_OPTIONS, type XqPublicRoom } from "./online/types";

const LEVEL_HINT: Record<XqBotLevel, string> = {
  easy: "Hay đi nước ngẫu hứng",
  medium: "Tính trước 3 nước",
  hard: "Tính sâu ~1 giây",
  master: "Tính sâu ~2,5 giây",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative rounded-3xl p-4 sm:p-5 ${className}`} style={{ ...PAPER_BG, ...LACQUER_FRAME, color: XQ.ink }}>
      {/* góc chỉ vàng */}
      {(["left-2 top-2", "right-2 top-2 rotate-90", "right-2 bottom-2 rotate-180", "left-2 bottom-2 -rotate-90"] as const).map((c) => (
        <svg key={c} className={`pointer-events-none absolute h-5 w-5 ${c}`} viewBox="0 0 20 20" aria-hidden>
          <path d="M2 14 V2 H14 M6 10 V6 H10" fill="none" stroke={XQ.gold} strokeWidth={1.6} />
        </svg>
      ))}
      <div className="relative">{children}</div>
    </section>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={`${serif.className} mb-2.5 flex items-center gap-2 text-lg font-extrabold`} style={{ color: XQ.redDeep }}>
      <span className="h-[2px] w-4" style={{ background: XQ.gold }} />
      {children}
    </h2>
  );
}

function Pick({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-xl px-3 py-2 text-left text-sm font-bold transition ${className}`}
      style={{
        background: on ? `linear-gradient(180deg, ${XQ.red}, ${XQ.redDeep})` : "rgba(255,255,255,.6)",
        color: on ? "#fff" : XQ.ink,
        border: `1.5px solid ${on ? XQ.redDeep : "rgba(90,52,23,.25)"}`,
        boxShadow: on ? `inset 0 0 0 1.5px ${XQ.goldSoft}` : "none",
      }}
    >
      {children}
    </button>
  );
}

function SealButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`${serif.className} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-lg font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ background: `linear-gradient(180deg, ${XQ.red}, ${XQ.redDeep})`, boxShadow: `inset 0 0 0 2px ${XQ.goldSoft}, 0 4px 0 #4d0c08` }}
    >
      {children}
    </button>
  );
}

export default function XiangqiLobby({ onBot }: { onBot: (s: BotSetup) => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "online">("bot");
  const [level, setLevel] = useState<XqBotLevel>("medium");
  const [human, setHuman] = useState<Side>(1);
  const [rooms, setRooms] = useState<XqPublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<XqPublicRoom[]>("xq:list");
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
      router.push(`/games/xiangqi/room/${code}`);
    };
    socket.on("xq:matched", onMatched);
    return () => {
      socket.off("xq:matched", onMatched);
    };
  }, [router]);

  useEffect(() => () => void monoEmit("xq:quick:cancel"), []);

  useEffect(() => {
    if (queue === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = async () => {
    if (!(await waitForSocket())) return toast.error("Chưa kết nối được máy chủ");
    const res = await monoEmit<{ waiting: number }>("xq:quick");
    if (!res.ok) return toast.error(res.error ?? "Không vào hàng chờ được");
    const since = Date.now();
    setNow(since);
    setQueue(since);
  };
  const cancel = async () => {
    await monoEmit("xq:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("xq:create", { timeMinutes: minutes, isPrivate });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/xiangqi/room/${r.data.room.code}`);
  };
  const waited = queue !== null ? Math.max(0, Math.round((now - queue) / 1000)) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:py-8">
      {/* Tiêu đề */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: XQ.gold }}>
              象 棋
            </p>
            <h1 className={`${serif.className} text-4xl font-extrabold leading-tight sm:text-5xl`} style={{ color: XQ.redDeep }}>
              Cờ Tướng
            </h1>
            <p className="mt-1.5 text-sm font-semibold" style={{ color: XQ.inkSoft }}>
              Bàn 9×10, sông Sở – Hán. Chiếu bí tướng đối phương để thắng. Luật chuẩn: lộ mặt tướng, cản mã, cản tượng, chiếu dai xử thua.
            </p>
          </div>
          <div className="relative hidden h-28 w-32 shrink-0 sm:block" aria-hidden>
            <div className="absolute left-0 top-0 -rotate-12">
              <PieceSvg p={1} label="han" size={76} />
            </div>
            <div className="absolute bottom-0 right-0 rotate-12">
              <PieceSvg p={-1} label="han" size={76} />
            </div>
          </div>
        </div>
      </Card>

      {/* Tab */}
      <div className="grid grid-cols-2 gap-3" role="tablist">
        {([["bot", Bot, "Đấu với máy"], ["online", Swords, "Chơi online"]] as const).map(([id, Icon, text]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={`${serif.className} flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-extrabold transition`}
              style={
                on
                  ? { background: `linear-gradient(180deg, ${XQ.red}, ${XQ.redDeep})`, color: "#fff", boxShadow: `inset 0 0 0 2px ${XQ.goldSoft}, 0 6px 18px rgba(0,0,0,.35)` }
                  : { background: "rgba(244,231,201,.08)", color: XQ.paper, border: `1.5px solid rgba(201,154,46,.35)` }
              }
            >
              <Icon className="h-5 w-5" /> {text}
            </button>
          );
        })}
      </div>

      {tab === "bot" && (
        <Card>
          <Title>Độ khó của máy</Title>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(XQ_BOT_LEVELS) as XqBotLevel[]).map((l) => (
              <Pick key={l} on={level === l} onClick={() => setLevel(l)}>
                {XQ_BOT_LEVELS[l]}
                <span className="block text-[11px] font-semibold opacity-75">{LEVEL_HINT[l]}</span>
              </Pick>
            ))}
          </div>
          <div className="mt-5">
            <Title>Bạn cầm quân</Title>
            <div className="grid grid-cols-2 gap-2">
              {([1, -1] as Side[]).map((s) => (
                <Pick key={s} on={human === s} onClick={() => setHuman(s)} className="flex items-center gap-2.5">
                  <PieceSvg p={s} label="han" size={38} />
                  <span>
                    {s === 1 ? "Đỏ" : "Đen"}
                    <span className="block text-[11px] font-semibold opacity-75">{s === 1 ? "Bạn đi trước" : "Máy đi trước"}</span>
                  </span>
                </Pick>
              ))}
            </div>
          </div>
          <SealButton className="mt-5 w-full" onClick={() => onBot({ level, human })}>
            Vào bàn cờ
          </SealButton>
        </Card>
      )}

      {tab === "online" && (
        <div className="space-y-5">
          <Card>
            <Title>Ghép trận nhanh</Title>
            <button
              type="button"
              disabled={queue !== null}
              onClick={() => void quick()}
              className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:brightness-105 disabled:opacity-60"
              style={{ background: "#fff8e6", border: `1.5px solid ${XQ.gold}` }}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: XQ.red }}>
                <Zap className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <b className={`${serif.className} block text-lg`}>Tìm đối thủ</b>
                <span className="text-xs font-semibold" style={{ color: XQ.inkSoft }}>Ai đang chờ là vào bàn ngay · mỗi bên 10 phút</span>
              </span>
            </button>
            {queue !== null && (
              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: "rgba(201,154,46,.18)", border: `1px solid ${XQ.gold}` }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: XQ.red }} />
                <span className="flex-1">Đang tìm đối thủ… {waited}s</span>
                <button type="button" onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs" style={{ border: `1px solid ${XQ.inkSoft}` }}>
                  <X className="h-3.5 w-3.5" /> Huỷ
                </button>
              </div>
            )}
          </Card>

          <Card>
            <Title>Tạo phòng</Title>
            <p className="mb-2 text-xs font-semibold" style={{ color: XQ.inkSoft }}>Thời gian mỗi bên</p>
            <div className="grid grid-cols-4 gap-2">
              {TIME_OPTIONS.map((m) => (
                <Pick key={m} on={minutes === m} onClick={() => setMinutes(m)} className="text-center">
                  {m} phút
                </Pick>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#b3261e]" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <Lock className="h-4 w-4" /> Phòng riêng (chỉ vào bằng mã)
            </label>
            <SealButton className="mt-4 w-full" onClick={() => void create()} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Tạo phòng
            </SealButton>
          </Card>

          <form
            className="flex items-center gap-2 rounded-2xl p-1.5 pl-3"
            style={{ ...PAPER_BG, ...LACQUER_FRAME, color: XQ.ink }}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) router.push(`/games/xiangqi/room/${c}`);
              else toast.error("Mã phòng gồm 6 ký tự");
            }}
          >
            <Hash className="h-5 w-5 shrink-0" style={{ color: XQ.red }} />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Nhập mã phòng"
              aria-label="Mã phòng"
              className="w-full min-w-0 bg-transparent font-mono text-xl font-bold tracking-[0.3em] outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-[#9a8466]"
            />
            <button type="submit" className={`${serif.className} shrink-0 rounded-xl px-4 py-2 font-extrabold text-white`} style={{ background: XQ.red }}>
              Vào
            </button>
          </form>

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <Title>Phòng đang mở</Title>
              <button type="button" onClick={() => void refresh()} aria-label="Làm mới" className="rounded-lg p-1.5 transition hover:rotate-90" style={{ color: XQ.ink }}>
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="py-4 text-center text-sm font-semibold" style={{ color: XQ.inkSoft }}>
                <span className="mb-1 block text-2xl" style={{ fontFamily: CJK_FONT, color: XQ.gold }}>
                  虛 席
                </span>
                Chưa có phòng nào — hãy tạo phòng hoặc ghép trận
              </p>
            ) : (
              <ul>
                {rooms.map((r) => {
                  const open = r.status === "lobby" && r.players.length < 2;
                  return (
                    <li key={r.code} className="flex items-center gap-2 py-2 text-sm" style={{ borderBottom: "1px dashed rgba(90,52,23,.3)" }}>
                      <span className="font-mono text-sm font-black tracking-widest" style={{ color: XQ.red }}>{r.code}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {r.settings.timeMinutes} phút · {r.players.map((p) => p.name).join(" vs ")}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold opacity-70">
                        <Users className="h-3.5 w-3.5" /> {r.players.length}/2
                      </span>
                      <button
                        type="button"
                        disabled={!open}
                        onClick={() => router.push(`/games/xiangqi/room/${r.code}`)}
                        className="rounded-lg px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: open ? XQ.red : "#8a7a6a" }}
                      >
                        {r.status === "lobby" ? (open ? "Vào" : "Đầy") : "Đang đấu"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
