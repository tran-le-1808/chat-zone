"use client";

/** Phòng Sắc Màu online: kết nối / lỗi / phòng chờ (thêm máy) / ván bài */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, Check, Copy, Crown, MessageCircle, Plus, UserX } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import GameChat from "../../../monopoly/_components/GameChat";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { SM_BOT_LEVELS, type SMBotLevel } from "../../_lib/bot";
import SMTable from "../SMTable";
import SoundToggle from "../SoundToggle";
import { CARD_BG, font as display, PAGE_BG, SM } from "../theme";
import { TURN_OPTIONS, type SMRoomSettings, type SMSnapshot } from "./types";

const SMX = { main: "#6d4ce0", dark: "#4a2fb0", gold2: "#c99a2e", inkSoft: "#5b557a" };

function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-white" style={PAGE_BG}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ffd166] border-t-transparent" />
      <p className="text-sm opacity-70">{text}</p>
    </div>
  );
}

const chatTrigger = ({ onClick, unread }: { onClick: () => void; unread: number }) => (
  <button type="button" onClick={onClick} aria-label="Mở chat" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#ffd166]/40 bg-white/10 text-[#ffd166] hover:bg-white/15">
    <MessageCircle className="h-4 w-4" />
    {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6d4ce0] px-1 text-[9px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
  </button>
);

export default function SacMauRoomScreen() {
  const { room, uiStatus, error } = useRoom();
  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) return <Loading text="Đang vào phòng…" />;
  if (uiStatus === "error" || !room)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4" style={PAGE_BG}>
        <div className="w-full max-w-sm space-y-4 rounded-3xl p-6 text-center" style={{ ...CARD_BG, color: SM.ink }}>
          <h2 className="text-xl font-black">Không thể vào phòng</h2>
          <p className="text-sm">{error}</p>
          <Link href="/games/sacmau" className="block rounded-xl px-4 py-2.5 font-bold text-white" style={{ background: SMX.main }}>
            Về sảnh Sắc Màu
          </Link>
        </div>
      </div>
    );
  return room.status === "lobby" ? <WaitingRoom /> : <OnlineGame />;
}

