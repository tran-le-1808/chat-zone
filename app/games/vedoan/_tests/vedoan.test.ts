/** Vẽ Đoán: so đáp án, gần đúng, gợi ý, điểm, chọn từ, nét vẽ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawerPoints, guessPoints, hintMask, isClose, isCorrect, leaksWord, nextReveal, normalize, parseCustomWords, pickChoices } from "../_lib/game";
import { effectiveOps, mergeOps, sanitizeOps, type DrawOp } from "../_lib/draw";
import { WORDS } from "../_lib/words";

test("so đáp án bỏ dấu, hoa thường, bỏ chữ 'con/cái' ở đầu", () => {
  assert.equal(normalize("  Đôi   ĐŨA! "), "doi dua");
  assert.ok(isCorrect("con mèo", "con mèo"));
  assert.ok(isCorrect("CON MEO", "con mèo"));
  assert.ok(isCorrect("mèo", "con mèo"));
  assert.ok(!isCorrect("con", "con mèo"));
  assert.ok(isCorrect("pho", "tô phở"));
  assert.ok(!isCorrect("bò", "con mèo"));
  assert.ok(isCorrect("ao dai", "áo dài"));
});

test("gần đúng: sai 1 ký tự", () => {
  assert.ok(isClose("con meoo", "con mèo"));
  assert.ok(isClose("dua hau", "quả dưa hấu") === false || isCorrect("dua hau", "quả dưa hấu"));
  assert.ok(isClose("khinh khi cau", "khinh khí cầu") === false);
  assert.ok(isClose("khinh khi cao", "khinh khí cầu"));
  assert.ok(!isClose("xe", "xe đạp"));
});

test("gợi ý chữ cái: không lộ khoảng trắng, tối đa 40%", () => {
  assert.equal(hintMask("con mèo"), "___ ___");
  let r: number[] = [];
  for (let i = 0; i < 10; i++) r = nextReveal("con mèo", r);
  assert.equal(r.length, 2);
  assert.ok(!r.includes(3));
  assert.equal(hintMask("con mèo", [0, 4]), "c__ m__");
});

test("điểm: đoán nhanh nhiều điểm hơn, người vẽ theo tỉ lệ đoán đúng", () => {
  assert.equal(guessPoints(1, 0), 330);
  assert.equal(guessPoints(0, 5), 50);
  assert.ok(guessPoints(0.8, 1) > guessPoints(0.3, 1));
  assert.equal(drawerPoints(0, 3), 0);
  assert.equal(drawerPoints(3, 3), 250);
  assert.ok(drawerPoints(1, 3) < drawerPoints(2, 3));
});

test("chọn 3 từ khác nhau, tránh từ đã dùng; từ tự nhập", () => {
  const used = new Set(WORDS.slice(0, 50).map((w) => w.w));
  for (let i = 0; i < 50; i++) {
    const c = pickChoices(used);
    assert.equal(new Set(c).size, 3);
    assert.ok(c.every((w) => !used.has(w)));
  }
  const custom = parseCustomWords("Bánh mì, bánh mì\nCon mèo béo,, x ,trà đá");
  assert.deepEqual(custom, ["Bánh mì", "Con mèo béo", "trà đá"]);
  assert.ok(pickChoices(new Set(), custom, true).every((w) => custom.includes(w)));
  assert.ok(WORDS.length > 250);
  assert.equal(new Set(WORDS.map((w) => normalize(w.w))).size, WORDS.length);
});

test("chặn lộ đáp án trong chat", () => {
  assert.ok(leaksWord("nó là con mèo đó", "con mèo"));
  assert.ok(leaksWord("m e o", "con mèo"));
  assert.ok(!leaksWord("vẽ đẹp quá", "con mèo"));
});

test("nét vẽ: kiểm tra, gộp, hoàn tác", () => {
  assert.equal(sanitizeOps([{ k: "l", g: 1, c: 99, s: 0, p: [0, 0] }]), null);
  assert.equal(sanitizeOps([{ k: "l", g: 1, c: 1, s: 0, p: [0, 0, 5] }]), null);
  assert.equal(sanitizeOps("hack"), null);
  const ops = sanitizeOps([
    { k: "l", g: 1, c: 1, s: 0, p: [0, 0, 10, 10] },
    { k: "l", g: 1, c: 1, s: 0, p: [10, 10, 20, 20] },
    { k: "f", g: 2, c: 4, x: 500, y: 500 },
    { k: "u" },
  ])!;
  const merged = mergeOps(ops.slice(0, 2));
  assert.equal(merged.length, 1);
  assert.deepEqual((merged[0] as Extract<DrawOp, { k: "l" }>).p, [0, 0, 10, 10, 20, 20]);
  assert.deepEqual(effectiveOps(ops).map((o) => o.k), ["l", "l"]);
  assert.deepEqual(effectiveOps([...ops, { k: "u" }]), []);
});
