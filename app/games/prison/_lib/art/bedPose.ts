/** Tư thế nằm trên giường (hàm thuần, dùng cho scene và test). */
import { PRISON_MAP } from "../engine/map";

/** Tâm (điểm nằm) + góc xoay để trục dọc cục bộ (+y, hướng lên màn hình) chỉ về đầu giường */
export function bedPose(bedId: string): { x: number; y: number; rot: number; length: number } | null {
  const b = PRISON_MAP.interactableById[bedId];
  if (!b) return null;
  const a = b.sleepAnchor ?? { x: b.tiles[0].x + 0.5, y: b.tiles[0].y + 0.5 };
  const rot = { top: 0, bottom: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[b.headSide ?? "top"];
  return { x: a.x, y: a.y, rot, length: Math.max(1, b.tiles.length) };
}
