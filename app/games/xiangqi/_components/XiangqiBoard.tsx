"use client";

/**
 * BÀN CỜ TƯỚNG (SVG): bàn gỗ, sông "Sở hà – Hán giới", cung tướng, quân ngà khắc chữ Hán hoặc chữ Việt.
 * Bấm quân của mình để chọn -> hiện các ô đi được -> bấm ô đích để đi. Có thể lật bàn (cầm quân Đen).
 */
import { useId, useMemo, useState } from "react";
import { findKing, inCheck, legalTargets, sqX, sqY, type Side } from "../_lib/rules";
import { xqSound } from "../_lib/sound";
import { CJK_FONT, XQ } from "./theme";

const C = 60;
const M = 46;
const W = M * 2 + C * 8;
const H = M * 2 + C * 9;

export type PieceLabel = "han" | "viet";

const HAN_RED = ["", "帥", "仕", "相", "傌", "俥", "炮", "兵"];
const HAN_BLACK = ["", "將", "士", "象", "馬", "車", "砲", "卒"];
const VIET = ["", "Tướng", "Sĩ", "Tượng", "Mã", "Xe", "Pháo", "Tốt"];

export function pieceText(p: number, label: PieceLabel) {
  const t = Math.abs(p);
  return label === "viet" ? VIET[t] : p > 0 ? HAN_RED[t] : HAN_BLACK[t];
}

/** Một quân cờ (dùng cả ngoài bàn, vd. danh sách quân bị ăn) */
export function PieceSvg({ p, label, size = 28 }: { p: number; label: PieceLabel; size?: number }) {
  const gid = `xq-iv-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="-31 -31 62 62" aria-hidden>
      <defs>
        <IvoryGradient id={gid} />
      </defs>
      <PieceShape p={p} label={label} fillId={gid} />
    </svg>
  );
}

function IvoryGradient({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#fffaf0" />
      <stop offset="0.7" stopColor={XQ.ivory} />
      <stop offset="1" stopColor="#e3cf9f" />
    </radialGradient>
  );
}

function PieceShape({ p, label, lifted = false, glow = false, fillId = "xq-ivory" }: { p: number; label: PieceLabel; lifted?: boolean; glow?: boolean; fillId?: string }) {
  const color = p > 0 ? XQ.red : XQ.black;
  const text = pieceText(p, label);
  const viet = label === "viet";
  return (
    <g>
      <circle r={27} cy={lifted ? 5 : 3} fill="rgba(0,0,0,.35)" />
      {glow && <circle r={30} fill="none" stroke="#ff3b30" strokeWidth={4} opacity={0.85} className="xq-pulse" />}
      <circle r={27} fill={`url(#${fillId})`} stroke={lifted ? XQ.gold : "#8a6a3c"} strokeWidth={lifted ? 3 : 1.5} />
      <circle r={22} fill="none" stroke={color} strokeWidth={1.6} opacity={0.9} />
      <text
        y={viet ? 5 : 10}
        textAnchor="middle"
        fontSize={viet ? (text.length >= 5 ? 11.5 : text.length === 4 ? 14 : 16) : 29}
        fontWeight={700}
        fill={color}
        style={{ fontFamily: viet ? "inherit" : CJK_FONT }}
      >
        {text}
      </text>
    </g>
  );
}

