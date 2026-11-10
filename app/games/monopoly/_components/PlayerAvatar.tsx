"use client";

import Image from "next/image";
import { PawnType } from "@/types/game.types";
import { PAWN_ICON } from "./PawnAvatar";

interface PlayerAvatarProps {
  name: string;
  avatar?: string;
  color?: string;
  /** Hiện huy hiệu quân cờ ở góc */
  pawnType?: PawnType;
  size?: number;
  className?: string;
}

/** Ảnh đại diện người chơi (avatar tài khoản hoặc chữ cái đầu) + quân cờ */
export default function PlayerAvatar({
  name,
  avatar,
  color = "#22d3ee",
  pawnType,
  size = 40,
  className = "",
}: PlayerAvatarProps) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-full border-2 bg-white/10"
        style={{ borderColor: color }}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-bold text-white"
            // Nền đặc màu người chơi -> chữ cái đầu rõ trên cả nền sáng (modal) lẫn nền tối
            style={{
              fontSize: size * 0.42,
              background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 60%), ${color}`,
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {pawnType && (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-white/20 bg-slate-900"
          style={{
            width: size * 0.48,
            height: size * 0.48,
            fontSize: size * 0.28,
          }}
        >
          {PAWN_ICON[pawnType]}
        </span>
      )}
    </div>
  );
}
