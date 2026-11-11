"use client";

import { useSyncExternalStore } from "react";

/** Điện thoại: hẹp hơn breakpoint `md` (768px) hoặc màn hình thấp khi xoay ngang */
export const COMPACT_QUERY = "(max-width: 767px), (max-height: 500px)";

// Giữ 1 hàm subscribe cố định cho mỗi query (tránh đăng ký lại mỗi lần render)
const subscribers = new Map<string, (onChange: () => void) => () => void>();
function subscribe(query: string) {
  const cached = subscribers.get(query);
  if (cached) return cached;
  const fn = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  subscribers.set(query, fn);
  return fn;
}

/** Theo dõi 1 media query (an toàn khi render phía server: mặc định false) */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** true khi đang chơi trên màn hình điện thoại */
export function useIsCompact() {
  return useMediaQuery(COMPACT_QUERY);
}

/** Điện thoại xoay ngang: màn hình thấp, chiều cao là giới hạn chính */
export const PHONE_LANDSCAPE_QUERY =
  "(max-height: 500px) and (orientation: landscape)";

/** true khi đang chơi trên điện thoại xoay ngang */
export function useIsPhoneLandscape() {
  return useMediaQuery(PHONE_LANDSCAPE_QUERY);
}
