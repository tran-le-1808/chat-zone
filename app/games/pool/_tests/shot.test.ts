import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANCEL_THRESHOLD,
  MAX_PULL_M,
  MIN_PULL_M,
  TIP_PRESETS,
  aimTowards,
  clampTipUnit,
  crossedMilestone,
  cuePullDistance,
  describeTip,
  onCueShaft,
  powerCurve,
  presetTip,
  pullFromAlong,
  pullFromDrag,
  rotatedAim,
  safeUnit,
  shortTipLabel,
  tipFromOffset,
  type TipLimits,
} from "../../_shared/shot/shotMath";
import { transition, type ShotEvent, type ShotState } from "../../_shared/shot/shotMachine";
import { POOL_PHYSICS as C, powerToSpeed } from "../_lib/physics/config";
import { PoolSim } from "../_lib/physics/simulator";
import { computeStrike, sanitizeShot } from "../_lib/physics/cue";
import type { ShotCommand } from "../_lib/physics/types";

/** Bida Lỗ: vòng an toàn = ngưỡng trượt cơ (0.5R) trong đĩa tối đa 0.6R */
const POOL: TipLimits = { maxFrac: C.maxTipOffset, safeFrac: C.miscueOffset };

// ===================== 1–2. Điểm chạm =====================

test("2 — kéo chấm ra ngoài vòng an toàn: bị kẹp ở mép, |tip| không bao giờ vượt giới hạn", () => {
  const s = safeUnit(POOL);
  assert.ok(Math.abs(s - 0.5 / 0.6) < 1e-12);
  for (let i = 0; i < 2000; i++) {
    const a = (i / 2000) * Math.PI * 2;
    const r = 0.1 + (i % 17) * 0.5; // bán kính ngón tay 0.1R … 8R (kéo rất xa)
    const t = tipFromOffset(Math.cos(a) * r * 100, -Math.sin(a) * r * 100, 100, POOL);
    assert.ok(Math.hypot(t.x, t.y) <= s + 1e-12, `|tip| = ${Math.hypot(t.x, t.y)}`);
    // Engine không bao giờ coi là trượt cơ
    const shot = sanitizeShot({ dirX: 1, dirY: 0, power: 0.5, tipX: t.x, tipY: t.y }, C);
    assert.equal(computeStrike(shot, C).miscue, false);
  }
  // Ngoài vòng -> đúng mép vòng, cùng hướng với ngón tay
  const edge = clampTipUnit(2, 0, POOL);
  assert.equal(edge.clamped, true);
  assert.ok(Math.abs(edge.x - s) < 1e-12 && edge.y === 0);
});

test("Điểm chạm liên tục từ tâm tới mép (không rời rạc) và trục y hướng lên", () => {
  const xs = [0, 5, 10, 15, 20].map((px) => tipFromOffset(px, 0, 100, POOL).x);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1]);
  assert.ok(tipFromOffset(0, -20, 100, POOL).y > 0, "ngón tay phía TRÊN tâm = top (dương)");
  assert.ok(tipFromOffset(0, 20, 100, POOL).y < 0, "ngón tay phía DƯỚI tâm = draw (âm)");
  assert.ok(tipFromOffset(20, 0, 100, POOL).x > 0, "bên phải = dương");
  // Carom: toàn đĩa là vùng an toàn (không có luật trượt cơ)
  const carom: TipLimits = { maxFrac: 0.55, safeFrac: 0.55 };
  assert.equal(safeUnit(carom), 1);
});

test("Gợi ý nhanh (Giữa / Top / Draw / Trái / Phải) nằm trong vòng an toàn", () => {
  for (const p of TIP_PRESETS) {
    const t = presetTip(p, POOL);
    assert.ok(Math.hypot(t.x, t.y) <= safeUnit(POOL) + 1e-12);
  }
  assert.deepEqual(presetTip(TIP_PRESETS[0], POOL), { x: 0, y: 0 });
});

