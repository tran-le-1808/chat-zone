"use client";

/** Phòng cờ caro online: kết nối / lỗi / phòng chờ / ván đấu (ván đấu giữ lại khi vừa kết thúc để xem kết quả) */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Crown, Flag, MessageCircle, RefreshCw, UserX } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { ui } from "@/components/ui/styles";
import GameChat from "../../../monopoly/_components/GameChat";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { RULE_HINT, RULE_LABEL, type CaroRule } from "../../_lib/rules";
import CaroBoard, { STONE_COLOR, STONE_LABEL } from "../CaroBoard";
import SoundToggle from "../SoundToggle";
import { caroSound } from "../../_lib/sound";
import type { CaroRoomSettings, CaroSnapshot } from "./types";

function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0b0d1a] text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4b942] border-t-transparent" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

const chatTrigger = ({ onClick, unread }: { onClick: () => void; unread: number }) => (
  <button type="button" onClick={onClick} aria-label="Mở chat" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
    <MessageCircle className="h-4 w-4" />
    {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c81d25] px-1 text-[9px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
  </button>
);

export default function CaroRoomScreen() {
  const { room, uiStatus, error } = useRoom();
  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) return <Loading text="Đang vào phòng…" />;
  if (uiStatus === "error" || !room)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0b0d1a] p-4 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-[#c81d25]/40 bg-[#11132a] p-6 text-center shadow-2xl">
          <h2 className="text-xl font-bold">Không thể vào phòng</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <Link href="/games/caro" className={`${ui.btnPrimary} block`}>Về sảnh Cờ Caro</Link>
        </div>
      </div>
    );
  return room.status === "lobby" ? <WaitingRoom /> : <OnlineGame />;
}

// ------------------------------------------------------------------ phòng chờ

