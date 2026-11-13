import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POOL_PHYSICS as C,
  POOL_TABLE as T,
  PoolSim,
  createBalls,
  kineticEnergy,
  resolveBallBall,
  simulateShot,
  powerToSpeed,
  type Ball,
  type ShotCommand,
} from "../_lib/physics/index";
import { rackEight, rackNine, rng } from "../_lib/rules/rack";

/** Vị trí bi cái lúc bi mục tiêu chạm băng đầu tiên (trước khi nó dội về đụng lại bi cái) */
function cueWhenObjectHitsRail(start: { n: number; x: number; y: number }[], cmd: ShotCommand) {
  const sim = new PoolSim(start);
  sim.strike(cmd);
  while (sim.isMoving() && !sim.events.some((e) => e.type === "cushion" && e.ball !== 0)) sim.step();
  // Cho bi cái thêm thời gian hoàn tất pha trượt
  const t0 = sim.time;
  while (sim.isMoving() && sim.time < t0 + 0.6) sim.step();
  return sim.balls.find((b) => b.n === 0)!;
}

const R = C.ballRadius;
const shot = (p: Partial<ShotCommand>): ShotCommand => ({
  dirX: 1, dirY: 0, power: 0.3, tipX: 0, tipY: 0, elevation: 0, ...p,
});
const speed = (b: Ball) => Math.hypot(b.v.x, b.v.y);
const deg = (r: number) => (r * 180) / Math.PI;

test("3.8.1 — đánh giữa tâm: vận tốc lăn = 5/7·v0 (sai số < 1%)", () => {
  // Lực vừa phải để bi kịp chuyển sang lăn trước khi tới băng
  for (const power of [0.1, 0.25, 0.4]) {
    const sim = new PoolSim([{ n: 0, x: -1.2, y: 0.3 }]);
    sim.strike(shot({ power }));
    const cue = sim.balls[0];
    const v0 = speed(cue);
    assert.ok(Math.abs(v0 - powerToSpeed(power, C)) / v0 < 1e-9);
    while (cue.state === "sliding") sim.step();
    assert.equal(cue.state, "rolling");
    const ratio = speed(cue) / v0;
    assert.ok(Math.abs(ratio - 5 / 7) / (5 / 7) < 0.01, `tỉ lệ ${ratio}`);
  }
});

function pair(va: { x: number; y: number }, offsetAngle = 0): [Ball, Ball] {
  const [a, b] = createBalls([
    { n: 0, x: 0, y: 0 },
    { n: 1, x: 2 * R * Math.cos(offsetAngle), y: 2 * R * Math.sin(offsetAngle) },
  ]);
  a.v = { ...va };
  a.state = "sliding";
  return [a, b];
}

test("3.8.2 — va chạm thẳng, bi cái trượt không xoáy: bi cái dừng, bi mục tiêu nhận ~e·v", () => {
  const [a, b] = pair({ x: 2, y: 0 });
  resolveBallBall(a, b, C);
  assert.ok(speed(a) < 0.03 * 2, `bi cái còn ${speed(a)}`);
  const ratio = b.v.x / 2;
  assert.ok(ratio > 0.94 && ratio < 0.98, `bi mục tiêu ${ratio}`);
});

test("3.8.2b — cú dừng (stop shot) trong mô phỏng đầy đủ: bi cái gần như đứng tại chỗ", () => {
  // Đánh hơi dưới tâm để bi tới bi mục tiêu lúc vừa hết xoáy ngược (trượt thuần)
  const cue = cueWhenObjectHitsRail(
    [{ n: 0, x: -0.4, y: 0.2 }, { n: 1, x: 0, y: 0.2 }],
    shot({ power: 0.24, tipY: -0.35 }),
  );
  // Bi cái gần như đứng tại điểm va chạm (≈ −0.057)
  assert.ok(Math.abs(cue.p.x - (-2 * R)) < 0.12, `bi cái ở ${cue.p.x}`);
});