test("Mô tả điểm chạm theo thời gian thực", () => {
  const s = safeUnit(POOL);
  assert.match(describeTip(0, 0, POOL), /Giữa tâm/);
  assert.match(describeTip(0, 0.3 * s, POOL), /^Top nhẹ$/);
  assert.match(describeTip(0.9 * s, -0.5 * s, POOL), /Draw vừa, xoáy phải mạnh/);
  assert.equal(shortTipLabel(0, 0, POOL), "");
  assert.equal(shortTipLabel(0.5 * s, 0.5 * s, POOL), "Top·Phải");
});

test("7 — điểm chạm vào engine đúng chiều: top đi sau, draw kéo về, phải/trái xoáy ngược nhau", () => {
  const start = [{ n: 0, x: -0.3, y: 0.1 }, { n: 1, x: 0, y: 0.1 }];
  const cueAfterContact = (tipX: number, tipY: number) => {
    const sim = new PoolSim(start);
    sim.strike({ dirX: 1, dirY: 0, power: 0.35, tipX, tipY, elevation: 0 });
    while (sim.isMoving() && !sim.events.some((e) => e.type === "cushion" && e.ball !== 0)) sim.step();
    return sim.balls.find((b) => b.n === 0)!;
  };
  const s = safeUnit(POOL);
  assert.ok(cueAfterContact(0, 0.8 * s).p.x > cueAfterContact(0, 0).p.x + 0.05, "top: bi cái đi tiếp");
  assert.ok(cueAfterContact(0, -0.8 * s).p.x < cueAfterContact(0, 0).p.x - 0.05, "draw: bi cái bị kéo về");
  const mk = (tipX: number): ShotCommand => ({ dirX: 1, dirY: 0, power: 0.4, tipX, tipY: 0, elevation: 0 });
  const wr = computeStrike(mk(0.7 * s), C).w.z;
  const wl = computeStrike(mk(-0.7 * s), C).w.z;
  assert.ok(wr !== 0 && wl !== 0 && Math.sign(wr) === -Math.sign(wl), "phải và trái xoáy ngược chiều");
});

// ===================== 3–5. Kéo cơ & lực =====================

test("Lực: kéo 0→100% ánh xạ đúng, phi tuyến nhẹ, vùng thấp có độ phân giải cao", () => {
  assert.equal(pullFromDrag(100, 100, 200), 0);
  assert.equal(pullFromDrag(100, 300, 200), 1);
  assert.equal(pullFromDrag(100, 900, 200), 1, "kéo quá cuối thanh vẫn giữ 100%");
  assert.equal(pullFromDrag(100, 20, 200), 0, "kéo ngược lên quá điểm đầu = 0");
  assert.equal(pullFromDrag(100, 200, 200, 2), 1, "độ nhạy 2× ");
  assert.ok(Math.abs(pullFromDrag(100, 200, 200, 0.5) - 0.25) < 1e-12);
  // Carom (engine tuyến tính): d^1.4 — cú nhẹ nhạy hơn
  assert.ok(powerCurve(0.5, 1.4) < 0.5);
  assert.equal(powerCurve(1, 1.4), 1);
  // Bida Lỗ: engine đã có p^1.5 -> v tăng đơn điệu, vmin ≈ 0.5, vmax ≈ 12 m/s
  assert.ok(Math.abs(powerToSpeed(0, C) - 0.5) < 1e-9 && Math.abs(powerToSpeed(1, C) - 12) < 1e-9);
  // Đường cong p^1.5: bước ở vùng lực thấp nhỏ hơn bước cùng độ rộng ở vùng cao -> lực nhẹ dễ kiểm soát
  assert.ok(powerToSpeed(0.25, C) - powerToSpeed(0.05, C) < powerToSpeed(1, C) - powerToSpeed(0.8, C));
});

test("Cơ lùi ra sau bi tối đa ≈ 15–20 cm ứng với lực 100%", () => {
  assert.ok(MAX_PULL_M >= 0.15 && MAX_PULL_M <= 0.2);
  assert.equal(cuePullDistance(0), MIN_PULL_M);
  assert.ok(Math.abs(cuePullDistance(1) - (MIN_PULL_M + MAX_PULL_M)) < 1e-12);
  assert.equal(cuePullDistance(5), cuePullDistance(1));
});

