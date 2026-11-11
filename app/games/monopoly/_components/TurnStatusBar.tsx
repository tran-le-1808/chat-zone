"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import { useOptionalRoom } from "../_context/RoomContext";
import { useIsCompact } from "./ui/useScreen";

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default function TurnStatusBar() {
  const { players, lastRoll, isOnline } = useGame();
  const roomCtx = useOptionalRoom();
  const isCompact = useIsCompact();

  if (!isOnline) return null;

  const roller = lastRoll
    ? players.find((p) => p.id === lastRoll.playerId)
    : null;

  const host = roomCtx?.host;
  const hostOffline = !!host && !host.connected;

  return (
    // Kết quả xúc xắc vừa đổ & cảnh báo chủ phòng mất kết nối (lượt hiện tại
    // được làm nổi bật ngay trên thẻ người chơi). GameBoard định vị bên phải.
    <div className="pointer-events-none flex min-w-0 flex-col items-end gap-1 md:gap-2">
      <style>{`
        @keyframes roll-badge {
          0% { transform: translateY(-8px) scale(.9); opacity: 0; }
          10% { transform: translateY(0) scale(1); opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        .roll-badge { animation: roll-badge 3.5s ease-out forwards; }
      `}</style>

      {lastRoll && roller && (
        <div
          key={lastRoll.seq}
          className={`roll-badge rounded-xl border border-white/10 bg-black/80 text-white ${
            isCompact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-sm"
          }`}
        >
          <span style={{ color: roller.color }} className="font-bold">
            {roller.name}
          </span>{" "}
          đổ{" "}
          <span className={isCompact ? "text-sm" : "text-lg"}>
            {DICE_FACES[lastRoll.d1]} {DICE_FACES[lastRoll.d2]}
          </span>{" "}
          = <span className="font-black">{lastRoll.d1 + lastRoll.d2}</span>
          {lastRoll.d1 === lastRoll.d2 && (
            <span className="ml-1 text-amber-300">· Đôi!</span>
          )}
        </div>
      )}

      {hostOffline && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-950/80 px-3 py-1.5 text-[11px] font-semibold text-amber-200 md:text-xs">
          ⚠️ Chủ phòng mất kết nối — đang chuyển quyền điều khiển...
        </div>
      )}
    </div>
  );
}
