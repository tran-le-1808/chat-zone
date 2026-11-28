"use client";

/** BÀN VẼ ĐOÁN ONLINE: bảng điểm · bảng vẽ (người vẽ có công cụ) · khung đoán / chat */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Crown, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { useOptionalVoice } from "../../../monopoly/_context/VoiceContext";
import { VoiceBadge } from "../../../monopoly/_components/VoiceControls";
import MSVoiceControls from "../../../masoi/_components/online/MSVoice";
import { mergeOps, type DrawOp } from "../../_lib/draw";
import { vdSound } from "../../_lib/sound";
import DrawBoard from "../DrawBoard";
import SoundToggle from "../SoundToggle";
import { CARD, font, hand, PAGE_BG, PLAYER_COLORS, VD } from "../theme";
import type { VDChatMessage, VDSnapshot } from "./types";

function useNow(on: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [on]);
  return now;
}

export default function VDGame() {
  const { room, initialSnapshot, isHost, resetToLobby, leaveRoom, code, chat, myUserId } = useRoom();
  const voice = useOptionalVoice();
  const [snap, setSnap] = useState<VDSnapshot | null>(initialSnapshot as VDSnapshot | null);
  const [offset, setOffset] = useState(0);
  const [board, setBoard] = useState<{ turnId: number; ops: DrawOp[] }>({ turnId: -1, ops: [] });
  const [local, setLocal] = useState<{ id: string; text: string; at: number }[]>([]);
  const pending = useRef<DrawOp[]>([]);
  const turnRef = useRef(-1);

  const apply = useCallback((s: VDSnapshot | null) => {
    if (!s) return;
    setOffset(s.serverNow - Date.now());
    setSnap(s);
  }, []);

  const loadOps = useCallback(() => {
    void monoEmit<{ turnId: number; ops: DrawOp[] } | null>("vd:ops").then((r) => {
      if (r.ok && r.data) setBoard({ turnId: r.data.turnId, ops: r.data.ops });
    });
  }, []);

  useEffect(() => {
    const onState = (s: VDSnapshot | null) => apply(s);
    const onDraw = ({ turnId, ops }: { turnId: number; ops: DrawOp[] }) =>
      setBoard((b) => (b.turnId === turnId ? { turnId, ops: [...b.ops, ...ops] } : b));
    socket.on("vd:state", onState);
    socket.on("vd:draw", onDraw);
    const sync = () => {
      void monoEmit<VDSnapshot | null>("vd:sync").then((r) => r.ok && apply(r.data ?? null));
      loadOps();
    };
    sync();
    const onReconnect = () => setTimeout(sync, 800);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("vd:state", onState);
      socket.off("vd:draw", onDraw);
      socket.off("connect", onReconnect);
    };
  }, [apply, loadOps]);

  // lượt mới: bảng trắng, tải lại nét (nếu vào giữa lượt) + âm thanh
  useEffect(() => {
    if (!snap || turnRef.current === snap.turnId) return;
    turnRef.current = snap.turnId;
    pending.current = [];
    setBoard({ turnId: snap.turnId, ops: [] });
    loadOps();
    if (snap.isDrawer && snap.phase === "choose") vdSound.play("turn");
  }, [snap, loadOps]);

  // âm thanh theo giai đoạn
  const phaseRef = useRef("");
  useEffect(() => {
    if (!snap) return;
    const k = `${snap.turnId}:${snap.phase}`;
    if (phaseRef.current === k) return;
    const first = !phaseRef.current;
    phaseRef.current = k;
    if (first) return;
    if (snap.phase === "reveal") vdSound.play("reveal");
    if (snap.phase === "over") vdSound.play("end");
  }, [snap]);

  // gửi nét vẽ theo lô (~60ms)
  useEffect(() => {
    const t = setInterval(() => {
      if (!pending.current.length || !snap?.isDrawer) return;
      const ops = mergeOps(pending.current.splice(0, 200));
      void monoEmit("vd:draw", { ops, turnId: snap.turnId }).then((r) => {
        if (!r.ok && r.error) toast.error(r.error);
      });
    }, 60);
    return () => clearInterval(t);
  }, [snap?.isDrawer, snap?.turnId]);

  // voice: người vẽ không được nói trong lúc vẽ
  const setGate = voice?.setGate;
  const gate = useMemo(() => {
    if (!snap) return null;
    const silent = snap.isDrawer && snap.phase === "draw";
    return {
      key: `${snap.turnId}:${snap.phase}:${silent}`,
      canSend: () => !silent,
      canHear: () => true,
      mic: !silent,
      label: silent ? "Người vẽ không được nói" : "Cả phòng",
    };
  }, [snap]);
  useEffect(() => {
    setGate?.(gate);
  }, [setGate, gate]);
  useEffect(() => () => setGate?.(null), [setGate]);

  const live = snap && (snap.phase === "draw" || snap.phase === "choose");
  const now = useNow(!!live);
  const left = snap && now ? Math.max(0, Math.ceil((snap.deadline - offset - now) / 1000)) : null;
  const lastTick = useRef(-1);
  useEffect(() => {
    if (snap?.phase === "draw" && left !== null && left <= 10 && left > 0 && left !== lastTick.current) {
      lastTick.current = left;
      vdSound.play("tick");
    }
  }, [left, snap?.phase]);

  const messages = useMemo(() => {
    const list = (chat as unknown as VDChatMessage[]).map((m) => ({ ...m, at: m.createdAt - offset }));
    for (const l of local) list.push({ id: l.id, userId: "me-local", name: "", seat: -1, text: l.text, createdAt: l.at, kind: "close", at: l.at });
    return list.sort((a, b) => a.at - b.at).slice(-120);
  }, [chat, local, offset]);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => chatEnd.current?.scrollIntoView({ block: "nearest" }), [messages.length]);
  const lastCorrect = useRef(0);
  useEffect(() => {
    const n = messages.filter((m) => m.kind === "correct").length;
    if (n > lastCorrect.current && lastCorrect.current) vdSound.play("pop");
    lastCorrect.current = n;
  }, [messages]);

  const [text, setText] = useState("");
  if (!snap || !room) return <div className="flex min-h-dvh items-center justify-center text-white" style={PAGE_BG}>Đang vào lớp vẽ…</div>;

  const me = snap.players.find((p) => p.userId === myUserId);
  const drawerName = snap.players.find((p) => p.userId === snap.drawer)?.name ?? "?";
  const iGuessed = !!me?.guessed;
  const ranked = snap.players.slice().sort((a, b) => b.score - a.score);
  const colorOf = (uid: string) => PLAYER_COLORS[Math.max(0, snap.players.findIndex((p) => p.userId === uid)) % PLAYER_COLORS.length];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    vdSound.unlock();
    setText("");
    const r = await monoEmit<{ kind: string; points?: number }>("vd:chat", { text: t });
    if (!r.ok) {
      if (r.error) toast.error(r.error);
      return;
    }
    if (r.data?.kind === "correct") vdSound.play("correct");
    if (r.data?.kind === "close") {
      vdSound.play("close");
      setLocal((l) => [...l, { id: `close-${Date.now()}`, text: `🔥 “${t}” — gần đúng rồi!`, at: Date.now() }]);
    }
  };

  const leave = async () => {
    if (snap.phase !== "over" && !(await confirmDialog({ title: "Rời phòng?", message: "Bạn sẽ rời ván đang chơi.", confirmText: "Rời", cancelText: "Ở lại", tone: "danger" }))) return;
    void leaveRoom();
  };

  const wordBar = (() => {
    if (snap.phase === "over") return <span>Hết ván!</span>;
    if (snap.phase === "choose") return snap.isDrawer ? <span>Chọn một từ để vẽ</span> : <span>{drawerName} đang chọn từ…</span>;
    if (snap.word && (snap.isDrawer || iGuessed || snap.phase === "reveal"))
      return (
        <span>
          {snap.isDrawer && snap.phase === "draw" ? "Vẽ: " : "Đáp án: "}
          <b style={{ color: snap.isDrawer ? VD.red : VD.green }}>{snap.word}</b>
        </span>
      );
    return (
      <span className="font-mono text-xl tracking-[0.35em] sm:text-2xl">
        {snap.mask.split("").map((c, i) => (c === " " ? <span key={i}>&nbsp;&nbsp;</span> : <span key={i}>{c === "_" ? "_" : c.toUpperCase()}</span>))}
        <sup className="ml-1 font-sans text-xs tracking-normal opacity-60">{snap.mask.replace(/ /g, "").length}</sup>
      </span>
    );
  })();

  const overlay = (() => {
    if (snap.phase === "choose")
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1f2a44]/75 p-3 text-white">
          {snap.isDrawer ? (
            <>
              <p className={`${hand.className} text-2xl`}>Chọn từ bạn sẽ vẽ</p>
              <div className="flex flex-wrap justify-center gap-2">
                {snap.choices.map((w, i) => (
                  <button key={w} type="button" onClick={() => void monoEmit("vd:choose", { index: i }).then((r) => !r.ok && r.error && toast.error(r.error))} className={`${hand.className} rounded-xl px-4 py-2 text-xl text-[#1f2a44] transition hover:-translate-y-0.5`} style={{ background: [VD.yellow, VD.orange, VD.red][i], border: `3px solid ${VD.ink}`, boxShadow: `3px 3px 0 ${VD.ink}` }}>
                    {w}
                    <span className="block font-sans text-[10px] font-bold opacity-70">{["dễ", "vừa", "khó"][i] ?? ""}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className={`${hand.className} text-2xl`}>
              <Pencil className="mr-1 inline h-6 w-6" /> {drawerName} đang chọn từ…
            </p>
          )}
        </div>
      );
    if (snap.phase === "reveal")
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1f2a44]/80 p-3 text-white">
          <p className="text-sm font-bold opacity-80">Đáp án là</p>
          <p className={`${hand.className} text-4xl`} style={{ color: VD.yellow }}>{snap.word}</p>
          <div className="mt-1 flex max-w-md flex-wrap justify-center gap-1.5">
            {ranked.map((p) => (
              <span key={p.userId} className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">
                {p.name} <b className={p.gain ? "text-emerald-300" : "text-white/50"}>+{p.gain}</b>
              </span>
            ))}
          </div>
        </div>
      );
    if (snap.phase === "over")
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-[#1f2a44]/85 p-3 text-white">
          <p className={`${hand.className} text-3xl`} style={{ color: VD.yellow }}>🏆 Bảng vàng</p>
          <ol className="w-full max-w-xs space-y-1">
            {ranked.map((p, i) => (
              <li key={p.userId} className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold" style={{ background: i === 0 ? VD.yellow : "rgba(255,255,255,.12)", color: i === 0 ? VD.ink : "#fff" }}>
                <span className="w-5">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span>{p.score}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void monoEmit("vd:next").then((r) => !r.ok && r.error && toast.error(r.error))} className="rounded-xl px-4 py-2 text-sm font-black text-[#1f2a44]" style={{ background: VD.green, border: `3px solid ${VD.ink}` }}>
              Chơi ván mới
            </button>
            {isHost && !(room.settings as unknown as { quick?: boolean }).quick && (
              <button type="button" onClick={() => void resetToLobby()} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold">
                Về phòng chờ
              </button>
            )}
          </div>
        </div>
      );
    return null;
  })();

  const placeholder = snap.phase !== "draw" ? "Nhắn tin…" : snap.isDrawer ? "Chat (không được nói đáp án)" : iGuessed ? "Chat với người đã đoán đúng…" : "Gõ đáp án…";

  return (
    <div className={`${font.className} flex min-h-dvh flex-col`} style={PAGE_BG}>
      <header className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: "rgba(31,42,68,.85)" }}>
        <button type="button" onClick={() => void leave()} className="inline-flex items-center gap-1 rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold">
          <ArrowLeft className="h-4 w-4" /> Rời
        </button>
        <span className={`${hand.className} min-w-0 truncate text-lg`}>Vẽ Đoán</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">
          Vòng {snap.round}/{snap.rounds}
        </span>
        <span className="hidden font-mono text-xs tracking-widest text-white/70 sm:inline">{code}</span>
        <span className="ml-auto" />
        <MSVoiceControls />
        <SoundToggle />
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-3 p-2 sm:p-3 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* bảng điểm */}
        <aside className="order-2 flex gap-1.5 overflow-x-auto rounded-2xl p-2 lg:order-1 lg:flex-col lg:overflow-visible" style={CARD}>
          {ranked.map((p, i) => {
            const drawing = p.userId === snap.drawer && snap.phase !== "over";
            return (
              <div key={p.userId} className={`flex min-w-[140px] items-center gap-2 rounded-xl px-2 py-1.5 lg:min-w-0 ${p.guessed ? "bg-emerald-100" : drawing ? "bg-amber-100" : "bg-white"}`} style={{ border: `2px solid ${p.userId === myUserId ? VD.ink : "rgba(31,42,68,.15)"}`, opacity: p.connected ? 1 : 0.5 }}>
                <span className="w-4 text-center text-xs font-black opacity-60">{i + 1}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: colorOf(p.userId) }}>
                  {drawing ? <Pencil className="h-4 w-4" /> : p.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-black">
                    <span className="truncate">{p.userId === myUserId ? `${p.name} (bạn)` : p.name}</span>
                    {p.userId === room.hostId && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                    <VoiceBadge userId={p.userId} size="xs" />
                  </p>
                  <p className="text-xs font-bold opacity-70">
                    {p.score} điểm {p.gain > 0 && <span className="text-emerald-600">+{p.gain}</span>}
                  </p>
                </div>
                {p.guessed && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
              </div>
            );
          })}
        </aside>

        {/* bảng vẽ */}
        <main className="order-1 flex min-w-0 flex-col gap-2 lg:order-2">
          <div className="flex items-center gap-2 rounded-2xl px-3 py-2" style={CARD}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-black ${left !== null && left <= 10 && snap.phase === "draw" ? "animate-pulse bg-rose-500 text-white" : "bg-amber-100"}`} style={{ border: `2.5px solid ${VD.ink}` }}>
              {live && left !== null ? left : <Clock className="h-5 w-5" />}
            </span>
            <div className={`${hand.className} min-w-0 flex-1 truncate text-center text-xl sm:text-2xl`}>{wordBar}</div>
          </div>
          <DrawBoard
            ops={board.ops}
            canDraw={snap.isDrawer && snap.phase === "draw"}
            onOps={(ops) => {
              pending.current.push(...ops);
              setBoard((b) => ({ ...b, ops: [...b.ops, ...ops] }));
            }}
            overlay={overlay}
          />
        </main>

        {/* đoán / chat */}
        <aside className="order-3 flex h-72 min-h-0 flex-col overflow-hidden rounded-2xl lg:h-[calc(100dvh-80px)]" style={CARD}>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 text-sm">
            {messages.map((m) => {
              if (m.kind === "system") return <p key={m.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{m.text}</p>;
              if (m.kind === "correct") return <p key={m.id} className="rounded-lg bg-emerald-100 px-2 py-1 font-black text-emerald-700">{m.text}</p>;
              if (m.kind === "close") return <p key={m.id} className="rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-800">{m.text}</p>;
              return (
                <p key={m.id} className={m.kind === "guessed" ? "rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-800" : "px-1"}>
                  <b style={{ color: colorOf(m.userId) }}>{m.userId === myUserId ? "Bạn" : m.name}:</b> {m.text}
                </p>
              );
            })}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={(e) => void send(e)} className="flex gap-1.5 border-t-2 border-[#1f2a44]/15 p-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={placeholder} className="min-w-0 flex-1 rounded-xl border-2 border-[#1f2a44]/25 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#3a86ff]" />
            <button type="submit" aria-label="Gửi" className="rounded-xl px-3 text-white" style={{ background: VD.blue, border: `2px solid ${VD.ink}` }}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
