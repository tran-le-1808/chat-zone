/**
 * Sprite sheet nhân vật pixel art 16×16 vẽ bằng code (gốc, không dùng tài sản ngoài).
 * Hàng = hướng (0 xuống, 1 trái, 2 phải, 3 lên). Cột = khung:
 *   0–1 đứng chờ, 2–5 đi bộ, 6–7 chạy, 8–9 tương tác, 10 bị đánh / bất tỉnh.
 */
import { PALETTE as P } from "./palette";

export const FRAME = 16;
export const COLS = 11;
export const ROWS = 4;
export const FRAMES = { idle: [0, 1], walk: [2, 3, 4, 5], run: [6, 7], interact: [8, 9], hit: [10] } as const;

export type Direction = 0 | 1 | 2 | 3;

export interface Outfit {
  body: string;
  bodyDark: string;
  pants: string;
  hair: string;
  skin: string;
  cap?: string;
  badge?: string;
  accent?: string;
}

export const OUTFITS = {
  guard: { body: P.navy, bodyDark: P.navyDark, pants: P.wallDark, hair: P.hairDark, skin: P.skin, cap: P.ink, badge: P.gold },
  // bộ đồ công nhân / bảo trì: yếm xám xanh, áo phản quang
  worker: { body: "#64748b", bodyDark: "#475569", pants: "#334155", hair: P.hairDark, skin: P.skin, accent: "#facc15" },
} satisfies Record<string, Outfit>;

/** Chỉ mặc đồ lót (áo ba lỗ + quần đùi màu trung tính) — không mô tả trần trụi */
export function underwearOutfit(variant = 0): Outfit {
  return {
    body: "#e5e7eb",
    bodyDark: "#cbd5e1",
    pants: "#94a3b8",
    hair: variant % 2 ? P.hairBrown : P.hairDark,
    skin: variant % 3 === 2 ? P.skinDark : P.skin,
  };
}

export function prisonerOutfit(accent: string, variant = 0): Outfit {
  return {
    body: P.orangeLight,
    bodyDark: P.orange,
    pants: P.orange,
    hair: variant % 2 ? P.hairBrown : P.hairDark,
    skin: variant % 3 === 2 ? P.skinDark : P.skin,
    accent,
  };
}

