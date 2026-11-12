/** Định dạng thời gian kiểu Việt Nam cho danh sách & tin nhắn */

export function relativeTimeVi(iso?: string | null, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t) / 1000;
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  const d = new Date(t);
  const today = new Date(now);
  const yesterday = new Date(now - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
  if (d.getFullYear() === today.getFullYear())
    return `${d.getDate()}/${d.getMonth() + 1}`;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function clockVi(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Nhãn ngày để ngăn cách tin nhắn: "Hôm nay", "Hôm qua", "Thứ Hai, 10/11/2026" */
export function dayLabelVi(iso?: string | null, now = Date.now()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date(now);
  const yesterday = new Date(now - 86400000);
  if (d.toDateString() === today.toDateString()) return "Hôm nay";
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
  const days = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
