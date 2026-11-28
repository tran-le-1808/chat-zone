"use client";

/** SẢNH MA SÓI: chơi với máy (chọn số người, vai, độ khó), ghép nhanh, tạo phòng, vào bằng mã, phòng đang mở */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Hash, Loader2, Lock, Plus, RefreshCw, Swords, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { MS_MAX, MS_MIN, rolesFor, type Role } from "../_lib/game";
import { MS_BOT_LEVELS, type MSBotLevel } from "../_lib/bot";
import type { BotSetup } from "./MSBotGame";
import { font, MS, NIGHT_BG, PAPER, ROLE, title } from "./theme";
import { DISCUSS_OPTIONS, MS_ROOM_MAX, type MSPublicRoom } from "./online/types";

const LEVEL_HINT: Record<MSBotLevel, string> = { easy: "Bầu bừa, dễ lừa", normal: "Biết suy luận, Sói biết nói dối", hard: "Nhớ phiếu bầu, Sói nhận vơ khéo" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative rounded-3xl p-4 sm:p-5 ${className}`} style={{ ...PAPER, color: MS.ink }}>
      {children}
    </section>
  );
}
function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={`${title.className} mb-2.5 flex items-center gap-2 text-xl font-black`} style={{ color: MS.bloodDark }}>
      <span className="text-sm" style={{ color: MS.gold }}>✦</span>
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
      style={{ background: on ? `linear-gradient(180deg, #2a3466, ${MS.night})` : "#fff", color: on ? MS.moon : MS.ink, border: `1.5px solid ${on ? MS.night : "rgba(0,0,0,.12)"}`, boxShadow: on ? `inset 0 0 0 1.5px ${MS.gold}` : "none" }}
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
      style={{ background: `linear-gradient(180deg, ${MS.blood}, ${MS.bloodDark})`, boxShadow: `inset 0 0 0 2px ${MS.gold}, 0 4px 0 #4a0f09` }}
    >
      {children}
    </button>
  );
}

function RoleChips({ n }: { n: number }) {
  const count = new Map<Role, number>();
  for (const r of rolesFor(n)) count.set(r, (count.get(r) ?? 0) + 1);
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...count.entries()].map(([r, k]) => {
        const M = ROLE[r];
        return (
          <span key={r} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white" style={{ background: M.color }}>
            <M.Icon className="h-3.5 w-3.5" /> {k > 1 ? `${k} ` : ""}
            {M.name}
          </span>
        );
      })}
    </div>
  );
}

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white sm:p-7" style={{ ...NIGHT_BG, border: `2px solid ${MS.gold}66` }}>
      <svg viewBox="0 0 400 120" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-90" preserveAspectRatio="none" aria-hidden>
        <path d="M0 120 L0 80 L20 60 L35 82 L55 40 L75 85 L95 55 L115 88 L140 50 L160 90 L185 62 L205 92 L230 45 L255 88 L280 58 L300 90 L325 52 L350 86 L372 60 L400 84 L400 120 Z" fill="#07140f" />
      </svg>
      <div className="absolute right-6 top-5 h-16 w-16 rounded-full sm:h-20 sm:w-20" style={{ background: `radial-gradient(circle at 40% 40%, #fffbe8, ${MS.moon} 55%, #c9b37a)`, boxShadow: "0 0 50px rgba(244,231,191,.55)" }} aria-hidden />
      <p className="relative text-xs font-black uppercase tracking-[0.3em]" style={{ color: MS.gold }}>Trò chơi suy luận · 5–12 người</p>
      <h1 className={`${title.className} relative text-5xl font-black leading-tight sm:text-6xl`} style={{ color: MS.moon, textShadow: "0 3px 0 #000" }}>
        Ma Sói
      </h1>
      <p className="relative mt-1 max-w-md pb-10 text-sm font-semibold text-white/85">
        Đêm xuống, bầy Sói lẻn vào làng. Ban ngày cả làng bàn bạc và bỏ phiếu treo cổ kẻ đáng ngờ. Tiên Tri, Bảo Vệ, Phù Thuỷ, Thợ Săn — ai đứng về phía bạn?
      </p>
    </div>
  );
}

