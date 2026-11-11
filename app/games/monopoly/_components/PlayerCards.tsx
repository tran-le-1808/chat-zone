"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import { useOptionalRoom } from "../_context/RoomContext";
import PlayerAvatar from "./PlayerAvatar";
import MoneyDisplay from "./MoneyDisplay";
import MoneyPopups from "./MoneyPopups";
import { VoiceBadge } from "./VoiceControls";
import { useIsCompact } from "./ui/useScreen";

const DESKTOP_POSITIONS = [
  "top-4 left-4",
  "top-4 right-4",
  "bottom-4 left-4",
  "bottom-4 right-4",
];
const COMPACT_POSITIONS = [
  "top-1.5 left-1.5",
  "top-1.5 right-1.5",
  "bottom-1.5 left-1.5",
  "bottom-1.5 right-1.5",
];

/** Hiệu ứng cho thẻ người đang tới lượt: viền phát sáng nhịp nhàng + nhãn nhún nhảy */
function TurnKeyframes() {
  return (
    <style>{`
      @keyframes turn-glow {
        0%, 100% { box-shadow: 0 0 0 2px var(--turn-color), 0 0 10px 1px var(--turn-color); }
        50% { box-shadow: 0 0 0 3px var(--turn-color), 0 0 26px 6px var(--turn-color); }
      }
      .turn-glow { animation: turn-glow 1.4s ease-in-out infinite; }
      @keyframes turn-tag {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50% { transform: translateX(-50%) translateY(-3px); }
      }
      .turn-tag { animation: turn-tag 1s ease-in-out infinite; }
      @keyframes turn-avatar {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      .turn-avatar { animation: turn-avatar 1.4s ease-in-out infinite; }
    `}</style>
  );
}

export default function PlayerCards() {
  const { players, activePlayerIndex, myPlayer, winner } = useGame();
  const roomCtx = useOptionalRoom();
  const isCompact = useIsCompact();
  const positions = isCompact ? COMPACT_POSITIONS : DESKTOP_POSITIONS;

  return (
    <>
      <TurnKeyframes />
      {/* Popup +$/−$ khi tiền thay đổi (nằm ngoài thẻ để không bị mờ theo) */}
      <MoneyPopups />
      {/* Thẻ người chơi ở 4 góc (điện thoại: bản thu gọn, rộng vừa nội dung).
          Người đang tới lượt: rõ nét + viền sáng màu nhân vật + nhãn "Đến lượt";
          những người còn lại mờ đi. */}
      {players.map((p, idx) => {
        const isActive = activePlayerIndex === idx && !p.isBankrupt && !winner;
        const isMe = myPlayer?.id === p.id;
        const roomPlayer = roomCtx?.room?.players.find(
          (rp) => rp.userId === p.userId,
        );
        const isHost = !!p.userId && roomCtx?.room?.hostId === p.userId;
        const isOffline = !!roomCtx && !p.isBankrupt && !roomPlayer?.connected;
        const isTopRow = idx < 2;

        const stateClass = p.isBankrupt
          ? "border-red-500/60 opacity-40 grayscale"
          : isActive
            ? "turn-glow opacity-100"
            : "border-white/10 opacity-45";
        const activeStyle: React.CSSProperties | undefined = isActive
          ? ({
              "--turn-color": p.color,
              borderColor: p.color,
            } as React.CSSProperties)
          : undefined;

        // Nhãn "Đến lượt": thẻ hàng trên đặt ở mép dưới, thẻ hàng dưới đặt ở mép trên
        const turnTag = isActive && (
          <span
            className={`turn-tag pointer-events-none absolute left-1/2 whitespace-nowrap rounded-full font-black uppercase tracking-wide text-white shadow-lg ${
              isTopRow ? "-bottom-2.5" : "-top-2.5"
            } ${isCompact ? "px-1.5 py-px text-[8px]" : "px-2.5 py-0.5 text-[10px]"}`}
            style={{
              background: p.color,
              textShadow: "0 1px 0 rgba(0,0,0,0.35)",
            }}
          >
            {isMe ? "🎯 Lượt của bạn" : "🎲 Đến lượt"}
          </span>
        );

        if (isCompact) {
          return (
            <div
              key={p.id}
              className={`absolute ${positions[idx]} z-20 flex w-fit max-w-[42vw] items-center gap-1.5 rounded-xl border bg-black/60 py-1 pl-1 pr-2 backdrop-blur-sm transition-all duration-500 ${stateClass}`}
              style={activeStyle}
            >
              <div
                className={`relative shrink-0 ${isActive ? "turn-avatar" : ""}`}
              >
                <PlayerAvatar
                  name={p.name}
                  avatar={p.avatar}
                  color={p.color}
                  pawnType={p.type}
                  size={26}
                />
                {roomCtx && !p.isBankrupt && (
                  <span
                    className={`absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-slate-900 ${
                      isOffline ? "bg-gray-500" : "bg-green-400"
                    }`}
                  />
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <div
                  className={`flex max-w-22 items-center gap-0.5 text-[10px] font-extrabold ${
                    p.isBankrupt ? "line-through" : ""
                  }`}
                  style={{ color: p.color }}
                >
                  {isHost && <span>👑</span>}
                  <span className="truncate">{isMe ? "Bạn" : p.name}</span>
                  {p.inJail && !p.isBankrupt && <span>🚔</span>}
                  <VoiceBadge userId={p.userId} size="xs" />
                </div>
                <div className="whitespace-nowrap text-[10px] font-semibold text-gray-100">
                  {p.isBankrupt
                    ? "🏴 Phá sản"
                    : `$${p.money.toLocaleString("vi-VN")}`}
                </div>
              </div>
              {turnTag}
            </div>
          );
        }

        return (
          <div
            key={p.id}
            className={`absolute ${positions[idx]} z-10 flex items-center gap-3 rounded-2xl border bg-black/50 p-3 px-4 backdrop-blur-md transition-all duration-500 ${stateClass} ${
              isActive ? "scale-105" : ""
            }`}
            style={activeStyle}
          >
            <div className={`relative ${isActive ? "turn-avatar" : ""}`}>
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
                <VoiceBadge userId={p.userId} />
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
                  {p.inJail && (
                    <span className="text-red-400">🚔 Trong tù</span>
                  )}
                  {isOffline && (
                    <span className="text-gray-400">📴 Mất kết nối</span>
                  )}
                </div>
              )}
            </div>
            {turnTag}
          </div>
        );
      })}
    </>
  );
}
