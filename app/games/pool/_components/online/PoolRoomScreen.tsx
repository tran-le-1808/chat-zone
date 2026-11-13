"use client";

import Link from "next/link";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { VoiceProvider } from "../../../monopoly/_context/VoiceContext";
import { PoolOnlineView } from "../PoolGame";
import PoolWaitingRoom from "./PoolWaitingRoom";
import { useOnlinePoolController } from "./useOnlinePool";

function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0d0f1e] text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4b942] border-t-transparent" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

function OnlineTable() {
  const controller = useOnlinePoolController();
  if (!controller.match) return <Loading text="Đang đồng bộ bàn bida…" />;
  return <PoolOnlineView controller={controller} />;
}

/** Phòng bida lỗ online: kết nối / lỗi / phòng chờ / trận đấu (voice giữ nguyên khi chuyển) */
export default function PoolRoomScreen() {
  const { room, uiStatus, error, gameSession } = useRoom();
  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) return <Loading text="Đang vào phòng…" />;
  if (uiStatus === "error" || !room)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d0f1e] p-4 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-[#c81d25]/40 bg-[#11132a] p-6 text-center shadow-2xl">
          <h2 className="text-xl font-bold">Không thể vào phòng</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <Link href="/games/pool" className="block rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold text-white shadow-[0_4px_0_#7f1118]">
            Về sảnh Bida Lỗ
          </Link>
        </div>
      </div>
    );
  return (
    <VoiceProvider>{room.status === "lobby" ? <PoolWaitingRoom /> : <OnlineTable key={gameSession} />}</VoiceProvider>
  );
}
