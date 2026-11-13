/**
 * Toán thuần của bộ điều khiển đánh bi (không phụ thuộc React / engine) — để test được.
 * Mọi giá trị trả ra đều ở ĐƠN VỊ ENGINE đang dùng: power 0..1, tip (x, y) trong đĩa đơn vị.
 */

/** Khoảng lùi cơ tối đa (m) ứng với lực 100%, và khoảng hở mặc định giữa đầu cơ & bi */
export const MAX_PULL_M = 0.18;
export const MIN_PULL_M = 0.02;
/** Kéo dưới ngưỡng này rồi thả = huỷ cú đánh */
export const CANCEL_THRESHOLD = 0.05;
export const MILESTONES = [0.25, 0.5, 0.75] as const;
/** Lực dùng để vẽ đường dự đoán khi chưa kéo cơ */
export const PREVIEW_POWER = 0.6;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Khoảng lùi của đầu cơ so với bi (m) theo mức kéo d ∈ [0,1] */
export const cuePullDistance = (d: number) => MIN_PULL_M + clamp01(d) * MAX_PULL_M;

/**
 * Đường cong lực: f(d) = d^exp. exp = 1 khi engine đã tự có đường cong phi tuyến
 * (Bida Lỗ: v = vmin + (vmax−vmin)·p^1.5); exp > 1 để vùng lực thấp có độ phân giải cao
 * (Bida Carom, engine tuyến tính).
 */
export const powerCurve = (d: number, exp: number) => Math.pow(clamp01(d), exp);

/** Mức kéo từ chuyển động ngón tay: kéo xuống `travelPx` pixel = 100% (đã nhân độ nhạy) */
export function pullFromDrag(startY: number, y: number, travelPx: number, sensitivity = 1): number {
  if (travelPx <= 0) return 0;
  return clamp01(((y - startY) / travelPx) * sensitivity);
}

/** Mốc 25/50/75% vừa bị vượt qua (cả 2 chiều) giữa 2 lần cập nhật, hoặc null */
export function crossedMilestone(prev: number, next: number): number | null {
  for (const m of MILESTONES) if ((prev < m && next >= m) || (prev >= m && next < m)) return m;
  return null;
}

// ======================= ĐIỂM CHẠM =======================

/** Giới hạn điểm chạm tính theo bán kính bi R: maxFrac = engine cho phép, safeFrac = trượt cơ nếu vượt */
export interface TipLimits {
  maxFrac: number;
  safeFrac: number;
}

/** Bán kính vòng an toàn trong đĩa đơn vị của engine (1 = maxFrac·R) */
export const safeUnit = (l: TipLimits) => Math.min(1, l.safeFrac / l.maxFrac);

/** Kẹp (x, y) vào vòng an toàn */
export function clampTipUnit(x: number, y: number, l: TipLimits): { x: number; y: number; clamped: boolean } {
  const s = safeUnit(l);
  const len = Math.sqrt(x * x + y * y);
  if (len <= s) return { x, y, clamped: false };
  const k = s / len;
  return { x: x * k, y: y * k, clamped: true };
}

/**
 * Vị trí ngón tay trên bi lớn -> điểm chạm. (dxPx, dyPx) tính từ tâm bi, y hướng xuống,
 * radiusPx = bán kính bi lớn trên màn hình. Liên tục, không rời rạc.
 */
export function tipFromOffset(dxPx: number, dyPx: number, radiusPx: number, l: TipLimits) {
  const ux = dxPx / radiusPx / l.maxFrac;
  const uy = -dyPx / radiusPx / l.maxFrac;
  return clampTipUnit(ux, uy, l);
}

export const TIP_PRESETS = [
  { key: "center", label: "Giữa", x: 0, y: 0 },
  { key: "top", label: "Top", x: 0, y: 0.7 },
  { key: "draw", label: "Draw", x: 0, y: -0.7 },
  { key: "left", label: "Trái", x: -0.7, y: 0 },
  { key: "right", label: "Phải", x: 0.7, y: 0 },
] as const;

/** Điểm chạm của preset (tỉ lệ so với vòng an toàn) */
export const presetTip = (p: (typeof TIP_PRESETS)[number], l: TipLimits) => ({
  x: p.x * safeUnit(l),
  y: p.y * safeUnit(l),
});

