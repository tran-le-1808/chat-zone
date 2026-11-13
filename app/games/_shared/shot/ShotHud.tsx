"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PowerPull from "./PowerPull";
import { SpinMini, SpinModal } from "./SpinPicker";
import type { ShotInput } from "./useShotInput";
import type { ShotSettings } from "./shotSettings";
import type { TipLimits } from "./shotMath";

/** Nút công cụ vuông ≥ 48 dp trong thanh công cụ */
export function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
  badge,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-2xl border px-2 text-xs font-extrabold shadow transition active:scale-95 disabled:opacity-40 ${active ? "border-[#f4b942] bg-[#f4b942] text-[#1a1206]" : "border-white/15 bg-black/50 text-slate-100 backdrop-blur-sm"}`}
    >
      {children}
      {badge && <span className="absolute -right-1 -top-1 rounded-full bg-[#c81d25] px-1 text-[9px] font-black text-white">{badge}</span>}
    </button>
  );
}

/** Cửa sổ nhỏ nổi lên phía trên thanh công cụ (vd. chỉnh góc nâng cơ) */
export function ToolPopover({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={onClose} />
      <div className="absolute bottom-full right-0 z-30 mb-2 w-60 rounded-2xl border border-white/15 bg-[#11132a]/95 p-3 text-white shadow-2xl backdrop-blur-md">{children}</div>
    </>
  );
}

export interface ShotHudProps {
  shot: ShotInput;
  /** Được phép đánh (đúng lượt, bi dừng, …) */
  enabled: boolean;
  settings: ShotSettings;
  /** Mức kéo cơ hiện tại 0..1 (aim.power) */
  power: number;
  tipX: number;
  tipY: number;
  onTip: (x: number, y: number) => void;
  limits: TipLimits;
  /** Màu bi cái */
  ballColor: string;
  /** Chỉ dùng cho phím mũi tên (desktop) — không còn thanh ngắm tinh trên màn hình */
  onAimNudge: (deg: number) => void;
  /** Các công cụ phụ của game (góc cơ, gọi bi, phòng thủ…) */
  tools?: ReactNode;
  /** Cảnh báo (vd. cơ vướng băng) */
  notice?: ReactNode;
}

/**
 * Lớp điều khiển đánh bi kiểu 8 Ball Pool phủ lên khung bàn:
 *  - thanh kéo cơ (lực) ở cạnh, bi cái nhỏ ở góc dưới (đối diện), thanh công cụ nhỏ ở đáy;
 *  - dòng gợi ý trạng thái nằm ở thanh trên (header), không phủ lên bàn;
 *  - Space giữ để lấy lực / thả để đánh, Esc huỷ, ←/→ chỉnh ngắm.
 * Tôn trọng safe area. Không có nút "Đánh".
 */
export default function ShotHud({ shot, enabled, settings, power, tipX, tipY, onTip, limits, ballColor, onAimNudge, tools, notice }: ShotHudProps) {
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const lefty = settings.hand === "left";
  const api = useRef({ shot, onAimNudge, settings });
  const charge = useRef<{ t0: number; raf: number; d: number } | null>(null);
  useEffect(() => {
    api.current = { shot, onAimNudge, settings };
  });

  // Phím tắt (desktop)
  useEffect(() => {
    const stopCharge = () => {
      if (charge.current) cancelAnimationFrame(charge.current.raf);
      charge.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const a = api.current;
      if (e.key === "Escape") {
        if (charge.current) {
          stopCharge();
          a.shot.pullCancel();
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const fine = e.shiftKey ? 0.05 : 0.5;
        a.onAimNudge((e.key === "ArrowLeft" ? fine : -fine) * a.settings.aimSensitivity);
        e.preventDefault();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (e.repeat || charge.current || !a.shot.pullStart()) return;
        const t0 = performance.now();
        const loop = () => {
          const c = charge.current;
          if (!c) return;
          c.d = Math.min(1, (performance.now() - t0) / 1600);
          api.current.shot.pullMove(c.d);
          c.raf = requestAnimationFrame(loop);
        };
        charge.current = { t0, raf: requestAnimationFrame(loop), d: 0 };
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === " " || e.code === "Space") && charge.current) {
        const d = charge.current.d;
        stopCharge();
        api.current.shot.pullRelease(d);
        e.preventDefault();
      }
    };
    const onBlur = () => {
      if (charge.current) {
        stopCharge();
        api.current.shot.pullCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      stopCharge();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const locked = !enabled;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      {/* Thanh kéo cơ: cạnh đối diện tay thuận, cao ~60% khung */}
      <div className={`pointer-events-auto absolute top-[10%] ${lefty ? "right-2" : "left-2"}`} style={{ height: "clamp(170px, 60%, 540px)" }}>
        <PowerPull
          power={power}
          disabled={locked || shot.spinOpen}
          sensitivity={settings.pullSensitivity}
          onStart={shot.pullStart}
          onMove={shot.pullMove}
          onRelease={shot.pullRelease}
          onCancel={shot.pullCancel}
        />
      </div>

      {notice && <div className="pointer-events-auto absolute inset-x-0 bottom-[84px] flex justify-center px-3">{notice}</div>}

      {/* Đáy: công cụ nhỏ + bi cái nhỏ ở góc thuận tay */}
      <div className={`absolute bottom-2 flex items-end gap-2 ${lefty ? "left-2 flex-row" : "right-2 flex-row-reverse"} [@media(max-height:500px)]:bottom-1`}>
        <div className="pointer-events-auto relative">
          <SpinMini
            tipX={tipX}
            tipY={tipY}
            limits={limits}
            color={ballColor}
            disabled={locked}
            onOpen={(rect) => {
              if (shot.openSpin()) setOrigin(rect);
            }}
          />
        </div>
        <div className={`pointer-events-auto relative flex max-w-[calc(100vw-9rem)] flex-wrap items-end gap-1.5 ${lefty ? "" : "justify-end"}`}>
          {tools}
        </div>
      </div>

      {shot.spinOpen && (
        <div className="pointer-events-auto">
          <SpinModal tipX={tipX} tipY={tipY} limits={limits} color={ballColor} origin={origin} haptics={settings.haptics} onChange={onTip} onClose={shot.closeSpin} />
        </div>
      )}
    </div>
  );
}
