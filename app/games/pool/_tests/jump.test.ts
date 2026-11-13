import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POOL_PHYSICS as C,
  PoolSim,
  AUTO_LIFT_MAX,
  checkCueClearance,
  computeStrike,
  liftShot,
  kineticEnergy,
  simulateShot,
  type BallSpot,
  type ShotCommand,
} from "../_lib/physics/index";
import { rng } from "../_lib/rules/rack";

const R = C.ballRadius;
const shot = (p: Partial<ShotCommand>): ShotCommand => ({ dirX: 1, dirY: 0, power: 0.6, tipX: 0, tipY: 0, elevation: 0, ...p });
const cueAt = (x: number, y = 0): BallSpot => ({ n: 0, x, y });

/** Cơ năng cả hệ: động năng (tịnh tiến + đứng + quay) + thế năng m·g·h */
const mech = (sim: PoolSim) => kineticEnergy(sim.balls, C) + sim.balls.reduce((e, b) => e + (b.state === "offTable" || b.state === "pocketed" ? 0 : C.ballMass * C.gravity * b.h), 0);

function fly(cmd: ShotCommand, start: BallSpot[] = [cueAt(-1.1)], maxT = C.maxSimTime) {
  const sim = new PoolSim(start);
  sim.strike(cmd);
  const cue = sim.balls[0];
  let maxH = 0;
  let minH = 0;
  let airborneSteps = 0;
  const e0 = mech(sim);
  let eMax = e0;
  while (sim.isMoving() && sim.time < maxT) {
    sim.step();
    maxH = Math.max(maxH, cue.h);
    minH = Math.min(minH, cue.h);
    if (cue.state === "airborne") airborneSteps++;
    if (sim.steps % 20 === 0) eMax = Math.max(eMax, mech(sim));
  }
  return { sim, cue, maxH, minH, airborneSteps, e0, eMax };
}

test("Không đủ thành phần lực thẳng đứng thì bi KHÔNG bay: góc ≤ 3° mọi mức lực", () => {
  for (const elevation of [0, 1, 2, 3]) {
    for (const power of [0.1, 0.4, 0.8, 1]) {
      const o = computeStrike(shot({ elevation, power }), C);
      assert.equal(o.jump, false, `${elevation}° lực ${power}`);
      assert.equal(o.vz, 0);
      const r = fly(shot({ elevation, power }));
      assert.equal(r.maxH, 0, `${elevation}° lực ${power} không được rời mặt bàn`);
      assert.ok(!r.sim.events.some((e) => e.type === "jump" || e.type === "land"));
    }
  }
});

test("Jump shot: góc lớn + lực vừa -> bi rời bàn, nhảy ~vài cm tới chục cm, đáp, nảy tắt dần rồi dừng", () => {
  const cmd = shot({ elevation: 45, power: 0.6 });
  const o = computeStrike(cmd, C);
  assert.equal(o.jump, true);
  const r = fly(cmd);
  assert.ok(r.maxH > 0.05 && r.maxH < 0.25, `nhảy cao ${(r.maxH * 100).toFixed(1)} cm`);
  assert.ok(r.sim.events.some((e) => e.type === "jump"), "có sự kiện jump (phân biệt với cú thường)");
  const lands = r.sim.events.filter((e) => e.type === "land");
  assert.ok(lands.length >= 1 && lands.length <= 8, `${lands.length} lần đáp`);
  // Các lần nảy nhỏ dần
  const sp = lands.map((e) => (e.type === "land" ? e.speed : 0));
  for (let i = 1; i < sp.length; i++) assert.ok(sp[i] < sp[i - 1], "nảy tắt dần");
  assert.equal(r.cue.state, "stationary");
  assert.equal(r.cue.h, 0);
  assert.equal(r.minH, 0, "tâm bi không bao giờ chui xuống dưới mặt bàn");
});

test("Quỹ đạo bay là parabol: h(t) = vz·t − ½gt² (sai số < 0.1 mm)", () => {
  const cmd = shot({ elevation: 50, power: 0.55 });
  const vz = computeStrike(cmd, C).vz;
  assert.ok(vz > 1);
  const sim = new PoolSim([cueAt(-1.2)]);
  sim.strike(cmd);
  const cue = sim.balls[0];
  const vx = cue.v.x;
  const x0 = cue.p.x;
  const tLand = (2 * vz) / C.gravity;
  let worst = 0;
  while (sim.time < tLand * 0.95) {
    sim.step();
    const t = sim.time;
    worst = Math.max(worst, Math.abs(cue.h - (vz * t - 0.5 * C.gravity * t * t)), Math.abs(cue.p.x - (x0 + vx * t)));
  }
  assert.ok(worst < 1e-4, `lệch quỹ đạo ${worst * 1000} mm`);
  assert.ok(Math.abs(cue.vz - (vz - C.gravity * sim.time)) < 1e-6);
});