function WaitingRoom() {
  const { room, me, isHost, myUserId, code, setReady, startGame, updateSettings, kickPlayer, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);
  if (!room) return null;
  const st = room.settings as unknown as CaroRoomSettings;
  const opponent = room.players.find((p) => p.userId !== myUserId);
  const canStart = isHost && room.players.length === 2 && !!opponent?.ready && opponent.connected;
  const chip = (on: boolean) => `rounded-xl border px-3 py-1.5 text-sm font-bold ${on ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.04] text-slate-300"} disabled:opacity-60`;
  return (
    <div className="min-h-dvh bg-[#0b0d1a] p-4 text-slate-100">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void leaveRoom()} className={`${ui.btnGhost} px-2! py-1.5!`}>
            <ArrowLeft className="h-4 w-4" /> Rời phòng
          </button>
          <h1 className="text-lg font-black">Phòng Cờ Caro</h1>
          <div className="ml-auto">
            <GameChat variant="modal" trigger={chatTrigger} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span className="text-xs text-slate-400">Mã phòng (gửi cho bạn bè)</span>
          <span className="flex items-center gap-2 font-mono text-xl font-black tracking-[0.3em] text-[#ffd166]">
            {code} {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
          </span>
        </button>

        <section className={`${ui.card} space-y-2 p-4`}>
          {[0, 1].map((seat) => {
            const p = room.players.find((x) => x.seat === seat);
            return (
              <div key={seat} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="w-16 text-xs text-slate-400">Ghế {seat + 1}</span>
                {p ? (
                  <>
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {p.name}
                      {p.userId === myUserId && " (bạn)"}
                    </span>
                    {p.userId === room.hostId && <Crown className="h-4 w-4 text-[#ffd166]" />}
                    {!p.connected && <span className="text-xs text-rose-300">mất kết nối</span>}
                    {p.userId !== room.hostId && <span className={`text-xs font-bold ${p.ready ? "text-emerald-300" : "text-slate-500"}`}>{p.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}</span>}
                    {isHost && p.userId !== myUserId && (
                      <button type="button" title="Mời ra" onClick={() => void kickPlayer(p.userId)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300">
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <span className="flex-1 text-sm text-slate-500">Đang chờ người chơi…</span>
                )}
              </div>
            );
          })}
        </section>

        <section className={`${ui.card} space-y-3 p-4`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cài đặt {isHost ? "" : "(chủ phòng chỉnh)"}</p>
          <div className="flex flex-wrap gap-2">
            {(["block2", "free"] as CaroRule[]).map((r) => (
              <button key={r} type="button" disabled={!isHost} className={chip(st.rule === r)} onClick={() => void updateSettings({ rule: r })}>{RULE_LABEL[r]}</button>
            ))}
          </div>
          <p className="text-xs text-slate-400">{RULE_HINT[st.rule]}</p>
          <div className="flex flex-wrap gap-2">
            {[15, 30, 60].map((s) => (
              <button key={s} type="button" disabled={!isHost} className={chip(st.turnSeconds === s)} onClick={() => void updateSettings({ turnSeconds: s })}>{s}s/nước</button>
            ))}
          </div>
          <p className="text-xs text-slate-400">Hết giờ một nước là thua ván. Ván sau đổi người cầm X (đi trước).</p>
        </section>

        {isHost ? (
          <button type="button" disabled={!canStart} onClick={() => void startGame()} className={`${ui.btnPrimary} w-full disabled:opacity-50`}>
            {room.players.length < 2 ? "Chờ đối thủ vào phòng" : canStart ? "Bắt đầu" : "Chờ đối thủ sẵn sàng"}
          </button>
        ) : (
          <button type="button" onClick={() => void setReady(!me?.ready)} className={`${ui.btnPrimary} w-full`}>
            {me?.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ván đấu

function OnlineGame() {
  const { room, myUserId, initialSnapshot, isHost, resetToLobby, leaveRoom } = useRoom();
  const [snap, setSnap] = useState<CaroSnapshot | null>(initialSnapshot as CaroSnapshot | null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);

  const apply = useCallback((s: CaroSnapshot | null) => {
    if (!s) return;
    setOffset(s.serverNow - Date.now());
    // bỏ snapshot cũ / đến muộn; ván mới (chưa có nước nào) luôn nhận
    setSnap((cur) => (cur && s.seq < cur.seq && s.moves.length > 0 ? cur : s));
  }, []);

  useEffect(() => {
    const onState = (s: CaroSnapshot | null) => apply(s);
    socket.on("caro:state", onState);
    const sync = () => void monoEmit<CaroSnapshot | null>("caro:sync").then((r) => r.ok && apply(r.data ?? null));
    sync();
    const onReconnect = () => setTimeout(sync, 800);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("caro:state", onState);
      socket.off("connect", onReconnect);
    };
  }, [apply]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const mySeat = snap ? snap.players.indexOf(myUserId ?? "") : -1;
  const myStone = snap && mySeat >= 0 ? (mySeat === snap.xSeat ? 1 : 2) : null;
  const over = !!snap && (snap.winnerSeat !== null || snap.draw || room?.status === "finished");
  const myTurn = !!snap && !over && myStone === snap.turn;
  const remain = snap ? Math.max(0, ((snap.pausedAt ?? now + offset) - snap.deadline) * -1) / 1000 : 0;
  const last = snap?.moves.length ? snap.moves[snap.moves.length - 1] : null;

  // âm thanh: quân mới (mình / đối thủ), kết quả ván — mỗi sự kiện phát một lần
  const heard = useRef<{ moves: number; over: boolean } | null>(null);
  useEffect(() => {
    if (!snap) return;
    const n = snap.moves.length;
    const h = heard.current;
    // lần đầu vào phòng (hoặc vào lại): không phát lại các nước cũ
    if (!h) {
      heard.current = { moves: n, over };
      return;
    }
    if (n > h.moves) {
      const [x, y] = snap.moves[n - 1];
      caroSound.play(snap.board[y * snap.size + x] === myStone ? "place" : "opponent");
    }
    if (over && !h.over) setTimeout(() => caroSound.play(snap.winnerSeat === null ? "draw" : snap.winnerSeat === mySeat ? "win" : "lose"), 180);
    heard.current = { moves: n, over };
  }, [snap, over, myStone, mySeat]);

  const play = async (x: number, y: number) => {
    caroSound.unlock();
    if (!snap || !myTurn || sending) return;
    setSending(true);
    // hiện ngay quân vừa đi (server xác nhận qua caro:state)
    const optimistic = { ...snap, board: snap.board.slice(), moves: [...snap.moves, [x, y] as [number, number]] };
    optimistic.board[y * snap.size + x] = snap.turn;
    setSnap(optimistic);
    const r = await monoEmit<CaroSnapshot | null>("caro:move", { x, y, seq: snap.seq });
    setSending(false);
    if (!r.ok) {
      toast.error(r.error ?? "Không đi được");
      if (r.data) apply(r.data);
      else setSnap(snap);
    }
  };

  const resign = async () => {
    if (!(await confirmDialog({ title: "Xin thua?", message: "Ván này sẽ tính là bạn thua.", confirmText: "Xin thua", cancelText: "Chơi tiếp", tone: "danger" }))) return;
    const r = await monoEmit("caro:resign");
    if (!r.ok) toast.error(r.error ?? "Không xin thua được");
  };
  const rematch = async () => {
    const r = await monoEmit("caro:rematch");
    if (!r.ok) toast.error(r.error ?? "Không bắt đầu ván mới được");
  };
  const leave = async () => {
    if (!over && !(await confirmDialog({ title: "Rời phòng giữa ván?", message: "Rời phòng lúc này sẽ bị xử thua.", confirmText: "Rời phòng", cancelText: "Ở lại", tone: "danger" }))) return;
    void leaveRoom();
  };

  const result = useMemo(() => {
    if (!snap || !over) return null;
    if (snap.winnerSeat === null) return { text: "Hoà", tone: "text-slate-200" };
    return snap.winnerSeat === mySeat ? { text: "🎉 Bạn thắng!", tone: "text-emerald-300" } : { text: "Bạn thua", tone: "text-rose-300" };
  }, [snap, over, mySeat]);

  if (!snap || !room) return <Loading text="Đang đồng bộ bàn cờ…" />;
  const st = room.settings as unknown as CaroRoomSettings;
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-white/10 disabled:opacity-40";
  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0d1a] text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <button type="button" onClick={() => void leave()} className={btn}>
          <ArrowLeft className="h-4 w-4" /> Rời
        </button>
        <span className="text-sm font-black">Cờ Caro · {RULE_LABEL[snap.rule]}</span>
        <span className="font-mono text-xs tracking-widest text-[#ffd166]">{room.code}</span>
        <span className="ml-auto rounded-lg bg-white/5 px-2 py-1 text-xs font-bold tabular-nums">
          {snap.names[0]} {snap.score[0]} – {snap.score[1]} {snap.names[1]}
        </span>
        <SoundToggle />
        <GameChat variant="modal" trigger={chatTrigger} />
      </header>
      <main className="flex flex-1 flex-col items-center gap-3 p-3 lg:flex-row lg:items-start lg:justify-center">
        <div className="aspect-square w-full max-w-[min(94vw,calc(100dvh-150px))]">
          <CaroBoard size={snap.size} board={snap.board} lastMove={last} winLine={snap.winLine} hoverStone={myTurn ? myStone : null} disabled={!myTurn || sending} onCell={(x, y) => void play(x, y)} />
        </div>
        <aside className="w-full max-w-sm space-y-3">
          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#11132a] p-3">
            {[0, 1].map((seat) => {
              const stone = seat === snap.xSeat ? 1 : 2;
              const active = !over && snap.turn === stone;
              const p = room.players.find((x) => x.userId === snap.players[seat]);
              return (
                <div key={seat} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${active ? "border-[#ffd166] bg-[#ffd166]/10" : "border-white/10"}`}>
                  <span className="text-lg font-black" style={{ color: STONE_COLOR[stone] }}>{STONE_LABEL[stone]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {snap.names[seat]}
                    {seat === mySeat && " (bạn)"}
                  </span>
                  {p && !p.connected && <span className="text-[11px] text-rose-300">mất kết nối</span>}
                  {active && (
                    <span className={`font-mono text-sm font-black tabular-nums ${remain <= 5 ? "text-rose-400" : "text-slate-200"}`}>
                      {snap.pausedAt ? "⏸" : `${Math.ceil(remain)}s`}
                    </span>
                  )}
                </div>
              );
            })}
            {!over && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${remain <= 5 ? "bg-rose-500" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (remain / st.turnSeconds) * 100)}%` }} />
                </div>
                <p className="text-sm font-bold">{myTurn ? "Lượt của bạn" : mySeat < 0 ? "Đang xem" : "Đối thủ đang nghĩ…"}</p>
              </>
            )}
            {result && (
              <div className="space-y-1 pt-1">
                <p className={`text-lg font-black ${result.tone}`}>{result.text}</p>
                <p className="text-xs text-slate-400">{snap.endReason}</p>
              </div>
            )}
            <p className="text-[11px] text-slate-500">{RULE_HINT[snap.rule]} · {st.turnSeconds}s/nước · {snap.moves.length} nước</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!over && mySeat >= 0 && (
              <button type="button" className={btn} onClick={() => void resign()}>
                <Flag className="h-4 w-4" /> Xin thua
              </button>
            )}
            {over && (
              <button type="button" className={`${btn} border-[#ffd166]/50 text-[#ffd166]`} onClick={() => void rematch()}>
                <RefreshCw className="h-4 w-4" /> Ván mới (đổi người đi trước)
              </button>
            )}
            {over && isHost && !st.quick && (
              <button type="button" className={btn} onClick={() => void resetToLobby()}>
                Về phòng chờ
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
