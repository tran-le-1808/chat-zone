"use client";

/**
 * BÀN CỜ CARO (SVG): lưới 20×20, quân X đỏ / O xanh, đánh dấu nước vừa đi và đường thắng.
 * Dùng chung cho chơi với bot và chơi online. Bấm / chạm vào ô để đi.
 */
import { useState } from "react";
import { idx, type Cell, type Stone } from "../_lib/rules";

const C = 30; // kích thước 1 ô trong toạ độ SVG

export const STONE_COLOR: Record<Stone, string> = { 1: "#ef4444", 2: "#3b82f6" };
export const STONE_LABEL: Record<Stone, string> = { 1: "X", 2: "O" };

function StoneMark({ s, x, y, faded = false }: { s: Stone; x: number; y: number; faded?: boolean }) {
  const cx = x * C + C / 2;
  const cy = y * C + C / 2;
  const r = C * 0.3;
  const op = faded ? 0.35 : 1;
  if (s === 1)
    return (
      <g stroke={STONE_COLOR[1]} strokeWidth={3.4} strokeLinecap="round" opacity={op}>
        <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
        <line x1={cx + r} y1={cy - r} x2={cx - r} y2={cy + r} />
      </g>
    );
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke={STONE_COLOR[2]} strokeWidth={3.2} opacity={op} />;
}

export default function CaroBoard({
  size,
  board,
  lastMove,
  winLine,
  hoverStone,
  disabled,
  onCell,
}: {
  size: number;
  board: readonly (Cell | number)[];
  lastMove: [number, number] | null;
  winLine: [number, number][] | null;
  /** Quân sẽ đặt (hiện mờ khi rê chuột) — null khi chưa tới lượt */
  hoverStone: Stone | null;
  disabled: boolean;
  onCell: (x: number, y: number) => void;
}) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const W = size * C;
  const cellAt = (e: React.PointerEvent<SVGSVGElement>): [number, number] | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    return x >= 0 && y >= 0 && x < size && y < size ? [x, y] : null;
  };
  const win = new Set((winLine ?? []).map(([x, y]) => `${x},${y}`));
  const canHover = hover && hoverStone && !disabled && board[idx(hover[0], hover[1], size)] === 0;
  return (
    <svg
      viewBox={`0 0 ${W} ${W}`}
      className={`h-full w-full touch-manipulation select-none rounded-xl bg-[#f5ecd7] shadow-2xl ${disabled ? "cursor-default" : "cursor-pointer"}`}
      role="grid"
      aria-label="Bàn cờ caro"
      onPointerMove={(e) => e.pointerType === "mouse" && setHover(cellAt(e))}
      onPointerLeave={() => setHover(null)}
      onPointerUp={(e) => {
        if (disabled) return;
        const c = cellAt(e);
        if (c && board[idx(c[0], c[1], size)] === 0) onCell(c[0], c[1]);
      }}
    >
      {/* lưới */}
      <g stroke="#c8b48a" strokeWidth={1}>
        {Array.from({ length: size + 1 }, (_, i) => (
          <g key={i}>
            <line x1={0} y1={i * C} x2={W} y2={i * C} />
            <line x1={i * C} y1={0} x2={i * C} y2={W} />
          </g>
        ))}
      </g>
      {/* ô thắng */}
      {[...win].map((k) => {
        const [x, y] = k.split(",").map(Number);
        return <rect key={k} x={x * C + 1} y={y * C + 1} width={C - 2} height={C - 2} fill="#facc15" opacity={0.55} rx={4} />;
      })}
      {/* nước vừa đi */}
      {lastMove && <rect x={lastMove[0] * C + 1.5} y={lastMove[1] * C + 1.5} width={C - 3} height={C - 3} fill="none" stroke="#16a34a" strokeWidth={2} rx={4} />}
      {board.map((v, i) => (v === 1 || v === 2 ? <StoneMark key={i} s={v} x={i % size} y={Math.floor(i / size)} /> : null))}
      {canHover && <StoneMark s={hoverStone!} x={hover![0]} y={hover![1]} faded />}
    </svg>
  );
}