test("Năng lượng cơ học (động + thế năng) không bao giờ tăng trong lúc bay, nảy, đáp", () => {
  const rand = rng(11);
  for (let k = 0; k < 40; k++) {
    const cmd = shot({
      dirX: 1,
      dirY: (rand() - 0.5) * 0.4,
      power: 0.2 + rand() * 0.55,
      tipX: (rand() - 0.5) * 0.8,
      tipY: (rand() - 0.5) * 0.8,
      elevation: 20 + rand() * 55,
    });
    const r = fly(cmd, [cueAt(-1.2, (rand() - 0.5) * 0.4)], 6);
    assert.ok(r.eMax <= r.e0 * (1 + 1e-9) + 1e-9, `cơ năng tăng ở cú ${k}: ${r.e0} -> ${r.eMax}`);
  }
});

test("Nhảy qua bi: cùng cú đánh, đánh thẳng thì trúng bi, đánh chúi cao thì bay qua không chạm", () => {
  const obstacle: BallSpot = { n: 1, x: -0.8, y: 0 };
  const flat = simulateShot([cueAt(-1.1), obstacle], shot({ elevation: 0, power: 0.6 })).result;
  assert.equal(flat.firstHit, 1);
  // Chỉ xét giai đoạn bay (sau đó bi lăn tới băng đối diện rồi dội lại có thể chạm bi chắn)
  const hop = simulateShot([cueAt(-1.1), obstacle], shot({ elevation: 45, power: 0.6 }), { maxTime: 0.55 }).result;
  assert.equal(hop.firstHit, null, "bay qua, không chạm bi chắn");
  const stay = hop.final.find((b) => b.n === 1)!;
  assert.ok(Math.abs(stay.x - obstacle.x) < 1e-9 && Math.abs(stay.y) < 1e-9, "bi bị nhảy qua đứng yên");
  const cueEnd = hop.final.find((b) => b.n === 0)!;
  assert.ok(cueEnd.x > obstacle.x + 0.2, "bi cái đã đi qua bi chắn");
});

test("Bay quá thấp thì vẫn va bi: chạm vào mép dưới / bên hông bi chắn, bi nảy lên đúng hướng", () => {
  // Bi chắn rất gần: bi cái chưa kịp nâng đủ cao -> va chạm 3D
  const hits = [0.06, 0.08, 0.1].filter((gap) => simulateShot([cueAt(-1.1), { n: 1, x: -1.1 + 2 * R + gap, y: 0 }], shot({ elevation: 45, power: 0.6 })).result.firstHit === 1);
  assert.ok(hits.length >= 2, `chỉ ${hits.length}/3 trường hợp sát bi có va chạm`);
});

test("Bay qua băng thì văng khỏi bàn (không xuyên băng, không vào lỗ); bay thấp thì dội băng bình thường", () => {
  const high = simulateShot([cueAt(0.95)], shot({ elevation: 55, power: 1 })).result;
  assert.deepEqual(high.offTable, [0]);
  assert.equal(high.final.length, 0);
  assert.equal(high.scratch, false, "không phải rơi lỗ");
  // Cú thường sát băng: dội lại, không văng
  const low = simulateShot([cueAt(0.95)], shot({ elevation: 0, power: 0.6 })).result;
  assert.deepEqual(low.offTable, []);
  assert.equal(low.final.length, 1);
});

test("Bi đáp xuống: ma sát tiếp tuyến đổi spin & hướng (bi cái có spin sau khi đáp, rồi lăn)", () => {
  const r = fly(shot({ elevation: 40, power: 0.5, tipY: -0.4 }), [cueAt(-1.2)]);
  const lands = r.sim.events.filter((e) => e.type === "land");
  assert.ok(lands.length >= 1);
  // Sau khi đáp lần cuối, bi chuyển trượt -> lăn rồi dừng
  assert.equal(r.cue.state, "stationary");
});

