/** Khoảng cách tới vật tương tác (tách riêng để các module hệ thống dùng chung, tránh vòng import). */
import { dist } from "./geometry";
import type { Interactable } from "./map";

export function distanceToInteractable(p: { x: number; y: number }, it: Interactable): number {
  let best = Infinity;
  for (const t of it.tiles) best = Math.min(best, dist(p.x, p.y, t.x + 0.5, t.y + 0.5));
  return best;
}
