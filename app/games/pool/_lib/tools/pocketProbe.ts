import { POOL_PHYSICS, type PoolConfig } from "../physics/config";
import { PoolSim } from "../physics/simulator";
import { tableFor, type Pocket } from "../physics/table";
import type { Ball } from "../physics/types";

export interface ProbeResult {
  pocketed: boolean;
  /** Bi chạm mặt vát / mũi lỗ / thành sau lỗ */
  touchedJaw: boolean;
  touchedBack: boolean;
}

/**
 * Bắn 1 bi ĐANG LĂN vào lỗ: lệch góc `angleDeg` so với trục lỗ, lệch ngang `offset` (m)
 * so với tâm miệng lỗ, tốc độ `speed` (m/s), xuất phát cách miệng lỗ `dist` (m).
 */
export function probePocket(
  pocket: Pocket,
  angleDeg: number,
  offset: number,
  speed: number,
  c: PoolConfig = POOL_PHYSICS,
  dist = 0.3,
): ProbeResult {
  const R = c.ballRadius;
  const a = (angleDeg * Math.PI) / 180;
  // Hướng đi: trục lỗ xoay một góc a
  const dx = pocket.axisX * Math.cos(a) - pocket.axisY * Math.sin(a);
  const dy = pocket.axisX * Math.sin(a) + pocket.axisY * Math.cos(a);
  // Pháp tuyến ngang của đường đi
  const nx = -dy;
  const ny = dx;
  const x = pocket.mouthX - dx * dist + nx * offset;
  const y = pocket.mouthY - dy * dist + ny * offset;
  const L = c.tableLength / 2 - R;
  const W = c.tableWidth / 2 - R;
  if (Math.abs(x) > L || Math.abs(y) > W) return { pocketed: false, touchedJaw: false, touchedBack: false };
  const sim = new PoolSim([{ n: 1, x, y }], c, tableFor(c));
  const b = sim.balls[0];
  b.v = { x: dx * speed, y: dy * speed };
  b.w = { x: -b.v.y / R, y: b.v.x / R, z: 0 };
  b.state = "rolling" as Ball["state"];
  // Dừng sớm: đã rơi, hoặc đã bật xa khỏi miệng lỗ và đang đi ra xa (không thể quay lại vào)
  while (sim.isMoving() && sim.time < 3) {
    sim.step();
    if (b.state === "pocketed") break;
    if (sim.steps % 20 === 0 && b.state !== "dropping") {
      const rx = b.p.x - pocket.mouthX;
      const ry = b.p.y - pocket.mouthY;
      const away = rx * b.v.x + ry * b.v.y > 0;
      if (away && Math.sqrt(rx * rx + ry * ry) > 0.12) break;
    }
  }
  const parts = new Set(sim.events.flatMap((e) => (e.type === "cushion" ? [e.part] : [])));
  return {
    pocketed: sim.pocketed.length > 0,
    touchedJaw: parts.has("jaw") || parts.has("nose"),
    touchedBack: parts.has("back"),
  };
}

/**
 * Độ rộng hiệu dụng (m): dải độ lệch ngang mà TÂM bi đi qua và vào lỗ.
 * clean = true: chỉ tính bi vào mà không chạm mặt vát / mũi lỗ (đường tâm bi đi lọt);
 * false: tính cả bi sượt mặt vát rồi vẫn trượt vào (như ngoài đời).
 */
export function effectiveWidth(pocket: Pocket, speed: number, c: PoolConfig = POOL_PHYSICS, angleDeg = 0, clean = true): number {
  const step = 0.001;
  let n = 0;
  for (let s = -0.08; s <= 0.08; s += step) {
    const r = probePocket(pocket, angleDeg, s, speed, c);
    if (r.pocketed && (!clean || !r.touchedJaw)) n++;
  }
  return n * step;
}
