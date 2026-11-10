"use client";

import { PawnType } from "./Pawn3D";

interface PawnAvatarProps {
  type: PawnType;
  className?: string;
}

/** Biểu tượng 2D nhỏ của nhân vật (dùng ở nơi không cần mô hình 3D) */
export const PAWN_ICON: Record<PawnType, string> = {
  dragon: "🐲",
  bunny: "🐰",
  cat: "🐱",
  lion: "🦁",
};

const PAWN_BG: Record<PawnType, string> = {
  dragon: "bg-teal-400/20 border-teal-300/40",
  bunny: "bg-pink-400/20 border-pink-300/40",
  cat: "bg-violet-400/20 border-violet-300/40",
  lion: "bg-amber-400/20 border-amber-300/40",
};

export default function PawnAvatar({
  type,
  className = "text-2xl",
}: PawnAvatarProps) {
  return (
    <div
      className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold shadow-lg ${PAWN_BG[type]} ${className}`}
    >
      <span className="text-2xl">{PAWN_ICON[type]}</span>
    </div>
  );
}
