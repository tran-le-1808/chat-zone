/**
 * Chuyển hướng sau khi đăng nhập: /login?redirect=/games/monopoly/room/ABC123
 *
 * Chỉ chấp nhận đường dẫn NỘI BỘ (bắt đầu bằng "/" và không phải "//" hay "/\")
 * để tránh bị lợi dụng chuyển hướng sang trang ngoài (open redirect).
 */
export const REDIRECT_PARAM = "redirect";

const AUTH_PAGES = ["/login", "/register"];

export function getSafeRedirect(value: string | null | undefined): string {
  if (!value) return "/";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return "/";
  // Không quay lại chính trang đăng nhập / đăng ký
  const path = value.split(/[?#]/)[0];
  if (AUTH_PAGES.includes(path)) return "/";
  return value;
}

/** Trang auth kèm đường dẫn cần quay lại (bỏ qua nếu là trang chủ) */
export function authUrlWithRedirect(
  authPath: "/login" | "/register",
  redirectTo: string | null | undefined,
): string {
  const target = getSafeRedirect(redirectTo);
  if (target === "/") return authPath;
  return `${authPath}?${REDIRECT_PARAM}=${encodeURIComponent(target)}`;
}

/** Đọc ?redirect= từ URL hiện tại (chỉ dùng phía client) */
export function readRedirectFromLocation(): string {
  if (typeof window === "undefined") return "/";
  return getSafeRedirect(
    new URLSearchParams(window.location.search).get(REDIRECT_PARAM),
  );
}
