"use client";

/**
 * BÀN MA SÓI (dùng chung chơi với máy và online): vòng người chơi quanh đống lửa / ánh trăng,
 * bảng hành động theo vai & giai đoạn, nhật ký làng + chat, thẻ vai, bảng kết quả.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Mic, MicOff, Moon, Send, Skull, Sun, WifiOff, X } from "lucide-react";
import type { MSAction, MSEvent, MSView, Role } from "../_lib/game";
import { msSound } from "../_lib/sound";
import { DAY_BG, font, MS, NIGHT_BG, PAPER, ROLE, title } from "./theme";

export interface ChatLine {
  id: string;
  seat: number;
  name: string;
  text: string;
  channel: "all" | "wolf" | "dead";
  at: number;
}

/** Trạng thái voice từng ghế (null = không bật voice) */
export interface SeatVoice {
  muted: boolean;
  speaking: boolean;
  /** Mình có nghe được người này lúc này không (theo luật) */
  heard: boolean;
}

export interface MSTableView extends MSView {
  names: string[];
  bots: boolean[];
  connected?: boolean[];
  /** Hết giờ giai đoạn (giờ máy mình, ms) — null: không giới hạn */
  deadline: number | null;
  games: number;
}

interface Props {
  view: MSTableView;
  onAct: (a: MSAction) => boolean | Promise<boolean>;
  chat?: ChatLine[];
  onChat?: (text: string) => void;
  header: React.ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  resultExtra?: React.ReactNode;
  voice?: (SeatVoice | null)[];
}

const ACCUSE = ["Tôi nghi {t} lắm.", "{t} nói chuyện có vẻ gian gian.", "Bỏ phiếu {t} đi mọi người!", "Đêm qua tôi thấy {t} lảng vảng ngoài bìa rừng."];

function useNow(on: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [on]);
  return now;
}

function RoleIcon({ role, className = "h-4 w-4" }: { role: Role; className?: string }) {
  const I = ROLE[role].Icon;
  return <I className={className} />;
}

function compositionText(c: Role[]) {
  const count = new Map<Role, number>();
  for (const r of c) count.set(r, (count.get(r) ?? 0) + 1);
  return [...count.entries()].map(([r, k]) => (k > 1 ? `${k} ${ROLE[r].name}` : ROLE[r].name)).join(" · ");
}

// ------------------------------------------------------------------ nhật ký

interface FeedItem {
  key: string;
  at: number;
  kind: "sys" | "say" | "private" | "chat";
  seat?: number;
  channel?: ChatLine["channel"];
  name?: string;
  text: string;
}

function eventLines(v: MSTableView): FeedItem[] {
  const nm = (i: number) => v.names[i] ?? `Ghế ${i + 1}`;
  const roleTxt = (i: number) => (v.roles[i] ? ` (${ROLE[v.roles[i]!].name})` : "");
  const out: FeedItem[] = [{ key: "n1", at: 0, kind: "sys", text: "🌙 Đêm 1 buông xuống. Cả làng đi ngủ…" }];
  v.events.forEach((e: MSEvent, idx) => {
    const key = `e${idx}`;
    if (e.k === "dawn") {
      if (e.day > 1) out.push({ key: `${key}n`, at: 0, kind: "sys", text: `🌙 Đêm ${e.day} buông xuống…` });
      out.push({
        key,
        at: 0,
        kind: "sys",
        text: e.deaths.length ? `☀️ Sáng ngày ${e.day}: ${e.deaths.map((d) => nm(d) + roleTxt(d)).join(", ")} đã chết đêm qua.` : `☀️ Sáng ngày ${e.day}: đêm qua bình yên, không ai chết.`,
      });
      for (const r of v.seerLog.filter((x) => x.day === e.day))
        out.push({ key: `${key}s`, at: 0, kind: "private", text: `🔮 (chỉ bạn thấy) Đêm ${r.day} bạn soi ${nm(r.target)}: ${r.wolf ? "là SÓI!" : "là người tốt."}` });
    } else if (e.k === "claim")
      out.push({ key, at: 0, kind: "say", seat: e.seat, text: `“Tôi là Tiên Tri! Tôi đã soi ${nm(e.target)} — ${e.wolf ? "là SÓI!" : "là người tốt."}”` });
    else if (e.k === "accuse") out.push({ key, at: 0, kind: "say", seat: e.seat, text: ACCUSE[(e.seat * 7 + e.target * 3 + e.day) % ACCUSE.length].replace("{t}", nm(e.target)) });
    else if (e.k === "lynch") {
      out.push({
        key,
        at: 0,
        kind: "sys",
        text: e.seat >= 0 ? `⚖️ Dân làng treo cổ ${nm(e.seat)}${roleTxt(e.seat)} với ${e.tally[e.seat]} phiếu.` : `⚖️ Không ai bị treo cổ (${e.skips} phiếu bỏ qua / hoà phiếu).`,
      });
    } else if (e.k === "shot") out.push({ key, at: 0, kind: "sys", text: `🏹 Thợ Săn ${nm(e.seat)} gục xuống nhưng kịp bắn ${nm(e.target)}${roleTxt(e.target)}!` });
    else if (e.k === "over") out.push({ key, at: 0, kind: "sys", text: e.winner === "wolf" ? "🐺 Phe Sói đã nuốt chửng cả làng!" : "🏆 Dân Làng đã diệt sạch Sói!" });
  });
  return out;
}

