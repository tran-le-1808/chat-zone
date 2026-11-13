"use client";

import { useEffect, useRef } from "react";
import { ChevronsDown } from "lucide-react";
import { pullFromDrag } from "./shotMath";

const HANDLE_H = 66;

const levelColor = (d: number) => (d < 0.34 ? "#34d399" : d < 0.67 ? "#f4b942" : "#ef4444");

/**
 * Thanh kéo cơ: chạm tay nắm ở trên rồi KÉO XUỐNG để lấy lực, kéo lên lại để giảm, THẢ để đánh.
 * Kéo về sát vị trí đầu (< 5%) rồi thả = huỷ. Chỉ nhận con trỏ bắt đầu ngay trên tay nắm,
 * và chỉ 1 con trỏ — ngón thứ hai (ngắm / zoom) không ảnh hưởng.
 */
export default function PowerPull({
  power,
  disabled,
  sensitivity,
  onStart,
  onMove,
  onRelease,
  onCancel,
}: {
  power: number;
  disabled: boolean;
  sensitivity: number;
  /** Trả false nếu không được phép bắt đầu kéo */
  onStart: () => boolean;
  onMove: (d: number) => void;
  onRelease: (d: number) => void;
  onCancel: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startY: number; travel: number; d: number } | null>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });

  // Mất focus / chuyển tab / cuộc gọi đến giữa lúc kéo -> huỷ, không tự đánh
  useEffect(() => {
    const abort = () => {
      if (!drag.current) return;
      drag.current = null;
      cancelRef.current();
    };
    const onVis = () => document.hidden && abort();
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const d = Math.max(0, Math.min(1, power));
  const color = levelColor(d);
  const pulling = d > 0;

  return (
    <div
      ref={trackRef}
      className={`relative h-full w-[78px] select-none overflow-hidden rounded-3xl border border-white/15 bg-black/40 shadow-xl backdrop-blur-sm ${disabled ? "opacity-45" : ""}`}
      style={{ touchAction: "none" }}
    >
      {/* Thang lực: xanh → vàng → đỏ, có vạch 25 / 50 / 75% */}
      <div className="pointer-events-none absolute inset-y-3 left-2.5 w-3 overflow-hidden rounded-full" style={{ background: "linear-gradient(to bottom, #34d399, #f4b942 55%, #ef4444)" }}>
        <div className="absolute inset-x-0 bottom-0 bg-[#1a1c2e]/90" style={{ top: `${d * 100}%` }} />
      </div>
      {[25, 50, 75].map((t) => (
        <span key={t} className="pointer-events-none absolute left-1 h-px w-6 bg-white/45" style={{ top: `calc(12px + (100% - 24px) * ${t / 100})` }}>
          <span className="absolute -top-[6px] left-6 text-[8px] font-bold text-white/55">{t}</span>
        </span>
      ))}

      {/* Cây cơ đứng: tay nắm ở trên, thân cơ kéo theo xuống (vị trí theo % chiều cao thanh) */}
      <div className="absolute right-1.5 w-[44px]" style={{ top: `calc(6px + (100% - ${HANDLE_H + 12}px) * ${d})` }}>
        <div>
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Kéo cơ xuống để lấy lực, thả tay để đánh"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(d * 100)}
            aria-disabled={disabled}
            className={`relative z-10 flex h-[66px] w-[44px] cursor-grab flex-col items-center justify-center rounded-2xl border-2 shadow-[0_6px_14px_rgba(0,0,0,0.55)] active:cursor-grabbing ${pulling ? "scale-105" : ""} transition-transform`}
            style={{
              touchAction: "none",
              borderColor: pulling ? color : "rgba(255,255,255,0.35)",
              background: "linear-gradient(135deg, #5b2e14, #2b1409)",
            }}
            onPointerDown={(e) => {
              if (disabled || drag.current) return;
              if (e.pointerType === "mouse" && e.button !== 0) return;
              const el = trackRef.current;
              if (!el) return;
              if (!onStart()) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { id: e.pointerId, startY: e.clientY, travel: Math.max(60, el.clientHeight - HANDLE_H - 12), d: 0 };
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              const s = drag.current;
              if (!s || s.id !== e.pointerId) return;
              s.d = pullFromDrag(s.startY, e.clientY, s.travel, sensitivity);
              onMove(s.d);
            }}
            onPointerUp={(e) => {
              const s = drag.current;
              if (!s || s.id !== e.pointerId) return;
              drag.current = null;
              onRelease(s.d);
            }}
            onPointerCancel={(e) => {
              const s = drag.current;
              if (!s || s.id !== e.pointerId) return;
              drag.current = null;
              onCancel();
            }}
            onLostPointerCapture={(e) => {
              const s = drag.current;
              if (!s || s.id !== e.pointerId) return;
              drag.current = null;
              onCancel();
            }}
          >
            {pulling ? (
              <span className="text-sm font-black tabular-nums" style={{ color }}>
                {Math.round(d * 100)}%
              </span>
            ) : (
              <>
                <ChevronsDown className="h-5 w-5 text-[#ffd166]" />
                <span className="text-[9px] font-bold uppercase tracking-wide text-[#ffd166]/80">Kéo</span>
              </>
            )}
            {/* Rãnh cầm */}
            <span className="absolute inset-x-2 top-1.5 h-px bg-white/15" />
            <span className="absolute inset-x-2 bottom-1.5 h-px bg-white/15" />
          </div>
          {/* Thân cơ + đầu da (bị cắt dưới khung khi kéo) */}
          <div className="mx-auto -mt-1 h-[700px] w-3 rounded-b-full" style={{ background: "linear-gradient(90deg, #e9d3a8, #c79a5e 55%, #8b5a2b)" }} />
        </div>
      </div>
    </div>
  );
}
