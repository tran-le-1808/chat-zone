/** Rung nhẹ (nếu thiết bị hỗ trợ và người chơi bật). Không bao giờ ném lỗi. */
export function vibrate(pattern: number | number[], enabled: boolean) {
  if (!enabled || typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* thiết bị không hỗ trợ */
  }
}
export const HAPTIC = { tick: 8, shoot: 28, warn: [14, 40, 14] } as const;
