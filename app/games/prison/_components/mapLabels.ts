/** Nhãn tên khu cho popup bản đồ (hàm thuần — test được bằng node) */
import { PRISON_MAP } from "../_lib/engine/map";

export const SCALE = 8;

export interface Label {
  id: string;
  text: string;
  x: number;
  y: number;
  restricted: boolean;
}

/** Nhãn khu: tâm hình chữ nhật lớn nhất; rút gọn tên xà lim; bỏ nhãn chồng lên nhãn đã đặt */
export function zoneLabels(): Label[] {
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out: Label[] = [];
  const zones = [...PRISON_MAP.zones].filter((z) => z.id !== "outside" && z.id !== "fence_strip");
  // khu rộng trước để nhãn quan trọng được đặt trước
  const area = (r: [number, number, number, number]) => (r[2] - r[0] + 1) * (r[3] - r[1] + 1);
  zones.sort((a, b) => Math.max(...b.rects.map(area)) - Math.max(...a.rects.map(area)));
  for (const z of zones) {
    const r = [...z.rects].sort((a, b) => area(b) - area(a))[0];
    const text = z.id.startsWith("cell_") ? z.name.replace("Xà lim ", "") : z.name;
    const cx = ((r[0] + r[2] + 1) / 2) * SCALE;
    const cy = ((r[1] + r[3] + 1) / 2) * SCALE;
    const w = text.length * 5.4 + 4;
    const h = 11;
    const box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
    placed.push(box);
    out.push({ id: z.id, text, x: cx, y: cy, restricted: z.restricted });
  }
  return out;
}

