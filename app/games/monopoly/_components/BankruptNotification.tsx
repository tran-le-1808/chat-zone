"use client";

import React from "react";
import { BANKRUPT_NOTICE_MS, useGame } from "../_context/GameContext";
import PlayerAvatar from "./PlayerAvatar";

const DEBRIS_EMOJI = ["💸", "🏚️", "📉", "💔", "🧾", "🪙"];

// Giả ngẫu nhiên cố định (render thuần, không dùng Math.random)
const pseudo = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Các mảnh tiền / nhà rơi xuống
const DEBRIS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  emoji: DEBRIS_EMOJI[i % DEBRIS_EMOJI.length],
  left: pseudo(i + 1) * 100,
  delay: pseudo(i + 101) * 1.6,
  duration: 2.2 + pseudo(i + 201) * 1.6,
  size: 18 + pseudo(i + 301) * 22,
  rotate: (pseudo(i + 401) - 0.5) * 720,
}));

export default function BankruptNotification() {
  const { bankruptNotice } = useGame();
  const debris = DEBRIS;

  if (!bankruptNotice) return null;

  const { player, debt, remainingPlayers, reason } = bankruptNotice;
  const hasLeft = reason === "left";

  return (
    <div className="bankrupt-overlay fixed inset-0 z-[180] flex items-center justify-center overflow-hidden p-4">
      <style>{`
        .bankrupt-overlay { animation: bk-bg ${BANKRUPT_NOTICE_MS}ms ease-out forwards; }
        @keyframes bk-bg {
          0%   { background: rgba(220, 38, 38, 0.75); }
          6%   { background: rgba(0, 0, 0, 0.6); }
          12%  { background: rgba(220, 38, 38, 0.55); }
          20%  { background: rgba(0, 0, 0, 0.82); }
          90%  { background: rgba(0, 0, 0, 0.82); opacity: 1; }
          100% { background: rgba(0, 0, 0, 0.82); opacity: 0; }
        }
        .bk-card { animation: bk-slam 0.55s cubic-bezier(.2,1.6,.4,1) both, bk-shake 0.5s 0.55s ease-in-out both; }
        @keyframes bk-slam {
          0%   { transform: scale(2.4) rotate(-8deg); opacity: 0; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes bk-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px) rotate(-1deg); }
          40% { transform: translateX(9px) rotate(1deg); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
        .bk-avatar { animation: bk-gray 1.2s 0.6s ease-in forwards; }
        @keyframes bk-gray {
          to { filter: grayscale(1) brightness(0.6); transform: rotate(-12deg) translateY(6px); }
        }
        .bk-stamp { animation: bk-stamp 0.35s 0.9s cubic-bezier(.3,1.8,.5,1) both; }
        @keyframes bk-stamp {
          0%   { transform: translate(-50%, -50%) scale(3) rotate(-18deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(-18deg); opacity: 1; }
        }
        .bk-debris { position: absolute; top: -60px; animation-name: bk-fall; animation-timing-function: linear; animation-fill-mode: both; }
        @keyframes bk-fall {
          0%   { transform: translateY(0) rotate(0); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(var(--rot)); opacity: 0.2; }
        }
        .bk-progress { animation: bk-progress ${BANKRUPT_NOTICE_MS}ms linear forwards; }
        @keyframes bk-progress { from { width: 100%; } to { width: 0%; } }
      `}</style>

      {/* Mảnh vỡ rơi */}
      {debris.map((d) => (
        <span
          key={d.id}
          className="bk-debris pointer-events-none select-none"
          style={
            {
              left: `${d.left}%`,
              fontSize: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
              "--rot": `${d.rotate}deg`,
            } as React.CSSProperties
          }
        >
          {d.emoji}
        </span>
      ))}

      <div className="bk-card relative w-full max-w-md rounded-3xl border-2 border-red-500/70 bg-slate-950 p-8 text-center shadow-[0_0_80px_rgba(239,68,68,0.45)]">
        <span className="inline-block rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-red-300">
          📢 Thông báo toàn bàn cờ
        </span>

        <div className="relative mx-auto mt-5 flex h-24 w-24 items-center justify-center">
          <div className="bk-avatar">
            <PlayerAvatar
              name={player.name}
              avatar={player.avatar}
              color={player.color}
              pawnType={player.type}
              size={96}
            />
          </div>
          <div className="bk-stamp absolute left-1/2 top-1/2 whitespace-nowrap rounded-md border-4 border-red-500 bg-black/50 px-2 py-0.5 text-lg font-black tracking-widest text-red-500">
            BANKRUPT
          </div>
        </div>

        <h2 className="mt-5 text-3xl font-black text-red-500 drop-shadow">
          <span style={{ color: player.color }}>{player.name}</span>{" "}
          {hasLeft ? "ĐÃ BỎ CUỘC!" : "ĐÃ PHÁ SẢN!"}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          {hasLeft ? (
            "Người chơi đã rời trận và bị xử thua."
          ) : (
            <>
              Đã bán hết nhà nhưng vẫn còn nợ
              <span className="mx-1 text-lg font-extrabold text-red-400">
                ${debt}
              </span>
              và bị loại khỏi trận đấu.
            </>
          )}{" "}
          Toàn bộ đất đai được trả về ngân hàng.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-semibold text-amber-300">
          {remainingPlayers > 1
            ? `🎲 Còn lại ${remainingPlayers} người chơi trên bàn cờ`
            : "🏆 Chỉ còn một người trụ lại — trận đấu kết thúc!"}
        </div>

        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="bk-progress h-full bg-red-500" />
        </div>
      </div>
    </div>
  );
}
