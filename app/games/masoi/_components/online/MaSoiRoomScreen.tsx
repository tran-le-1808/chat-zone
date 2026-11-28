"use client";

/** Phòng Ma Sói online: kết nối / lỗi / phòng chờ (thêm máy) / ván chơi */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Check, Copy, Crown, MessageCircle, Plus, UserX } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import GameChat from "../../../monopoly/_components/GameChat";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { useOptionalVoice, VoiceProvider } from "../../../monopoly/_context/VoiceContext";
import VoiceControls, { VoiceBadge } from "../../../monopoly/_components/VoiceControls";
import { msVoiceRule } from "../../_lib/voice";
import MSVoiceControls from "./MSVoice";
import { MS_MIN, rolesFor, type MSAction } from "../../_lib/game";
import { MS_BOT_LEVELS, type MSBotLevel } from "../../_lib/bot";
import MSTable, { type ChatLine, type SeatVoice } from "../MSTable";
import SoundToggle from "../SoundToggle";
import { font, MS, NIGHT_BG, PAPER, ROLE } from "../theme";
import { DISCUSS_OPTIONS, MS_ROOM_MAX, type MSChatMessage, type MSRoomSettings, type MSSnapshot } from "./types";

function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-white" style={NIGHT_BG}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4e7bf] border-t-transparent" />
      <p className="text-sm opacity-70">{text}</p>
    </div>
  );
}

const chatTrigger = ({ onClick, unread }: { onClick: () => void; unread: number }) => (
  <button type="button" onClick={onClick} aria-label="Mở chat" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#f4e7bf]/40 bg-white/10 text-[#f4e7bf] hover:bg-white/15">
    <MessageCircle className="h-4 w-4" />
    {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c0392b] px-1 text-[9px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
  </button>
);

export default function MaSoiRoomScreen() {
  const { room, uiStatus, error } = useRoom();
  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) return <Loading text="Đang vào làng…" />;
  if (uiStatus === "error" || !room)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4" style={NIGHT_BG}>
        <div className="w-full max-w-sm space-y-4 rounded-3xl p-6 text-center" style={{ ...PAPER, color: MS.ink }}>
          <h2 className="text-xl font-black">Không thể vào phòng</h2>
          <p className="text-sm">{error}</p>
          <Link href="/games/masoi" className="block rounded-xl px-4 py-2.5 font-bold text-white" style={{ background: MS.blood }}>
            Về sảnh Ma Sói
          </Link>
        </div>
      </div>
    );
  return <VoiceProvider>{room.status === "lobby" ? <WaitingRoom /> : <OnlineGame />}</VoiceProvider>;
}

