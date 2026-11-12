"use client";

import Link from "next/link";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { VoiceProvider } from "../../../monopoly/_context/VoiceContext";
import { BilliardGameProvider } from "../../_context/BilliardGameContext";
import BilliardWaitingRoom from "./BilliardWaitingRoom";
import BilliardGame from "../game/BilliardGame";

/** Phòng bida: đang kết nối / lỗi / phòng chờ / trận đấu (voice giữ nguyên khi chuyển) */
export default function BilliardRoomScreen() {
  const { room, uiStatus, error, gameSession } = useRoom();

  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#14161f] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
        <p className="text-sm text-gray-400">Đang vào phòng...</p>
      </div>
    );
  }

  if (uiStatus === "error" || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#14161f] p-4 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-rose-500/30 bg-[#1f2230] p-6 text-center">
          <div className="text-5xl">🚫</div>
          <h2 className="text-xl font-bold">Không thể vào phòng</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <Link
            href="/games/billiard"
            className="block rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 font-bold text-slate-900"
          >
            Về sảnh Bida
          </Link>
        </div>
      </div>
    );
  }

  return (
    <VoiceProvider>
      {room.status === "lobby" ? (
        <BilliardWaitingRoom />
      ) : (
        <BilliardGameProvider key={gameSession}>
          <BilliardGame />
        </BilliardGameProvider>
      )}
    </VoiceProvider>
  );
}
