/** Tiến lên miền Nam: nhận bộ, chặt, tới trắng, diễn biến vòng, bot đánh hết ván */
import { test } from "node:test";
import assert from "node:assert/strict";
import { beats, comboOf, deal, instantWin, pass, play, scoreOf, type TLState } from "../_lib/cards";
import { botAction } from "../_lib/bot";

// lá: nước r (0 = 3 … 12 = 2), chất s (0 ♠ … 3 ♥)
const c = (r: number, s: number) => r * 4 + s;

test("nhận dạng bộ", () => {
  assert.equal(comboOf([c(0, 0)])?.type, "single");
  assert.equal(comboOf([c(5, 0), c(5, 3)])?.type, "pair");
  assert.equal(comboOf([c(5, 0), c(6, 3)]), null);
  assert.equal(comboOf([c(3, 0), c(4, 1), c(5, 2)])?.type, "straight");
  assert.equal(comboOf([c(10, 0), c(11, 1), c(12, 2)]), null, "sảnh không có heo");
  assert.equal(comboOf([c(2, 0), c(2, 1), c(3, 0), c(3, 3), c(4, 1), c(4, 2)])?.type, "pairs");
  assert.equal(comboOf([c(7, 0), c(7, 1), c(7, 2), c(7, 3)])?.type, "quad");
});

test("so bài & chặt", () => {
  const heo = comboOf([c(12, 0)])!;
  const heoCo = comboOf([c(12, 3)])!;
  const doiHeo = comboOf([c(12, 0), c(12, 1)])!;
  const ba = comboOf([c(2, 0), c(2, 1), c(3, 0), c(3, 3), c(4, 1), c(4, 2)])!;
  const quad = comboOf([c(7, 0), c(7, 1), c(7, 2), c(7, 3)])!;
  const bon = comboOf([c(2, 0), c(2, 1), c(3, 0), c(3, 3), c(4, 1), c(4, 2), c(5, 0), c(5, 1)])!;
  assert.ok(beats(heoCo, heo));
  assert.ok(beats(ba, heo) && beats(quad, heo) && beats(bon, heo));
  assert.ok(!beats(ba, doiHeo) && beats(quad, doiHeo) && beats(bon, doiHeo));
  assert.ok(beats(quad, ba) && beats(bon, quad) && !beats(ba, quad));
  assert.ok(!beats(comboOf([c(5, 0)])!, comboOf([c(4, 0), c(4, 1)])!));
  const s3 = comboOf([c(3, 0), c(4, 1), c(5, 2)])!;
  assert.ok(beats(comboOf([c(3, 0), c(4, 1), c(5, 3)])!, s3));
  assert.ok(!beats(comboOf([c(3, 0), c(4, 1), c(5, 2), c(6, 0)])!, s3), "sảnh khác độ dài");
});

test("tới trắng", () => {
  assert.equal(instantWin([c(12, 0), c(12, 1), c(12, 2), c(12, 3), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => c(r, 0))]), "Tứ quý heo");
  assert.equal(instantWin([...Array.from({ length: 12 }, (_, r) => c(r, 0)), c(12, 0)]), "Sảnh rồng");
  assert.equal(instantWin([...[0, 2, 4, 6, 8, 10].flatMap((r) => [c(r, 0), c(r, 1)]), c(12, 3)]), "6 đôi");
  assert.equal(instantWin([...Array.from({ length: 10 }, (_, r) => c(r, 0)), c(0, 1), c(1, 1), c(12, 3)]), null);
});

function fixed(hands: number[][], turn = 0, mustPlay = -1): TLState {
  const n = hands.length;
  return { n, hands, turn, table: null, passed: new Array(n).fill(false), finished: [], mustPlay, over: false, instant: null, events: [], played: new Array(n).fill(0) };
}

test("vòng đánh: bỏ lượt mất quyền, ai cũng bỏ thì người đánh cuối mở vòng mới; nước đầu phải có lá nhỏ nhất", () => {
  let s = fixed([[c(0, 0), c(5, 0), c(9, 0)], [c(1, 0), c(6, 0), c(10, 0)], [c(2, 0), c(7, 0), c(11, 0)]], 0, c(0, 0));
  assert.equal((play(s, 0, [c(5, 0)]) as { error: string }).error, "MUST_PLAY_LOWEST");
  s = (play(s, 0, [c(0, 0)]) as { state: TLState }).state;
  assert.equal(s.turn, 1);
  assert.equal((play(s, 1, [c(1, 0), c(6, 0)]) as { error: string }).error, "BAD_COMBO");
  s = (pass(s, 1) as { state: TLState }).state;
  s = (play(s, 2, [c(2, 0)]) as { state: TLState }).state;
  // ghế 1 đã bỏ -> tới ghế 0
  assert.equal(s.turn, 0);
  s = (pass(s, 0) as { state: TLState }).state;
  // ai cũng bỏ -> ghế 2 mở vòng mới
  assert.equal(s.turn, 2);
  assert.equal(s.table, null);
  assert.equal((pass(s, 2) as { error: string }).error, "CANNOT_PASS");
});

test("về nhất rồi người kế tiếp hưởng sái; hết ván xếp hạng & tính điểm", () => {
  let s = fixed([[c(11, 0)], [c(1, 0), c(5, 0)], [c(3, 0), c(4, 0)]], 0);
  s = (play(s, 0, [c(11, 0)]) as { state: TLState }).state;
  assert.deepEqual(s.finished, [0]);
  s = (pass(s, 1) as { state: TLState }).state;
  s = (pass(s, 2) as { state: TLState }).state;
  assert.equal(s.turn, 1, "ghế sau người về nhất được đi");
  s = (play(s, 1, [c(1, 0)]) as { state: TLState }).state;
  s = (play(s, 2, [c(3, 0)]) as { state: TLState }).state;
  s = (play(s, 1, [c(5, 0)]) as { state: TLState }).state;
  assert.ok(s.over);
  assert.deepEqual(s.finished, [0, 1, 2]);
  assert.deepEqual(scoreOf(s), [2, 0, -2]);
});

test("4 bot đánh hết 200 ván không lỗi, mọi ván đều kết thúc", () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  let starter: number | null = null;
  for (let g = 0; g < 200; g++) {
    let s = deal(4, starter, rng);
    let steps = 0;
    while (!s.over) {
      const lv = (["easy", "normal", "hard", "hard"] as const)[s.turn];
      const a = botAction(s, s.turn, lv, rng);
      const r = a.kind === "play" ? play(s, s.turn, a.cards) : pass(s, s.turn);
      assert.ok(r.ok, `ván ${g} bước ${steps}: ${!r.ok && r.error}`);
      if (!r.ok) return;
      s = r.state;
      assert.ok(++steps < 400, "ván không kết thúc");
    }
    assert.equal(new Set(s.finished).size, s.instant ? 1 : 4);
    starter = s.finished[0];
  }
});
