import { test } from "node:test";
import assert from "node:assert/strict";
import { attenuate, busGain, DEFAULT_MIX, headroom, moodFor, RepeatGuard, sanitizeMix, surfaceFor } from "../_lib/audio/mix";

test("âm thanh: tắt tiếng riêng từng bus & tắt khi ẩn tab", () => {
  const m = sanitizeMix({ ...DEFAULT_MIX, muted: { music: true, sfx: false, voice: false } });
  assert.equal(busGain(m, "music", false), 0);
  assert.ok(busGain(m, "sfx", false) > 0);
  assert.equal(busGain(m, "sfx", true), 0, "ẩn tab -> im lặng");
  assert.ok(busGain({ ...m, muteWhenHidden: false }, "sfx", true) > 0);
  assert.equal(sanitizeMix({ master: 7, music: -2 }).master, 1, "giá trị vượt miền bị chặn");
});

test("âm thanh: không vượt ngưỡng gây méo; xa nhỏ dần; tường cản nhỏ hơn", () => {
  assert.equal(headroom([0.3, 0.3]), 1);
  const k = headroom([0.8, 0.8, 0.8]);
  assert.ok(0.8 * 3 * k <= 0.9 + 1e-9);
  assert.ok(attenuate(1, 14, false) > attenuate(8, 14, false));
  assert.ok(attenuate(5, 14, true) < attenuate(5, 14, false));
  assert.equal(attenuate(20, 14, false), 0);
  // bus tối đa không vượt 1
  assert.ok(busGain(sanitizeMix({ master: 1, sfx: 1 }), "sfx", false) <= 1);
});

test("âm thanh: chặn cùng âm lặp lại trong 150 ms", () => {
  const g = new RepeatGuard(150);
  assert.equal(g.allow("step", 0), true);
  assert.equal(g.allow("step", 100), false);
  assert.equal(g.allow("bell", 100), true);
  assert.equal(g.allow("step", 160), true);
});

test("âm thanh: nhạc theo khu vực & giờ, bề mặt bước chân", () => {
  assert.equal(moodFor("guardroom", 10, true), "tense");
  assert.equal(moodFor("workshop", 10, false), "work");
  assert.equal(moodFor("cell_0", 22, false), "silent");
  assert.equal(moodFor("yard", 14, false), "calm");
  assert.equal(surfaceFor("yard", ","), "grass");
  assert.equal(surfaceFor("workshop", "."), "metal");
  assert.equal(surfaceFor("library", "."), "wood");
});
