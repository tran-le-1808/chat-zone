"use client";

import React from "react";
import { Player } from "@/types/game.types";
import PlayerAvatar from "./PlayerAvatar";

interface WinnerModalProps {
  winner: Player;
  /** Bấm nút chơi lại. Không truyền = tải lại trang */
  onRestart?: () => void;
  restartLabel?: string;
  /** false = chỉ hiện thông báo chờ (người chơi không phải chủ phòng) */
  canRestart?: boolean;
  waitingText?: string;
  onLeave?: () => void;
}

export default function WinnerModal({
  winner,
  onRestart,
  restartLabel = "🔄 Chơi Trận Mới",
  canRestart = true,
  waitingText = "Đang chờ chủ phòng bắt đầu ván mới...",
  onLeave,
}: WinnerModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-amber-400/60 bg-slate-950 p-8 text-center shadow-[0_0_50px_rgba(251,191,36,0.3)] space-y-5">
        <div className="text-7xl animate-bounce">🏆</div>

        <div className="flex flex-col items-center gap-3">
          <PlayerAvatar
            name={winner.name}
            avatar={winner.avatar}
            color={winner.color}
            pawnType={winner.type}
            size={72}
          />
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wider uppercase mb-2">
              Quán Quân Cờ Tỷ Phú
            </span>
            <h2 className="text-3xl font-black text-amber-400 drop-shadow">
              {winner.name}
            </h2>
          </div>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed">
          Tất cả đối thủ đã phá sản! Nhà tài phiệt duy nhất còn trụ lại bàn cờ
          với tài sản tích lũy:
        </p>

        <div className="text-4xl font-black text-emerald-400 tracking-tight">
          ${winner.money.toLocaleString()}
        </div>

        {canRestart ? (
          <button
            onClick={() => {
              if (onRestart) onRestart();
              else window.location.reload();
            }}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl shadow-xl transition-transform active:scale-95"
          >
            {restartLabel}
          </button>
        ) : (
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-gray-300 animate-pulse">
            {waitingText}
          </div>
        )}

        {onLeave && (
          <button
            onClick={onLeave}
            className="w-full py-2.5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold transition"
          >
            🚪 Rời phòng
          </button>
        )}
      </div>
    </div>
  );
}