function WaitingRoom() {
  const { room, me, isHost, myUserId, code, setReady, startGame, updateSettings, kickPlayer, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);
  if (!room) return null;
  const st = room.settings as unknown as MSRoomSettings;
  const players = room.players as unknown as { userId: string; name: string; seat: number; ready: boolean; connected: boolean; botLevel?: string | null }[];
  const humansReady = players.every((p) => p.botLevel || p.userId === room.hostId || (p.ready && p.connected));
  const canStart = isHost && players.length >= MS_MIN && humansReady;
  const addBot = async (level: MSBotLevel) => {
    const r = await monoEmit("ms:bot:add", { level });
    if (!r.ok) toast.error(r.error ?? "Không thêm được máy");
  };
  const comp = new Map<string, number>();
  if (players.length >= MS_MIN) for (const r of rolesFor(players.length)) comp.set(ROLE[r].name, (comp.get(ROLE[r].name) ?? 0) + 1);
  return (
    <div className={`${font.className} min-h-dvh p-4 text-white`} style={NIGHT_BG}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void leaveRoom()} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Rời phòng
          </button>
          <h1 className="text-lg font-black">Phòng Ma Sói</h1>
          <div className="ml-auto flex items-center gap-2">
            <VoiceControls variant="lobby" />
            <GameChat variant="modal" trigger={chatTrigger} />
          </div>
        </div>
        <div className="space-y-4 rounded-3xl p-4 sm:p-5" style={{ ...PAPER, color: MS.ink }}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: "#fff", border: `1.5px dashed ${MS.gold}` }}
          >
            <span className="text-xs font-semibold opacity-70">Mã phòng (gửi cho bạn bè)</span>
            <span className="flex items-center gap-2 font-mono text-xl font-black tracking-[0.3em]" style={{ color: MS.blood }}>
              {code} {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-60" />}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: MS_ROOM_MAX }, (_, seat) => {
              const p = players.find((x) => x.seat === seat);
              return (
                <div key={seat} className="flex min-h-[56px] items-center gap-2 rounded-2xl px-2.5 py-2" style={{ background: p ? "#fff" : "rgba(0,0,0,.04)", border: `1.5px ${p ? "solid" : "dashed"} ${p ? MS.gold : "rgba(0,0,0,.2)"}` }}>
                  {p ? (
                    <>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: p.botLevel ? "#4b5563" : MS.night2 }}>
                        {p.botLevel ? <Bot className="h-4 w-4" /> : p.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-sm font-black">
                          <span className="truncate">{p.name}</span>
                          {p.userId === room.hostId && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: MS.gold }} />}
                          <VoiceBadge userId={p.userId} size="xs" />
                        </p>
                        <p className="truncate text-[11px] font-semibold opacity-70">
                          {p.botLevel ? `Máy · ${MS_BOT_LEVELS[p.botLevel as MSBotLevel] ?? ""}` : p.userId === myUserId ? "Bạn" : !p.connected ? "mất kết nối" : p.userId === room.hostId ? "Chủ phòng" : p.ready ? "✅ Sẵn sàng" : "Chưa sẵn sàng"}
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
                      <span className="mr-auto text-[11px] font-semibold opacity-60">Trống</span>
                      {(Object.keys(MS_BOT_LEVELS) as MSBotLevel[]).map((l) => (
                        <button key={l} type="button" onClick={() => void addBot(l)} className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[11px] font-bold text-white" style={{ background: "#4b5563" }}>
                          <Plus className="h-3 w-3" /> {MS_BOT_LEVELS[l]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold opacity-50">Trống</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs font-semibold opacity-75">
            {players.length >= MS_MIN ? `Bộ vai ${players.length} người: ${[...comp.entries()].map(([k, c]) => (c > 1 ? `${c} ${k}` : k)).join(" · ")}` : `Cần ít nhất ${MS_MIN} người (có thể thêm máy)`}
          </p>

          <div>
            <p className="mb-2 text-sm font-black" style={{ color: MS.bloodDark }}>Thời gian thảo luận {isHost ? "" : "(chủ phòng chỉnh)"}</p>
            <div className="grid grid-cols-4 gap-2">
              {DISCUSS_OPTIONS.map((s) => {
                const on = st.discussSeconds === s;
                return (
                  <button key={s} type="button" disabled={!isHost} onClick={() => void updateSettings({ discussSeconds: s })} className="rounded-xl py-2 text-sm font-black disabled:cursor-default" style={{ background: on ? MS.night : "#fff", color: on ? MS.moon : MS.ink, border: `1.5px solid ${on ? MS.night : "rgba(0,0,0,.15)"}` }}>
                    {s >= 120 ? `${s / 60} phút` : `${s}s`}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" disabled={!isHost} className="h-4 w-4 accent-[#c0392b]" checked={st.reveal} onChange={(e) => void updateSettings({ reveal: e.target.checked })} />
              Lộ vai khi chết
            </label>
            <p className="mt-2 text-xs opacity-70">Ban đêm 30 giây, bỏ phiếu 30 giây. Ai rời giữa ván sẽ có máy chơi thay.</p>
            <p className="mt-1 text-xs opacity-70">🎙️ Voice theo luật: ngày cả làng nói chuyện · đêm chỉ bầy Sói nghe nhau, dân đang ngủ · người chết chỉ nói với người chết.</p>
          </div>

          {isHost ? (
            <button type="button" disabled={!canStart} onClick={() => void startGame()} className="w-full rounded-xl py-3 text-lg font-black text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${MS.blood}, ${MS.bloodDark})`, boxShadow: `inset 0 0 0 2px ${MS.gold}` }}>
              {players.length < MS_MIN ? `Cần ít nhất ${MS_MIN} người` : canStart ? "🌙 Bắt đầu" : "Chờ mọi người sẵn sàng"}
            </button>
          ) : (
            <button type="button" onClick={() => void setReady(!me?.ready)} className="w-full rounded-xl py-3 text-lg font-black text-white" style={{ background: `linear-gradient(180deg, ${MS.blood}, ${MS.bloodDark})`, boxShadow: `inset 0 0 0 2px ${MS.gold}` }}>
              {me?.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OnlineGame() {
  const { room, initialSnapshot, isHost, resetToLobby, leaveRoom, code, chat, sendChat, myUserId } = useRoom();
  const voice = useOptionalVoice();
  const [snap, setSnap] = useState<MSSnapshot | null>(initialSnapshot as MSSnapshot | null);
  const [offset, setOffset] = useState(0);

  const apply = useCallback((s: MSSnapshot | null) => {
    if (!s) return;
    setOffset(s.serverNow - Date.now());
    setSnap((cur) => (cur && cur.games === s.games && s.seq < cur.seq ? cur : s));
  }, []);

  useEffect(() => {
    const onState = (s: MSSnapshot | null) => apply(s);
    socket.on("ms:state", onState);
    const sync = () => void monoEmit<MSSnapshot | null>("ms:sync").then((r) => r.ok && apply(r.data ?? null));
    sync();
    const onReconnect = () => setTimeout(sync, 800);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("ms:state", onState);
      socket.off("connect", onReconnect);
    };
  }, [apply]);

  // luật voice theo giai đoạn (đêm chỉ Sói, người chết…)
  const rule = useMemo(() => (snap ? msVoiceRule(snap, snap.players) : null), [snap]);
  const setGate = voice?.setGate;
  useEffect(() => {
    setGate?.(rule);
  }, [setGate, rule]);
  useEffect(() => () => setGate?.(null), [setGate]);

  const lines = useMemo<ChatLine[]>(() => {
    if (!snap) return [];
    return (chat as unknown as MSChatMessage[])
      .filter((m) => m.createdAt >= snap.startedAt)
      .map((m) => ({ id: m.id, seat: m.seat, name: m.name, text: m.text, channel: m.channel ?? "all", at: m.createdAt - offset }));
  }, [chat, snap, offset]);

  if (!snap || !room) return <Loading text="Màn đêm đang buông…" />;
  const voiceSeats: (SeatVoice | null)[] | undefined =
    voice?.enabled && rule
      ? snap.players.map((uid) => {
          const u = voice.users[uid];
          if (!u) return null;
          const heard = uid === myUserId ? rule.mic : rule.canHear(uid);
          return { muted: u.muted, speaking: !!voice.speaking[uid] && heard, heard };
        })
      : undefined;
  const st = room.settings as unknown as MSRoomSettings;

  const onAct = async (a: MSAction) => {
    const r = await monoEmit<MSSnapshot | null>("ms:act", { action: a, seq: snap.seq });
    if (!r.ok) {
      toast.error(r.error ?? "Không thực hiện được");
      if (r.data) apply(r.data);
    }
    return r.ok;
  };
  const leave = async () => {
    if (snap.phase !== "over" && !(await confirmDialog({ title: "Rời làng giữa ván?", message: "Máy sẽ chơi thay bạn cho hết ván này.", confirmText: "Rời", cancelText: "Ở lại", tone: "danger" }))) return;
    void leaveRoom();
  };

  return (
    <MSTable
      key={snap.games}
      view={{ ...snap, deadline: snap.phase === "over" ? null : snap.deadline - offset }}
      onAct={onAct}
      chat={lines}
      voice={voiceSeats}
      onChat={sendChat}
      onNext={() => void monoEmit("ms:next").then((r) => !r.ok && toast.error(r.error ?? "Không bắt đầu được"))}
      nextLabel="Ván mới (chia lại vai)"
      resultExtra={
        isHost && !st.quick ? (
          <button type="button" onClick={() => void resetToLobby()} className="rounded-xl border border-black/15 px-4 py-3 text-sm font-bold">
            Về phòng chờ
          </button>
        ) : undefined
      }
      header={
        <header className="flex items-center gap-2 px-3 py-2" style={{ background: "linear-gradient(90deg,#1a1430,#0b1026)", borderBottom: "1px solid rgba(244,231,191,.25)" }}>
          <button type="button" onClick={() => void leave()} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Rời
          </button>
          <span className="min-w-0 truncate text-sm font-black">Ma Sói · ván {snap.games}</span>
          <span className="hidden font-mono text-xs tracking-widest text-[#f4e7bf] sm:inline">{code}</span>
          <span className="ml-auto" />
          <MSVoiceControls />
          <SoundToggle />
        </header>
      }
    />
  );
}
