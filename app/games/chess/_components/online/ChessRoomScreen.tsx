"use client";

/** Phòng cờ vua online: kết nối / lỗi / phòng chờ / ván đấu (giữ bàn cờ khi vừa kết thúc để xem kết quả) */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Crown, Flag, FlipVertical2, Handshake, MessageCircle, RefreshCw, UserX } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import GameChat from "../../../monopoly/_components/GameChat";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { enc, inCheck, makeMove, SIDE_VI, type Side } from "../../_lib/rules";
import { chessSound, soundForMove } from "../../_lib/sound";
import ChessBoard from "../ChessBoard";
import SoundToggle from "../SoundToggle";
import { btnCls, capturedBy, CheckBanner, fmtClock, MoveList, PlayerCard } from "../ui";
import { CARD_BG, CH, PAGE_BG, serif } from "../theme";
import { TIME_OPTIONS, type ChessRoomSettings, type ChessSnapshot } from "./types";


function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-[#f6f1e4]" style={PAGE_BG}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a646] border-t-transparent" />
      <p className="text-sm opacity-70">{text}</p>
    </div>
  );
}

const chatTrigger = ({ onClick, unread }: { onClick: () => void; unread: number }) => (
  <button type="button" onClick={onClick} aria-label="Mở chat" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#c9a646]/40 bg-white/5 text-[#e6cf86] hover:bg-white/10">
    <MessageCircle className="h-4 w-4" />
    {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2f6b4f] px-1 text-[9px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
  </button>
);

export default function ChessRoomScreen() {
  const { room, uiStatus, error } = useRoom();
  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) return <Loading text="Đang vào phòng…" />;
  if (uiStatus === "error" || !room)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4" style={PAGE_BG}>
        <div className="w-full max-w-sm space-y-4 rounded-3xl p-6 text-center" style={{ ...CARD_BG, color: CH.ink }}>
          <h2 className={`${serif.className} text-xl font-extrabold`}>Không thể vào phòng</h2>
          <p className="text-sm">{error}</p>
          <Link href="/games/chess" className="block rounded-xl px-4 py-2.5 font-bold text-white" style={{ background: CH.green }}>
            Về sảnh Cờ Vua
          </Link>
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
  const st = room.settings as unknown as ChessRoomSettings;
  const opponent = room.players.find((p) => p.userId !== myUserId);
  const canStart = isHost && room.players.length === 2 && !!opponent?.ready && opponent.connected;
  return (
    <div className="min-h-dvh p-4 text-[#f6f1e4]" style={PAGE_BG}>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void leaveRoom()} className={btnCls}>
            <ArrowLeft className="h-4 w-4" /> Rời phòng
          </button>
          <h1 className={`${serif.className} text-lg font-extrabold`}>Phòng Cờ Vua</h1>
          <div className="ml-auto">
            <GameChat variant="modal" trigger={chatTrigger} />
          </div>
        </div>
        <div className="space-y-4 rounded-3xl p-4 sm:p-5" style={{ ...CARD_BG, color: CH.ink }}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: "#fff8e6", border: `1.5px dashed ${CH.gold}` }}
          >
            <span className="text-xs font-semibold" style={{ color: CH.inkSoft }}>Mã phòng (gửi cho bạn bè)</span>
            <span className="flex items-center gap-2 font-mono text-xl font-black tracking-[0.3em]" style={{ color: CH.green }}>
              {code} {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-60" />}
            </span>
          </button>

          <div className="space-y-2">
            {[0, 1].map((seat) => {
              const p = room.players.find((x) => x.seat === seat);
              return (
                <div key={seat} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(90,52,23,.18)" }}>
                  <span className="w-14 text-xs font-semibold" style={{ color: CH.inkSoft }}>Ghế {seat + 1}</span>
                  {p ? (
                    <>
                      <span className="min-w-0 flex-1 truncate font-bold">
                        {p.name}
                        {p.userId === myUserId && " (bạn)"}
                      </span>
                      {p.userId === room.hostId && <Crown className="h-4 w-4" style={{ color: CH.gold }} />}
                      {!p.connected && <span className="text-xs text-rose-700">mất kết nối</span>}
                      {p.userId !== room.hostId && <span className={`text-xs font-bold ${p.ready ? "text-emerald-700" : "opacity-50"}`}>{p.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}</span>}
                      {isHost && p.userId !== myUserId && (
                        <button type="button" title="Mời ra" onClick={() => void kickPlayer(p.userId)} className="rounded-lg p-1 opacity-60 hover:bg-rose-100 hover:text-rose-700 hover:opacity-100">
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="flex-1 text-sm opacity-50">Đang chờ người chơi…</span>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <p className={`${serif.className} mb-2 text-sm font-extrabold`} style={{ color: CH.green }}>
              Thời gian mỗi bên {isHost ? "" : "(chủ phòng chỉnh)"}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {TIME_OPTIONS.map((m) => {
                const on = st.timeMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!isHost}
                    onClick={() => void updateSettings({ timeMinutes: m })}
                    className="rounded-xl py-2 text-sm font-bold disabled:cursor-default"
                    style={{ background: on ? CH.green : "rgba(255,255,255,.6)", color: on ? "#fff" : CH.ink, border: `1.5px solid ${on ? CH.greenDeep : "rgba(90,52,23,.25)"}` }}
                  >
                    {m} phút
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs" style={{ color: CH.inkSoft }}>Hết giờ là thua. Ván sau đổi người cầm quân Trắng (đi trước).</p>
          </div>

          {isHost ? (
            <button type="button" disabled={!canStart} onClick={() => void startGame()} className={`${serif.className} w-full rounded-xl py-3 text-lg font-extrabold text-white disabled:opacity-50`} style={{ background: `linear-gradient(180deg, ${CH.green}, ${CH.greenDeep})`, boxShadow: `inset 0 0 0 2px ${CH.goldSoft}` }}>
              {room.players.length < 2 ? "Chờ đối thủ vào phòng" : canStart ? "Bắt đầu" : "Chờ đối thủ sẵn sàng"}
            </button>
          ) : (
            <button type="button" onClick={() => void setReady(!me?.ready)} className={`${serif.className} w-full rounded-xl py-3 text-lg font-extrabold text-white`} style={{ background: `linear-gradient(180deg, ${CH.green}, ${CH.greenDeep})`, boxShadow: `inset 0 0 0 2px ${CH.goldSoft}` }}>
              {me?.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ván đấu

function OnlineGame() {
  const { room, myUserId, initialSnapshot, isHost, resetToLobby, leaveRoom } = useRoom();
  const [snap, setSnap] = useState<ChessSnapshot | null>(initialSnapshot as ChessSnapshot | null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [flipOverride, setFlipOverride] = useState(false);

  const apply = useCallback((s: ChessSnapshot | null) => {
    if (!s) return;
    setOffset(s.serverNow - Date.now());
    setSnap((cur) => (cur && s.seq < cur.seq && s.moves.length > 0 ? cur : s));
  }, []);

  useEffect(() => {
    const onState = (s: ChessSnapshot | null) => apply(s);
    socket.on("chess:state", onState);
    const sync = () => void monoEmit<ChessSnapshot | null>("chess:sync").then((r) => r.ok && apply(r.data ?? null));
    sync();
    const onReconnect = () => setTimeout(sync, 800);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("chess:state", onState);
      socket.off("connect", onReconnect);
    };
  }, [apply]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const mySeat = snap ? snap.players.indexOf(myUserId ?? "") : -1;
  const mySide: Side | null = snap && mySeat >= 0 ? (mySeat === snap.whiteSeat ? 1 : -1) : null;
  const over = !!snap && (snap.winnerSeat !== null || snap.draw || room?.status === "finished");
  const myTurn = !!snap && !over && mySide === snap.turn;
  const flipped = (mySide === -1) !== flipOverride;

  // đồng hồ hiển thị
  const clockOf = (seat: number) => {
    if (!snap) return 0;
    const turnSeat = snap.turn === 1 ? snap.whiteSeat : 1 - snap.whiteSeat;
    if (over || seat !== turnSeat || snap.pausedAt) return snap.clocks[seat];
    return snap.clocks[seat] - (now + offset - snap.turnStart);
  };

  // âm thanh & băng rôn chiếu tướng
  const heard = useRef<{ moves: number; over: boolean } | null>(null);
  const [checkFlash, setCheckFlash] = useState<{ n: number; mate: boolean } | null>(null);
  useEffect(() => {
    if (!snap) return;
    const n = snap.moves.length;
    const h = heard.current;
    if (!h) {
      heard.current = { moves: n, over };
      return;
    }
    if (n > h.moves) {
      soundForMove(snap.captures[n - 1], snap.checks[n - 1]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (snap.checks[n - 1]) setCheckFlash({ n, mate: /#$/.test(snap.san[n - 1] ?? "") });
    }
    if (over && !h.over) setTimeout(() => chessSound.play(snap.winnerSeat === null ? "draw" : snap.winnerSeat === mySeat ? "win" : "lose"), 200);
    heard.current = { moves: n, over };
  }, [snap, over, mySeat]);
  useEffect(() => {
    if (!checkFlash) return;
    const t = setTimeout(() => setCheckFlash(null), 1100);
    return () => clearTimeout(t);
  }, [checkFlash]);

  const play = async (from: number, to: number, promo: number) => {
    if (!snap || !myTurn || sending) return;
    setSending(true);
    // hiện ngay quân vừa đi (server xác nhận qua chess:state)
    const { pos } = makeMove(snap, enc(from, to, promo));
    setSnap({ ...snap, ...pos, moves: [...snap.moves, [from, to, promo]] });
    const r = await monoEmit<ChessSnapshot | null>("chess:move", { from, to, promo, seq: snap.seq });
    setSending(false);
    if (!r.ok) {
      toast.error(r.error ?? "Không đi được");
      if (r.data) apply(r.data);
      else setSnap(snap);
    }
  };

  const resign = async () => {
    if (!(await confirmDialog({ title: "Xin thua?", message: "Ván này sẽ tính là bạn thua.", confirmText: "Xin thua", cancelText: "Chơi tiếp", tone: "danger" }))) return;
    const r = await monoEmit("chess:resign");
    if (!r.ok) toast.error(r.error ?? "Không xin thua được");
  };
  const offerDraw = async () => {
    const r = await monoEmit("chess:draw:offer");
    if (!r.ok) toast.error(r.error ?? "Không xin hoà được");
    else toast("Đã gửi lời xin hoà");
  };
  const answerDraw = async (accept: boolean) => {
    const r = await monoEmit("chess:draw:answer", { accept });
    if (!r.ok) toast.error(r.error ?? "Không trả lời được");
  };
  const rematch = async () => {
    const r = await monoEmit("chess:rematch");
    if (!r.ok) toast.error(r.error ?? "Không bắt đầu ván mới được");
  };
  const leave = async () => {
    if (!over && !(await confirmDialog({ title: "Rời phòng giữa ván?", message: "Rời phòng lúc này sẽ bị xử thua.", confirmText: "Rời phòng", cancelText: "Ở lại", tone: "danger" }))) return;
    void leaveRoom();
  };

  const result = useMemo(() => {
    if (!snap || !over) return null;
    if (snap.winnerSeat === null) return { text: "Hoà", tone: "text-slate-200" };
    return snap.winnerSeat === mySeat ? { text: "🎉 Bạn thắng!", tone: "text-emerald-300" } : mySeat < 0 ? { text: `${snap.names[snap.winnerSeat]} thắng`, tone: "text-[#e6cf86]" } : { text: "Bạn thua", tone: "text-rose-300" };
  }, [snap, over, mySeat]);

  if (!snap || !room) return <Loading text="Đang đồng bộ bàn cờ…" />;
  const st = room.settings as unknown as ChessRoomSettings;
  const caps = capturedBy(snap.captures);
  const lastM = snap.moves.at(-1);
  const last = lastM ? ([lastM[0], lastM[1]] as [number, number]) : null;
  const sideOfSeat = (seat: number): Side => (seat === snap.whiteSeat ? 1 : -1);
  // trên: đối thủ, dưới: mình (người xem: Đen trên, Trắng dưới)
  const bottomSeat = mySeat >= 0 ? mySeat : snap.whiteSeat;
  const topSeat = 1 - bottomSeat;
  const opponentOffered = snap.drawOffer !== null && mySeat >= 0 && snap.drawOffer !== mySeat && !over;
  const iOffered = snap.drawOffer === mySeat && !over;

  const card = (seat: number) => {
    const side = sideOfSeat(seat);
    const ms = clockOf(seat);
    const p = room.players.find((x) => x.userId === snap.players[seat]);
    return (
      <PlayerCard
        side={side}
        name={`${snap.names[seat]}${seat === mySeat ? " (bạn)" : ""} · ${SIDE_VI[side]}`}
        active={!over && snap.turn === side}
        clock={snap.pausedAt && !over && snap.turn === side ? "⏸" : fmtClock(ms)}
        low={!over && snap.turn === side && ms < 30_000}
        captured={caps[side]}
        opponentCaptured={caps[(-side) as Side]}
        note={p && !p.connected ? <span className="text-[11px] text-rose-300">mất kết nối</span> : undefined}
      />
    );
  };

  return (
    <div className="flex min-h-dvh flex-col text-[#f6f1e4]" style={PAGE_BG}>
      <header className="flex flex-wrap items-center gap-2 border-b border-[#c9a646]/25 px-3 py-2">
        <button type="button" onClick={() => void leave()} className={btnCls}>
          <ArrowLeft className="h-4 w-4" /> Rời
        </button>
        <span className={`${serif.className} text-base font-extrabold`}>Cờ Vua · {snap.timeMinutes} phút</span>
        <span className="font-mono text-xs tracking-widest text-[#e6cf86]">{room.code}</span>
        <span className="ml-auto rounded-lg bg-white/5 px-2 py-1 text-xs font-bold tabular-nums">
          {snap.names[0]} {snap.score[0]} – {snap.score[1]} {snap.names[1]}
        </span>
        <SoundToggle />
        <GameChat variant="modal" trigger={chatTrigger} />
      </header>
      <main className="flex flex-1 flex-col items-center gap-3 p-3 lg:flex-row lg:items-start lg:justify-center">
        <div className="relative aspect-square w-full max-w-[min(92vw,calc(100dvh-150px))]">
          <ChessBoard pos={snap} flipped={flipped} mySide={mySide} canMove={myTurn && !sending} lastMove={last} onMove={(f, t, p) => void play(f, t, p)} />
          <CheckBanner show={!!checkFlash} mate={checkFlash?.mate} />
        </div>
        <aside className="w-full max-w-sm space-y-2.5">
          {card(topSeat)}
          {card(bottomSeat)}
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            {!over && <p className="text-sm font-bold">{myTurn ? (mySide && inCheck(snap.b, mySide) ? "Bạn đang bị chiếu!" : "Lượt của bạn") : mySeat < 0 ? "Đang xem" : "Đối thủ đang nghĩ…"}</p>}
            {result && (
              <>
                <p className={`text-lg font-black ${result.tone}`}>{result.text}</p>
                <p className="text-xs opacity-70">{snap.endReason}</p>
              </>
            )}
            {opponentOffered && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#c9a646]/15 p-2 text-sm">
                <span className="flex-1">🤝 Đối thủ xin hoà</span>
                <button type="button" className={btnCls} onClick={() => void answerDraw(true)}>Đồng ý</button>
                <button type="button" className={btnCls} onClick={() => void answerDraw(false)}>Từ chối</button>
              </div>
            )}
            {iOffered && <p className="mt-1 text-xs text-[#e6cf86]">Đã xin hoà — chờ đối thủ trả lời</p>}
          </div>
          <MoveList san={snap.san} />
          <div className="flex flex-wrap gap-2">
            {!over && mySeat >= 0 && (
              <>
                <button type="button" className={btnCls} disabled={iOffered} onClick={() => void offerDraw()}>
                  <Handshake className="h-4 w-4" /> Xin hoà
                </button>
                <button type="button" className={btnCls} onClick={() => void resign()}>
                  <Flag className="h-4 w-4" /> Xin thua
                </button>
              </>
            )}
            <button type="button" className={btnCls} onClick={() => setFlipOverride((f) => !f)}>
              <FlipVertical2 className="h-4 w-4" /> Lật bàn
            </button>
            {over && mySeat >= 0 && (
              <button type="button" className={`${btnCls} border-[#e6cf86]! text-[#e6cf86]!`} onClick={() => void rematch()}>
                <RefreshCw className="h-4 w-4" /> Ván mới (đổi màu quân)
              </button>
            )}
            {over && isHost && !st.quick && (
              <button type="button" className={btnCls} onClick={() => void resetToLobby()}>
                Về phòng chờ
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