export default function MaSoiLobby({ onBot }: { onBot: (s: BotSetup) => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "online">("bot");
  const [level, setLevel] = useState<MSBotLevel>("normal");
  const [count, setCount] = useState(8);
  const [role, setRole] = useState<Role | "random">("random");
  const [reveal, setReveal] = useState(true);
  const [rooms, setRooms] = useState<MSPublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [discuss, setDiscuss] = useState(90);
  const [bots, setBots] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const roleOpts = [...new Set(rolesFor(count))];

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<MSPublicRoom[]>("ms:list");
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
      toast.success("Đã đủ làng — màn đêm buông xuống!");
      router.push(`/games/masoi/room/${code}`);
    };
    socket.on("ms:matched", onMatched);
    return () => {
      socket.off("ms:matched", onMatched);
    };
  }, [router]);
  useEffect(() => () => void monoEmit("ms:quick:cancel"), []);
  useEffect(() => {
    if (queue === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = async () => {
    if (!(await waitForSocket())) return toast.error("Chưa kết nối được máy chủ");
    const res = await monoEmit("ms:quick");
    if (!res.ok) return toast.error(res.error ?? "Không vào hàng chờ được");
    const since = Date.now();
    setNow(since);
    setQueue(since);
  };
  const cancel = async () => {
    await monoEmit("ms:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("ms:create", { discussSeconds: discuss, isPrivate, bots, reveal });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/masoi/room/${r.data.room.code}`);
  };
  const waited = queue !== null ? Math.max(0, Math.round((now - queue) / 1000)) : 0;

  return (
    <div className={`${font.className} mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:py-8`}>
      <Hero />

      <div className="grid grid-cols-2 gap-3" role="tablist">
        {([["bot", Bot, "Chơi với máy"], ["online", Swords, "Chơi online"]] as const).map(([id, Icon, text]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-black transition"
              style={on ? { background: `linear-gradient(180deg, ${MS.blood}, ${MS.bloodDark})`, color: "#fff", boxShadow: `inset 0 0 0 2px ${MS.gold}, 0 6px 18px rgba(0,0,0,.35)` } : { background: "rgba(11,16,38,.08)", color: MS.ink, border: "1.5px solid rgba(43,33,24,.25)" }}
            >
              <Icon className="h-5 w-5" /> {text}
            </button>
          );
        })}
      </div>

      {tab === "bot" && (
        <Card>
          <Title>Số người trong làng</Title>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: MS_MAX - MS_MIN + 1 }, (_, i) => MS_MIN + i).map((k) => (
              <Pick
                key={k}
                on={count === k}
                onClick={() => {
                  setCount(k);
                  if (role !== "random" && !rolesFor(k).includes(role)) setRole("random");
                }}
                className="text-center"
              >
                {k} người
              </Pick>
            ))}
          </div>
          <div className="mt-3">
            <RoleChips n={count} />
          </div>
          <div className="mt-5">
            <Title>Vai của bạn</Title>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              <Pick on={role === "random"} onClick={() => setRole("random")} className="text-center">
                🎲 Ngẫu nhiên
              </Pick>
              {roleOpts.map((r) => {
                const M = ROLE[r];
                return (
                  <Pick key={r} on={role === r} onClick={() => setRole(r)} className="text-center">
                    <M.Icon className="mx-auto mb-0.5 h-4 w-4" style={{ color: role === r ? MS.moon : M.color }} />
                    {M.name}
                  </Pick>
                );
              })}
            </div>
            {role !== "random" && <p className="mt-2 text-xs font-semibold opacity-75">{ROLE[role].desc}</p>}
          </div>
          <div className="mt-5">
            <Title>Độ khó của máy</Title>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MS_BOT_LEVELS) as MSBotLevel[]).map((l) => (
                <Pick key={l} on={level === l} onClick={() => setLevel(l)}>
                  {MS_BOT_LEVELS[l]}
                  <span className="block text-[11px] font-semibold opacity-75">{LEVEL_HINT[l]}</span>
                </Pick>
              ))}
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-4 w-4 accent-[#c0392b]" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
            Lộ vai khi chết
          </label>
          <BigButton className="mt-4 w-full" onClick={() => onBot({ level, players: count, role, reveal })}>
            🌙 Vào làng
          </BigButton>
        </Card>
      )}

      {tab === "online" && (
        <div className="space-y-5">
          <Card>
            <Title>Ghép làng nhanh</Title>
            <button type="button" disabled={queue !== null} onClick={() => void quick()} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left transition hover:brightness-105 disabled:opacity-60" style={{ border: `1.5px solid ${MS.gold}` }}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: MS.blood }}>
                <Zap className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <b className="block text-lg">Tìm làng</b>
                <span className="text-xs font-semibold opacity-75">Làng 8 người · đủ người là vào ngay, chờ lâu thì thêm máy cho đủ</span>
              </span>
            </button>
            {queue !== null && (
              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: "rgba(217,164,65,.25)", border: `1px solid ${MS.gold}` }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: MS.blood }} />
                <span className="flex-1">Đang tìm dân làng… {waited}s</span>
                <button type="button" onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs" style={{ border: "1px solid rgba(0,0,0,.3)" }}>
                  <X className="h-3.5 w-3.5" /> Huỷ
                </button>
              </div>
            )}
          </Card>

          <Card>
            <Title>Tạo phòng</Title>
            <p className="mb-2 text-xs font-semibold opacity-75">Thời gian thảo luận ban ngày</p>
            <div className="grid grid-cols-4 gap-2">
              {DISCUSS_OPTIONS.map((s) => (
                <Pick key={s} on={discuss === s} onClick={() => setDiscuss(s)} className="text-center">
                  {s >= 120 ? `${s / 60} phút` : `${s} giây`}
                </Pick>
              ))}
            </div>
            <p className="mb-2 mt-3 text-xs font-semibold opacity-75">Thêm máy sẵn</p>
            <div className="grid grid-cols-4 gap-2">
              {[0, 2, 4, 7].map((k) => (
                <Pick key={k} on={bots === k} onClick={() => setBots(k)} className="text-center">
                  {k === 0 ? "Không" : `${k} máy`}
                </Pick>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#c0392b]" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
              Lộ vai khi chết
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#c0392b]" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <Lock className="h-4 w-4" /> Phòng riêng (chỉ vào bằng mã)
            </label>
            <BigButton className="mt-4 w-full" onClick={() => void create()} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Tạo phòng
            </BigButton>
          </Card>

          <form
            className="flex items-center gap-2 rounded-2xl p-1.5 pl-3"
            style={{ ...PAPER, color: MS.ink }}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) router.push(`/games/masoi/room/${c}`);
              else toast.error("Mã phòng gồm 6 ký tự");
            }}
          >
            <Hash className="h-5 w-5 shrink-0" style={{ color: MS.blood }} />
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Nhập mã phòng" aria-label="Mã phòng" className="w-full min-w-0 bg-transparent font-mono text-xl font-bold tracking-[0.3em] outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-[#a8857a]" />
            <button type="submit" className="shrink-0 rounded-xl px-4 py-2 font-black text-white" style={{ background: MS.blood }}>
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
              <p className="py-4 text-center text-sm font-semibold opacity-75">
                <span className="mb-1 block text-2xl">🐺</span>
                Chưa có làng nào — tạo phòng hoặc ghép nhanh
              </p>
            ) : (
              <ul>
                {rooms.map((r) => {
                  const open = r.status === "lobby" && r.players.length < MS_ROOM_MAX;
                  return (
                    <li key={r.code} className="flex items-center gap-2 py-2 text-sm" style={{ borderBottom: "1px dashed rgba(0,0,0,.18)" }}>
                      <span className="font-mono text-sm font-black tracking-widest" style={{ color: MS.blood }}>{r.code}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.players.map((p) => p.name).join(", ")}</span>
                      <span className="flex items-center gap-1 text-xs font-bold opacity-70">
                        <Users className="h-3.5 w-3.5" /> {r.players.length}/{MS_ROOM_MAX}
                      </span>
                      <button type="button" disabled={!open} onClick={() => router.push(`/games/masoi/room/${r.code}`)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40" style={{ background: open ? MS.blood : "#8a7a6a" }}>
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
