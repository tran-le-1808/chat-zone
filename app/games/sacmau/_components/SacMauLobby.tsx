"use client";

/** SẢNH TIẾN LÊN MIỀN NAM: chơi với máy, ghép nhanh, tạo phòng, vào bằng mã, phòng đang mở */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Hash, Loader2, Lock, Plus, RefreshCw, Swords, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { SM_BOT_LEVELS, type SMBotLevel } from "../_lib/bot";
import type { BotSetup } from "./SMBotGame";
import { SMCardFace } from "./SMCard";
import { CARD_BG, font as display, SM } from "./theme";

const SMX = { main: "#6d4ce0", dark: "#4a2fb0", gold2: "#c99a2e", inkSoft: "#5b557a" };
import { TURN_OPTIONS, type SMPublicRoom } from "./online/types";

const LEVEL_HINT: Record<SMBotLevel, string> = { easy: "Đánh bừa, hay quên báo", normal: "Giữ lá Đổi sắc, chọn hệ khéo", hard: "Nhớ hệ đối thủ thiếu, ép người sắp hết" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative rounded-3xl p-4 sm:p-5 ${className}`} style={{ ...CARD_BG, color: SM.ink }}>
      {children}
    </section>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 text-lg font-black" style={{ color: SMX.main }}>
      <span className="text-sm" style={{ color: SMX.gold2 }}>◆</span>
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
      className={`rounded-xl px-3 py-2 text-left text-sm font-black transition ${className}`}
      style={{
        background: on ? `linear-gradient(180deg, ${SMX.main}, ${SMX.dark})` : "#fff",
        color: on ? "#fff" : SM.ink,
        border: `1.5px solid ${on ? SMX.dark : "rgba(0,0,0,.12)"}`,
        boxShadow: on ? `inset 0 0 0 1.5px ${SM.gold}` : "none",
      }}
    >
      {children}
    </button>
  );
}

function BigButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-lg font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ background: `linear-gradient(180deg, ${SMX.main}, ${SMX.dark})`, boxShadow: `inset 0 0 0 2px ${SM.gold}, 0 4px 0 #2a1a78` }}
    >
      {children}
    </button>
  );
}