function WaitingRoom() {
  const { room, me, isHost, myUserId, code, setReady, startGame, updateSettings, kickPlayer, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);
  if (!room) return null;
  const st = room.settings as unknown as SMRoomSettings;
  const players = room.players as unknown as { userId: string; name: string; seat: number; ready: boolean; connected: boolean; botLevel?: string | null }[];
  const humansReady = players.every((p) => p.botLevel || p.userId === room.hostId || (p.ready && p.connected));
  const canStart = isHost && players.length >= 2 && humansReady;
  const addBot = async (level: SMBotLevel) => {
    const r = await monoEmit("sm:bot:add", { level });
    if (!r.ok) toast.error(r.error ?? "Không thêm được máy");
  };
  return (
    <div className={`${display.className} min-h-dvh p-4 text-white`} style={PAGE_BG}>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void leaveRoom()} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Rời phòng
          </button>
          <h1 className="text-lg font-black">Phòng Sắc Màu</h1>
          <div className="ml-auto">
            <GameChat variant="modal" trigger={chatTrigger} />
          </div>
        </div>
        <div className="space-y-4 rounded-3xl p-4 sm:p-5" style={{ ...CARD_BG, color: SM.ink }}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: "#fff", border: `1.5px dashed ${SMX.gold2}` }}
          >
            <span className="text-xs font-semibold" style={{ color: SMX.inkSoft }}>Mã phòng (gửi cho bạn bè)</span>
            <span className="flex items-center gap-2 font-mono text-xl font-black tracking-[0.3em]" style={{ color: SMX.main }}>
              {code} {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-60" />}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((seat) => {
              const p = players.find((x) => x.seat === seat);
              return (
                <div key={seat} className="flex min-h-[64px] items-center gap-2 rounded-2xl px-3 py-2" style={{ background: p ? "#fff" : "rgba(0,0,0,.04)", border: `1.5px ${p ? "solid" : "dashed"} ${p ? SM.gold : "rgba(0,0,0,.2)"}` }}>
                  {p ? (
                    <>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: p.botLevel ? "#4b5563" : SMX.main }}>
                        {p.botLevel ? <Bot className="h-4 w-4" /> : p.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-sm font-black">
                          {p.name}
                          {p.userId === room.hostId && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: SMX.gold2 }} />}
                        </p>
                        <p className="text-[11px] font-semibold" style={{ color: SMX.inkSoft }}>
                          {p.botLevel ? `Máy · ${SM_BOT_LEVELS[p.botLevel as SMBotLevel] ?? ""}` : p.userId === myUserId ? "Bạn" : !p.connected ? "mất kết nối" : p.userId === room.hostId ? "Chủ phòng" : p.ready ? "✅ Sẵn sàng" : "Chưa sẵn sàng"}
                        </p>
                      </div>
                      {isHost && p.userId !== myUserId && (
                        <button type="button" title="Mời ra" onClick={() => void kickPlayer(p.userId)} className="rounded-lg p-1 opacity-50 hover:bg-rose-100 hover:text-rose-700 hover:opacity-100">
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : isHost ? (
                    <div className="flex w-full flex-wrap items-center gap-1">
                      <span className="mr-auto text-xs font-semibold opacity-60">Ghế trống</span>
                      {(Object.keys(SM_BOT_LEVELS) as SMBotLevel[]).map((l) => (
                        <button key={l} type="button" onClick={() => void addBot(l)} className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[11px] font-bold text-white" style={{ background: "#4b5563" }}>
                          <Plus className="h-3 w-3" /> {SM_BOT_LEVELS[l]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold opacity-60">Đang chờ người chơi…</span>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <p className="mb-2 text-sm font-black" style={{ color: SMX.main }}>Thời gian mỗi lượt {isHost ? "" : "(chủ phòng chỉnh)"}</p>
            <div className="grid grid-cols-3 gap-2">
              {TURN_OPTIONS.map((s) => {
                const on = st.turnSeconds === s;
                return (
                  <button key={s} type="button" disabled={!isHost} onClick={() => void updateSettings({ turnSeconds: s })} className="rounded-xl py-2 text-sm font-black disabled:cursor-default" style={{ background: on ? SMX.main : "#fff", color: on ? "#fff" : SM.ink, border: `1.5px solid ${on ? SMX.dark : "rgba(0,0,0,.15)"}` }}>
                    {s} giây
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" disabled={!isHost} className="h-4 w-4 accent-[#6d4ce0]" checked={st.stack} onChange={(e) => void updateSettings({ stack: e.target.checked })} />
              Cho phép cộng dồn +2 / +4
            </label>
            <p className="mt-2 text-xs" style={{ color: SMX.inkSoft }}>Hết giờ: tự bốc bài rồi bỏ lượt. Người rời giữa ván sẽ có máy đánh thay.</p>
          </div>

          {isHost ? (
            <button type="button" disabled={!canStart} onClick={() => void startGame()} className="w-full rounded-xl py-3 text-lg font-black text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SMX.main}, ${SMX.dark})`, boxShadow: `inset 0 0 0 2px ${SM.gold}` }}>
              {players.length < 2 ? "Cần ít nhất 2 người (thêm máy)" : canStart ? "Chia bài" : "Chờ mọi người sẵn sàng"}
            </button>
          ) : (
            <button type="button" onClick={() => void setReady(!me?.ready)} className="w-full rounded-xl py-3 text-lg font-black text-white" style={{ background: `linear-gradient(180deg, ${SMX.main}, ${SMX.dark})`, boxShadow: `inset 0 0 0 2px ${SM.gold}` }}>
              {me?.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OnlineGame() {
  const { room, initialSnapshot, isHost, resetToLobby, leaveRoom, code } = useRoom();
  const [snap, setSnap] = useState<SMSnapshot | null>(initialSnapshot as SMSnapshot | null);
  const [offset, setOffset] = useState(0);

  const apply = useCallback((s: SMSnapshot | null) => {
    if (!s) return;
    setOffset(s.serverNow - Date.now());
    setSnap((cur) => (cur && cur.games === s.games && s.seq < cur.seq ? cur : s));
  }, []);

  useEffect(() => {
    const onState = (s: SMSnapshot | null) => apply(s);
    socket.on("sm:state", onState);
    const sync = () => void monoEmit<SMSnapshot | null>("sm:sync").then((r) => r.ok && apply(r.data ?? null));
    sync();
    const onReconnect = () => setTimeout(sync, 800);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("sm:state", onState);
      socket.off("connect", onReconnect);
    };
  }, [apply]);

  if (!snap || !room) return <Loading text="Đang chia bài…" />;
  const st = room.settings as unknown as SMRoomSettings;

  const act = async (ev: string, body: Record<string, unknown>) => {
    const r = await monoEmit<SMSnapshot | null>(ev, { ...body, seq: snap.seq });
    if (!r.ok) {
      toast.error(r.error ?? "Không thực hiện được");
      if (r.data) apply(r.data);
    }
    return r.ok;
  };
  const leave = async () => {
    if (!snap.over && !(await confirmDialog({ title: "Rời bàn giữa ván?", message: "Máy sẽ đánh thay bạn cho hết ván này.", confirmText: "Rời bàn", cancelText: "Ở lại", tone: "danger" }))) return;
    void leaveRoom();
  };

  return (
    <SMTable
      view={{ ...snap, step: snap.seq, deadline: snap.over ? null : snap.deadline - offset }}
      onPlay={(card, color, call) => act("sm:play", { card, color, call })}
      onDraw={() => void act("sm:draw", {})}
      onPass={() => void act("sm:pass", {})}
      onNext={() => void act("sm:next", {})}
      nextLabel="Chia ván mới"
      resultExtra={
        isHost && !st.quick ? (
          <button type="button" onClick={() => void resetToLobby()} className="rounded-xl border border-black/15 px-4 py-3 text-sm font-bold">
            Về phòng chờ
          </button>
        ) : undefined
      }
      header={
        <header className="flex items-center gap-2 px-3 py-2" style={{ background: `linear-gradient(90deg, ${SMX.dark}, #120f2b)`, borderBottom: `1px solid ${SM.gold}55` }}>
          <button type="button" onClick={() => void leave()} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Rời
          </button>
          <span className="text-sm font-black">Sắc Màu · ván {snap.games}</span>
          <span className="font-mono text-xs tracking-widest text-[#ffd166]">{code}</span>
          <span className="ml-auto" />
          <SoundToggle />
          <GameChat variant="modal" trigger={chatTrigger} />
        </header>
      }
    />
  );
}
