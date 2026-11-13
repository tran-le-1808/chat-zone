import { test } from "node:test";
import assert from "node:assert/strict";
import { POOL_PHYSICS as C, PoolSim, computeStrike, masseGate, AUTO_LIFT_MAX } from "../_lib/physics/index";

const ANG = 0.35;
const dir = { x: Math.cos(ANG), y: Math.sin(ANG) };
const lateral = (p: { x: number; y: number }, o: { x: number; y: number }) => (p.x - o.x) * -dir.y + (p.y - o.y) * dir.x;
const POWERS = [0.1, 0.25, 0.4, 0.6, 0.8, 1];

/**
 * Góc (rad) giữa hướng bi đã đi và đường ngắm, đo ngay khi bi đi được `dist` mét. null nếu bi không đi tới
 * (lực quá nhẹ / xoáy kéo mạnh làm bi dừng hoặc quay đầu sớm).
 */
function headingError(dist: number, power: number, tipX: number, tipY: number, elevation: number): number | null {
  const o = { x: -0.5, y: -0.3 };
  const sim = new PoolSim([{ n: 0, x: o.x, y: o.y }]);
  sim.strike({ dirX: dir.x, dirY: dir.y, power, tipX, tipY, elevation });
  const b = sim.balls[0];
  while (sim.isMoving() && sim.time < 4) {
    sim.step();
    const d = Math.hypot(b.p.x - o.x, b.p.y - o.y);
    if (d >= dist) return Math.asin(Math.max(-1, Math.min(1, lateral(b.p, o) / d)));
  }
  return null;
}

/** Độ lệch ngang (m) tại `dist` mét — dùng cho test massé */
function deviationAt(dist: number, power: number, tipX: number, tipY: number, elevation: number) {
  const a = headingError(dist, power, tipX, tipY, elevation);
  return a === null ? 0 : Math.sin(a) * dist;
}

test("Hướng đi của bi cái KHÔNG phụ thuộc lực kéo (đánh thường và cơ chỉ nâng nhẹ ≤ 6°, kể cả có xoáy)", () => {
  const tips: [number, number][] = [[0, 0], [0.4, 0], [-0.5, 0], [0.4, 0.5], [-0.5, -0.5], [0, 0.7], [0, -0.7]];
  let checked = 0;
  for (const [tipX, tipY] of tips) {
    for (const elevation of [0, 2, 4, AUTO_LIFT_MAX]) {
      const ang = POWERS.map((p) => headingError(0.25, p, tipX, tipY, elevation)).filter((a): a is number => a !== null);
      assert.ok(ang.length >= 4, `tip (${tipX}, ${tipY}) góc ${elevation}°: quá ít mức lực đi đủ 0.25 m`);
      const spread = Math.max(...ang) - Math.min(...ang);
      checked += ang.length;
      // Hướng đi đổi < 0.05° giữa lực nhẹ và lực mạnh
      assert.ok(spread < 0.05 * (Math.PI / 180), `tip (${tipX}, ${tipY}) góc ${elevation}°: hướng đi đổi theo lực ${(spread * (180 / Math.PI)).toFixed(3)}° (${ang.map((a) => ((a * 180) / Math.PI).toFixed(2)).join(", ")}°)`);
    }
  }
  assert.ok(checked > 100);
});

test("Đánh chính tâm: bi đi đúng đường ngắm ở mọi lực (độ lệch ngang = 0)", () => {
  for (const elevation of [0, 3, 6]) for (const p of POWERS) assert.ok(Math.abs(deviationAt(0.8, p, 0, 0, elevation)) < 1e-6);
});

test("Squirt là góc cố định theo điểm chạm, KHÔNG đổi theo lực", () => {
  for (const tipX of [-0.6, -0.3, 0.3, 0.6]) {
    const angles = POWERS.map((power) => {
      const o = computeStrike({ dirX: 1, dirY: 0, power, tipX, tipY: 0, elevation: 0 }, C);
      return Math.atan2(o.v.y, o.v.x);
    });
    assert.ok(Math.max(...angles) - Math.min(...angles) < 1e-9, `squirt đổi theo lực ở tipX ${tipX}`);
    // Xoáy phải (tipX > 0) đẩy bi sang TRÁI hướng ngắm (góc dương, ngược chiều kim đồng hồ) và ngược lại
    assert.equal(Math.sign(angles[0]), Math.sign(tipX), "lệch ngược phía xoáy");
  }
});

test("Xoáy ngang không làm bi tự uốn cong: vận tốc và trục xoáy ngang quay cùng nhau sau squirt", () => {
  // u (vận tốc trượt tại điểm tiếp xúc) song song với v -> ma sát không kéo ngang bi
  for (const power of POWERS) {
    const o = computeStrike({ dirX: 1, dirY: 0, power, tipX: 0.5, tipY: 0.4, elevation: 4 }, C);
    const ux = o.v.x - C.ballRadius * o.w.y;
    const uy = o.v.y + C.ballRadius * o.w.x;
    const cross = o.v.x * uy - o.v.y * ux;
    assert.ok(Math.abs(cross) < 1e-9 * Math.hypot(o.v.x, o.v.y) ** 2 + 1e-12, `u không song song v ở lực ${power}`);
  }
});

test("Massé có chủ ý (cơ dốc ≥ 15°) vẫn cong như thật; chuyển mượt từ 8° tới 15°", () => {
  assert.equal(masseGate(0, C), 0);
  assert.equal(masseGate(AUTO_LIFT_MAX, C), 0, "cơ tự nâng qua băng không gây cong");
  assert.equal(masseGate(15, C), 1);
  assert.equal(masseGate(45, C), 1);
  let prev = 0;
  for (let e = 8; e <= 15; e += 0.5) {
    const g = masseGate(e, C);
    assert.ok(g >= prev - 1e-12 && g >= 0 && g <= 1);
    prev = g;
  }
  const curved = Math.abs(deviationAt(0.8, 0.5, 0.6, 0, 40) - deviationAt(0.8, 0.5, 0.6, 0, 0));
  assert.ok(curved > 0.02, `massé 40° phải cong rõ (${(curved * 100).toFixed(1)} cm)`);
});