test("300 jump shot ngẫu nhiên: luôn kết thúc, không NaN, không chui xuống bàn, không nảy vô hạn", () => {
  const rand = rng(77);
  for (let k = 0; k < 300; k++) {
    const balls: BallSpot[] = [cueAt(-0.9 + rand() * 0.6, (rand() - 0.5) * 0.8), { n: 3, x: rand() * 0.8, y: (rand() - 0.5) * 0.8 }, { n: 5, x: 0.4 + rand() * 0.5, y: (rand() - 0.5) * 0.8 }];
    const a = rand() * Math.PI * 2;
    const cmd = shot({ dirX: Math.cos(a), dirY: Math.sin(a), power: 0.1 + rand() * 0.9, tipX: (rand() - 0.5) * 1.2, tipY: (rand() - 0.5) * 1.2, elevation: 10 + rand() * 70 });
    const tr = simulateShot(balls, cmd);
    for (const b of tr.result.final) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `NaN ở cú ${k}`);
    assert.ok(tr.result.duration < C.maxSimTime - 0.5, `cú ${k} không dừng (${tr.result.duration}s)`);
    assert.ok(tr.events.filter((e) => e.type === "land").length < 30, `nảy quá nhiều ở cú ${k}`);
    assert.ok(tr.stats.finalEnergy <= tr.stats.initialEnergy * (1 + 1e-6) + 1e-6, `động năng tăng ở cú ${k}`);
  }
});

test("Phát lại: khung ghi độ cao khi bay (z < 0) và băm trạng thái không phụ thuộc việc ghi khung", () => {
  const cmd = shot({ elevation: 45, power: 0.6 });
  const a = simulateShot([cueAt(-1.1)], cmd, { record: true });
  const b = simulateShot([cueAt(-1.1)], cmd, { record: false });
  assert.equal(a.hash, b.hash);
  let minZ = 0;
  for (let f = 0; f < a.frameCount; f++) minZ = Math.min(minZ, a.frames[f * 7 + 6]);
  assert.ok(minZ < -0.05, `độ cao lớn nhất trong khung ${-minZ}`);
});

// ===================== Cơ không được xuyên bi / băng =====================

test("Cơ vướng bi khác phía sau: đánh ngang bị chặn, nâng cơ lên thì hết vướng (có minElevation)", () => {
  const balls: BallSpot[] = [cueAt(0), { n: 7, x: -0.2, y: 0.01 }];
  // Giữa bàn đuôi cơ nhô qua băng nên tự nâng nhẹ; bi 7 nằm sau cơ vẫn chặn
  const flat = liftShot(balls, shot({ elevation: 0 }), C);
  assert.equal(flat.clearance.ok, false);
  assert.equal(flat.clearance.blockedBy, "ball");
  assert.ok(flat.clearance.minElevation !== null && flat.clearance.minElevation > 1.5 && flat.clearance.minElevation <= C.maxElevation);
  assert.equal(checkCueClearance(balls, shot({ elevation: flat.clearance.minElevation! }), C).ok, true);
  assert.equal(checkCueClearance(balls, shot({ elevation: 80 }), C).ok, true);
  // Bi không nằm trên đường cơ thì không vướng
  assert.equal(liftShot([cueAt(0), { n: 7, x: -0.2, y: 0.3 }], shot({ elevation: 0 }), C).clearance.ok, true);
});

test("Cơ vướng thành băng: sát băng thì chặn; giữa bàn tự nâng đuôi cơ rất nhẹ (không gây nhảy)", () => {
  const near = [cueAt(C.tableLength / 2 - 0.045)];
  const r = liftShot(near, shot({ dirX: -1, dirY: 0, elevation: 0 }), C);
  assert.equal(r.clearance.ok, false);
  assert.equal(r.clearance.blockedBy, "rail");
  assert.ok(r.clearance.minElevation !== null && r.clearance.minElevation > AUTO_LIFT_MAX, "cần nâng nhiều -> không tự nâng");
  assert.equal(checkCueClearance(near, shot({ dirX: -1, dirY: 0, elevation: r.clearance.minElevation! }), C).ok, true);
  const mid = liftShot([cueAt(0)], shot({ elevation: 0 }), C);
  assert.equal(mid.clearance.ok, true);
  assert.equal(mid.lifted, true);
  assert.ok(mid.shot.elevation > 0 && mid.shot.elevation <= AUTO_LIFT_MAX);
  assert.equal(computeStrike(mid.shot, C).jump, false, "nâng đuôi cơ qua băng không tạo jump shot");
});

test("Đánh chúi dốc không tạo xung lực phi vật lý: tốc độ bi ≤ tốc độ đánh ngang cùng lực", () => {
  for (const power of [0.3, 0.6, 1]) {
    const flat = computeStrike(shot({ power, elevation: 0 }), C);
    for (const elevation of [15, 30, 45, 60, 80]) {
      const o = computeStrike(shot({ power, elevation }), C);
      const total = Math.hypot(o.speed, o.vz);
      assert.ok(total <= flat.speed * 1.0001, `${elevation}° lực ${power}: tổng ${total} > ${flat.speed}`);
    }
  }
});
