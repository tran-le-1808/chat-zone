/**
 * Camera 2D (hàm thuần, không phụ thuộc three.js — test được bằng node):
 * - Zoom nguyên: số px mỗi ô = baseTilePx × k, k = max(1, floor(cạnh ngắn của viewport / zoomStepHeight)) × hệ số người chơi chọn
 *   (làm tròn về số nguyên) để pixel art sắc nét.
 * - Tâm khung nhìn = nhân vật (nhân vật nằm đúng giữa màn hình) khi không chạm biên bản đồ.
 * - Sát biên: kẹp vào biên (không lộ vùng trống). Bản đồ nhỏ hơn viewport theo một chiều: căn giữa theo chiều đó.
 * - centerOffsetY (px màn hình): dời tâm vùng chơi khi HUD che một phần (mobile).
 * Toạ độ thế giới: 1 đơn vị = 1 ô, trục y hướng xuống (giống engine).
 */

export interface CameraInput {
  /** Điểm cần đặt giữa màn hình (toạ độ thế giới, y xuống) */
  target: { x: number; y: number };
  viewport: { width: number; height: number };
  map: { width: number; height: number };
  /** Hệ số zoom người chơi chọn trong cài đặt (1 = mặc định) */
  zoomSetting?: number;
  baseTilePx?: number;
  zoomStepHeight?: number;
  centerOffsetY?: number;
}

export interface CameraFrame {
  /** Tâm khung nhìn (toạ độ thế giới, y xuống) */
  x: number;
  y: number;
  /** Số px màn hình cho 1 ô (= zoom của camera trực giao) */
  zoom: number;
  /** Vị trí của target trên màn hình (px, gốc trên-trái) */
  screenX: number;
  screenY: number;
  clampedX: boolean;
  clampedY: boolean;
}

/** Số px mỗi ô (nguyên lần baseTilePx) */
export function pixelsPerTile(viewport: { width: number; height: number }, zoomSetting = 1, baseTilePx = 16, zoomStepHeight = 270): number {
  const short = Math.max(1, Math.min(viewport.width, viewport.height));
  const k = Math.max(1, Math.floor(short / zoomStepHeight));
  return baseTilePx * Math.max(1, Math.round(k * zoomSetting));
}

function axis(target: number, viewPx: number, mapTiles: number, zoom: number, offsetPx: number): { c: number; clamped: boolean } {
  const half = viewPx / 2 / zoom;
  const want = target + offsetPx / zoom;
  // bản đồ ngắn hơn khung nhìn: căn giữa bản đồ
  if (mapTiles <= half * 2) return { c: mapTiles / 2, clamped: true };
  const c = Math.min(mapTiles - half, Math.max(half, want));
  return { c, clamped: Math.abs(c - want) > 1e-9 };
}

export function cameraFrame(i: CameraInput): CameraFrame {
  const zoom = pixelsPerTile(i.viewport, i.zoomSetting ?? 1, i.baseTilePx ?? 16, i.zoomStepHeight ?? 270);
  const ax = axis(i.target.x, i.viewport.width, i.map.width, zoom, 0);
  const ay = axis(i.target.y, i.viewport.height, i.map.height, zoom, i.centerOffsetY ?? 0);
  return {
    x: ax.c,
    y: ay.c,
    zoom,
    screenX: i.viewport.width / 2 + (i.target.x - ax.c) * zoom,
    screenY: i.viewport.height / 2 + (i.target.y - ay.c) * zoom,
    clampedX: ax.clamped,
    clampedY: ay.clamped,
  };
}
