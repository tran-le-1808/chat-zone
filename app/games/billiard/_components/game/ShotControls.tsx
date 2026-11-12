"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useBilliard } from "../../_context/BilliardGameContext";
import { BALL_COLORS } from "../../_lib/types";
import ElevationControl from "./ElevationControl";
import {
  DEFAULT_PHYSICS,
  checkCueClearance,
  sanitizeShot,
  type BallId,
} from "../../_lib/physics";

const DEG = Math.PI / 180;

/** Xoay hướng ngắm một góc (radian) */
function rotate(dx: number, dy: number, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { dirX: dx * c - dy * s, dirY: dx * s + dy * c };
}

/** Thanh lực dọc: kéo để chọn 0..100% */
function PowerBar({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(Math.max(0.01, Math.min(1, 1 - (clientY - r.top) / r.height)));
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
        Lực
      </span>
      <div
        ref={ref}
        role="slider"
        aria-label="Lực đánh"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          set(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!disabled && e.buttons) set(e.clientY);
        }}
        className={`relative h-32 w-7 touch-none overflow-hidden rounded-full border border-white/20 bg-black/50 [@media(max-height:500px)]:h-24 ${disabled ? "opacity-50" : "cursor-ns-resize"}`}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-400 via-amber-400 to-rose-500"
          style={{ height: `${value * 100}%` }}
        />
        <div
          className="absolute inset-x-0 h-0.5 bg-white"
          style={{ bottom: `${value * 100}%` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

/** Chọn điểm chạm đầu cơ trên bi cái (spin) */
function SpinPicker({
  tipX,
  tipY,
  color,
  onChange,
  disabled,
}: {
  tipX: number;
  tipY: number;
  color: string;
  onChange: (x: number, y: number) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (cx: number, cy: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let x = ((cx - r.left) / r.width) * 2 - 1;
    let y = -(((cy - r.top) / r.height) * 2 - 1);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    onChange(x, y);
  };
  const label =
    Math.hypot(tipX, tipY) < 0.12
      ? "Giữa tâm"
      : [
          tipY > 0.25 ? "Trên (follow)" : tipY < -0.25 ? "Dưới (draw)" : "",
          tipX > 0.25 ? "Phải" : tipX < -0.25 ? "Trái" : "",
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
        Điểm chạm
      </span>
      <div
        ref={ref}
        role="slider"
        aria-label="Điểm chạm trên bi cái"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(tipY * 100)}
        aria-valuetext={label}
        tabIndex={0}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          set(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!disabled && e.buttons) set(e.clientX, e.clientY);
        }}
        onDoubleClick={() => onChange(0, 0)}
        className={`relative h-20 w-20 touch-none rounded-full border-2 border-white/30 shadow-inner [@media(max-height:500px)]:h-16 [@media(max-height:500px)]:w-16 ${disabled ? "opacity-50" : "cursor-crosshair"}`}
        style={{
          background: `radial-gradient(circle at 35% 30%, #ffffff, ${color} 55%, #00000055 100%)`,
        }}
      >
        <span className="pointer-events-none absolute left-1/2 top-1 h-[calc(100%-8px)] w-px -translate-x-1/2 bg-black/15" />
        <span className="pointer-events-none absolute left-1 top-1/2 h-px w-[calc(100%-8px)] -translate-y-1/2 bg-black/15" />
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow"
          style={{
            left: `${50 + tipX * 42}%`,
            top: `${50 - tipY * 42}%`,
          }}
        />
      </div>
      <span className="h-3 text-[10px] text-gray-300">{label}</span>
    </div>
  );
}

