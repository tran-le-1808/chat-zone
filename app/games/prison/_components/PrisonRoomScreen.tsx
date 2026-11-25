"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Crown, Link2, Loader2, LogOut, Play, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { ui } from "@/components/ui/styles";
import { useAppSelector } from "@/redux/hooks";
import PlayerAvatar from "../../monopoly/_components/PlayerAvatar";
import { ROLE_INFO } from "../_lib/engine/config";
import type { RoomView } from "../_lib/engine/protocol";
import { acquirePrisonSocket, getPrisonSocket, prisonEmit, releasePrisonSocket, waitConnected } from "../_lib/net/prisonSocket";
import { NetSession, type JoinPayload } from "../_lib/session/NetSession";
import { playerColor } from "../_lib/session/types";
import PrisonGame from "./PrisonGame";
import { DifficultyPicker, RolePicker } from "./RoleDifficulty";

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "lobby" } | { kind: "game" };

export default function PrisonRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const myId = useAppSelector((s) => s.auth.user?._id ?? null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [session, setSession] = useState<NetSession | null>(null);
  const [connected, setConnected] = useState(true);
  const sessionRef = useRef<NetSession | null>(null);
  const socketRef = useRef<ReturnType<typeof acquirePrisonSocket> | null>(null);
  const [socket] = useState(() => getPrisonSocket());

  const startSession = useCallback(
    (payload: JoinPayload) => {
      const s = socketRef.current;
      if (!s || !myId || !payload.state || sessionRef.current) return;
      const ns = new NetSession(s, code, myId, payload, (reason) => {
        toast.error(reason);
        sessionRef.current?.dispose();
        sessionRef.current = null;
        setSession(null);
        router.push("/games/prison");
      });
      sessionRef.current = ns;
      setSession(ns);
      setPhase({ kind: "game" });
    },
    [code, myId, router],
  );

  const join = useCallback(async () => {
    const s = socketRef.current;
    if (!s) return;
    if (!(await waitConnected(s))) return setPhase({ kind: "error", message: "Không kết nối được máy chủ" });
    const r = await prisonEmit<JoinPayload>(s, "room:join", { roomCode: code });
    if (!r.ok) return setPhase({ kind: "error", message: r.message });
    setRoom(r.data!.room as unknown as RoomView);
    if (r.data!.state) startSession(r.data!);
    else if (!sessionRef.current) setPhase({ kind: "lobby" });
  }, [code, startSession]);

  useEffect(() => {
    const s = acquirePrisonSocket();
    socketRef.current = s;
    const onRoom = (v: RoomView) => v.roomCode === code && setRoom(v);
    const onStarted = (p: JoinPayload) => startSession(p);
    const onClosed = () => {
      toast("Phòng đã đóng");
      router.push("/games/prison");
    };
    const onConnect = () => {
      setConnected(true);
      if (!sessionRef.current) void join();
    };
    const onDisconnect = () => setConnected(false);
    const onInvite = (d: { roomCode: string; from: string }) => toast(`${d.from} mời bạn vào phòng ${d.roomCode}`);
    s.on("room:updated", onRoom);
    s.on("game:started", onStarted);
    s.on("room:closed", onClosed);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("room:invite-received", onInvite);
    const t = setTimeout(() => void join(), 0);
    return () => {
      clearTimeout(t);
      s.off("room:updated", onRoom);
      s.off("game:started", onStarted);
      s.off("room:closed", onClosed);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("room:invite-received", onInvite);
      sessionRef.current?.dispose();
      sessionRef.current = null;
      releasePrisonSocket();
    };
  }, [code, join, startSession, router]);

  const leave = async () => {
    const s = socketRef.current;
    if (s) await prisonEmit(s, "room:leave");
    sessionRef.current?.dispose();
    sessionRef.current = null;
    router.push("/games/prison");
  };

  if (phase.kind === "game" && session) return <PrisonGame session={session} title={`Co-op · ${code}`} onExit={() => void leave()} />;

  if (phase.kind === "loading")
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0d0f1e] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#ffd166]" />
      </div>
    );
  if (phase.kind === "error" || !room)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#0d0f1e] p-6 text-center text-white">
        <p className="text-lg font-bold">{phase.kind === "error" ? phase.message : "Không tìm thấy phòng"}</p>
        <button type="button" className={ui.btnPrimary} onClick={() => router.push("/games/prison")}>
          Về sảnh Prison Break
        </button>
      </div>
    );
  return <Lobby room={room} myId={myId} connected={connected} onLeave={() => void leave()} socket={socket} />;
}

