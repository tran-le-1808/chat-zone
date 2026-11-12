/**
 * URL đầy đủ của tệp đính kèm.
 * - Tệp mới: lưu trên Cloudinary -> đã là URL tuyệt đối (https://res.cloudinary.com/...)
 * - Tệp cũ: đường dẫn tương đối "/uploads/..." trên server API
 */
export function mediaUrl(url?: string | null): string {
  if (!url) return "";
  if (
    /^(https?:)?\/\//i.test(url) ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  )
    return url;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${url}`;
}