function useFeed(v: MSTableView, chat: ChatLine[]) {
  // gắn mốc thời gian cho mỗi dòng sự kiện khi thấy lần đầu để xen kẽ đúng với chat
  const base = useMemo(() => eventLines(v), [v]);
  const [stamps, setStamps] = useState<Record<string, number>>(() => Object.fromEntries(base.map((b) => [b.key, 0])));
  useEffect(() => {
    const missing = base.filter((b) => stamps[b.key] === undefined);
    if (!missing.length) return;
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStamps((s) => ({ ...s, ...Object.fromEntries(missing.map((b) => [b.key, now])) }));
  }, [base, stamps]);
  return useMemo(() => {
    const items: FeedItem[] = base.map((b) => ({ ...b, at: stamps[b.key] ?? Number.MAX_SAFE_INTEGER }));
    for (const c of chat) items.push({ key: c.id, at: c.at, kind: "chat", seat: c.seat, name: c.name, channel: c.channel, text: c.text });
    return items.map((it, i) => ({ it, i })).sort((a, b) => a.it.at - b.it.at || a.i - b.i).map((x) => x.it);
  }, [base, stamps, chat]);
}

// ------------------------------------------------------------------ bàn

export default function MSTable({ view: v, onAct, chat = [], onChat, header, onNext, nextLabel = "Ván mới", resultExtra, voice }: Props) {
  const me = v.mySeat;
  const myRole = v.myRole;
  const night = v.phase === "night" || v.phase === "witch";
  const dark = night || v.phase === "over";
  const alive = me >= 0 && v.alive[me];
  const [selRaw, setSel] = useState<{ pid: number; seat: number } | null>(null);
  const sel = selRaw && selRaw.pid === v.pid ? selRaw.seat : -1;
  const [modeRaw, setMode] = useState<{ pid: number; m: "poison" | "claim" } | null>(null);
  const mode = modeRaw && modeRaw.pid === v.pid ? modeRaw.m : null;
  const [showRole, setShowRole] = useState(() => v.phase === "night" && v.day === 1 && me >= 0);
  const [hideResult, setHideResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(v.deadline !== null);
  const left = v.deadline !== null && now ? Math.max(0, Math.ceil((v.deadline - now) / 1000)) : null;
  const feed = useFeed(v, chat);

  // âm thanh khi đổi giai đoạn
  const prev = useRef<{ pid: number; phase: string; dead: number } | null>(null);
  useEffect(() => {
    const dead = v.alive.filter((a) => !a).length;
    const p = prev.current;
    prev.current = { pid: v.pid, phase: v.phase, dead };
    if (!p || p.pid === v.pid) return;
    if (v.phase === "over") msSound.play(myRole && (myRole === "wolf") === (v.winner === "wolf") ? "win" : "lose");
    else if (dead > p.dead) msSound.play("death");
    else if (v.phase === "night" && p.phase !== "night") msSound.play("night");
    else if (v.phase === "day") msSound.play("day");
    else if (v.phase === "vote") msSound.play("vote");
    if (v.phase !== "over" && !v.done && alive) setTimeout(() => msSound.play("turn"), 600);
  }, [v.pid, v.phase, v.alive, v.done, v.winner, myRole, alive]);

  const send = async (a: MSAction) => {
    if (busy) return;
    setBusy(true);
    msSound.unlock();
    try {
      if (a.k === "claim") msSound.play("claim");
      if (a.k === "vote") msSound.play("vote");
      await onAct(a);
      setSel(null);
      setMode(null);
    } finally {
      setBusy(false);
    }
  };

  const canPick = (p: number): boolean => {
    if (me < 0 || p === me && !(v.phase === "night" && myRole === "guard")) return false;
    const isAlive = v.alive[p];
    if (v.phase === "hunter") return v.hunterSeat === me && isAlive;
    if (!alive) return false;
    if (v.phase === "night") {
      if (myRole === "wolf") return isAlive && v.roles[p] !== "wolf";
      if (myRole === "seer") return !v.done && isAlive;
      if (myRole === "guard") return !v.done && isAlive && p !== v.lastGuard;
      return false;
    }
    if (v.phase === "witch") return myRole === "witch" && mode === "poison" && !v.done && isAlive;
    if (v.phase === "day") return mode === "claim" ? true : isAlive;
    if (v.phase === "vote") return !v.done && isAlive;
    return false;
  };

  // vị trí vòng tròn: mình ở dưới cùng
  const n = v.n;
  const base = me >= 0 ? me : 0;
  const big = n <= 8;
  const voteCount = useMemo(() => {
    const c = new Array<number>(n).fill(0);
    if (v.phase === "vote") v.votes.forEach((t, i) => v.alive[i] && t >= 0 && (c[t] += 1));
    return c;
  }, [v.phase, v.votes, v.alive, n]);
  const wolfMarks = useMemo(() => {
    const c = new Array<number>(n).fill(0);
    if (v.wolfVotes && v.phase === "night") v.wolfVotes.forEach((t, i) => v.alive[i] && t >= 0 && (c[t] += 1));
    return c;
  }, [v.wolfVotes, v.phase, v.alive, n]);
  const seen = useMemo(() => new Map(v.seerLog.map((r) => [r.target, r.wolf])), [v.seerLog]);

  const status = (() => {
    if (v.phase === "night") return "Làng đang ngủ… Sói đi săn";
    if (v.phase === "witch") return "Phù Thuỷ đang cân nhắc…";
    if (v.phase === "day") return `Thảo luận · ${v.acted.filter((a, i) => a && v.alive[i]).length}/${v.alive.filter(Boolean).length} sẵn sàng`;
    if (v.phase === "vote") return `Bỏ phiếu · ${v.acted.filter((a, i) => a && v.alive[i]).length}/${v.alive.filter(Boolean).length} đã bầu`;
    if (v.phase === "hunter") return `Thợ Săn ${v.names[v.hunterSeat] ?? ""} đang ngắm…`;
    return v.winner === "wolf" ? "Sói thắng" : "Dân thắng";
  })();

  const iWon = myRole ? (myRole === "wolf") === (v.winner === "wolf") : null;

  return (
    <div className={`${font.className} flex min-h-dvh flex-col transition-colors duration-1000 ${dark ? "text-white" : "text-[#2b2118]"}`} style={dark ? NIGHT_BG : DAY_BG}>
      <div className="text-white">{header}</div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-3 p-2 sm:p-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col items-center gap-2">
          {/* thanh trên: vai + bộ vai */}
          <div className="flex w-full flex-wrap items-center gap-2 text-xs">
            {myRole && (
              <button type="button" onClick={() => setShowRole(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-white shadow" style={{ background: ROLE[myRole].color }}>
                <RoleIcon role={myRole} className="h-3.5 w-3.5" /> Vai của bạn: {ROLE[myRole].name}
              </button>
            )}
            {me < 0 && <span className="rounded-full bg-black/30 px-3 py-1.5 font-bold text-white">Đang xem</span>}
            <span className={`truncate rounded-full px-3 py-1.5 font-semibold ${dark ? "bg-white/10" : "bg-black/10"}`}>
              {n} người: {compositionText(v.composition)}
            </span>
          </div>

          {/* vòng người chơi */}
          <div className="relative aspect-square w-full max-w-[min(94vw,540px)]">
            <div className="absolute inset-[14%] rounded-full" style={{ background: dark ? "radial-gradient(circle, rgba(244,231,191,.10), transparent 70%)" : "radial-gradient(circle, rgba(255,190,90,.35), transparent 70%)" }} />
            {/* giữa bàn */}
            <div className="absolute inset-[28%] flex flex-col items-center justify-center rounded-full text-center" style={{ background: dark ? "rgba(11,16,38,.55)" : "rgba(255,248,230,.6)", border: `2px solid ${dark ? "rgba(244,231,191,.35)" : "rgba(43,33,24,.25)"}`, boxShadow: dark ? "0 0 60px rgba(244,231,191,.15)" : "0 0 60px rgba(242,169,59,.35)" }}>
              {dark ? <Moon className="h-8 w-8 sm:h-11 sm:w-11" style={{ color: MS.moon, fill: MS.moon }} /> : <Sun className="h-8 w-8 sm:h-11 sm:w-11" style={{ color: MS.sun, fill: "#f7c86a" }} />}
              <p className={`${title.className} mt-1 text-lg font-black sm:text-2xl`}>{v.phase === "over" ? "Hết ván" : `${night ? "Đêm" : "Ngày"} ${v.day}`}</p>
              <p className="px-2 text-[10px] font-semibold opacity-80 sm:text-xs">{status}</p>
              {left !== null && v.phase !== "over" && <p className={`mt-0.5 font-mono text-sm font-black sm:text-base ${left <= 5 ? "text-rose-500" : ""}`}>{left}s</p>}
            </div>
            {Array.from({ length: n }, (_, i) => {
              const ang = Math.PI / 2 + ((i - base) * 2 * Math.PI) / n;
              const x = 50 + 42 * Math.cos(ang);
              const y = 50 + 42 * Math.sin(ang);
              const dead = !v.alive[i];
              const role = v.roles[i];
              const pickable = canPick(i);
              const selected = sel === i;
              const size = big ? "h-12 w-12 sm:h-16 sm:w-16" : "h-10 w-10 sm:h-14 sm:w-14";
              const vc = voice?.[i] ?? null;
              const talking = !!vc && vc.speaking && !vc.muted;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!pickable}
                  onClick={() => {
                    setSel({ pid: v.pid, seat: i });
                    msSound.play("select");
                  }}
                  className={`absolute flex w-[22%] max-w-[96px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${pickable ? "cursor-pointer" : "cursor-default"}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span
                    className={`relative flex ${size} items-center justify-center rounded-full text-base font-black transition sm:text-xl ${pickable ? "hover:scale-110" : ""} ${selected ? "scale-110" : ""}`}
                    style={{
                      background: dead ? "#4b4b4b" : role ? `radial-gradient(circle at 35% 30%, #fff8, ${ROLE[role].color} 60%)` : night ? "radial-gradient(circle at 35% 30%, #3b4a80, #1a2250)" : "radial-gradient(circle at 35% 30%, #fff, #d9b77a)",
                      color: dead ? "#aaa" : role ? "#fff" : night ? MS.moon : MS.ink,
                      border: `3px solid ${selected ? "#ffd34d" : i === me ? "#fff" : role === "wolf" && myRole === "wolf" ? MS.blood : night ? "rgba(244,231,191,.45)" : "rgba(43,33,24,.5)"}`,
                      boxShadow: selected ? "0 0 0 4px rgba(255,211,77,.45), 0 0 24px rgba(255,211,77,.6)" : talking ? "0 0 0 4px rgba(52,211,153,.6), 0 0 22px rgba(52,211,153,.8)" : pickable ? "0 0 14px rgba(255,255,255,.35)" : "0 3px 8px rgba(0,0,0,.35)",
                      filter: dead ? "grayscale(1)" : undefined,
                      opacity: dead ? 0.7 : 1,
                    }}
                  >
                    {role ? <RoleIcon role={role} className={big ? "h-5 w-5 sm:h-7 sm:w-7" : "h-4 w-4 sm:h-6 sm:w-6"} /> : (v.names[i] ?? "?").charAt(0).toUpperCase()}
                    {dead && <Skull className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-black p-0.5 text-white" />}
                    {voteCount[i] > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-black text-white ring-2 ring-white">{voteCount[i]}</span>}
                    {wolfMarks[i] > 0 && <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ring-2 ring-white" style={{ background: MS.blood }}>🐾{wolfMarks[i] > 1 ? wolfMarks[i] : ""}</span>}
                    {seen.has(i) && <span className={`absolute -left-1.5 -bottom-1 rounded-full px-1 text-[9px] font-black text-white ring-2 ring-white ${seen.get(i) ? "bg-rose-600" : "bg-emerald-600"}`}>{seen.get(i) ? "SÓI" : "tốt"}</span>}
                    {!dead && (v.phase === "day" || v.phase === "vote") && v.acted[i] && <Check className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" />}
                    {vc && (
                      <span
                        title={vc.muted ? "Tắt mic" : !vc.heard ? "Bạn không nghe được người này lúc này" : talking ? "Đang nói" : "Trong voice"}
                        className={`absolute -right-1.5 bottom-1/2 flex h-4 w-4 translate-y-1/2 items-center justify-center rounded-full ring-2 ring-white ${vc.muted || !vc.heard ? "bg-zinc-500" : "bg-emerald-500"}`}
                      >
                        {vc.muted || !vc.heard ? <MicOff className="h-2.5 w-2.5 text-white" /> : <Mic className="h-2.5 w-2.5 text-white" />}
                      </span>
                    )}
                    {v.connected && !v.connected[i] && !v.bots[i] && <WifiOff className="absolute -right-1 top-0 h-4 w-4 rounded-full bg-black/70 p-0.5 text-white" />}
                  </span>
                  <span className={`flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 text-[10px] font-bold leading-4 sm:text-xs ${dark ? "bg-black/40 text-white" : "bg-white/70 text-[#2b2118]"} ${dead ? "line-through opacity-70" : ""}`}>
                    {v.bots[i] && <Bot className="h-3 w-3 shrink-0 opacity-70" />}
                    <span className="truncate">{i === me ? "Bạn" : v.names[i]}</span>
                  </span>
                  {v.phase === "vote" && v.votes[i] !== -2 && v.alive[i] && (
                    <span className="max-w-full truncate text-[9px] font-semibold opacity-80">→ {v.votes[i] < 0 ? "bỏ qua" : v.votes[i] === me ? "Bạn" : v.names[v.votes[i]]}</span>
                  )}
                </button>
              );
            })}
          </div>

          <ActionPanel v={v} sel={sel} mode={mode} setMode={(m) => setMode(m ? { pid: v.pid, m } : null)} send={send} busy={busy} />
        </div>

        <Feed feed={feed} v={v} onChat={onChat} night={night} />
      </div>

      {showRole && myRole && <RoleModal role={myRole} v={v} onClose={() => setShowRole(false)} />}
      {v.phase === "over" && hideResult !== v.games && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md space-y-3 rounded-3xl p-5 text-[#2b2118]" style={PAPER}>
            <div className="text-center">
              <p className="text-4xl">{v.winner === "wolf" ? "🐺" : "🏡"}</p>
              <h2 className={`${title.className} text-2xl font-black`} style={{ color: v.winner === "wolf" ? MS.blood : "#3f6b2a" }}>
                {v.winner === "wolf" ? "Phe Sói thắng!" : "Dân Làng thắng!"}
              </h2>
              {iWon !== null && <p className="text-sm font-bold">{iWon ? "Bạn đã thắng 🎉" : "Bạn đã thua"}</p>}
            </div>
            <div className="grid max-h-[45vh] grid-cols-2 gap-1.5 overflow-y-auto">
              {v.names.map((name, i) => {
                const r = v.roles[i];
                return (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-white/70 px-2 py-1.5" style={{ border: `1.5px solid ${r ? ROLE[r].color : "#999"}` }}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ background: r ? ROLE[r].color : "#999" }}>
                      {r && <RoleIcon role={r} />}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-black ${v.alive[i] ? "" : "line-through opacity-60"}`}>{i === me && name !== "Bạn" ? `${name} (bạn)` : name}</p>
                      <p className="text-[10px] font-semibold opacity-70">{r ? ROLE[r].name : "?"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {onNext && (
                <button type="button" onClick={onNext} className="rounded-xl px-5 py-3 text-sm font-black text-white" style={{ background: `linear-gradient(180deg, ${MS.blood}, ${MS.bloodDark})` }}>
                  {nextLabel}
                </button>
              )}
              {resultExtra}
              <button type="button" onClick={() => setHideResult(v.games)} className="rounded-xl border border-black/15 px-4 py-3 text-sm font-bold">
                Xem lại bàn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ bảng hành động

function Btn({ children, tone = "main", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "main" | "ghost" | "good" | "bad" }) {
  const bg = tone === "main" ? `linear-gradient(180deg, #e0b04e, #b07d1f)` : tone === "good" ? "linear-gradient(180deg,#2fb070,#1d7a4c)" : tone === "bad" ? `linear-gradient(180deg, ${MS.blood}, ${MS.bloodDark})` : "rgba(255,255,255,.15)";
  return (
    <button type="button" {...rest} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: bg, border: tone === "ghost" ? "1.5px solid rgba(255,255,255,.35)" : "none", color: tone === "ghost" ? "inherit" : "#fff" }}>
      {children}
    </button>
  );
}

function ActionPanel({ v, sel, mode, setMode, send, busy }: { v: MSTableView; sel: number; mode: "poison" | "claim" | null; setMode: (m: "poison" | "claim" | null) => void; send: (a: MSAction) => void; busy: boolean }) {
  const me = v.mySeat;
  const role = v.myRole;
  const alive = me >= 0 && v.alive[me];
  const night = v.phase === "night" || v.phase === "witch";
  const nm = (i: number) => (i === me ? "bạn" : (v.names[i] ?? ""));
  const box = (children: React.ReactNode) => (
    <div className={`w-full max-w-[560px] space-y-2 rounded-2xl p-3 text-center text-sm ${night ? "bg-[#0b1026]/70 ring-1 ring-white/15" : "bg-white/70 ring-1 ring-black/10"}`}>{children}</div>
  );
  const hint = (t: string) => <p className="font-semibold opacity-85">{t}</p>;

  if (v.phase === "over") return box(hint("Ván đã kết thúc."));
  if (v.phase === "hunter") {
    if (v.hunterSeat !== me) return box(hint(`🏹 Thợ Săn ${v.names[v.hunterSeat]} đang chọn người để bắn…`));
    return box(
      <>
        {hint(sel >= 0 ? `Bắn ${nm(sel)}?` : "🏹 Bạn đã gục ngã! Chọn một người để bắn theo.")}
        <div className="flex justify-center gap-2">
          <Btn tone="bad" disabled={sel < 0 || busy} onClick={() => send({ k: "shoot", target: sel })}>Bắn</Btn>
          <Btn tone="ghost" disabled={busy} onClick={() => send({ k: "shoot", target: -1 })}>Không bắn</Btn>
        </div>
      </>,
    );
  }
  if (me < 0) return box(hint("Bạn đang xem ván này."));
  if (!alive) return box(hint("💀 Bạn đã chết — giờ bạn thấy toàn bộ vai. Chỉ nói chuyện được với người đã chết."));

  if (v.phase === "night") {
    if (role === "wolf") {
      const mine = v.wolfVotes?.[me] ?? -1;
      return box(
        <>
          {hint(mine >= 0 ? `Bạn chọn cắn ${nm(mine)}. Có thể đổi ý tới khi cả bầy chốt.` : "🐺 Chọn con mồi đêm nay (dấu 🐾 là lựa chọn của bầy).")}
          <Btn tone="bad" disabled={sel < 0 || busy || sel === mine} onClick={() => send({ k: "kill", target: sel })}>{sel >= 0 ? `Cắn ${nm(sel)}` : "Chọn một người"}</Btn>
        </>,
      );
    }
    if (role === "seer") {
      if (v.done) return box(hint("🔮 Bạn đã soi. Kết quả hiện khi trời sáng."));
      return box(
        <>
          {hint("🔮 Chọn một người để soi xem có phải Sói không.")}
          <Btn disabled={sel < 0 || busy} onClick={() => send({ k: "see", target: sel })}>{sel >= 0 ? `Soi ${nm(sel)}` : "Chọn một người"}</Btn>
        </>,
      );
    }
    if (role === "guard") {
      if (v.done) return box(hint("🛡️ Bạn đang canh gác. Mong trời mau sáng…"));
      return box(
        <>
          {hint(`🛡️ Chọn người để bảo vệ đêm nay${v.lastGuard >= 0 ? ` (không được chọn lại ${nm(v.lastGuard)})` : ""}.`)}
          <Btn tone="good" disabled={sel < 0 || busy} onClick={() => send({ k: "guard", target: sel })}>{sel >= 0 ? `Bảo vệ ${nm(sel)}` : "Chọn một người"}</Btn>
        </>,
      );
    }
    return box(hint("😴 Bạn đang ngủ… Chờ trời sáng."));
  }

  if (v.phase === "witch") {
    if (role !== "witch") return box(hint("😴 Đêm vẫn còn dài…"));
    if (v.done) return box(hint("🧪 Bạn đã quyết định."));
    const p = v.potions ?? { heal: false, poison: false };
    return box(
      <>
        <p className="font-semibold">{v.victim >= 0 ? <>🧪 Đêm nay Sói cắn <b className="text-rose-400">{nm(v.victim)}</b>.</> : "🧪 Đêm nay Sói không cắn ai."}</p>
        {mode === "poison" ? (
          <>
            {hint(sel >= 0 ? `Đầu độc ${nm(sel)}?` : "Chọn người để đầu độc.")}
            <div className="flex justify-center gap-2">
              <Btn tone="bad" disabled={sel < 0 || busy} onClick={() => send({ k: "witch", save: false, poison: sel })}>Đầu độc</Btn>
              <Btn tone="ghost" onClick={() => setMode(null)}>Thôi</Btn>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {p.heal && v.victim >= 0 && <Btn tone="good" disabled={busy} onClick={() => send({ k: "witch", save: true, poison: -1 })}>Cứu {nm(v.victim)}</Btn>}
            {p.poison && <Btn tone="bad" onClick={() => setMode("poison")}>Dùng bình độc…</Btn>}
            <Btn tone="ghost" disabled={busy} onClick={() => send({ k: "witch", save: false, poison: -1 })}>Không làm gì</Btn>
          </div>
        )}
        <p className="text-xs opacity-70">Còn: {p.heal ? "🟢 bình cứu" : "—"} · {p.poison ? "🟣 bình độc" : "—"}</p>
      </>,
    );
  }

  if (v.phase === "day") {
    const accused = v.events.filter((e) => e.k === "accuse" && e.day === v.day && e.seat === me).length;
    if (mode === "claim")
      return box(
        <>
          {hint(sel >= 0 ? `Tuyên bố: “Tôi là Tiên Tri, ${nm(sel)} là…”` : "Chọn người mà bạn (tự nhận) đã soi.")}
          <div className="flex flex-wrap justify-center gap-2">
            <Btn tone="bad" disabled={sel < 0 || busy} onClick={() => send({ k: "claim", target: sel, wolf: true })}>…là SÓI</Btn>
            <Btn tone="good" disabled={sel < 0 || busy} onClick={() => send({ k: "claim", target: sel, wolf: false })}>…là người tốt</Btn>
            <Btn tone="ghost" onClick={() => setMode(null)}>Thôi</Btn>
          </div>
          <p className="text-xs opacity-70">Ai cũng có thể tuyên bố — kể cả Sói nói dối.</p>
        </>,
      );
    return box(
      <>
        {hint(v.done ? "✅ Bạn đã sẵn sàng. Chờ mọi người… (vẫn có thể nói thêm)" : "☀️ Bàn bạc xem ai là Sói. Chọn một người để tố, hoặc tuyên bố Tiên Tri.")}
        <div className="flex flex-wrap justify-center gap-2">
          <Btn tone="bad" disabled={sel < 0 || busy || !v.alive[sel] || accused >= 2} onClick={() => send({ k: "accuse", target: sel })}>{sel >= 0 ? `Nghi ${nm(sel)}` : "Nghi ngờ…"}</Btn>
          <Btn tone="ghost" onClick={() => setMode("claim")}>Tuyên bố Tiên Tri</Btn>
          {!v.done && <Btn disabled={busy} onClick={() => send({ k: "ready" })}>Sẵn sàng bỏ phiếu</Btn>}
        </div>
      </>,
    );
  }

  if (v.phase === "vote") {
    if (v.done) return box(hint(`🗳️ Bạn đã bầu ${v.votes[me] >= 0 ? nm(v.votes[me]) : "bỏ qua"}. Chờ mọi người…`));
    return box(
      <>
        {hint(sel >= 0 ? `Treo cổ ${nm(sel)}?` : "🗳️ Chọn người để treo cổ (phiếu công khai, không đổi được).")}
        <div className="flex justify-center gap-2">
          <Btn tone="bad" disabled={sel < 0 || busy} onClick={() => send({ k: "vote", target: sel })}>Bầu treo</Btn>
          <Btn tone="ghost" disabled={busy} onClick={() => send({ k: "vote", target: -1 })}>Bỏ qua</Btn>
        </div>
      </>,
    );
  }
  return null;
}

// ------------------------------------------------------------------ nhật ký + chat

function Feed({ feed, v, onChat, night }: { feed: FeedItem[]; v: MSTableView; onChat?: (t: string) => void; night: boolean }) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [feed.length]);
  const me = v.mySeat;
  const alive = me >= 0 && v.alive[me];
  const wolf = v.myRole === "wolf";
  const canTalk = v.phase === "over" || !alive || !night || wolf;
  const channelLabel = !alive && v.phase !== "over" ? "Kênh người chết" : night && wolf ? "Kênh bầy Sói" : "Cả làng";
  return (
    <aside className="flex h-80 min-h-0 flex-col overflow-hidden rounded-2xl text-[#2b2118] lg:h-[calc(100dvh-80px)]" style={PAPER}>
      <h3 className={`${title.className} border-b border-black/10 px-3 py-2 text-base font-black`}>Nhật ký làng</h3>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-[13px] leading-snug">
        {feed.map((f) => {
          if (f.kind === "sys") return <p key={f.key} className="rounded-lg bg-black/5 px-2 py-1 font-semibold">{f.text}</p>;
          if (f.kind === "private") return <p key={f.key} className="rounded-lg bg-violet-100 px-2 py-1 font-semibold text-violet-900">{f.text}</p>;
          const seat = f.seat ?? -1;
          const who = seat === me ? "Bạn" : (f.name ?? v.names[seat] ?? "?");
          const tag = f.channel === "wolf" ? "🐺 " : f.channel === "dead" ? "💀 " : "";
          return (
            <p key={f.key} className={f.channel === "wolf" ? "text-rose-800" : f.channel === "dead" ? "italic opacity-70" : ""}>
              <b>
                {tag}
                {who}:
              </b>{" "}
              {f.kind === "say" ? <i>{f.text}</i> : f.text}
            </p>
          );
        })}
        <div ref={endRef} />
      </div>
      {onChat && (
        <form
          className="flex gap-1.5 border-t border-black/10 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t || !canTalk) return;
            onChat(t);
            setText("");
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            disabled={!canTalk}
            placeholder={canTalk ? `Nhắn (${channelLabel})…` : "Ban đêm chỉ Sói được nói chuyện"}
            className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-600 disabled:opacity-60"
          />
          <button type="submit" disabled={!canTalk} aria-label="Gửi" className="rounded-xl px-3 text-white disabled:opacity-40" style={{ background: MS.ink }}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </aside>
  );
}

function RoleModal({ role, v, onClose }: { role: Role; v: MSTableView; onClose: () => void }) {
  const meta = ROLE[role];
  const mates = role === "wolf" ? v.roles.map((r, i) => (r === "wolf" && i !== v.mySeat ? v.names[i] : null)).filter(Boolean) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative w-full max-w-xs overflow-hidden rounded-3xl text-center text-[#2b2118]" style={PAPER} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-2 top-2 rounded-full p-1 hover:bg-black/10">
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center gap-2 px-5 pb-3 pt-6" style={{ background: `linear-gradient(180deg, ${meta.color}33, transparent)` }}>
          <span className="flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${meta.color} 60%)` }}>
            <meta.Icon className="h-10 w-10" />
          </span>
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Vai của bạn · phe {meta.team}</p>
          <h2 className={`${title.className} text-3xl font-black`} style={{ color: meta.color }}>{meta.name}</h2>
        </div>
        <div className="space-y-2 px-5 pb-5 text-sm">
          <p>{meta.desc}</p>
          {mates.length > 0 && <p className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-800">Đồng bọn: {mates.join(", ")}</p>}
          <button type="button" onClick={onClose} className="w-full rounded-xl py-2.5 font-black text-white" style={{ background: meta.color }}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
