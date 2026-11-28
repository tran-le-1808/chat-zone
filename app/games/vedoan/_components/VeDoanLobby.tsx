"use client";

/** SẢNH VẼ ĐOÁN: chơi online (ghép nhanh, tạo phòng, vào bằng mã, phòng đang mở) · vẽ thử */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brush, Hash, Loader2, Lock, Plus, RefreshCw, Shuffle, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import type { DrawOp } from "../_lib/draw";
import { WORDS } from "../_lib/words";
import DrawBoard from "./DrawBoard";
import { CARD, font, hand, VD } from "./theme";
import { DRAW_OPTIONS, ROUND_OPTIONS, VD_MAX_PLAYERS, type VDPublicRoom } from "./online/types";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative rounded-3xl p-4 sm:p-5 ${className}`} style={CARD}>
      {children}
    </section>
  );
}
function Title({ children }: { children: React.ReactNode }) {
  return <h2 className={`${hand.className} mb-2 text-2xl`}>{children}</h2>;
}
function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="rounded-xl px-2 py-2 text-center text-sm font-black transition" style={{ background: on ? VD.yellow : "#fff", border: `2.5px solid ${on ? VD.ink : "rgba(31,42,68,.2)"}`, boxShadow: on ? `2px 2px 0 ${VD.ink}` : "none" }}>
      {children}
    </button>
  );
}
function Big({ children, color = VD.red, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button type="button" {...rest} className={`${hand.className} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-2xl text-white transition hover:-translate-y-0.5 disabled:opacity-50 ${className}`} style={{ background: color, border: `3px solid ${VD.ink}`, boxShadow: `4px 4px 0 ${VD.ink}` }}>
      {children}
    </button>
  );
}

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7" style={{ ...CARD, background: "#fffdf7" }}>
      <svg viewBox="0 0 200 120" className="pointer-events-none absolute -right-4 -top-2 h-32 w-52 opacity-90 sm:h-40 sm:w-64" aria-hidden>
        <path d="M20 90 C 40 30, 80 30, 100 70 S 160 110, 185 40" fill="none" stroke={VD.red} strokeWidth="7" strokeLinecap="round" />
        <circle cx="150" cy="30" r="14" fill={VD.yellow} stroke={VD.ink} strokeWidth="3" />
        <path d="M40 104 l10 -18 l10 18 z" fill={VD.green} stroke={VD.ink} strokeWidth="3" strokeLinejoin="round" />
        <rect x="118" y="70" width="40" height="10" rx="3" transform="rotate(-35 138 75)" fill={VD.blue} stroke={VD.ink} strokeWidth="3" />
      </svg>
      <p className="relative text-xs font-black uppercase tracking-[0.25em]" style={{ color: VD.blue }}>
        Vẽ hình · đoán chữ · 2–10 người
      </p>
      <h1 className={`${hand.className} relative text-5xl leading-tight sm:text-6xl`}>Vẽ Đoán</h1>
      <p className="relative mt-1 max-w-sm text-sm font-bold opacity-75">
        Mỗi lượt một người chọn từ bí mật rồi vẽ, cả phòng gõ đáp án. Đoán càng nhanh càng nhiều điểm — người vẽ được điểm khi có người đoán ra. Có gợi ý chữ cái, từ tự nhập và voice.
      </p>
    </div>
  );
}

function Practice() {
  const [ops, setOps] = useState<DrawOp[]>([]);
  const [word, setWord] = useState(() => WORDS[0].w);
  const shuffle = () => {
    setWord(WORDS[Math.floor(Math.random() * WORDS.length)].w);
    setOps([]);
  };
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Title>Vẽ thử</Title>
        <span className={`${hand.className} rounded-xl px-3 py-1 text-xl`} style={{ background: VD.yellow, border: `2.5px solid ${VD.ink}` }}>
          {word}
        </span>
        <button type="button" onClick={shuffle} className="ml-auto inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-sm font-black" style={{ border: `2.5px solid ${VD.ink}` }}>
          <Shuffle className="h-4 w-4" /> Từ khác
        </button>
      </div>
      <DrawBoard ops={ops} canDraw onOps={(o) => setOps((x) => [...x, ...o])} />
      <p className="mt-2 text-xs font-bold opacity-60">Làm quen bút, tẩy, đổ màu, hoàn tác trước khi vào phòng. Bảng này không lưu lại.</p>
    </Card>
  );
}

export default function VeDoanLobby() {
  const router = useRouter();
  const [tab, setTab] = useState<"online" | "practice">("online");
  const [rooms, setRooms] = useState<VDPublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [rounds, setRounds] = useState(3);
  const [drawSeconds, setDrawSeconds] = useState(80);
  const [hints, setHints] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [customText, setCustomText] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<VDPublicRoom[]>("vd:list");
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
      toast.success("Đã có phòng — vào vẽ thôi!");
      router.push(`/games/vedoan/room/${code}`);
    };
    socket.on("vd:matched", onMatched);
    return () => {
      socket.off("vd:matched", onMatched);
    };
  }, [router]);
  useEffect(() => () => void monoEmit("vd:quick:cancel"), []);
  useEffect(() => {
    if (queue === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = async () => {
    if (!(await waitForSocket())) return toast.error("Chưa kết nối được máy chủ");
    const res = await monoEmit("vd:quick");
    if (!res.ok) return toast.error(res.error ?? "Không vào hàng chờ được");
    const since = Date.now();
    setNow(since);
    setQueue(since);
  };
  const cancel = async () => {
    await monoEmit("vd:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("vd:create", { rounds, drawSeconds, hints, isPrivate, customText, onlyCustom });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/vedoan/room/${r.data.room.code}`);
  };
  const waited = queue !== null ? Math.max(0, Math.round((now - queue) / 1000)) : 0;

  return (
    <div className={`${font.className} mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:py-8`} style={{ color: VD.ink }}>
      <Hero />
      <div className="grid grid-cols-2 gap-3" role="tablist">
        {([["online", Users, "Chơi online"], ["practice", Brush, "Vẽ thử"]] as const).map(([id, Icon, text]) => {
          const on = tab === id;
          return (
            <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)} className={`${hand.className} flex items-center justify-center gap-2 rounded-2xl py-2.5 text-2xl transition`} style={{ background: on ? VD.yellow : "rgba(255,255,255,.75)", border: `3px solid ${VD.ink}`, boxShadow: on ? `4px 4px 0 ${VD.ink}` : "none" }}>
              <Icon className="h-5 w-5" /> {text}
            </button>
          );
        })}
      </div>

      {tab === "practice" && <Practice />}

      {tab === "online" && (
        <div className="space-y-5">
          <Card>
            <Title>Ghép phòng nhanh</Title>
            <button type="button" disabled={queue !== null} onClick={() => void quick()} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-60" style={{ border: `2.5px solid ${VD.ink}` }}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: VD.red, border: `2.5px solid ${VD.ink}` }}>
                <Zap className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <b className="block text-lg">Tìm phòng</b>
                <span className="text-xs font-bold opacity-70">Vào phòng đang chơi còn chỗ, hoặc mở phòng mới khi đủ người</span>
              </span>
            </button>
            {queue !== null && (
              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: "#fff3c4", border: `2px solid ${VD.ink}` }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: VD.red }} />
                <span className="flex-1">Đang tìm người chơi… {waited}s{waited > 20 ? " — rủ bạn bè vào cho nhanh nhé!" : ""}</span>
                <button type="button" onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs" style={{ border: "1.5px solid rgba(0,0,0,.3)" }}>
                  <X className="h-3.5 w-3.5" /> Huỷ
                </button>
              </div>
            )}
          </Card>

          <Card>
            <Title>Tạo phòng</Title>
            <p className="mb-1.5 text-xs font-black opacity-70">Số vòng (mỗi người vẽ 1 lần mỗi vòng)</p>
            <div className="grid grid-cols-4 gap-2">
              {ROUND_OPTIONS.map((r) => (
                <Pick key={r} on={rounds === r} onClick={() => setRounds(r)}>
                  {r} vòng
                </Pick>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-xs font-black opacity-70">Thời gian vẽ</p>
            <div className="grid grid-cols-4 gap-2">
              {DRAW_OPTIONS.map((s) => (
                <Pick key={s} on={drawSeconds === s} onClick={() => setDrawSeconds(s)}>
                  {s} giây
                </Pick>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#3a86ff]" checked={hints} onChange={(e) => setHints(e.target.checked)} />
              Gợi ý chữ cái khi còn ít thời gian
            </label>
            <details className="mt-2 rounded-xl p-2" style={{ background: "#f3f7ff" }}>
              <summary className="cursor-pointer text-sm font-black">Từ tự nhập (tuỳ chọn)</summary>
              <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} rows={4} placeholder={"Mỗi dòng (hoặc dấu phẩy) một từ — vd. tên bạn bè, món ăn quen…"} className="mt-2 w-full rounded-xl border-2 border-[#1f2a44]/25 bg-white p-2 text-sm font-semibold outline-none focus:border-[#3a86ff]" />
              <label className="mt-1 flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" className="h-4 w-4 accent-[#3a86ff]" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} />
                Chỉ dùng từ tự nhập (cần ≥ 3 từ)
              </label>
            </details>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-4 w-4 accent-[#3a86ff]" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <Lock className="h-4 w-4" /> Phòng riêng (chỉ vào bằng mã)
            </label>
            <Big className="mt-4 w-full" onClick={() => void create()} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Tạo phòng
            </Big>
          </Card>

          <form
            className="flex items-center gap-2 rounded-2xl p-1.5 pl-3"
            style={CARD}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) router.push(`/games/vedoan/room/${c}`);
              else toast.error("Mã phòng gồm 6 ký tự");
            }}
          >
            <Hash className="h-5 w-5 shrink-0" style={{ color: VD.blue }} />
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Nhập mã phòng" aria-label="Mã phòng" className="w-full min-w-0 bg-transparent font-mono text-xl font-bold tracking-[0.3em] outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-slate-400" />
            <button type="submit" className="shrink-0 rounded-xl px-4 py-2 font-black text-white" style={{ background: VD.blue, border: `2.5px solid ${VD.ink}` }}>
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
              <p className="py-4 text-center text-sm font-bold opacity-60">
                <span className="mb-1 block text-2xl">🎨</span>
                Chưa có phòng nào — tạo phòng rồi gửi mã cho bạn bè
              </p>
            ) : (
              <ul>
                {rooms.map((r) => {
                  const open = r.players.length < VD_MAX_PLAYERS;
                  return (
                    <li key={r.code} className="flex items-center gap-2 py-2 text-sm" style={{ borderBottom: "2px dashed rgba(31,42,68,.15)" }}>
                      <span className="font-mono text-sm font-black tracking-widest" style={{ color: VD.blue }}>{r.code}</span>
                      <span className="min-w-0 flex-1 truncate font-bold">
                        {r.settings.rounds} vòng · {r.settings.drawSeconds}s · {r.players.map((p) => p.name).join(", ")}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold opacity-70">
                        <Users className="h-3.5 w-3.5" /> {r.players.length}/{VD_MAX_PLAYERS}
                      </span>
                      <button type="button" disabled={!open} onClick={() => router.push(`/games/vedoan/room/${r.code}`)} className="rounded-lg px-2.5 py-1 text-xs font-black text-white disabled:opacity-40" style={{ background: open ? VD.green : "#8a8a8a" }}>
                        {open ? (r.status === "lobby" ? "Vào" : "Vào xem & chơi") : "Đầy"}
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
