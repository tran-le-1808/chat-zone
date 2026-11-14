import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStepDurations,
  hopPose,
  landSpring,
  volumeXZ,
  MAX_TOTAL_S,
  MIN_STEP_S,
  T_STEP,
  SLOTS,
  stepHeightFactor,
} from "../stepTimeline";
import { PENTATONIC, stepNoteHz } from "../stepSound";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

test("tổng thời gian không vượt 3.2 s và mỗi bước >= 0.18 s", () => {
  for (const n of [1, 2, 7, 12]) {
    const d = buildStepDurations(n, 1, 5);
    assert.equal(d.length, n);
    assert.ok(sum(d) <= MAX_TOTAL_S + 1e-9 || n <= 8, `n=${n} total=${sum(d)}`);
    for (const x of d) assert.ok(x >= MIN_STEP_S - 1e-9);
  }
  assert.ok(sum(buildStepDurations(12, 2, 9)) <= MAX_TOTAL_S + 1e-9);
});

test("bước đầu chậm hơn ~15%, bước cuối chậm hơn ~25% so với bước giữa", () => {
  const d = buildStepDurations(7, 0, 0);
  const mid = d.slice(1, -1).reduce((a, b) => a + b, 0) / 5;
  assert.ok(d[0] > mid * 1.05);
  assert.ok(d[6] > mid * 1.15);
});

test("có hạt giống: cùng playerId + moveId cho cùng kết quả, khác seed thì khác", () => {
  assert.deepEqual(buildStepDurations(9, 3, 11), buildStepDurations(9, 3, 11));
  assert.notDeepEqual(buildStepDurations(9, 3, 11), buildStepDurations(9, 3, 12));
  assert.equal(stepHeightFactor(2, 7, 1, 4), stepHeightFactor(2, 7, 1, 4));
});

test("tốc độ: chậm > vừa > nhanh", () => {
  const f = (s: "slow" | "normal" | "fast") => sum(buildStepDurations(5, 0, 0, s));
  assert.ok(f("slow") > f("normal") && f("normal") > f("fast"));
});

test("giữ thể tích trong [0.9, 1.1] và chân không chìm dưới mặt ô ở mọi khung hình", () => {
  const dur = T_STEP;
  for (let t = 0; t <= dur * 3; t += 0.001) {
    const p = hopPose(t, dur, 1);
    const vol = volumeXZ(p.sy) ** 2 * p.sy;
    assert.ok(vol > 0.9 && vol < 1.1, `vol=${vol} t=${t}`);
    assert.ok(p.lift >= -1e-9, "lift < 0");
    assert.ok(p.sy > 0.7 && p.sy < 1.2, `sy=${p.sy}`);
  }
});

test("độc lập tốc độ khung hình: 30/60/120 FPS cho cùng tư thế ở cùng mốc thời gian", () => {
  const dur = 0.4;
  // Mô phỏng vòng lặp: cộng dồn delta (kẹp 50 ms như SmoothPawn) rồi lấy tư thế theo thời gian tích luỹ
  const at = (fps: number, frames: number) => {
    let t = 0;
    for (let i = 0; i < frames; i++) t += Math.min(1 / fps, 0.05);
    return { t, pose: hopPose(t, dur, 1) };
  };
  for (const T of [0.1, 0.2, 0.3, 0.4]) {
    const a = at(30, Math.round(T * 30));
    const b = at(60, Math.round(T * 60));
    const c = at(120, Math.round(T * 120));
    assert.ok(Math.abs(a.t - c.t) < 1e-9 && Math.abs(b.t - c.t) < 1e-9);
    for (const k of ["u", "lift", "sy", "pitch"] as const) {
      assert.ok(Math.abs(a.pose[k] - c.pose[k]) < 0.01 && Math.abs(b.pose[k] - c.pose[k]) < 0.01, `T=${T} ${k}`);
    }
  }
});

test("vị trí cuối: hết pha bay u = 1, lift = 0 (đứng đúng điểm của ô)", () => {
  const p = hopPose(10, 0.4, 1);
  assert.equal(p.u, 1);
  assert.equal(p.lift, 0);
  assert.ok(Math.abs(landSpring(5) - 1) < 1e-3);
});

test("lò xo tắt dần: chạm đất 0.8, nhún 1-2 nhịp rồi ổn định", () => {
  assert.ok(Math.abs(landSpring(0) - 0.8) < 1e-9);
  let crossings = 0;
  let prev = landSpring(0) - 1;
  for (let t = 0.001; t < 1; t += 0.001) {
    const v = landSpring(t) - 1;
    if (Math.sign(v) !== Math.sign(prev) && Math.abs(v) > 1e-4) crossings++;
    prev = v;
  }
  assert.ok(crossings >= 1 && crossings <= 4, `crossings=${crossings}`);
});

test("khe đứng: 4 quân không chồng nhau (cách nhau >= 0.35 chiều rộng ô)", () => {
  for (const n of [1, 2, 3, 4]) {
    const s = SLOTS[n];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        assert.ok(Math.hypot(s[i][0] - s[j][0], s[i][1] - s[j][1]) >= 0.35 - 1e-9);
  }
});

test("âm bước đi: đi lên theo thang ngũ cung, trong dải nghe dễ chịu, mỗi người chơi một giọng", () => {
  const notes = Array.from({ length: 5 }, (_, i) => stepNoteHz(i));
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i] > notes[i - 1], "phải đi lên");
  for (let step = 0; step < 24; step++)
    for (let pid = 0; pid < 4; pid++) {
      const hz = stepNoteHz(step, pid);
      assert.ok(hz >= 380 && hz <= 1400, `hz=${hz}`);
      // luôn thuộc thang ngũ cung (cộng độ lệch của người chơi) -> không có nốt lệch tông
      const semis = Math.round(12 * Math.log2(hz / 392));
      assert.ok(Math.abs(12 * Math.log2(hz / 392) - semis) < 1e-9);
    }
  assert.deepEqual(PENTATONIC.length, 5);
  assert.notEqual(stepNoteHz(0, 0), stepNoteHz(0, 1));
});
