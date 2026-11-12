"use client";

import Link from "next/link";
import { GameProvider, GameSnapshot } from "../../_context/GameContext";
import { useRoom } from "../../_context/RoomContext";
import GameBoard from "../GameBoard";
import WaitingRoom from "./WaitingRoom";
import { VoiceProvider } from "../../_context/VoiceContext";

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0d0f1e] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4b942] border-t-transparent" />
        <p className="text-sm text-slate-400">Đang vào phòng…</p>
      </div>
    );
  }

  if (uiStatus === "error" || !room) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d0f1e] p-4 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-[#c81d25]/40 bg-[#11132a] p-6 text-center shadow-2xl">
          <div className="text-5xl">🚫</div>
          <h2 className="text-xl font-bold">Không thể vào phòng</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <Link
            href="/games/monopoly"
            className="block rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold text-white shadow-[0_4px_0_#7f1118]"
          >
            Về sảnh chờ
          </Link>
        </div>
      </div>
    );
  }

  // Voice chat bao cả phòng chờ lẫn bàn cờ -> bật ở phòng chờ thì vào game vẫn giữ
  return (
    <VoiceProvider>
      {room.status === "lobby" ? (
        <WaitingRoom />
      ) : (
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
      )}
    </VoiceProvider>
  );
}