export default function XiangqiBoard({
  board,
  flipped = false,
  mySide,
  canMove,
  lastMove,
  label,
  onMove,
}: {
  board: readonly number[];
  flipped?: boolean;
  /** Bên người xem được điều khiển (null = chỉ xem) */
  mySide: Side | null;
  canMove: boolean;
  lastMove: [number, number] | null;
  label: PieceLabel;
  onMove: (from: number, to: number) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const vx = (x: number) => (flipped ? 8 - x : x);
  const vy = (y: number) => (flipped ? 9 - y : y);
  const px = (i: number) => M + vx(sqX(i)) * C;
  const py = (i: number) => M + vy(sqY(i)) * C;

  const selValid = sel !== null && canMove && mySide !== null && Math.sign(board[sel]) === mySide ? sel : null;
  const targets = useMemo(() => (selValid !== null ? new Set(legalTargets(board, selValid)) : new Set<number>()), [board, selValid]);
  // tướng đang bị chiếu (của bên tới lượt): tô đỏ
  const checked = useMemo(() => {
    const out: number[] = [];
    for (const s of [1, -1] as Side[]) if (inCheck(board, s)) out.push(findKing(board, s));
    return out;
  }, [board]);

  const click = (i: number) => {
    if (!canMove || mySide === null) return;
    xqSound.unlock();
    const p = board[i];
    if (selValid !== null && targets.has(i)) {
      onMove(selValid, i);
      setSel(null);
      return;
    }
    if (p && Math.sign(p) === mySide) {
      setSel(i === sel ? null : i);
      xqSound.play("select");
    } else setSel(null);
  };

  // lưới
  const lines: React.ReactNode[] = [];
  for (let y = 0; y < 10; y++) lines.push(<line key={`h${y}`} x1={M} y1={M + y * C} x2={M + 8 * C} y2={M + y * C} />);
  for (let x = 0; x < 9; x++) {
    if (x === 0 || x === 8) lines.push(<line key={`v${x}`} x1={M + x * C} y1={M} x2={M + x * C} y2={M + 9 * C} />);
    else {
      lines.push(<line key={`va${x}`} x1={M + x * C} y1={M} x2={M + x * C} y2={M + 4 * C} />);
      lines.push(<line key={`vb${x}`} x1={M + x * C} y1={M + 5 * C} x2={M + x * C} y2={M + 9 * C} />);
    }
  }
  // chéo cung
  for (const y0 of [0, 7]) {
    lines.push(<line key={`p1${y0}`} x1={M + 3 * C} y1={M + y0 * C} x2={M + 5 * C} y2={M + (y0 + 2) * C} />);
    lines.push(<line key={`p2${y0}`} x1={M + 5 * C} y1={M + y0 * C} x2={M + 3 * C} y2={M + (y0 + 2) * C} />);
  }
  // dấu vị trí pháo / tốt
  const marks: [number, number][] = [[1, 2], [7, 2], [1, 7], [7, 7], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]];
  const markEls = marks.flatMap(([x, y]) => {
    const cx = M + x * C;
    const cy = M + y * C;
    const d = 5;
    const l = 10;
    const out: React.ReactNode[] = [];
    for (const sx of [-1, 1]) {
      if ((x === 0 && sx === -1) || (x === 8 && sx === 1)) continue;
      for (const sy of [-1, 1]) out.push(<path key={`${x}${y}${sx}${sy}`} d={`M${cx + sx * d} ${cy + sy * (d + l)} V${cy + sy * d} H${cx + sx * (d + l)}`} fill="none" />);
    }
    return out;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full touch-manipulation select-none" role="grid" aria-label="Bàn cờ tướng">
      <defs>
        <linearGradient id="xq-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={XQ.wood1} />
          <stop offset="1" stopColor={XQ.wood2} />
        </linearGradient>
        <IvoryGradient id="xq-ivory" />
        <pattern id="xq-grain" width="120" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 7 Q30 3 60 7 T120 7" fill="none" stroke="rgba(110,60,20,.12)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <style>{`.xq-pulse{animation:xqp 1s ease-in-out infinite}@keyframes xqp{0%,100%{opacity:.25}50%{opacity:.95}}`}</style>
      <rect x={0} y={0} width={W} height={H} rx={18} fill="url(#xq-wood)" />
      <rect x={0} y={0} width={W} height={H} rx={18} fill="url(#xq-grain)" />
      <rect x={M - 8} y={M - 8} width={8 * C + 16} height={9 * C + 16} fill="none" stroke={XQ.line} strokeWidth={3} />
      <g stroke={XQ.line} strokeWidth={1.6}>
        {lines}
        {markEls}
      </g>
      {/* sông */}
      <g fill={XQ.line} opacity={0.75} fontWeight={700}>
        <text x={M + 2 * C} y={M + 4.5 * C + 9} textAnchor="middle" fontSize={26} style={{ fontFamily: CJK_FONT }}>
          {flipped ? "漢 界" : "楚 河"}
        </text>
        <text x={M + 6 * C} y={M + 4.5 * C + 9} textAnchor="middle" fontSize={26} style={{ fontFamily: CJK_FONT }}>
          {flipped ? "楚 河" : "漢 界"}
        </text>
        <text x={M + 4 * C} y={M + 4.5 * C + 5} textAnchor="middle" fontSize={12} opacity={0.7}>
          Sở hà · Hán giới
        </text>
      </g>
      {/* nước vừa đi */}
      {lastMove &&
        lastMove.map((i, k) => (
          <rect key={k} x={px(i) - 29} y={py(i) - 29} width={58} height={58} rx={10} fill={k === 0 ? "rgba(46,125,50,.18)" : "rgba(46,125,50,.28)"} stroke="rgba(46,125,50,.7)" strokeWidth={2} strokeDasharray={k === 0 ? "6 5" : undefined} />
        ))}
      {/* quân */}
      {board.map((p, i) =>
        p ? (
          <g key={i} transform={`translate(${px(i)} ${py(i) - (i === selValid ? 4 : 0)})`} style={{ transition: "transform .12s" }}>
            <PieceShape p={p} label={label} lifted={i === selValid} glow={checked.includes(i)} />
          </g>
        ) : null,
      )}
      {/* ô đi được */}
      {[...targets].map((i) =>
        board[i] ? (
          <circle key={`t${i}`} cx={px(i)} cy={py(i)} r={29} fill="none" stroke="#2e7d32" strokeWidth={4} strokeDasharray="7 5" />
        ) : (
          <circle key={`t${i}`} cx={px(i)} cy={py(i)} r={9} fill="#2e7d32" opacity={0.75} />
        ),
      )}
      {/* vùng bấm */}
      {Array.from({ length: 90 }, (_, i) => (
        <rect
          key={`hit${i}`}
          x={px(i) - C / 2}
          y={py(i) - C / 2}
          width={C}
          height={C}
          fill="transparent"
          className={canMove && (targets.has(i) || (board[i] && Math.sign(board[i]) === mySide)) ? "cursor-pointer" : "cursor-default"}
          onClick={() => click(i)}
        />
      ))}
    </svg>
  );
}
