"use client";

/** Lá bài Sắc Màu (mặt / lưng): huy hiệu lục giác ở giữa, biểu tượng hệ ở góc */
import { Ban, Plus, Repeat2 } from "lucide-react";
import { CARDS, DRAW2, REVERSE, SKIP, WILD, WILD4 } from "../_lib/cards";
import { HE, SM } from "./theme";

function Value({ value, size, color }: { value: number; size: number; color: string }) {
  if (value <= 9) return <span style={{ fontSize: size, color, lineHeight: 1 }} className="font-extrabold">{value}</span>;
  if (value === SKIP) return <Ban style={{ width: size * 0.9, height: size * 0.9, color }} strokeWidth={3} />;
  if (value === REVERSE) return <Repeat2 style={{ width: size * 0.9, height: size * 0.9, color }} strokeWidth={3} />;
  if (value === DRAW2) return <span style={{ fontSize: size * 0.85, color, lineHeight: 1 }} className="font-extrabold">+2</span>;
  if (value === WILD4) return <span style={{ fontSize: size * 0.85, color, lineHeight: 1 }} className="font-extrabold">+4</span>;
  return <Plus style={{ width: size * 0.9, height: size * 0.9, color }} strokeWidth={3.2} />;
}

/** Biểu tượng nhỏ ở góc */
function Corner({ value, size, color }: { value: number; size: number; color: string }) {
  if (value <= 9) return <span className="font-extrabold leading-none" style={{ fontSize: size, color }}>{value}</span>;
  return <Value value={value} size={size} color={color} />;
}

export function SMCardFace({ card, w = 64, lift = false, dim = false, glow = false, onClick, style }: { card: number; w?: number; lift?: boolean; dim?: boolean; glow?: boolean; onClick?: () => void; style?: React.CSSProperties }) {
  const { color, value } = CARDS[card];
  const wild = color === WILD;
  const he = wild ? null : HE[color];
  const h = Math.round(w * 1.48);
  const bg = wild
    ? `conic-gradient(from 45deg, ${HE[0].main} 0 25%, ${HE[1].main} 0 50%, ${HE[2].main} 0 75%, ${HE[3].main} 0)`
    : `linear-gradient(155deg, ${he!.main} 0%, ${he!.dark} 100%)`;
  const Icon = he?.Icon;
  const hex = w * 0.66;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={wild ? (value === WILD4 ? "Đổi sắc +4" : "Đổi sắc") : `${value <= 9 ? value : value === SKIP ? "Chặn" : value === REVERSE ? "Đảo chiều" : "+2"} ${he!.name}`}
      className="relative shrink-0 select-none overflow-hidden rounded-[14%] transition-transform duration-150 disabled:cursor-default"
      style={{
        width: w,
        height: h,
        background: SM.cream,
        padding: w * 0.06,
        boxShadow: glow ? `0 0 0 2px ${SM.gold}, 0 0 16px ${SM.gold}aa, 0 6px 12px rgba(0,0,0,.4)` : "0 3px 8px rgba(0,0,0,.4)",
        transform: lift ? `translateY(-${Math.round(w * 0.22)}px)` : undefined,
        filter: dim ? "brightness(.55) saturate(.6)" : undefined,
        ...style,
      }}
    >
      <span className="relative flex h-full w-full items-center justify-center rounded-[11%]" style={{ background: bg }}>
        {/* sọc chéo trang trí */}
        <span className="absolute inset-0 rounded-[11%] opacity-20" style={{ background: "repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 9px)" }} />
        <span className="absolute left-[7%] top-[5%] flex flex-col items-center gap-0.5">
          <Corner value={value} size={w * 0.22} color="#fff" />
          {Icon && <Icon style={{ width: w * 0.16, height: w * 0.16, color: "#fff" }} />}
        </span>
        <span className="absolute bottom-[5%] right-[7%] flex rotate-180 flex-col items-center gap-0.5">
          <Corner value={value} size={w * 0.22} color="#fff" />
          {Icon && <Icon style={{ width: w * 0.16, height: w * 0.16, color: "#fff" }} />}
        </span>
        {/* huy hiệu lục giác */}
        <span
          className="relative flex items-center justify-center"
          style={{
            width: hex,
            height: hex * 1.12,
            background: SM.cream,
            clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
          }}
        >
          {wild ? (
            <span className="flex flex-col items-center leading-none">
              <span className="grid grid-cols-2 gap-[2px]" style={{ width: hex * 0.42 }}>
                {HE.map((x) => (
                  <span key={x.name} className="aspect-square rounded-[3px]" style={{ background: x.main }} />
                ))}
              </span>
              {value === WILD4 && <span className="mt-0.5 font-extrabold" style={{ fontSize: w * 0.2, color: SM.ink }}>+4</span>}
            </span>
          ) : (
            <Value value={value} size={w * 0.38} color={he!.dark} />
          )}
        </span>
      </span>
    </button>
  );
}

export function SMCardBack({ w = 36, style }: { w?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[14%]"
      style={{
        width: w,
        height: Math.round(w * 1.48),
        background: `radial-gradient(circle at 50% 50%, #3b2f8f, #1b1550)`,
        border: `2px solid ${SM.cream}`,
        boxShadow: `inset 0 0 0 2px ${SM.gold}, 0 2px 5px rgba(0,0,0,.4)`,
        ...style,
      }}
    >
      <span className="absolute inset-0 opacity-25" style={{ background: `conic-gradient(from 45deg, ${HE[0].main} 0 25%, ${HE[1].main} 0 50%, ${HE[2].main} 0 75%, ${HE[3].main} 0)` }} />
      {w >= 40 && (
        <span className="relative -rotate-12 font-extrabold leading-none" style={{ fontSize: w * 0.2, color: SM.gold }}>
          Sắc
          <br />
          Màu
        </span>
      )}
    </span>
  );
}
