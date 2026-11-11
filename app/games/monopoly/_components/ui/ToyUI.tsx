"use client";

import React from "react";
import localFont from "next/font/local";
import { useIsPhoneLandscape } from "./useScreen";

/**
 * Bộ giao diện "đồ chơi" dùng chung cho mọi modal trong game Cờ Tỷ Phú:
 * nền kem ấm, viền dày màu nhấn, góc bo lớn, nút bấm 3D kiểu kẹo, font Nunito tròn trịa.
 * Đồng bộ với phong cách bàn cờ "Đảo Tỷ Phú".
 */

export const toyFont = localFont({
  src: "../../../../../public/fonts/Nunito-ExtraBold.ttf",
  weight: "800",
  display: "swap",
});

/** Bảng màu nhấn cho từng loại modal / nút */
export const TOY_COLORS = {
  orange: {
    main: "#ff8a3d",
    dark: "#d4621a",
    soft: "#ffe1c2",
    text: "#7a3300",
  },
  purple: {
    main: "#8b6cf0",
    dark: "#5f43c4",
    soft: "#e4dcff",
    text: "#3b2580",
  },
  pink: { main: "#ff5c9a", dark: "#d23a74", soft: "#ffd6e8", text: "#7d1640" },
  green: { main: "#4fbf6b", dark: "#2f9148", soft: "#dff5c4", text: "#1f5a2d" },
  blue: { main: "#3fa9f5", dark: "#1f7fc4", soft: "#d3edff", text: "#0d4470" },
  gold: { main: "#ffc23d", dark: "#d99500", soft: "#fff1c2", text: "#6b4500" },
  red: { main: "#ff5a4e", dark: "#cc362c", soft: "#ffd9d5", text: "#7a1610" },
  gray: { main: "#c9cfdc", dark: "#9aa3b5", soft: "#eef1f6", text: "#3b4258" },
} as const;

export type ToyColor = keyof typeof TOY_COLORS;

/** Keyframes dùng chung (chèn 1 lần trong mỗi modal, trình duyệt tự gộp) */
export function ToyKeyframes() {
  return (
    <style>{`
      @keyframes toy-pop {
        0% { transform: scale(.6) translateY(30px); opacity: 0; }
        60% { transform: scale(1.04) translateY(-4px); opacity: 1; }
        100% { transform: scale(1) translateY(0); }
      }
      @keyframes toy-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes toy-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      @keyframes toy-wiggle { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(6deg) } }
      @keyframes toy-shine { from { transform: translateX(-120%) } to { transform: translateX(220%) } }
      @keyframes toy-progress { from { width: 100% } to { width: 0% } }
      @keyframes toy-card-flip {
        0% { transform: perspective(900px) rotateY(90deg) scale(.8); opacity: 0; }
        60% { transform: perspective(900px) rotateY(-8deg) scale(1.03); opacity: 1; }
        100% { transform: perspective(900px) rotateY(0) scale(1); }
      }
      .toy-pop { animation: toy-pop .45s cubic-bezier(.2,1.4,.4,1) both; }
      .toy-fade { animation: toy-fade .25s ease-out both; }
      .toy-bob { animation: toy-bob 2.2s ease-in-out infinite; }
      .toy-wiggle { animation: toy-wiggle 1.6s ease-in-out infinite; }
      .toy-card-flip { animation: toy-card-flip .6s cubic-bezier(.2,1.2,.4,1) both; }
    `}</style>
  );
}

/** Lớp nền tối phía sau modal */
export function ToyOverlay({
  children,
  z = 100,
}: {
  children: React.ReactNode;
  z?: number;
}) {
  return (
    <div
      className={`${toyFont.className} toy-fade fixed inset-0 overflow-y-auto overscroll-contain`}
      style={{ zIndex: z, background: "rgba(16, 24, 56, 0.62)" }}
    >
      <ToyKeyframes />
      {/* Modal cao hơn màn hình (điện thoại xoay ngang...) thì cuộn được, vẫn căn giữa khi đủ chỗ */}
      <div className="flex min-h-full items-center justify-center px-3 py-12 sm:px-4 [@media(max-height:500px)]:py-3">
        {children}
      </div>
    </div>
  );
}

interface ToyPanelProps {
  color?: ToyColor;
  /** Biểu tượng lớn trong huy hiệu tròn ở đỉnh panel */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  maxWidth?: number;
}

/** Panel kem bo tròn, viền dày màu nhấn, huy hiệu biểu tượng nhô lên ở đỉnh.
 *  Điện thoại xoay ngang: chuyển sang bố cục 2 cột (biểu tượng + tiêu đề | nội dung)
 *  để modal rộng ra thay vì dài xuống. */
