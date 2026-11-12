/**
 * Chuyển cuộc hội thoại trên trang chính bằng History API gốc của trình duyệt.
 *
 * Vì sao không dùng router.push:
 * trang "/" được prerender tĩnh. Ở bản production (Next 16), sau khi tải lại trang
 * khi URL đang có ?conversationId=..., router.push sang cùng trang chỉ khác search
 * params bị "treo" — URL không đổi (bản dev render động nên không gặp).
 *
 * Next.js đồng bộ window.history.pushState / replaceState với useSearchParams,
 * nên component vẫn nhận conversationId mới — lại không cần gọi server.
 */
export function goToConversation(
  conversationId: string | null,
  options: { replace?: boolean } = {},
) {
  if (typeof window === "undefined") return;
  const url = conversationId
    ? `/?conversationId=${encodeURIComponent(conversationId)}`
    : "/";
  if (`${window.location.pathname}${window.location.search}` === url) return;
  if (options.replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}