function Lobby({ room, myId, connected, onLeave, socket }: { room: RoomView; myId: string | null; connected: boolean; onLeave: () => void; socket: ReturnType<typeof acquirePrisonSocket> }) {
  const me = room.members.find((m) => m.userId === myId);
  const isHost = room.hostId === myId;
  const others = room.members.filter((m) => !m.isHost);
  const canStart = isHost && others.every((m) => m.ready && m.connected);
  const emit = async (ev: string, payload?: unknown) => {
    const r = await prisonEmit(socket, ev, payload);
    if (!r.ok) toast.error(r.message);
    return r.ok;
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${what}`);
    } catch {
      toast.error("Không sao chép được");
    }
  };

  return (
    <div className="min-h-dvh bg-[#0d0f1e] text-white">
      <header className="border-b border-[#f4b942]/15 bg-[#11132a]">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 sm:px-5">
          <button type="button" onClick={onLeave} className="flex h-10 items-center gap-1.5 rounded-xl border border-[#c81d25]/40 bg-[#c81d25]/10 px-3 text-sm font-bold text-[#ff8a7a] hover:bg-[#c81d25]/25">
            <LogOut className="h-4 w-4 rotate-180" /> <span className="max-sm:hidden">Rời phòng</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Prison Break · Phòng chờ</p>
            <p className="font-mono text-lg font-extrabold tracking-[0.3em] text-[#ffd166]">{room.roomCode}</p>
          </div>
          {!connected && <WifiOff className="h-5 w-5 text-amber-300" />}
          <button type="button" onClick={() => void copy(room.roomCode, "mã phòng")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:text-[#ffd166]" aria-label="Sao chép mã">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void copy(`${window.location.origin}/games/prison/room/${room.roomCode}`, "link mời")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:text-[#ffd166]" aria-label="Sao chép link mời">
            <Link2 className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-5 px-3 py-5 sm:px-5 lg:grid-cols-[1fr_340px]">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: room.settings.maxPlayers }, (_, i) => room.members[i]).map((m, i) =>
            m ? (
              <div key={m.userId} className={`relative rounded-3xl border bg-[#11132a]/85 p-4 ${m.userId === myId ? "border-[#f4b942]/60" : "border-white/10"}`}>
                <div className="flex items-center gap-3">
                  <span className={m.connected ? "" : "opacity-40 grayscale"}>
                    <PlayerAvatar name={m.name} avatar={m.avatar} size={44} color={playerColor(i)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-bold">
                      {m.isHost && <Crown className="h-4 w-4 shrink-0 text-[#ffd166]" />}
                      {m.name}
                      {m.userId === myId && <span className="rounded bg-[#f4b942]/20 px-1.5 text-[10px] text-[#ffd166]">Bạn</span>}
                    </p>
                    <p className="text-xs" style={{ color: ROLE_INFO[m.role].color }}>
                      {ROLE_INFO[m.role].name}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${!m.connected ? "bg-white/10 text-slate-400" : m.isHost ? "bg-[#f4b942]/20 text-[#ffd166]" : m.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                    {!m.connected ? "Mất kết nối" : m.isHost ? "Chủ phòng" : m.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{ROLE_INFO[m.role].perk}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="flex min-h-28 items-center justify-center rounded-3xl border-2 border-dashed border-white/10 text-sm text-slate-500">
                Ghế trống — gửi mã {room.roomCode}
              </div>
            ),
          )}
        </section>
        <aside className="space-y-4">
          {me && (
            <div className={`${ui.card} space-y-3 p-4`}>
              <p className="text-xs font-bold uppercase text-slate-400">Vai trò của bạn</p>
              <RolePicker value={me.role} onChange={(role) => void emit("room:role", { role })} disabled={room.status !== "WAITING"} />
            </div>
          )}
          <div className={`${ui.card} space-y-3 p-4`}>
            <p className="text-xs font-bold uppercase text-slate-400">Luật phòng {isHost ? "" : "(chỉ chủ phòng chỉnh)"}</p>
            <DifficultyPicker value={room.settings.difficulty} disabled={!isHost} onChange={(difficulty) => void emit("room:update-settings", { settings: { difficulty } })} />
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" disabled={!isHost} checked={room.settings.privateRoom} onChange={(e) => void emit("room:update-settings", { settings: { privateRoom: e.target.checked } })} /> Phòng riêng tư
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" disabled={!isHost} checked={room.settings.allowLateJoin} onChange={(e) => void emit("room:update-settings", { settings: { allowLateJoin: e.target.checked } })} /> Cho vào giữa chừng
              </label>
              <label className="flex items-center gap-2">
                Tối đa
                <select disabled={!isHost} value={room.settings.maxPlayers} onChange={(e) => void emit("room:update-settings", { settings: { maxPlayers: Number(e.target.value) } })} className="rounded-lg border border-white/10 bg-[#0d0f1e] px-2 py-1">
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} người
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {isHost ? (
            <button type="button" disabled={!canStart || room.status !== "WAITING"} onClick={() => void emit("room:start")} className={`${ui.btnPrimary} w-full py-4! text-lg`}>
              {room.status === "STARTING" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
              {canStart ? "Bắt đầu vượt ngục" : "Chờ mọi người sẵn sàng"}
            </button>
          ) : (
            <button type="button" onClick={() => void emit("room:ready", { ready: !me?.ready })} className={`${me?.ready ? ui.btnGold : ui.btnPrimary} w-full py-4! text-lg`}>
              <Check className="h-5 w-5" /> {me?.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
          )}
          <p className="text-center text-xs text-slate-500">Chiến thắng chung: chỉ khi mọi thành viên đều thoát khỏi trại.</p>
        </aside>
      </main>
    </div>
  );
}