export default function SacMauLobby({ onBot }: { onBot: (s: BotSetup) => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "online">("bot");
  const [level, setLevel] = useState<SMBotLevel>("normal");
  const [count, setCount] = useState(4);
  const [stack, setStack] = useState(true);
  const [rooms, setRooms] = useState<SMPublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [turnSeconds, setTurnSeconds] = useState(20);
  const [bots, setBots] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<SMPublicRoom[]>("sm:list");
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
      toast.success("Đã đủ bàn — chia bài!");
      router.push(`/games/sacmau/room/${code}`);
    };
    socket.on("sm:matched", onMatched);
    return () => {
      socket.off("sm:matched", onMatched);
    };
  }, [router]);
  useEffect(() => () => void monoEmit("sm:quick:cancel"), []);
  useEffect(() => {
    if (queue === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = async () => {
    if (!(await waitForSocket())) return toast.error("Chưa kết nối được máy chủ");
    const res = await monoEmit("sm:quick");
    if (!res.ok) return toast.error(res.error ?? "Không vào hàng chờ được");
    const since = Date.now();
    setNow(since);
    setQueue(since);
  };
  const cancel = async () => {
    await monoEmit("sm:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("sm:create", { turnSeconds, isPrivate, bots, stack });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/sacmau/room/${r.data.room.code}`);
  };
  const waited = queue !== null ? Math.max(0, Math.round((now - queue) / 1000)) : 0;

  return (
    <div className={`${display.className} mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:py-8`}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: SMX.gold2 }}>
              Bài đổi màu · 2–4 người
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl" style={{ color: SMX.main }}>
              Sắc Màu
              <span className="block text-2xl sm:text-3xl" style={{ color: SM.ink }}>Lửa · Nước · Lá · Gió</span>
            </h1>
            <p className="mt-1.5 text-sm font-semibold" style={{ color: SMX.inkSoft }}>
              Đánh lá cùng hệ hoặc cùng số, dùng Chặn, Đảo chiều, +2 và Đổi sắc để cản đối thủ. Còn 1 lá nhớ hô “Báo!”. Hết bài trước là thắng.
            </p>
          </div>
          <div className="relative hidden h-32 w-40 shrink-0 sm:block" aria-hidden>
            {[7, 32, 70, 104].map((c, i) => (
              <div key={c} className="absolute bottom-0 left-10 origin-bottom" style={{ transform: `rotate(${-24 + i * 16}deg)` }}>
                <SMCardFace card={c} w={58} />
              </div>
            ))}
          </div>
        </div>
      </Card>

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
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-black transition"
              style={on ? { background: `linear-gradient(180deg, ${SMX.main}, ${SMX.dark})`, color: "#fff", boxShadow: `inset 0 0 0 2px ${SM.gold}, 0 6px 18px rgba(0,0,0,.35)` } : { background: "rgba(255,246,227,.08)", color: SM.cream, border: "1.5px solid rgba(242,193,78,.35)" }}
            >
              <Icon className="h-5 w-5" /> {text}
            </button>
          );
        })}
      </div>

      {tab === "bot" && (
        <Card>
          <Title>Độ khó của máy</Title>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SM_BOT_LEVELS) as SMBotLevel[]).map((l) => (
              <Pick key={l} on={level === l} onClick={() => setLevel(l)}>
                {SM_BOT_LEVELS[l]}
                <span className="block text-[11px] font-semibold opacity-75">{LEVEL_HINT[l]}</span>
              </Pick>
            ))}
          </div>
          <div className="mt-5">
            <Title>Số người ở bàn</Title>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((k) => (
                <Pick key={k} on={count === k} onClick={() => setCount(k)} className="text-center">
                  {k} người
                  <span className="block text-[11px] font-semibold opacity-75">bạn + {k - 1} máy</span>
                </Pick>
              ))}
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-4 w-4 accent-[#6d4ce0]" checked={stack} onChange={(e) => setStack(e.target.checked)} />
            Cho phép cộng dồn +2 / +4
          </label>
          <BigButton className="mt-4 w-full" onClick={() => onBot({ level, players: count, stack })}>
            🎴 Chia bài
          </BigButton>
        </Card>
      )}

      {tab === "online" && (
        <div className="space-y-5">
          <Card>
            <Title>Ghép bàn nhanh</Title>
            <button type="button" disabled={queue !== null} onClick={() => void quick()} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left transition hover:brightness-105 disabled:opacity-60" style={{ border: `1.5px solid ${SM.gold}` }}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: SMX.main }}>
                <Zap className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <b className="block text-lg">Tìm bàn</b>
                <span className="text-xs font-semibold" style={{ color: SMX.inkSoft }}>Đủ 4 người là chia ngay · chờ lâu thì thêm máy cho đủ bàn</span>
              </span>
            </button>
            {queue !== null && (
              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: "rgba(242,193,78,.25)", border: `1px solid ${SMX.gold2}` }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: SMX.main }} />
                <span className="flex-1">Đang tìm người chơi… {waited}s</span>
                <button type="button" onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs" style={{ border: `1px solid ${SMX.inkSoft}` }}>
                  <X className="h-3.5 w-3.5" /> Huỷ
                </button>
              </div>
            )}
          </Card>

          <Card>
            <Title>Tạo phòng</Title>
            <p className="mb-2 text-xs font-semibold" style={{ color: SMX.inkSoft }}>Thời gian mỗi lượt</p>
            <div className="grid grid-cols-3 gap-2">
              {TURN_OPTIONS.map((s) => (
                <Pick key={s} on={turnSeconds === s} onClick={() => setTurnSeconds(s)} className="text-center">
                  {s} giây
                </Pick>
              ))}
            </div>
            <p className="mb-2 mt-3 text-xs font-semibold" style={{ color: SMX.inkSoft }}>Thêm máy sẵn</p>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((k) => (
                <Pick key={k} on={bots === k} onClick={() => setBots(k)} className="text-center">
                  {k === 0 ? "Không" : `${k} máy`}
                </Pick>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#6d4ce0]" checked={stack} onChange={(e) => setStack(e.target.checked)} />
              Cho phép cộng dồn +2 / +4
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#6d4ce0]" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <Lock className="h-4 w-4" /> Phòng riêng (chỉ vào bằng mã)
            </label>
            <BigButton className="mt-4 w-full" onClick={() => void create()} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Tạo phòng
            </BigButton>
          </Card>

          <form
            className="flex items-center gap-2 rounded-2xl p-1.5 pl-3"
            style={{ ...CARD_BG, color: SM.ink }}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) router.push(`/games/sacmau/room/${c}`);
              else toast.error("Mã phòng gồm 6 ký tự");
            }}
          >
            <Hash className="h-5 w-5 shrink-0" style={{ color: SMX.main }} />
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Nhập mã phòng" aria-label="Mã phòng" className="w-full min-w-0 bg-transparent font-mono text-xl font-bold tracking-[0.3em] outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-[#a8857a]" />
            <button type="submit" className="shrink-0 rounded-xl px-4 py-2 font-black text-white" style={{ background: SMX.main }}>
              Vào
            </button>
          </form>

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <Title>Phòng đang mở</Title>
              <button type="button" onClick={() => void refresh()} aria-label="Làm mới" className="rounded-lg p-1.5 transition hover:rotate-90">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="py-4 text-center text-sm font-semibold" style={{ color: SMX.inkSoft }}>
                <span className="mb-1 block text-2xl">🎴</span>
                Chưa có phòng nào — tạo phòng hoặc ghép bàn nhanh
              </p>
            ) : (
              <ul>
                {rooms.map((r) => {
                  const open = r.status === "lobby" && r.players.length < 4;
                  return (
                    <li key={r.code} className="flex items-center gap-2 py-2 text-sm" style={{ borderBottom: "1px dashed rgba(0,0,0,.18)" }}>
                      <span className="font-mono text-sm font-black tracking-widest" style={{ color: SMX.main }}>{r.code}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {r.settings.turnSeconds}s · {r.players.map((p) => p.name).join(", ")}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold opacity-70">
                        <Users className="h-3.5 w-3.5" /> {r.players.length}/4
                      </span>
                      <button type="button" disabled={!open} onClick={() => router.push(`/games/sacmau/room/${r.code}`)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40" style={{ background: open ? SMX.main : "#8a7a6a" }}>
                        {r.status === "lobby" ? (open ? "Vào" : "Đầy") : "Đang chơi"}
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
