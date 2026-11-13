"use client";

import { useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { HAPTIC, vibrate } from "./haptics";
import { TIP_PRESETS, describeTip, presetTip, safeUnit, shortTipLabel, tipFromOffset, type TipLimits } from "./shotMath";

const ballBg = (color: string) => `radial-gradient(circle at 35% 30%, #ffffff, ${color} 55%, #00000066 100%)`;

/** Bi cái nhỏ ở góc (≥ 56 dp): chấm đỏ = điểm chạm hiện tại. Chạm để phóng to. */
export function SpinMini({
  tipX,
  tipY,
  limits,
  color,
  disabled,
  onOpen,
}: {
  tipX: number;
  tipY: number;
  limits: TipLimits;
  color: string;
  disabled: boolean;
  onOpen: (rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const label = shortTipLabel(tipX, tipY, limits);
  return (
    <div className="relative">
      {label && (
        <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-[#ffd166]">
          {label}
        </span>
      )}
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label="Chỉnh điểm chạm trên bi cái (chạm để phóng to)"
        onClick={() => ref.current && onOpen(ref.current.getBoundingClientRect())}
        className="relative h-16 w-16 touch-none rounded-full border-2 border-white/40 shadow-[0_6px_16px_rgba(0,0,0,0.5)] transition active:scale-95 disabled:opacity-45"
        style={{ background: ballBg(color) }}
      >
        <span
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#e11d2a] shadow"
          style={{
            left: `${50 + tipX * limits.maxFrac * 50}%`,
            top: `${50 - tipY * limits.maxFrac * 50}%`,
          }}
        />
      </button>
    </div>
  );
}

/**
 * Bi lớn giữa màn hình để chấm điểm chạm. Chấm đỏ bám ngón tay, bị kẹp ở mép vòng an toàn
 * (ngoài vòng = vùng trượt cơ). Đóng: chạm ra ngoài hoặc "Xong".
 */
export function SpinModal({
  tipX,
  tipY,
  limits,
  color,
  origin,
  haptics,
  onChange,
  onClose,
}: {
  tipX: number;
  tipY: number;
  limits: TipLimits;
  color: string;
  /** Hình chữ nhật của bi nhỏ lúc mở (để phóng to từ đúng góc) */
  origin: DOMRect | null;
  haptics: boolean;
  onChange: (x: number, y: number) => void;
  onClose: () => void;
}) {
  const ballRef = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const wasClamped = useRef(false);
  const [closing, setClosing] = useState(false);
  const [flash, setFlash] = useState(false);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const update = (e: React.PointerEvent) => {
    const el = ballRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = tipFromOffset(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2, limits);
    onChange(t.x, t.y);
    if (t.clamped && !wasClamped.current) {
      // Vượt vùng an toàn: rung nhẹ + viền đỏ nhấp nháy ngắn
      vibrate([...HAPTIC.warn], haptics);
      setFlash(true);
      setTimeout(() => setFlash(false), 260);
    }
    wasClamped.current = t.clamped;
  };

  // Hoạt cảnh: từ bi nhỏ ở góc -> giữa màn hình
  const vw = typeof window === "undefined" ? 800 : window.innerWidth;
  const vh = typeof window === "undefined" ? 400 : window.innerHeight;
  const miniCx = origin ? origin.left + origin.width / 2 : vw - 40;
  const miniCy = origin ? origin.top + origin.height / 2 : vh - 40;
  const big = Math.min(vw * 0.5, vh * 0.72, 440);
  const anim = {
    "--dx": `${miniCx - vw / 2}px`,
    "--dy": `${miniCy - vh / 2}px`,
    "--s": `${(origin?.width ?? 64) / big}`,
  } as React.CSSProperties;

  const s = safeUnit(limits);
  const cx = 50 + tipX * limits.maxFrac * 50;
  const cy = 50 - tipY * limits.maxFrac * 50;
  const safeR = limits.safeFrac * 50;
  const maxR = limits.maxFrac * 50;
  const desc = describeTip(tipX, tipY, limits);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center gap-4 bg-black/55 p-3 backdrop-blur-[2px] animate-overlay-in max-[500px]:landscape:gap-3 [@media(max-height:500px)]:flex-row"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex max-h-full flex-col items-center gap-3 [@media(max-height:500px)]:flex-row" style={anim}>
        {/* Bi lớn */}
        <div
          ref={ballRef}
          role="slider"
          aria-label="Điểm chạm trên bi cái"
          aria-valuetext={desc}
          aria-valuenow={Math.round(tipY * 100)}
          tabIndex={0}
          className={`relative aspect-square shrink-0 touch-none select-none rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${closing ? "animate-ball-out" : "animate-ball-in"}`}
          style={{ ...anim, width: "min(50vw, 72dvh, 440px)", background: ballBg(color) }}
          onPointerDown={(e) => {
            if (drag.current !== null) return;
            drag.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            wasClamped.current = false;
            update(e);
          }}
          onPointerMove={(e) => {
            if (drag.current === e.pointerId) update(e);
          }}
          onPointerUp={(e) => {
            if (drag.current === e.pointerId) drag.current = null;
          }}
          onPointerCancel={() => (drag.current = null)}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            {/* Hoạ tiết nhẹ để thấy hướng xoáy */}
            <ellipse cx="50" cy="50" rx="20" ry="49" fill="none" stroke="#00000012" strokeWidth="0.6" />
            <ellipse cx="50" cy="50" rx="38" ry="49" fill="none" stroke="#00000010" strokeWidth="0.6" />
            <ellipse cx="50" cy="50" rx="49" ry="20" fill="none" stroke="#00000012" strokeWidth="0.6" />
            {/* Vùng trượt cơ (ngoài vòng an toàn) */}
            {s < 1 && (
              <path
                d={`M ${50 - maxR} 50 a ${maxR} ${maxR} 0 1 0 ${2 * maxR} 0 a ${maxR} ${maxR} 0 1 0 ${-2 * maxR} 0 M ${50 - safeR} 50 a ${safeR} ${safeR} 0 1 1 ${2 * safeR} 0 a ${safeR} ${safeR} 0 1 1 ${-2 * safeR} 0`}
                fill="#e11d2a"
                fillOpacity="0.16"
                fillRule="evenodd"
              />
            )}
            <circle cx="50" cy="50" r={safeR} fill="#ffffff" fillOpacity="0.14" stroke={flash ? "#ef4444" : "#0f6b52"} strokeOpacity={flash ? 1 : 0.7} strokeWidth={flash ? 1.8 : 0.9} strokeDasharray={s < 1 ? "none" : "2.4 1.8"} />
            {s < 1 && <circle cx="50" cy="50" r={maxR} fill="none" stroke="#e11d2a" strokeOpacity="0.55" strokeWidth="0.7" strokeDasharray="2.4 1.8" />}
            <line x1="50" y1="6" x2="50" y2="94" stroke="#0f172a" strokeOpacity="0.2" strokeWidth="0.5" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#0f172a" strokeOpacity="0.2" strokeWidth="0.5" />
            <g fontSize="5.4" fontWeight="800" fill="#0f172a" fillOpacity="0.45" textAnchor="middle">
              <text x="50" y="11">Top</text>
              <text x="50" y="93">Draw</text>
              <text x="9" y="52">Trái</text>
              <text x="91" y="52">Phải</text>
            </g>
            {/* Chấm điểm chạm: đường kính ≈ 12% bi */}
            <circle cx={cx} cy={cy} r="6" fill="#e11d2a" stroke="#fff" strokeWidth="1.2" />
            <circle cx={cx} cy={cy} r="1.3" fill="#fff" />
          </svg>
        </div>

        {/* Bảng điều khiển: mô tả, gợi ý nhanh, đặt lại, xong */}
        <div className={`flex w-[min(86vw,360px)] flex-col items-center gap-2 text-white [@media(max-height:500px)]:w-44 ${closing ? "opacity-0 transition-opacity duration-100" : ""}`}>
          <p aria-live="polite" className="min-h-5 text-center text-sm font-extrabold text-[#ffd166]">{desc}</p>
          <div className="flex w-full flex-wrap justify-center gap-1.5">
            {TIP_PRESETS.map((p) => {
              const t = presetTip(p, limits);
              const on = Math.hypot(t.x - tipX, t.y - tipY) < 0.05;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onChange(t.x, t.y)}
                  className={`min-h-12 min-w-12 rounded-xl border px-2 text-xs font-bold transition [@media(max-height:500px)]:min-h-10 ${on ? "border-[#f4b942] bg-[#f4b942]/20 text-[#ffd166]" : "border-white/15 bg-white/10 text-slate-100"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex w-full gap-2">
            <button type="button" onClick={() => onChange(0, 0)} className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2 text-xs font-bold [@media(max-height:500px)]:min-h-10">
              <RotateCcw className="h-4 w-4" /> Đặt lại giữa
            </button>
            <button type="button" onClick={close} className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-2 text-sm font-black shadow-[0_3px_0_#7f1118] [@media(max-height:500px)]:min-h-10">
              <Check className="h-4 w-4" /> Xong
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
