import type { MoveSpeed } from "./stepTimeline";

/** Cài đặt hoạt ảnh di chuyển (lưu cục bộ; mặc định tôn trọng prefers-reduced-motion) */
const KEY_SPEED = "mono-move-speed";
const KEY_SOUND = "mono-step-sound";
const KEY_FX = "mono-move-fx";

function read(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function getMoveSpeed(): MoveSpeed {
  const v = read(KEY_SPEED);
  return v === "slow" || v === "fast" || v === "instant" || v === "normal" ? v : "normal";
}

export function setMoveSpeed(v: MoveSpeed) {
  try {
    window.localStorage.setItem(KEY_SPEED, v);
  } catch {
    /* bỏ qua */
  }
}

export const stepSoundEnabled = () => read(KEY_SOUND) !== "off";
/** Hiệu ứng phụ (bụi, lún ô, nảy): tắt khi giảm chuyển động hoặc công tắc */
export const moveFxEnabled = () => read(KEY_FX) !== "off" && !prefersReducedMotion();
