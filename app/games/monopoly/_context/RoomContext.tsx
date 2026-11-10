"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { useAppSelector } from "@/redux/hooks";
import {
  JoinResult,
  RoomChatMessage,
  RoomInfo,
  RoomPlayer,
  RoomSettings,
} from "@/types/monopoly-room";

const MAX_CHAT = 100;

type RoomStatusUI = "connecting" | "joined" | "error";

interface RoomContextType {
  code: string;
  room: RoomInfo | null;
  uiStatus: RoomStatusUI;
  error: string | null;
  myUserId: string | null;
  me: RoomPlayer | null;
  isHost: boolean;
  host: RoomPlayer | null;
  chat: RoomChatMessage[];
  /** Trạng thái game nhận được khi vào phòng (dùng khi vào lại giữa trận) */
  initialSnapshot: unknown;
  /** Tăng mỗi khi bắt đầu ván mới -> tạo lại GameProvider */
  gameSession: number;
  sendChat: (text: string) => void;
  leaveRoom: () => Promise<void>;
  kickPlayer: (userId: string) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  changeSeat: (seat: number) => Promise<void>;
  updateSettings: (patch: Partial<RoomSettings>) => Promise<void>;
  startGame: () => Promise<void>;
  resetToLobby: () => Promise<void>;
  finishGame: () => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

export function RoomProvider({
  code,
  children,
}: {
  code: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const myUserId = user?._id ?? null;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [uiStatus, setUiStatus] = useState<RoomStatusUI>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<RoomChatMessage[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<unknown>(null);
  const [gameSession, setGameSession] = useState(0);

  const statusRef = useRef<RoomInfo["status"] | null>(null);
  const leavingRef = useRef(false);

  const applyRoom = useCallback((next: RoomInfo) => {
    const prevStatus = statusRef.current;
    // Ván mới bắt đầu -> bỏ snapshot cũ và tạo lại bàn cờ
    if (prevStatus && prevStatus !== "playing" && next.status === "playing") {
      setInitialSnapshot(null);
      setGameSession((s) => s + 1);
    }
    statusRef.current = next.status;
    setRoom(next);
  }, []);

  // ===================== JOIN / REJOIN =====================
  useEffect(() => {
    if (!myUserId || !code) return;
    let cancelled = false;

    const join = async () => {
      const connected = await waitForSocket();
      if (cancelled) return;
      if (!connected) {
        setUiStatus("error");
        setError("Không kết nối được tới máy chủ");
        return;
      }
      const res = await monoEmit<JoinResult>("mono:join", { code });
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setUiStatus("error");
        setError(res.error ?? "Không thể vào phòng");
        return;
      }
      setInitialSnapshot(res.data.snapshot);
      statusRef.current = res.data.room.status;
      setRoom(res.data.room);
      setChat(res.data.chat);
      setError(null);
      setUiStatus("joined");
    };

    void join();

    // Socket kết nối lại (mạng chập chờn) -> vào lại phòng
    const onReconnect = () => {
      if (!leavingRef.current) void join();
    };
    socket.on("connect", onReconnect);

    return () => {
      cancelled = true;
      socket.off("connect", onReconnect);
    };
  }, [code, myUserId]);

  // ===================== SERVER EVENTS =====================
  useEffect(() => {
    const onRoom = (next: RoomInfo) => {
      if (next.code !== code) return;
      applyRoom(next);
    };
    const onChat = (msg: RoomChatMessage) =>
      setChat((prev) => [...prev.slice(-(MAX_CHAT - 1)), msg]);
    const onKicked = (data: { code: string }) => {
      if (data.code !== code) return;
      leavingRef.current = true;
      toast.error("Bạn đã bị chủ phòng mời ra khỏi phòng");
      router.replace("/games/monopoly");
    };
    const onNotice = (data: { text: string }) => toast(data.text);

    socket.on("mono:room", onRoom);
    socket.on("mono:chat", onChat);
    socket.on("mono:kicked", onKicked);
    socket.on("mono:notice", onNotice);
    return () => {
      socket.off("mono:room", onRoom);
      socket.off("mono:chat", onChat);
      socket.off("mono:kicked", onKicked);
      socket.off("mono:notice", onNotice);
    };
  }, [code, router, applyRoom]);

  // ===================== ACTIONS =====================
  const run = async (event: string, payload?: unknown) => {
    const res = await monoEmit(event, payload);
    if (!res.ok && res.error) toast.error(res.error);
    return res.ok;
  };

  const sendChat = (text: string) => {
    const content = text.trim();
    if (!content) return;
    void run("mono:chat", { text: content });
  };

  const leaveRoom = async () => {
    leavingRef.current = true;
    await monoEmit("mono:leave");
    router.push("/games/monopoly");
  };

  const kickPlayer = async (userId: string) => {
    await run("mono:kick", { userId });
  };
  const setReady = async (ready: boolean) => {
    await run("mono:ready", { ready });
  };
  const changeSeat = async (seat: number) => {
    await run("mono:seat", { seat });
  };
  const updateSettings = async (patch: Partial<RoomSettings>) => {
    await run("mono:settings", patch);
  };
  const startGame = async () => {
    await run("mono:start");
  };
  const resetToLobby = async () => {
    await run("mono:reset");
  };
  const finishGame = () => {
    void monoEmit("mono:finish");
  };

  const me = room?.players.find((p) => p.userId === myUserId) ?? null;
  const host = room?.players.find((p) => p.userId === room.hostId) ?? null;

  return (
    <RoomContext.Provider
      value={{
        code,
        room,
        uiStatus,
        error,
        myUserId,
        me,
        isHost: !!room && room.hostId === myUserId,
        host,
        chat,
        initialSnapshot,
        gameSession,
        sendChat,
        leaveRoom,
        kickPlayer,
        setReady,
        changeSeat,
        updateSettings,
        startGame,
        resetToLobby,
        finishGame,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

/** Dùng ở các component có thể nằm ngoài phòng (chơi offline) */
export function useOptionalRoom() {
  return useContext(RoomContext);
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error("useRoom must be used within a RoomProvider");
  return context;
}
