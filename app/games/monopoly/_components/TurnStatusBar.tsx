"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import { useOptionalRoom } from "../_context/RoomContext";
import PlayerAvatar from "./PlayerAvatar";

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default function TurnStatusBar() {
  const {
    players,
    currPlayer,
    currentTile,
    isMyTurn,
    turnPhase,
    lastRoll,
    pawnStates,
    isOnline,
    rpsGame,
    xocGame,
  } = useGame();
  const roomCtx = useOptionalRoom();

  if (!isOnline) return null;

  const phaseText = (() => {
    if (rpsGame) return "đang chơi Oẳn tù tì với cả bàn ✊✋✌️";
    if (xocGame) return "mở sòng Xóc đĩa — cả bàn đoán chẵn lẻ 🥣";
    switch (turnPhase) {
      case "roll":
        return currPlayer.inJail
          ? "đang ở tù — chờ lắc xúc xắc"
          : "chuẩn bị lắc xúc xắc";
      case "buy":
        return `đang cân nhắc mua ${currentTile.name}`;
      case "festival":
        return "đang chọn nơi tổ chức Lễ Hội";
      case "sell":
        return "đang bán nhà để trả nợ";
      case "travel":
        return "đang chọn điểm đến du lịch";
      default:
        return pawnStates[currPlayer.id] === "moving"
          ? "đang di chuyển..."
          : "";
    }
  })();

  const roller = lastRoll
    ? players.find((p) => p.id === lastRoll.playerId)
    : null;

  const host = roomCtx?.host;
  const hostOffline = !!host && !host.connected;

  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      <style>{`
        @keyframes roll-badge {
          0% { transform: translateY(-8px) scale(.9); opacity: 0; }
          10% { transform: translateY(0) scale(1); opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        .roll-badge { animation: roll-badge 3.5s ease-out forwards; }
      `}</style>

      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-2 ${
          isMyTurn
            ? "border-cyan-400/70 bg-cyan-950/90 shadow-[0_0_30px_rgba(34,211,238,0.35)]"
            : "border-white/10 bg-black/80"
        }`}
      >
        <PlayerAvatar
          name={currPlayer.name}
          avatar={currPlayer.avatar}
          color={currPlayer.color}
          pawnType={currPlayer.type}
          size={34}
        />
        <div className="text-left">
          <div
            className="text-sm font-black"
            style={{ color: currPlayer.color }}
          >
            {isMyTurn ? "🎯 Lượt của bạn!" : `Lượt của ${currPlayer.name}`}
          </div>
          {phaseText && (
            <div className="text-xs text-gray-300">
              {isMyTurn ? `Bạn ${phaseText}` : phaseText}
            </div>
          )}
        </div>
      </div>

      {lastRoll && roller && (
        <div
          key={lastRoll.seq}
          className="roll-badge rounded-xl border border-white/10 bg-black/80 px-3 py-1.5 text-sm text-white"
        >
          <span style={{ color: roller.color }} className="font-bold">
            {roller.name}
          </span>{" "}
          đổ{" "}
          <span className="text-lg">
            {DICE_FACES[lastRoll.d1]} {DICE_FACES[lastRoll.d2]}
          </span>{" "}
          = <span className="font-black">{lastRoll.d1 + lastRoll.d2}</span>
          {lastRoll.d1 === lastRoll.d2 && (
            <span className="ml-1 text-amber-300">· Đôi!</span>
          )}
        </div>
      )}

      {hostOffline && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-950/80 px-3 py-1.5 text-xs font-semibold text-amber-200">
          ⚠️ Chủ phòng mất kết nối — đang chuyển quyền điều khiển...
        </div>
      )}
    </div>
  );
}