test("3.8.3 — cắt 30° không xoáy: 2 hướng sau va chạm ≈ 90° (quy tắc 90°)", () => {
  const cut = (30 * Math.PI) / 180;
  const angleAfter = (cfg: typeof C) => {
    const [a, b] = pair({ x: 2, y: 0 }, cut);
    resolveBallBall(a, b, cfg);
    return deg(Math.acos((a.v.x * b.v.x + a.v.y * b.v.y) / (speed(a) * speed(b))));
  };
  // Bỏ ma sát bi–bi: chỉ còn hệ số phục hồi e = 0.95 làm lệch ~2.5°
  const ideal = angleAfter({ ...C, ballFriction: 0 });
  assert.ok(Math.abs(ideal - 90) < 3, `góc lý tưởng ${ideal}°`);
  // Có ma sát: throw làm góc nhỏ hơn vài độ (như ngoài đời)
  const real = angleAfter(C);
  assert.ok(real < ideal && ideal - real < 6, `góc thực ${real}°`);
});

test("Throw: bi mục tiêu lệch khỏi đường nối tâm, đánh chậm lệch nhiều hơn", () => {
  const cut = (30 * Math.PI) / 180;
  const throwAt = (v: number) => {
    const [a, b] = pair({ x: v, y: 0 }, cut);
    resolveBallBall(a, b, C);
    const lineOfCenters = cut;
    return deg(lineOfCenters - Math.atan2(b.v.y, b.v.x));
  };
  const slow = throwAt(0.3);
  const fast = throwAt(3);
  assert.ok(slow > 1 && slow < 5, `throw ${slow}°`);
  assert.ok(slow >= fast - 1e-9);
});

test("3.8.4 — bảo toàn động lượng & năng lượng không tăng (bi–bi, ngẫu nhiên có xoáy)", () => {
  const rand = rng(42);
  const I = 0.4 * C.ballMass * R * R;
  for (let k = 0; k < 2000; k++) {
    const ang = (rand() - 0.5) * 1.6;
    const [a, b] = pair({ x: 0.2 + rand() * 6, y: (rand() - 0.5) * 2 }, ang);
    a.w = { x: (rand() - 0.5) * 300, y: (rand() - 0.5) * 300, z: (rand() - 0.5) * 300 };
    b.v = { x: (rand() - 0.5), y: (rand() - 0.5) };
    b.w = { x: (rand() - 0.5) * 100, y: (rand() - 0.5) * 100, z: (rand() - 0.5) * 100 };
    const p0 = { x: a.v.x + b.v.x, y: a.v.y + b.v.y };
    const e0 = kineticEnergy([a, b], C);
    resolveBallBall(a, b, C);
    assert.ok(Math.abs(a.v.x + b.v.x - p0.x) < 1e-9 && Math.abs(a.v.y + b.v.y - p0.y) < 1e-9);
    assert.ok(kineticEnergy([a, b], C) <= e0 + 1e-12, `năng lượng tăng ở lần ${k}`);
    void I;
  }
});

test("3.8.5 — bi lăn vuông góc vào băng, không xoáy ngang: bật ra cùng phương", () => {
  const sim = new PoolSim([{ n: 0, x: 0.6, y: 0.25 }]);
  sim.strike(shot({ power: 0.25 }));
  const cue = sim.balls[0];
  let hit = false;
  while (sim.isMoving()) {
    sim.step();
    if (sim.events.some((e) => e.type === "cushion")) {
      hit = true;
      if (cue.v.x < 0) break;
    }
  }
  assert.ok(hit);
  assert.ok(cue.v.x < 0, "phải bật ngược lại");
  assert.ok(Math.abs(cue.v.y) < 1e-6 * Math.abs(cue.v.x) + 1e-9, `lệch ${cue.v.y}`);
});

test("Follow / draw: bi cái đi tiếp khi đánh trên, kéo về khi đánh dưới", () => {
  const start = [{ n: 0, x: -0.3, y: 0.1 }, { n: 1, x: 0, y: 0.1 }];
  const follow = cueWhenObjectHitsRail(start, shot({ power: 0.3, tipY: 0.7 }));
  const draw = cueWhenObjectHitsRail(start, shot({ power: 0.4, tipY: -0.8 }));
  assert.ok(follow.p.x > 0.05 && follow.v.x >= 0, `follow ở ${follow.p.x}`);
  assert.ok(draw.p.x < -0.15 && draw.v.x <= 0, `draw ở ${draw.p.x}`);
});

