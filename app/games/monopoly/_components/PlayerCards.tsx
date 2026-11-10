"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import { useOptionalRoom } from "../_context/RoomContext";
import PlayerAvatar from "./PlayerAvatar";
import MoneyDisplay from "./MoneyDisplay";

export default function PlayerCards() {
  const { players, activePlayerIndex, myPlayer } = useGame();
  const roomCtx = useOptionalRoom();

  const positions = [
    "top-4 left-4",
    "top-4 right-4",
    "bottom-4 left-4",
    "bottom-4 right-4",
  ];

  return (
    <>
      {players.map((p, idx) => {
        const isActive = activePlayerIndex === idx;
        const isMe = myPlayer?.id === p.id;
        const roomPlayer = roomCtx?.room?.players.find(
          (rp) => rp.userId === p.userId,
        );
        const isHost = !!p.userId && roomCtx?.room?.hostId === p.userId;
        const isOffline = !!roomCtx && !p.isBankrupt && !roomPlayer?.connected;

        return (
          <div
            key={p.id}
            className={`absolute ${positions[idx]} z-10 flex items-center gap-3 p-3 px-4 rounded-2xl backdrop-blur-md border ${p.avatarBg} bg-black/40 transition-all duration-700 ${
              p.isBankrupt
                ? "grayscale opacity-50 border-red-500/60"
                : isActive
                  ? "ring-2 ring-cyan-400 scale-105"
                  : "opacity-80"
            }`}
          >
            <div className="relative">
              <PlayerAvatar
                name={p.name}
                avatar={p.avatar}
                color={p.color}
                pawnType={p.type}
                size={44}
              />
              {roomCtx && !p.isBankrupt && (
                <span
                  className={`absolute -left-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
                    isOffline ? "bg-gray-500" : "bg-green-400"
                  }`}
                  title={isOffline ? "Mất kết nối" : "Online"}
                />
              )}
            </div>
            <div className="min-w-0">
              <div
                className={`flex max-w-40 items-center gap-1 text-sm font-extrabold ${
                  p.isBankrupt ? "line-through" : ""
                }`}
                style={{ color: p.color }}
              >
                {isHost && <span title="Chủ phòng">👑</span>}
                <span className="truncate">{p.name}</span>
                {isMe && (
                  <span className="shrink-0 rounded-md bg-cyan-500/20 px-1 text-[10px] text-cyan-300">
                    Bạn
                  </span>
                )}
              </div>
              {p.isBankrupt ? (
                <div className="text-xs font-black tracking-wider text-red-500">
                  🏴 PHÁ SẢN
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <MoneyDisplay money={p.money} />
                  {p.inJail && <span className="text-red-400">🚔 Trong tù</span>}
                  {isOffline && (
                    <span className="text-gray-400">📴 Mất kết nối</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
