"use client";

import { useRef } from "react";

const QUICK = [5, 30, 60, 90];

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  ballColor: string;
}

/** Góc nâng cơ 0..90°: hình minh hoạ + thanh trượt + chọn nhanh */
function ElevationHorizontal({ value, onChange, disabled, ballColor }: Props) {
  const rad = (value * Math.PI) / 180;
  // Hình minh hoạ: bi ở góc dưới phải, cơ đi ra phía trái - trên theo góc nâng
  const bx = 70;
  const by = 46;
  const len = 58;
  const tipX = bx - 9 * Math.cos(rad);
  const tipY = by - 9 * Math.sin(rad);
  const buttX = tipX - len * Math.cos(rad);
  const buttY = tipY - len * Math.sin(rad);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
          Góc cơ
        </span>
        <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
          {value.toFixed(value % 1 ? 1 : 0)}°
          {value >= 90 && (
            <span className="rounded bg-rose-500/25 px-1 text-[9px] font-black uppercase text-rose-300">
              Tối đa
            </span>
          )}
        </span>
      </div>
      <svg
        viewBox="0 0 84 54"
        className="h-12 w-full [@media(max-height:500px)]:h-9"
        aria-hidden
      >
        <line x1="2" y1="52" x2="82" y2="52" stroke="#2f6fb5" strokeWidth="3" />
        <path
          d={`M ${bx - 22} ${by} A 22 22 0 0 1 ${bx} ${by - 22}`}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeDasharray="2 2"
        />
        <line
          x1={buttX}
          y1={buttY}
          x2={tipX}
          y2={tipY}
          stroke="#d9b382"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx={bx}
          cy={by}
          r="6"
          fill={ballColor}
          stroke="rgba(0,0,0,0.3)"
        />
      </svg>
      <input
        type="range"
        min={0}
        max={90}
        step={0.5}
        value={value}
        disabled={disabled}
        aria-label="Góc nâng cơ so với mặt bàn"
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400 disabled:opacity-40"
      />
      <div className="flex gap-1">
        {QUICK.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-md py-0.5 text-[10px] font-bold disabled:opacity-40 ${
              Math.abs(value - v) < 0.25
                ? "bg-amber-400 text-slate-900"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {v}°
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bản dọc gọn cho điện thoại xoay ngang: kéo lên / xuống để nâng / hạ cơ */
function ElevationVertical({ value, onChange, disabled, ballColor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    onChange(Math.round(k * 90 * 2) / 2);
  };
  const rad = (value * Math.PI) / 180;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-300">
        Góc cơ
      </span>
      <span className="text-xs font-bold tabular-nums">
        {value.toFixed(value % 1 ? 1 : 0)}°
      </span>
      {value >= 90 && (
        <span className="rounded bg-rose-500/25 px-1 text-[8px] font-black uppercase text-rose-300">
          Tối đa
        </span>
      )}
      {/* Biểu tượng cây cơ nghiêng theo góc */}
      <svg viewBox="0 0 40 30" className="h-6 w-10 shrink-0" aria-hidden>
        <line x1="0" y1="29" x2="40" y2="29" stroke="#2f6fb5" strokeWidth="2" />
        <line
          x1={30 - 4 * Math.cos(rad) - 24 * Math.cos(rad)}
          y1={25 - 4 * Math.sin(rad) - 24 * Math.sin(rad)}
          x2={30 - 4 * Math.cos(rad)}
          y2={25 - 4 * Math.sin(rad)}
          stroke="#d9b382"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="30" cy="25" r="3.5" fill={ballColor} />
      </svg>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Góc nâng cơ so với mặt bàn"
        aria-valuemin={0}
        aria-valuemax={90}
        aria-valuenow={value}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          set(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!disabled && e.buttons) set(e.clientY);
        }}
        className={`relative min-h-12 w-6 flex-1 touch-none overflow-hidden rounded-full border border-white/20 bg-black/50 ${disabled ? "opacity-50" : "cursor-ns-resize"}`}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-300 to-rose-500"
          style={{ height: `${(value / 90) * 100}%` }}
        />
        <div
          className="absolute inset-x-0 h-0.5 bg-white"
          style={{ bottom: `${(value / 90) * 100}%` }}
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-0.5">
        {QUICK.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`rounded py-0.5 text-[9px] font-bold disabled:opacity-40 ${
              Math.abs(value - v) < 0.25
                ? "bg-amber-400 text-slate-900"
                : "bg-white/10"
            }`}
          >
            {v}°
          </button>
        ))}
      </div>
    </div>
  );
}

/** Góc nâng cơ 0..90°: ngang (cột điều khiển) hoặc dọc (cột hẹp trên điện thoại) */
export default function ElevationControl({
  orientation = "horizontal",
  ...props
}: Props & { orientation?: "horizontal" | "vertical" }) {
  return orientation === "vertical" ? (
    <ElevationVertical {...props} />
  ) : (
    <ElevationHorizontal {...props} />
  );
}