const level = (r: number) => (r < 0.4 ? "nhẹ" : r < 0.75 ? "vừa" : "mạnh");

/** Mô tả điểm chạm, ví dụ "Top nhẹ, xoáy phải vừa" */
export function describeTip(x: number, y: number, l: TipLimits): string {
  const s = safeUnit(l);
  const v = y / s;
  const h = x / s;
  if (Math.hypot(v, h) < 0.12) return "Giữa tâm — không xoáy";
  const parts: string[] = [];
  if (Math.abs(v) > 0.2) parts.push(`${v > 0 ? "Top" : "Draw"} ${level(Math.abs(v))}`);
  if (Math.abs(h) > 0.2) parts.push(`xoáy ${h > 0 ? "phải" : "trái"} ${level(Math.abs(h))}`);
  return parts.length ? parts.join(", ") : "Gần tâm";
}

/** Nhãn rất ngắn cho bi nhỏ ở góc ("Top·Phải") hoặc "" nếu ở giữa */
export function shortTipLabel(x: number, y: number, l: TipLimits): string {
  const s = safeUnit(l);
  const v = y / s;
  const h = x / s;
  if (Math.hypot(v, h) < 0.12) return "";
  const p: string[] = [];
  if (Math.abs(v) > 0.2) p.push(v > 0 ? "Top" : "Draw");
  if (Math.abs(h) > 0.2) p.push(h > 0 ? "Phải" : "Trái");
  return p.join("·");
}

// ======================= NGẮM =======================

/** Chuẩn hoá góc về (−π, π] */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Ngắm tương đối (cảm ứng): xoay hướng ngắm theo độ lệch góc của ngón tay quanh bi cái,
 * so với lúc chạm xuống. Không bị "nhảy" khi vừa chạm, ngón tay không cần đặt đúng điểm ngắm.
 */
export function rotatedAim(startAngle: number, fingerStart: number, fingerNow: number, sensitivity = 1): number {
  return startAngle + sensitivity * wrapAngle(fingerNow - fingerStart);
}

/** Mức kéo cơ trực tiếp trên bàn: điểm chạm nằm trên "thân cơ" (cách trục ngắm ≤ halfWidth, phía sau bi) */
export function onCueShaft(
  cue: { x: number; y: number },
  dir: { x: number; y: number },
  pt: { x: number; y: number },
  halfWidth = 0.05,
  maxLen = 1.6,
): { hit: boolean; along: number } {
  const l = Math.hypot(dir.x, dir.y) || 1;
  const dx = dir.x / l;
  const dy = dir.y / l;
  const rx = pt.x - cue.x;
  const ry = pt.y - cue.y;
  const along = -(rx * dx + ry * dy); // > 0: phía sau bi
  const perp = Math.abs(rx * dy - ry * dx);
  return { hit: along > 0.04 && along < maxLen && perp <= halfWidth, along };
}

/** Mức kéo theo hình chiếu lên trục ngắm (kéo lùi ra sau = tăng lực) */
export const pullFromAlong = (along0: number, along: number, sensitivity = 1) =>
  clamp01(((along - along0) / MAX_PULL_M) * sensitivity);

/**
 * CHẠM / CLICK Ở ĐÂU TRÊN BÀN THÌ NGẮM TỚI ĐÓ: hướng ngắm = từ bi cái tới điểm chạm (không cần kéo).
 * Trả về null nếu điểm chạm quá sát bi cái (không xác định được hướng) — giữ nguyên hướng cũ.
 * `angle` là góc của hướng mới, dùng làm gốc cho thao tác kéo xoay tiếp theo (rotatedAim).
 */
export function aimTowards(
  cue: { x: number; y: number },
  point: { x: number; y: number },
  minDist = 0.01,
): { dirX: number; dirY: number; angle: number } | null {
  const dx = point.x - cue.x;
  const dy = point.y - cue.y;
  const l = Math.hypot(dx, dy);
  if (l < minDist) return null;
  return { dirX: dx / l, dirY: dy / l, angle: Math.atan2(dy, dx) };
}