export function ToyPanel({
  color = "blue",
  icon,
  title,
  subtitle,
  children,
  className = "",
  maxWidth = 400,
}: ToyPanelProps) {
  const c = TOY_COLORS[color];
  const isLandscape = useIsPhoneLandscape();

  const panelStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, #fffaf0 0%, #fff1dc 100%)",
    border: `5px solid ${c.main}`,
    boxShadow: `0 10px 0 ${c.dark}, 0 24px 50px rgba(0,0,0,0.35)`,
    color: "#2b2f48",
  };
  const badgeStyle: React.CSSProperties = {
    background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${c.soft} 45%, ${c.main} 100%)`,
    border: `5px solid #fffaf0`,
    boxShadow: `0 6px 0 ${c.dark}, 0 10px 20px rgba(0,0,0,0.25)`,
  };

  if (isLandscape) {
    return (
      <div
        className={`toy-pop relative flex w-full items-stretch gap-4 rounded-[26px] p-4 text-center ${className}`}
        style={{ ...panelStyle, maxWidth: Math.max(maxWidth + 220, 600) }}
      >
        {(icon || title || subtitle) && (
          <div className="flex w-36 shrink-0 flex-col items-center justify-center">
            {icon && (
              <div
                className="toy-bob mb-2 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={badgeStyle}
              >
                {icon}
              </div>
            )}
            {title && (
              <h2
                className="text-lg leading-tight tracking-wide"
                style={{ color: c.dark }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs" style={{ color: "#6b7085" }}>
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 [&>*:first-child]:mt-0">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`toy-pop relative w-full rounded-[32px] px-5 pb-5 text-center ${icon ? "pt-12" : "pt-6"} ${className}`}
      style={{ ...panelStyle, maxWidth }}
    >
      {icon && (
        <div
          className="toy-bob absolute left-1/2 top-0 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-4xl"
          style={badgeStyle}
        >
          {icon}
        </div>
      )}
      {title && (
        <h2
          className="text-2xl leading-tight tracking-wide"
          style={{ color: c.dark }}
        >
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="mt-1 text-sm" style={{ color: "#6b7085" }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

interface ToyButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> {
  color?: ToyColor;
  size?: "sm" | "md" | "lg";
  block?: boolean;
}

/** Nút bấm 3D kiểu kẹo: có "đế" bóng phía dưới, bấm vào thì lún xuống */
export function ToyButton({
  color = "blue",
  size = "md",
  block = true,
  className = "",
  children,
  disabled,
  style,
  ...rest
}: ToyButtonProps) {
  const c = TOY_COLORS[disabled ? "gray" : color];
  const pad =
    size === "lg"
      ? "px-5 py-3.5 text-lg"
      : size === "sm"
        ? "px-3 py-1.5 text-sm"
        : "px-4 py-2.5 text-base";
  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative overflow-hidden rounded-2xl text-white transition-transform duration-75 active:translate-y-[4px] disabled:cursor-not-allowed ${block ? "w-full" : ""} ${pad} ${className}`}
      style={{
        background: `linear-gradient(180deg, ${c.main} 0%, ${c.dark} 130%)`,
        boxShadow: disabled
          ? `0 3px 0 ${c.dark}`
          : `0 5px 0 ${c.dark}, 0 8px 14px rgba(0,0,0,0.18)`,
        textShadow: "0 2px 0 rgba(0,0,0,0.18)",
        opacity: disabled ? 0.65 : 1,
        ...style,
      }}
      {...rest}
    >
      {/* Vệt bóng phía trên cho cảm giác nhựa */}
      <span
        className="pointer-events-none absolute inset-x-2 top-1 h-[38%] rounded-xl"
        style={{ background: "rgba(255,255,255,0.28)" }}
      />
      <span className="relative flex items-center justify-between gap-2">
        {children}
      </span>
    </button>
  );
}

/** Nhãn giá tiền hình viên kẹo */
export function ToyPrice({
  amount,
  color = "gold",
  prefix = "$",
}: {
  amount: number | string;
  color?: ToyColor;
  prefix?: string;
}) {
  const c = TOY_COLORS[color];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-sm"
      style={{
        background: c.soft,
        color: c.text,
        boxShadow: `inset 0 -2px 0 ${c.main}55`,
      }}
    >
      {prefix}
      {typeof amount === "number" ? amount.toLocaleString("vi-VN") : amount}
    </span>
  );
}
