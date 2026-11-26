"use client";

/**
 * BÀN CỜ VUA (SVG): bàn gỗ óc chó, toạ độ a–h / 1–8, bấm quân để chọn -> chấm các ô đi được -> bấm ô đích.
 * Tốt lên hàng cuối: hiện bảng chọn quân phong cấp. Lật bàn khi cầm quân Đen.
 */
import { useMemo, useState } from "react";
import { BISHOP, findKing, inCheck, isPromotion, KNIGHT, legalTargets, QUEEN, ROOK, sqX, sqY, type Pos, type Side } from "../_lib/rules";
import { chessSound } from "../_lib/sound";
import { CH, PIECE_FONT } from "./theme";

const C = 64;
const GLYPH = ["", "♚", "♛", "♜", "♝", "♞", "♟"];

/** Một quân cờ (dùng cả ngoài bàn) */
export function PieceGlyph({ p, size = 22 }: { p: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <PieceText p={p} x={32} y={32} />
    </svg>
  );
}

function PieceText({ p, x, y }: { p: number; x: number; y: number }) {
  const white = p > 0;
  return (
    <text
      x={x}
      y={y + 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={50}
      fill={white ? "#fbf7ee" : "#1b1b1b"}
      stroke={white ? "#2a2a2a" : "#d9cfb8"}
      strokeWidth={white ? 1.6 : 0.8}
      paintOrder="stroke"
      style={{ fontFamily: PIECE_FONT, filter: "drop-shadow(0 2px 1.5px rgba(0,0,0,.35))" }}
    >
      {GLYPH[Math.abs(p)] + "︎"}
    </text>
  );
}

export default function ChessBoard({
  pos,
  flipped = false,
  mySide,
  canMove,
  lastMove,
  onMove,
}: {
  pos: Pos;
  flipped?: boolean;
  mySide: Side | null;
  canMove: boolean;
  lastMove: [number, number] | null;
  onMove: (from: number, to: number, promo: number) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const vx = (x: number) => (flipped ? 7 - x : x);
  const vy = (y: number) => (flipped ? 7 - y : y);
  const px = (i: number) => vx(sqX(i)) * C;
  const py = (i: number) => vy(sqY(i)) * C;

  const selValid = sel !== null && canMove && mySide !== null && Math.sign(pos.b[sel]) === mySide ? sel : null;
  const targets = useMemo(() => (selValid !== null ? new Set(legalTargets(pos, selValid)) : new Set<number>()), [pos, selValid]);
  const checkedKing = useMemo(() => (inCheck(pos.b, pos.turn) ? findKing(pos.b, pos.turn) : -1), [pos]);

  const click = (i: number) => {
    if (!canMove || mySide === null || promo) return;
    chessSound.unlock();
    if (selValid !== null && targets.has(i)) {
      if (isPromotion(pos, selValid, i)) setPromo({ from: selValid, to: i });
      else onMove(selValid, i, 0);
      setSel(null);
      return;
    }
    const v = pos.b[i];
    if (v && Math.sign(v) === mySide) {
      setSel(i === sel ? null : i);
      chessSound.play("select");
    } else setSel(null);
  };

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 512 512" className="h-full w-full touch-manipulation select-none overflow-hidden rounded-xl" role="grid" aria-label="Bàn cờ vua" style={{ boxShadow: `0 0 0 6px #5b3a22, 0 0 0 8px ${CH.gold}, 0 16px 40px rgba(0,0,0,.5)` }}>
        <defs>
          <radialGradient id="ch-check">
            <stop offset="0" stopColor="#ff2d2d" stopOpacity={0.95} />
            <stop offset="0.55" stopColor="#e01b1b" stopOpacity={0.55} />
            <stop offset="1" stopColor="#a00" stopOpacity={0} />
          </radialGradient>
          <pattern id="ch-grain" width="64" height="9" patternUnits="userSpaceOnUse">
            <path d="M0 4.5 Q16 2 32 4.5 T64 4.5" fill="none" stroke="rgba(90,50,20,.08)" strokeWidth="1" />
          </pattern>
        </defs>
        {Array.from({ length: 64 }, (_, i) => {
          const light = (sqX(i) + sqY(i)) % 2 === 0;
          return <rect key={`s${i}`} x={px(i)} y={py(i)} width={C} height={C} fill={light ? CH.light : CH.dark} />;
        })}
        <rect width={512} height={512} fill="url(#ch-grain)" />
        {/* toạ độ */}
        {Array.from({ length: 8 }, (_, k) => {
          const file = flipped ? 7 - k : k;
          const rank = flipped ? k + 1 : 8 - k;
          return (
            <g key={`c${k}`} fontSize={11} fontWeight={700}>
              <text x={k * C + C - 4} y={512 - 4} textAnchor="end" fill={k % 2 === 0 ? CH.light : CH.dark}>
                {"abcdefgh"[file]}
              </text>
              <text x={3} y={k * C + 12} fill={k % 2 === 0 ? CH.dark : CH.light}>
                {rank}
              </text>
            </g>
          );
        })}
        {lastMove && lastMove.map((i, k) => <rect key={`l${k}`} x={px(i)} y={py(i)} width={C} height={C} fill="rgba(205,210,60,.45)" />)}
        {selValid !== null && <rect x={px(selValid)} y={py(selValid)} width={C} height={C} fill="rgba(20,85,30,.5)" />}
        {checkedKing >= 0 && <circle cx={px(checkedKing) + C / 2} cy={py(checkedKing) + C / 2} r={C * 0.55} fill="url(#ch-check)" />}
        {pos.b.map((v, i) => (v ? <PieceText key={`p${i}`} p={v} x={px(i) + C / 2} y={py(i) + C / 2} /> : null))}
        {[...targets].map((i) =>
          pos.b[i] || i === pos.ep ? (
            <circle key={`t${i}`} cx={px(i) + C / 2} cy={py(i) + C / 2} r={C / 2 - 3} fill="none" stroke="rgba(20,85,30,.55)" strokeWidth={6} />
          ) : (
            <circle key={`t${i}`} cx={px(i) + C / 2} cy={py(i) + C / 2} r={10} fill="rgba(20,85,30,.5)" />
          ),
        )}
        {Array.from({ length: 64 }, (_, i) => (
          <rect
            key={`h${i}`}
            x={px(i)}
            y={py(i)}
            width={C}
            height={C}
            fill="transparent"
            className={canMove && (targets.has(i) || (pos.b[i] && Math.sign(pos.b[i]) === mySide)) ? "cursor-pointer" : "cursor-default"}
            onClick={() => click(i)}
          />
        ))}
      </svg>
      {promo && mySide !== null && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/45" onClick={() => setPromo(null)}>
          <div className="rounded-2xl p-3 text-center" style={{ background: CH.cream, border: `2px solid ${CH.gold}` }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-sm font-bold" style={{ color: CH.ink }}>Phong cấp thành</p>
            <div className="flex gap-2">
              {[QUEEN, ROOK, BISHOP, KNIGHT].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onMove(promo.from, promo.to, t);
                    setPromo(null);
                  }}
                  className="rounded-xl p-1 transition hover:scale-110"
                  style={{ background: CH.light, border: `1.5px solid ${CH.dark}` }}
                >
                  <PieceGlyph p={t * mySide} size={52} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
