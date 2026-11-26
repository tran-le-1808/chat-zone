"use client";

/** Các mảnh giao diện dùng chung cho bàn chơi với máy và online */
import { useEffect, useRef } from "react";
import type { Side } from "../_lib/rules";
import { PieceGlyph } from "./ChessBoard";
import { CH, serif } from "./theme";

const VALUE = [0, 0, 9, 5, 3, 3, 1];

/** Quân mỗi bên đã ăn được + chênh lệch điểm quân */
export function capturedBy(captures: readonly number[]): Record<Side, number[]> {
  const w: number[] = [];
  const b: number[] = [];
  captures.forEach((c, i) => c && (i % 2 === 0 ? w : b).push(c));
  const sort = (x: number, y: number) => VALUE[Math.abs(y)] - VALUE[Math.abs(x)];
  return { 1: w.sort(sort), [-1]: b.sort(sort) } as Record<Side, number[]>;
}
const sum = (a: number[]) => a.reduce((s, p) => s + VALUE[Math.abs(p)], 0);

export function PlayerCard({
  side,
  name,
  active,
  clock,
  low,
  captured,
  opponentCaptured,
  note,
}: {
  side: Side;
  name: string;
  active: boolean;
  clock?: string;
  low?: boolean;
  captured: number[];
  opponentCaptured: number[];
  note?: React.ReactNode;
}) {
  const diff = sum(captured) - sum(opponentCaptured);
  return (
    <div className="rounded-xl px-3 py-2 transition" style={{ background: active ? "rgba(201,166,70,.16)" : "rgba(255,255,255,.04)", border: `1.5px solid ${active ? CH.goldSoft : "rgba(255,255,255,.1)"}` }}>
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 shrink-0 rounded-sm" style={{ background: side === 1 ? "#fbf7ee" : "#1b1b1b", boxShadow: `0 0 0 1.5px ${CH.gold}` }} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{name}</span>
        {note}
        {clock !== undefined && (
          <span className={`rounded-md px-2 py-0.5 font-mono text-sm font-black tabular-nums ${low ? "bg-rose-600 text-white" : active ? "bg-[#e6cf86] text-[#1c2a22]" : "bg-white/10 text-slate-200"}`}>{clock}</span>
        )}
      </div>
      {captured.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-0">
          {captured.map((p, i) => (
            <PieceGlyph key={i} p={p} size={20} />
          ))}
          {diff > 0 && <span className="ml-1 text-xs font-bold text-[#e6cf86]">+{diff}</span>}
        </div>
      )}
    </div>
  );
}

/** Biên bản ván cờ (ký hiệu quốc tế SAN), tự cuộn tới nước mới nhất */
export function MoveList({ san }: { san: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [san.length]);
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < san.length; i += 2) rows.push([san[i], san[i + 1]]);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <p className={`${serif.className} border-b border-white/10 px-3 py-1.5 text-xs font-bold text-[#e6cf86]`}>Biên bản ván cờ</p>
      <div ref={ref} className="max-h-40 overflow-y-auto px-3 py-1.5 font-mono text-xs lg:max-h-64">
        {rows.length === 0 ? (
          <p className="py-2 text-center text-slate-500">Chưa có nước nào</p>
        ) : (
          rows.map(([w, b], i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-1 py-0.5">
              <span className="text-slate-500">{i + 1}.</span>
              <span className="text-[#fbf7ee]">{w}</span>
              <span className="text-slate-400">{b ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const btnCls =
  "inline-flex items-center gap-1.5 rounded-xl border border-[#c9a646]/35 bg-white/5 px-3 py-2 text-xs font-bold text-[#f6f1e4] transition hover:bg-white/10 disabled:opacity-40";

export function CheckBanner({ show, mate = false }: { show: boolean; mate?: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <div
        className={`${serif.className} ch-check rounded-2xl px-6 py-2 text-3xl font-extrabold text-white sm:text-4xl`}
        style={{ background: mate ? "linear-gradient(180deg,#b3261e,#7f1610)" : `linear-gradient(180deg, ${CH.green}, ${CH.greenDeep})`, border: `3px solid ${CH.goldSoft}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}
      >
        {mate ? "Chiếu hết!" : "Chiếu!"}
      </div>
      <style>{`.ch-check{animation:chc 1.1s ease-out forwards}@keyframes chc{0%{transform:scale(.6);opacity:0}15%{transform:scale(1.08);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
    </div>
  );
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