test("Mốc haptic 25/50/75% (cả hai chiều)", () => {
  assert.equal(crossedMilestone(0.2, 0.3), 0.25);
  assert.equal(crossedMilestone(0.3, 0.2), 0.25);
  assert.equal(crossedMilestone(0.3, 0.45), null);
  assert.equal(crossedMilestone(0.4, 0.8), 0.5);
});

test("Ngắm tương đối (cảm ứng) không nhảy khi vừa chạm, xoay đúng theo ngón tay", () => {
  assert.equal(rotatedAim(1, 0.3, 0.3), 1);
  assert.ok(Math.abs(rotatedAim(1, 0.3, 0.4) - 1.1) < 1e-12);
  assert.ok(Math.abs(rotatedAim(1, 0.3, 0.4, 0.2) - 1.02) < 1e-12, "ngắm tinh ×0.2");
  // Qua ranh giới ±π không bị xoay vòng 2π
  assert.ok(Math.abs(rotatedAim(0, 3.1, -3.1) - (2 * Math.PI - 6.2)) < 1e-9);
});

test("Kéo cơ trực tiếp trên bàn: chỉ khi chạm thân cơ, mức kéo theo hình chiếu lên trục ngắm", () => {
  const cue = { x: 0, y: 0 };
  const dir = { x: 1, y: 0 };
  assert.equal(onCueShaft(cue, dir, { x: -0.5, y: 0.02 }).hit, true);
  assert.equal(onCueShaft(cue, dir, { x: -0.5, y: 0.2 }).hit, false, "lệch xa trục cơ");
  assert.equal(onCueShaft(cue, dir, { x: 0.5, y: 0 }).hit, false, "phía trước bi");
  const a0 = onCueShaft(cue, dir, { x: -0.5, y: 0 }).along;
  const a1 = onCueShaft(cue, dir, { x: -0.5 - MAX_PULL_M, y: 0 }).along;
  assert.ok(Math.abs(pullFromAlong(a0, a1) - 1) < 1e-9);
  assert.equal(pullFromAlong(a0, a0 - 0.3), 0, "kéo tiến lên = 0");
});

// ===================== Máy trạng thái =====================

function run(start: ShotState, events: ShotEvent[]) {
  let state = start;
  const effects: unknown[] = [];
  for (const ev of events) {
    const r = transition(state, ev);
    state = r.state;
    if (r.effect) effects.push(r.effect);
  }
  return { state, effects };
}

test("3 — kéo cơ 0→100% rồi thả: đúng 1 lệnh đánh với đúng lực; kéo về 0 rồi thả: KHÔNG đánh", () => {
  const ok = run("IDLE", [{ type: "PULL_START" }, { type: "PULL_RELEASE", d: 1 }]);
  assert.deepEqual(ok.effects, [{ type: "shoot", d: 1 }]);
  assert.equal(ok.state, "SHOOTING");
  const mid = run("IDLE", [{ type: "PULL_START" }, { type: "PULL_RELEASE", d: 0.42 }]);
  assert.deepEqual(mid.effects, [{ type: "shoot", d: 0.42 }]);
  const cancel = run("IDLE", [{ type: "PULL_START" }, { type: "PULL_RELEASE", d: 0 }]);
  assert.deepEqual(cancel.effects, [{ type: "cancel" }]);
  assert.equal(cancel.state, "IDLE");
  const edge = run("IDLE", [{ type: "PULL_START" }, { type: "PULL_RELEASE", d: CANCEL_THRESHOLD - 0.001 }]);
  assert.deepEqual(edge.effects, [{ type: "cancel" }], "dưới 5% = huỷ");
  // Thả 2 lần chỉ đánh 1 lần
  const twice = run("IDLE", [{ type: "PULL_START" }, { type: "PULL_RELEASE", d: 0.8 }, { type: "PULL_RELEASE", d: 0.8 }]);
  assert.equal(twice.effects.length, 1);
});

test("5 — mất focus / bị khoá giữa lúc kéo: huỷ, không tự đánh", () => {
  const r = run("IDLE", [{ type: "PULL_START" }, { type: "ENABLED", enabled: false }, { type: "PULL_RELEASE", d: 0.9 }]);
  assert.deepEqual(r.effects, [{ type: "cancel" }]);
  assert.equal(r.state, "LOCKED");
  const c = run("IDLE", [{ type: "PULL_START" }, { type: "PULL_CANCEL" }]);
  assert.deepEqual(c.effects, [{ type: "cancel" }]);
  assert.equal(c.state, "IDLE");
});