export function directionOf(facing: number): Direction {
  // facing: atan2(dy, dx) với y hướng xuống
  const a = ((facing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (a >= Math.PI / 4 && a < (3 * Math.PI) / 4) return 0;
  if (a >= (3 * Math.PI) / 4 && a < (5 * Math.PI) / 4) return 1;
  if (a >= (5 * Math.PI) / 4 && a < (7 * Math.PI) / 4) return 3;
  return 2;
}

const cache = new Map<string, HTMLCanvasElement>();

export function characterSheet(o: Outfit): HTMLCanvasElement {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = COLS * FRAME;
  cv.height = ROWS * FRAME;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  for (let dir = 0 as Direction; dir < 4; dir = (dir + 1) as Direction)
    for (let f = 0; f < COLS; f++) drawFrame(g, f * FRAME, dir * FRAME, dir, f, o);
  cache.set(key, cv);
  return cv;
}

function drawFrame(g: CanvasRenderingContext2D, ox: number, oy: number, dir: Direction, f: number, o: Outfit) {
  const px = (x: number, y: number, c: string, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(ox + x, oy + y, w, h);
  };
  if (f === 10) {
    // nằm bất tỉnh
    px(2, 9, o.skin, 4, 4);
    px(2, 8, o.hair, 4, 2);
    px(6, 9, o.body, 6, 4);
    px(12, 10, o.pants, 3, 2);
    px(3, 10, P.ink);
    px(4, 6, P.gold);
    px(6, 5, P.gold);
    px(8, 6, P.gold);
    return;
  }
  const walk = f >= 2 && f <= 5 ? f - 2 : -1;
  const run = f === 6 || f === 7;
  const bob = f === 1 || walk === 1 || walk === 3 || run ? 1 : 0;
  const y0 = bob;
  // chân
  const step = walk >= 0 ? [0, 1, 0, -1][walk] : run ? (f === 6 ? 2 : -2) : 0;
  if (dir === 1 || dir === 2) {
    const s = dir === 2 ? 1 : -1;
    px(6 + Math.round(step * s * 0.5), 12, o.pants, 2, 3);
    px(8 - Math.round(step * s * 0.5), 12, o.pants, 2, 3);
    px(6 + Math.round(step * s * 0.5), 15, P.ink, 2, 1);
    px(8 - Math.round(step * s * 0.5), 15, P.ink, 2, 1);
  } else {
    px(5, 12, o.pants, 2, step > 0 ? 3 : 2 + (step < 0 ? 1 : 0));
    px(9, 12, o.pants, 2, step < 0 ? 3 : 2 + (step > 0 ? 1 : 0));
    px(5, 14 + (step > 0 ? 1 : 0), P.ink, 2, 1);
    px(9, 14 + (step < 0 ? 1 : 0), P.ink, 2, 1);
  }
  // thân
  px(4, 7 + y0, o.body, 8, 5);
  px(4, 11 + y0, o.bodyDark, 8, 1);
  if (o.badge && dir !== 3) px(dir === 1 ? 5 : 9, 8 + y0, o.badge);
  if (o.accent && dir === 0) px(7, 8 + y0, o.accent, 2, 2);
  if (o.accent && dir === 3) px(6, 8 + y0, o.accent, 4, 1);
  // tay (tương tác: đưa tay ra phía trước)
  const reach = f === 8 || f === 9;
  const swing = walk >= 0 ? [0, 1, 0, -1][walk] : run ? (f === 6 ? 1 : -1) : 0;
  if (dir === 0 || dir === 3) {
    px(3, 7 + y0 + Math.max(0, swing), o.bodyDark, 1, 4);
    px(12, 7 + y0 + Math.max(0, -swing), o.bodyDark, 1, 4);
    if (reach) {
      px(3, 11 + y0 - (f === 9 ? 1 : 0), o.skin);
      px(12, 11 + y0 - (f === 8 ? 1 : 0), o.skin);
    } else {
      px(3, 11 + y0 + Math.max(0, swing), o.skin);
      px(12, 11 + y0 + Math.max(0, -swing), o.skin);
    }
  } else {
    const hx = dir === 2 ? (reach ? 12 : 8 + swing) : reach ? 2 : 7 - swing;
    px(hx, 8 + y0, o.bodyDark, reach ? 2 : 1, reach ? 1 : 3);
    px(dir === 2 ? (reach ? 14 : hx) : reach ? 1 : hx, reach ? 8 + y0 : 11 + y0, o.skin);
  }
  // đầu
  px(5, 2 + y0, o.skin, 6, 5);
  if (dir === 3) px(5, 1 + y0, o.hair, 6, 5);
  else {
    px(5, 1 + y0, o.hair, 6, 2);
    if (dir === 1) px(9, 2 + y0, o.hair, 2, 3);
    if (dir === 2) px(5, 2 + y0, o.hair, 2, 3);
    if (dir === 0) {
      px(6, 4 + y0, P.ink);
      px(9, 4 + y0, P.ink);
      px(7, 6 + y0, o.bodyDark === P.navyDark ? P.skinDark : P.skinDark, 2, 1);
    }
    if (dir === 1) px(6, 4 + y0, P.ink);
    if (dir === 2) px(9, 4 + y0, P.ink);
  }
  if (o.cap) {
    px(4, 0 + y0, o.cap, 8, 2);
    if (dir === 0) px(5, 2 + y0, o.cap, 6, 1);
    if (dir === 1) px(3, 1 + y0, o.cap, 2, 1);
    if (dir === 2) px(11, 1 + y0, o.cap, 2, 1);
    px(7, 0 + y0, o.badge ?? P.gold, 2, 1);
  }
}

/** Chọn cột khung theo trạng thái & thời gian */
export function frameFor(state: { moving: boolean; sprinting: boolean; channel: boolean; down: boolean }, t: number): number {
  if (state.down) return FRAMES.hit[0];
  if (state.channel) return FRAMES.interact[Math.floor(t * 4) % 2];
  if (state.sprinting) return FRAMES.run[Math.floor(t * 10) % 2];
  if (state.moving) return FRAMES.walk[Math.floor(t * 8) % 4];
  return FRAMES.idle[Math.floor(t * 1.5) % 2];
}
