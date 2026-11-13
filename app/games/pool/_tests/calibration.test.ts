import { test } from "node:test";
import assert from "node:assert/strict";
import { POOL_PHYSICS as C, PoolSim, powerToSpeed, speedToPower, type ShotCommand } from "../_lib/physics/index";

/** Mục 2.4: hằng số vật lý phải cho số liệu giống bàn thật */
const shot = (v0: number, p: Partial<ShotCommand> = {}): ShotCommand => ({
  dirX: 1, dirY: 0, power: speedToPower(v0, C), tipX: 0, tipY: 0, elevation: 0, ...p,
});

function rollFromHead(v0: number) {
  const sim = new PoolSim([{ n: 0, x: -1.2, y: 0.3 }]);
  sim.strike(shot(v0));
  let dist = 0;
  let px = -1.2;
  while (sim.isMoving()) {
    sim.step();
    dist += Math.abs(sim.balls[0].p.x - px);
    px = sim.balls[0].p.x;
  }
  return { dist, end: sim.balls[0].p.x, cushions: sim.events.filter((e) => e.type === "cushion").length };
}

test("2.4 — lag shot (đầu bàn -> băng cuối -> về sát băng đầu) cần ~1.5–2 m/s", () => {
  let lag = 0;
  for (let v = 0.8; v < 4; v += 0.02) {
    const r = rollFromHead(v);
    if (r.cushions >= 1 && r.end < -0.95) {
      lag = v;
      break;
    }
  }
  assert.ok(lag >= 1.4 && lag <= 2.0, `tốc độ lag ${lag.toFixed(2)} m/s`);
});

test("2.4 — đánh trung bình 3 m/s: bi lăn ~4 chiều dài bàn", () => {
  const lengths = rollFromHead(3).dist / C.tableLength;
  assert.ok(lengths >= 3.7 && lengths <= 5.2, `${lengths.toFixed(2)} chiều bàn`);
});

test("2.4 — cú phá mạnh (lực 90%) cho bi cái 9–11 m/s", () => {
  const v = powerToSpeed(0.9, C);
  assert.ok(v >= 9 && v <= 11, `${v.toFixed(2)} m/s`);
});

test("2.4 — bi lăn vào băng 45°: đường bật ra ngắn hơn 45° vài độ", () => {
  const sim = new PoolSim([{ n: 0, x: -0.2, y: -0.3 }]);
  sim.strike(shot(1.4, { dirX: 1, dirY: 1 }));
  // Chờ bi chuyển sang lăn rồi mới tới băng
  let out = NaN;
  while (sim.isMoving()) {
    const vy = sim.balls[0].v.y;
    sim.step();
    const b = sim.balls[0];
    if (vy > 0 && b.v.y < 0) {
      while (b.state === "sliding") sim.step();
      out = (Math.atan2(-b.v.y, b.v.x) * 180) / Math.PI;
      break;
    }
  }
  assert.ok(out > 38 && out < 44.95, `góc ra ${out.toFixed(1)}°`);
});

test("2.4 — hệ thống mắt bàn: bắn 1 băng nhắm điểm đối xứng tới gần mục tiêu", () => {
  // Nhắm ảnh đối xứng của mục tiêu qua băng trên y = W/2 − R (điểm chạm băng tránh xa lỗ giữa)
  const R = C.ballRadius;
  const yb = C.tableWidth / 2 - R;
  const start = { x: -0.9, y: 0.1 };
  const target = { x: 0.5, y: -0.1 };
  const mirror = { x: target.x, y: 2 * yb - target.y };
  const sim = new PoolSim([{ n: 0, ...start }]);
  sim.strike(shot(1.6, { dirX: mirror.x - start.x, dirY: mirror.y - start.y, tipY: 0.2 }));
  let best = Infinity;
  let bounced = false;
  while (sim.isMoving()) {
    sim.step();
    const b = sim.balls[0];
    if (sim.events.some((e) => e.type === "cushion")) bounced = true;
    if (bounced) best = Math.min(best, Math.hypot(b.p.x - target.x, b.p.y - target.y));
  }
  assert.ok(best < 0.12, `bi đi qua cách mục tiêu ${(best * 100).toFixed(1)} cm`);
});