export default function ShotControls({
  showElevation = true,
}: {
  /** Điện thoại xoay ngang: góc cơ được tách ra cột riêng */
  showElevation?: boolean;
} = {}) {
  const {
    match,
    aim,
    setAim,
    canShoot,
    isMyTurn,
    animating,
    shooting,
    shoot,
    displayTurn,
  } = useBilliard();
  const disabled = !canShoot;
  const clearance = useMemo(() => {
    if (!match || !isMyTurn) return null;
    const cue = match.turn as BallId;
    return checkCueClearance(
      match.balls,
      sanitizeShot(aim, cue),
      DEFAULT_PHYSICS,
    );
  }, [match, isMyTurn, aim]);
  const blocked = !!clearance && !clearance.ok;
  const cueColor = BALL_COLORS[displayTurn];

  const turn = useCallback(
    (deg: number) => setAim(rotate(aim.dirX, aim.dirY, deg * DEG)),
    [aim.dirX, aim.dirY, setAim],
  );

  // Phím tắt (bỏ qua khi đang gõ chat)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || !canShoot) return;
      const fine = e.shiftKey ? 0.05 : 0.5;
      if (e.key === "ArrowLeft") turn(fine);
      else if (e.key === "ArrowRight") turn(-fine);
      else if (e.key === "ArrowUp")
        setAim({ power: Math.min(1, aim.power + 0.02) });
      else if (e.key === "ArrowDown")
        setAim({ power: Math.max(0.01, aim.power - 0.02) });
      else if (e.key === "w" || e.key === "W")
        setAim({
          elevation: Math.min(90, aim.elevation + (e.shiftKey ? 0.5 : 2.5)),
        });
      else if (e.key === "s" || e.key === "S")
        setAim({
          elevation: Math.max(0, aim.elevation - (e.shiftKey ? 0.5 : 2.5)),
        });
      else if (e.key === " ") {
        if (!blocked) void shoot();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canShoot, turn, aim.power, aim.elevation, setAim, shoot, blocked]);

  const status = !match
    ? ""
    : match.winner !== null
      ? "Trận đấu đã kết thúc"
      : animating
        ? "Bi đang lăn..."
        : shooting
          ? "Đang gửi cú đánh..."
          : !isMyTurn
            ? "Đang chờ đối thủ đánh"
            : !canShoot
              ? "Chờ bi dừng hẳn..."
              : "Kéo trên bàn để ngắm";

  return (
    <div className="flex w-full flex-col gap-3 [@media(max-height:500px)]:gap-1.5">
      <div className="flex items-end justify-center gap-4 [@media(max-height:500px)]:gap-2">
        <SpinPicker
          tipX={aim.tipX}
          tipY={aim.tipY}
          color={cueColor}
          disabled={disabled}
          onChange={(tipX, tipY) => setAim({ tipX, tipY })}
        />
        <PowerBar
          value={aim.power}
          disabled={disabled}
          onChange={(power) => setAim({ power })}
        />
      </div>
      <div className="flex w-full flex-col gap-2 [@media(max-height:500px)]:gap-1">
        <div className="flex gap-1">
          {[1, 0.1, -0.1, -1].map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => turn(d)}
              aria-label={`Xoay ngắm ${d > 0 ? "trái" : "phải"} ${Math.abs(d)} độ`}
              className="flex-1 rounded-lg bg-white/10 py-1 text-[11px] font-bold hover:bg-white/20 disabled:opacity-40"
            >
              {d > 0 ? (d === 1 ? "⟲" : "‹") : d === -1 ? "⟳" : "›"}
            </button>
          ))}
        </div>
        {showElevation && (
          <ElevationControl
            value={aim.elevation}
            disabled={disabled}
            ballColor={cueColor}
            onChange={(elevation) => setAim({ elevation })}
          />
        )}
        {blocked && canShoot && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-1.5 text-center text-[10px] leading-snug text-amber-200">
            ⚠️ {clearance?.reason}
            {clearance?.minElevation !== null &&
              clearance?.minElevation !== undefined && (
                <button
                  type="button"
                  onClick={() =>
                    setAim({ elevation: clearance.minElevation ?? 90 })
                  }
                  className="mt-1 block w-full rounded-md bg-amber-400 py-0.5 font-bold text-slate-900"
                >
                  Nâng cơ tới {clearance.minElevation}°
                </button>
              )}
          </div>
        )}
        <button
          type="button"
          disabled={disabled || blocked}
          onClick={() => void shoot()}
          className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-base font-black text-slate-900 shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-300 [@media(max-height:500px)]:py-2"
        >
          {shooting ? "..." : "Đánh"}
        </button>
        <span className="text-center text-[10px] leading-tight text-gray-300">
          {status}
        </span>
      </div>
    </div>
  );
}