test("Squirt: english phải làm bi cái lệch sang trái vài độ", () => {
  const sim = new PoolSim([{ n: 0, x: -1, y: 0 }]);
  sim.strike(shot({ power: 0.4, tipX: 0.8 }));
  const a = deg(Math.atan2(sim.balls[0].v.y, sim.balls[0].v.x));
  assert.ok(a > 1 && a < 6, `squirt ${a}°`);
});

test("Xác định: cùng đầu vào -> cùng quỹ đạo", () => {
  const rack = [{ n: 0, x: -0.635, y: 0.01 }, ...rackNine(7)];
  const s = shot({ power: 1, tipY: 0.1 });
  const t1 = simulateShot(rack, s, { record: true });
  const t2 = simulateShot(rack, s, { record: true });
  assert.deepEqual(t1.result, t2.result);
  assert.deepEqual(Array.from(t1.frames), Array.from(t2.frames));
});

test("Bi rơi lỗ: đánh thẳng vào lỗ góc", () => {
  const pk = T.pockets[2]; // góc trên phải
  const ox = pk.mouthX - pk.axisX * 0.4;
  const oy = pk.mouthY - pk.axisY * 0.4;
  const tr = simulateShot(
    [{ n: 0, x: ox - pk.axisX * 0.3, y: oy - pk.axisY * 0.3 }, { n: 3, x: ox, y: oy }],
    shot({ dirX: pk.axisX, dirY: pk.axisY, power: 0.3 }),
  );
  assert.deepEqual(tr.result.pocketed.find((p) => p.ball === 3), { ball: 3, pocket: 2 });
  assert.equal(tr.result.firstHit, 3);
});

const N_BREAKS = Number(process.env.BREAKS ?? 1000);
test(`3.8.6 — ${N_BREAKS} cú phá ngẫu nhiên: không chồng lấn, không xuyên băng`, () => {
  const rand = rng(2024);
  const hx = T.L / 2;
  const hy = T.W / 2;
  const nearMouth = (x: number, y: number) =>
    T.pockets.some((p) => Math.hypot(x - p.mouthX, y - p.mouthY) < 0.12);
  let worstOverlap = 0;
  let checked = 0;
  for (let k = 0; k < N_BREAKS; k++) {
    const eight = k % 2 === 0;
    const rack = eight ? rackEight(k) : rackNine(k);
    const cue = { n: 0, x: -T.L / 4 - rand() * 0.2, y: (rand() - 0.5) * 0.9 };
    const target = rack[0];
    const sim = new PoolSim([cue, ...rack]);
    sim.strike({
      dirX: target.x - cue.x + (rand() - 0.5) * 0.04,
      dirY: target.y - cue.y + (rand() - 0.5) * 0.04,
      power: 0.75 + rand() * 0.25,
      tipX: (rand() - 0.5) * 0.4,
      tipY: (rand() - 0.5) * 0.6,
      elevation: rand() * 8,
    });
    // Kiểm tra từng bước trong 2.5 s đầu (giai đoạn hỗn loạn nhất)
    while (sim.isMoving() && sim.time < 2.5) {
      sim.step();
      checked++;
      const on = sim.balls.filter((b) => b.state !== "pocketed" && b.state !== "dropping" && b.state !== "offTable");
      for (let i = 0; i < on.length; i++) {
        const a = on[i];
        assert.ok(Number.isFinite(a.p.x) && Number.isFinite(a.p.y));
        // Bi đang bay (nảy sau cú phá nâng cơ) có bán kính tiếp xúc ngang nhỏ hơn; tâm vẫn phải nằm trong mép bàn
        const lim = a.state === "airborne" ? 0 : R;
        const inside = Math.abs(a.p.x) <= hx - lim + 1e-6 && Math.abs(a.p.y) <= hy - lim + 1e-6;
        assert.ok(inside || nearMouth(a.p.x, a.p.y), `bi ${a.n} xuyên băng tại (${a.p.x}, ${a.p.y}) lần phá ${k}`);
        for (let j = i + 1; j < on.length; j++) {
          const b = on[j];
          // Khoảng cách 3D (tâm bi bay cao hơn thì không tính là chồng lấn)
          const ov = 2 * R - Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y, a.h - b.h);
          worstOverlap = Math.max(worstOverlap, ov);
        }
      }
    }
  }
  assert.ok(worstOverlap < 1e-6, `chồng lấn lớn nhất ${worstOverlap * 1000} mm`);
  assert.ok(checked > 0);
});
