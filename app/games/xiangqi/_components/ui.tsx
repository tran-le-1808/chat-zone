"use client";

/** Các mảnh giao diện dùng chung cho bàn chơi với bot và online */
import { useEffect, useRef, useState } from "react";
import { notations, type Side, type XqMove } from "../_lib/rules";
import { PieceSvg, type PieceLabel } from "./XiangqiBoard";
import { serif, XQ } from "./theme";

const LABEL_KEY = "xiangqi-piece-label";

/** Kiểu chữ trên quân (Hán / Việt), nhớ trên trình duyệt */
export function usePieceLabel(): [PieceLabel, (l: PieceLabel) => void] {
  const [label, setLabel] = useState<PieceLabel>(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(LABEL_KEY) === "viet" ? "viet" : "han";
    } catch {
      return "han";
    }
  });
  const set = (l: PieceLabel) => {
    setLabel(l);
    try {
      localStorage.setItem(LABEL_KEY, l);
    } catch {
      /* bỏ qua */
    }
  };
  return [label, set];
}

export function LabelToggle({ label, onChange }: { label: PieceLabel; onChange: (l: PieceLabel) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(label === "han" ? "viet" : "han")}
      title="Đổi chữ trên quân"
      className="flex h-9 items-center justify-center rounded-xl border border-[#c99a2e]/40 bg-white/5 px-2.5 text-xs font-bold text-[#e9c86b] hover:bg-white/10"
    >
      {label === "han" ? "帥 → Việt" : "Việt → 帥"}
    </button>
  );
}

/** Thẻ người chơi: màu quân, tên, đồng hồ, quân đã ăn được */
export function PlayerCard({
  side,
  name,
  active,
  clock,
  low,
  captured,
  label,
  note,
}: {
  side: Side;
  name: string;
  active: boolean;
  clock?: string;
  low?: boolean;
  captured: number[];
  label: PieceLabel;
  note?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2 transition"
      style={{
        background: active ? "rgba(201,154,46,.16)" : "rgba(255,255,255,.04)",
        border: `1.5px solid ${active ? XQ.goldSoft : "rgba(255,255,255,.1)"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: side === 1 ? XQ.red : "#111", boxShadow: `0 0 0 2px ${XQ.ivory}` }} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{name}</span>
        {note}
        {clock !== undefined && (
          <span className={`rounded-md px-2 py-0.5 font-mono text-sm font-black tabular-nums ${low ? "bg-rose-600 text-white" : active ? "bg-[#e9c86b] text-[#2a1a12]" : "bg-white/10 text-slate-200"}`}>{clock}</span>
        )}
      </div>
      {captured.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-0.5">
          {captured.map((p, i) => (
            <PieceSvg key={i} p={p} label={label} size={20} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Quân mà mỗi bên đã ăn được */
export function capturedBy(moves: readonly XqMove[], captures: readonly number[]): { 1: number[]; [-1]: number[] } {
  const red: number[] = [];
  const black: number[] = [];
  captures.forEach((c, i) => {
    if (!c) return;
    (i % 2 === 0 ? red : black).push(c);
  });
  void moves;
  const sort = (a: number, b: number) => Math.abs(b) - Math.abs(a);
  return { 1: red.sort(sort), [-1]: black.sort(sort) } as { 1: number[]; [-1]: number[] };
}

/** Sổ ghi nước kiểu Việt Nam, tự cuộn tới nước mới nhất */
export function MoveList({ moves }: { moves: readonly XqMove[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const list = notations(moves);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [moves.length]);
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push([list[i], list[i + 1]]);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <p className={`${serif.className} border-b border-white/10 px-3 py-1.5 text-xs font-bold text-[#e9c86b]`}>Biên bản ván cờ</p>
      <div ref={ref} className="max-h-40 overflow-y-auto px-3 py-1.5 font-mono text-xs lg:max-h-64">
        {rows.length === 0 ? (
          <p className="py-2 text-center text-slate-500">Chưa có nước nào</p>
        ) : (
          rows.map(([r, b], i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-1 py-0.5">
              <span className="text-slate-500">{i + 1}.</span>
              <span className="text-[#ff8a80]">{r}</span>
              <span className="text-slate-200">{b ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const btnCls =
  "inline-flex items-center gap-1.5 rounded-xl border border-[#c99a2e]/35 bg-white/5 px-3 py-2 text-xs font-bold text-[#f4e7c9] transition hover:bg-white/10 disabled:opacity-40";

/** Băng rôn "Chiếu tướng!" thoáng qua */
export function CheckBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <div
        className={`${serif.className} xq-check rounded-2xl px-6 py-2 text-3xl font-extrabold text-white sm:text-4xl`}
        style={{ background: `linear-gradient(180deg, ${XQ.red}, ${XQ.redDeep})`, border: `3px solid ${XQ.goldSoft}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}
      >
        Chiếu tướng!
      </div>
      <style>{`.xq-check{animation:xqc 1.1s ease-out forwards}@keyframes xqc{0%{transform:scale(.6);opacity:0}15%{transform:scale(1.08);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
    </div>
  );
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
