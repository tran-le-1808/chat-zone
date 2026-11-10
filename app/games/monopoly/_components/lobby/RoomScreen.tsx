"use client";

import Link from "next/link";
import { GameProvider, GameSnapshot } from "../../_context/GameContext";
import { useRoom } from "../../_context/RoomContext";
import GameBoard from "../GameBoard";
import WaitingRoom from "./WaitingRoom";

/** Hiển thị phòng chờ hoặc bàn cờ tuỳ theo trạng thái phòng */
export default function RoomScreen() {
  const {
    room,
    uiStatus,
    error,
    isHost,
    myUserId,
    initialSnapshot,
    gameSession,
    finishGame,
  } = useRoom();

  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#1a1c2b] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        <p className="text-sm text-gray-400">Đang vào phòng...</p>
      </div>
    );
  }

  if (uiStatus === "error" || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1c2b] p-4 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-rose-500/30 bg-[#262a40] p-6 text-center">
          <div className="text-5xl">🚫</div>
          <h2 className="text-xl font-bold">Không thể vào phòng</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <Link
            href="/games/monopoly"
            className="block rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 py-3 font-bold"
          >
            Về sảnh chờ
          </Link>
        </div>
      </div>
    );
  }

  if (room.status === "lobby") return <WaitingRoom />;

  return (
    <GameProvider
      key={gameSession}
      online={{
        isHost,
        myUserId,
        roomPlayers: room.players,
        settings: room.settings,
        initialSnapshot: initialSnapshot as GameSnapshot | null,
        onFinish: finishGame,
      }}
    >
      <GameBoard />
    </GameProvider>
  );
}
