import { test } from "node:test";
import assert from "node:assert/strict";
import { POOL_PHYSICS as C, PoolSim, POOL_TABLE as T } from "../_lib/physics/index";
import type { Ball } from "../_lib/physics/types";
import { castAim, targetPath } from "../_lib/aim";
import { rng } from "../_lib/rules/rack";

const R = C.ballRadius;
const corner = T.pockets[2];

test("Đường bi mục tiêu: đi thẳng vào lỗ góc -> báo đúng lỗ, kết thúc ở miệng lỗ", () => {
  const target = { n: 3, x: corner.mouthX - corner.axisX * 0.5, y: corner.mouthY - corner.axisY * 0.5 };
  const p = targetPath([{ n: 0, x: -0.5, y: 0 }, target], target, { x: corner.axisX, y: corner.axisY });
  assert.equal(p.pocket, 2);
  assert.equal(p.blocker, null);
  assert.ok(Math.hypot(p.end.x - corner.mouthX, p.end.y - corner.mouthY) < 0.03);
});

test("Đường bi mục tiêu: bị bi khác chắn thì dừng ở bi chắn và không báo vào lỗ", () => {
  const target = { n: 3, x: corner.mouthX - corner.axisX * 0.6, y: corner.mouthY - corner.axisY * 0.6 };
  const wall = { n: 5, x: corner.mouthX - corner.axisX * 0.3, y: corner.mouthY - corner.axisY * 0.3 };
  const p = targetPath([{ n: 0, x: -0.5, y: 0 }, target, wall], target, { x: corner.axisX, y: corner.axisY });
  assert.equal(p.pocket, null);
  assert.equal(p.blocker, 5);
  const d = Math.hypot(p.end.x - target.x, p.end.y - target.y);
  assert.ok(Math.abs(d - (0.3 - 2 * R)) < 0.01, `dừng cách bi đích ${d}`);
});

test("Đường bi mục tiêu: hướng vào băng giữa (không có lỗ) -> kết thúc ở băng", () => {
  const target = { n: 3, x: 0.3, y: 0 };
  const p = targetPath([{ n: 0, x: -0.5, y: 0 }, target], target, { x: 0, y: 1 });
  assert.equal(p.pocket, null);
  assert.ok(Math.abs(p.end.y - (T.W / 2 - R)) < 1e-6);
});

test("Bi ma / đường ngắm bi cái: chạm bi đầu tiên và báo hướng bi mục tiêu", () => {
  const balls = [{ n: 0, x: -0.8, y: 0 }, { n: 4, x: 0, y: 0.1 }];
  const cast = castAim(balls, 1, 0.09); // lệch tâm bi đích -> góc cắt > 0
  assert.equal(cast?.hitBall, 4);
  assert.ok(cast!.objectDir!.y > 0 && cast!.cut > 0);
});

test("Dự đoán khả năng vào lỗ khớp mô phỏng thật: ≥ 85% cú báo 'vào được' thì bi đang lăn thực sự vào lỗ", () => {
  const rand = rng(31);
  let predicted = 0;
  let pocketed = 0;
  for (let k = 0; k < 400; k++) {
    const x = (rand() - 0.5) * 2.0;
    const y = (rand() - 0.5) * 1.0;
    const pk = T.pockets[Math.floor(rand() * 6)];
    // Hướng về 1 lỗ, lệch ngẫu nhiên ±8° quanh điểm nhắm
    const a = Math.atan2(pk.mouthY - y, pk.mouthX - x) + (rand() - 0.5) * 0.28;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const target = { n: 3, x, y };
    const p = targetPath([{ n: 0, x: -0.2, y: 0.9 }, target], target, dir);
    if (p.pocket === null) continue;
    predicted++;
    const sim = new PoolSim([target]);
    const b: Ball = sim.balls[0];
    b.v = { x: dir.x * 1.8, y: dir.y * 1.8 };
    b.w = { x: -b.v.y / R, y: b.v.x / R, z: 0 };
    b.state = "rolling";
    while (sim.isMoving() && sim.time < 6) sim.step();
    if (sim.pocketed.length) pocketed++;
  }
  assert.ok(predicted > 100, `chỉ ${predicted} dự đoán`);
  assert.ok(pocketed / predicted >= 0.85, `khớp ${((pocketed / predicted) * 100).toFixed(0)}% (${pocketed}/${predicted})`);
});
