"use client";

/** Lá bài (mặt / lưng) vẽ bằng CSS — kích thước theo biến `w` (px) */
import { isRed, rankOf, RANK_LABEL, suitOf, SUIT_LABEL } from "../_lib/cards";
import { TL } from "./theme";

export function CardFace({ card, w = 64, selected = false, dim = false, onClick, style }: { card: number; w?: number; selected?: boolean; dim?: boolean; onClick?: () => void; style?: React.CSSProperties }) {
  const red = isRed(card);
  const color = red ? "#d0142c" : "#1b1b1b";
  const rank = RANK_LABEL[rankOf(card)];
  const suit = SUIT_LABEL[suitOf(card)];
  const h = Math.round(w * 1.42);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${rank}${suit}`}
      className="relative shrink-0 select-none rounded-[9%] text-left transition-transform duration-150 disabled:cursor-default"
      style={{
        width: w,
        height: h,
        background: "linear-gradient(160deg,#ffffff,#f4efe4)",
        border: selected ? `2px solid ${TL.gold}` : "1px solid rgba(0,0,0,.25)",
        boxShadow: selected ? `0 0 0 2px ${TL.goldDeep}, 0 10px 18px rgba(0,0,0,.45)` : "0 2px 6px rgba(0,0,0,.35)",
        transform: selected ? `translateY(-${Math.round(w * 0.28)}px)` : undefined,
        filter: dim ? "brightness(.7)" : undefined,
        color,
        ...style,
      }}
    >
      <span className="absolute left-[8%] top-[4%] flex flex-col items-center font-black leading-none" style={{ fontSize: w * 0.3 }}>
        {rank}
        <span style={{ fontSize: w * 0.26 }}>{suit}</span>
      </span>
      <span className="absolute bottom-[4%] right-[8%] flex rotate-180 flex-col items-center font-black leading-none" style={{ fontSize: w * 0.3 }}>
        {rank}
        <span style={{ fontSize: w * 0.26 }}>{suit}</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: w * 0.62, opacity: 0.92 }}>
        {rankOf(card) >= 8 && rankOf(card) <= 10 ? <span className="font-black" style={{ fontSize: w * 0.5 }}>{rank}</span> : suit}
      </span>
    </button>
  );
}

export function CardBack({ w = 36, style }: { w?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="block shrink-0 rounded-[9%]"
      style={{
        width: w,
        height: Math.round(w * 1.42),
        background: `repeating-linear-gradient(45deg, ${TL.red} 0 4px, ${TL.redDeep} 4px 8px)`,
        border: `2px solid ${TL.cream}`,
        boxShadow: `inset 0 0 0 2px ${TL.gold}, 0 2px 5px rgba(0,0,0,.4)`,
        ...style,
      }}
    />
  );
}
