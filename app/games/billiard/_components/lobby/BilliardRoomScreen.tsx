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
            href="/games/billiard"
            className="block rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold text-white shadow-[0_4px_0_#7f1118]"
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
