"use client";

import React from "react";
import { useGame } from "../_context/GameContext";

export default function TravelOverlay() {
  const { currPlayer, showBuyModal, isMyTurn } = useGame();

  if (!isMyTurn || !currPlayer.canTeleport || currPlayer.inJail || showBuyModal)
    return null;

  return (
    <div className="absolute bottom-1/2 left-1/2 z-50 w-fit max-w-[calc(100vw-24px)] -translate-x-1/2 translate-y-1/2">
      <div className="rounded-3xl border border-cyan-300/40 bg-slate-950/85 p-4 text-center shadow-2xl backdrop-blur-md">
        <div className="text-xl font-black text-cyan-300">
          ✈️ Chế độ Du Lịch
        </div>
        <div className="mt-1 text-sm text-white/80">
          Chọn bất kỳ ô nào trên bàn cờ để di chuyển tới đó.
        </div>
        <div className="mt-2 text-xs font-bold text-yellow-300 animate-pulse">
          👆 Nhấp chọn 1 ô trên bàn cờ để đi tiếp
        </div>
      </div>
    </div>
  );
}