test("6 — đang mở bi lớn: không kéo lực được, không ngắm được; đóng xong dùng lại bình thường", () => {
  const open = run("IDLE", [{ type: "SPIN_OPEN" }]);
  assert.equal(open.state, "SPIN_EDIT");
  assert.equal(transition("SPIN_EDIT", { type: "PULL_START" }).accepted, false);
  assert.equal(transition("SPIN_EDIT", { type: "AIM_START" }).accepted, false);
  assert.equal(transition("SPIN_EDIT", { type: "AIM_START" }).state, "SPIN_EDIT");
  const back = run("SPIN_EDIT", [{ type: "SPIN_CLOSE" }, { type: "PULL_START" }, { type: "PULL_RELEASE", d: 0.5 }]);
  assert.deepEqual(back.effects, [{ type: "shoot", d: 0.5 }]);
});

test("Chống đánh nhầm: khoá khi chưa tới lượt / đang lăn; chỉ 1 nguồn kéo; mở bi lớn khi đang kéo bị từ chối", () => {
  for (const st of ["LOCKED", "SHOOTING"] as const) {
    assert.equal(transition(st, { type: "PULL_START" }).accepted, false);
    assert.equal(transition(st, { type: "SPIN_OPEN" }).accepted, false);
  }
  assert.equal(transition("PULLING", { type: "PULL_START" }).accepted, false, "chỉ 1 con trỏ kéo lực");
  assert.equal(transition("PULLING", { type: "SPIN_OPEN" }).accepted, false);
  // Ngắm bằng ngón thứ hai khi đang kéo: không đổi trạng thái kéo
  assert.equal(transition("PULLING", { type: "AIM_START" }).state, "PULLING");
  assert.equal(transition("PULLING", { type: "AIM_END" }).state, "PULLING");
  // Sau khi đánh: khoá tới khi được phép đánh lại; lệnh bị server từ chối -> mở khoá
  assert.equal(run("SHOOTING", [{ type: "ENABLED", enabled: false }]).state, "LOCKED");
  assert.equal(run("LOCKED", [{ type: "ENABLED", enabled: true }]).state, "IDLE");
  assert.equal(run("SHOOTING", [{ type: "ENABLED", enabled: true }]).state, "IDLE");
});

test("Chạm / click ở đâu trên bàn thì ngắm tới đó (không cần kéo)", () => {
  const cue = { x: -0.5, y: 0.1 };
  for (const pt of [{ x: 0.8, y: 0.4 }, { x: -1.1, y: -0.5 }, { x: -0.5, y: 0.6 }, { x: 1.2, y: 0.1 }]) {
    const a = aimTowards(cue, pt)!;
    assert.ok(Math.abs(Math.hypot(a.dirX, a.dirY) - 1) < 1e-12, "hướng đã chuẩn hoá");
    // Đi từ bi cái theo hướng ngắm sẽ đi đúng qua điểm chạm
    const t = Math.hypot(pt.x - cue.x, pt.y - cue.y);
    assert.ok(Math.abs(cue.x + a.dirX * t - pt.x) < 1e-12 && Math.abs(cue.y + a.dirY * t - pt.y) < 1e-12);
    assert.ok(Math.abs(Math.atan2(a.dirY, a.dirX) - a.angle) < 1e-12);
  }
  // Chạm sát tâm bi cái: không xác định hướng -> giữ hướng cũ
  assert.equal(aimTowards(cue, { x: -0.5 + 0.003, y: 0.1 }), null);
  // Sau khi chạm, kéo xoay tiếp bắt đầu đúng từ hướng vừa ngắm (không nhảy)
  const a = aimTowards(cue, { x: 0.4, y: 0.5 })!;
  assert.equal(rotatedAim(a.angle, a.angle, a.angle), a.angle);
  assert.ok(Math.abs(rotatedAim(a.angle, a.angle, a.angle + 0.1) - (a.angle + 0.1)) < 1e-12);
});
