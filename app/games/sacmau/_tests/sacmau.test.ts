/** Sắc Màu: bộ bài, luật đánh, chức năng, cộng dồn, báo, máy đánh hết ván */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, deal, draw, DRAW2, pass, play, REVERSE, scoreOf, SKIP, WILD4, WILDCARD, type SMState } from "../_lib/cards";
import { botAction } from "../_lib/bot";

const find = (color: number, value: number, skip = 0) => CARDS.findIndex((c, i) => c.color === color && c.value === value && i >= skip);

function fixed(hands: number[][], top: number, extra: Partial<SMState> = {}): SMState {
  const used = new Set([...hands.flat(), top]);
  return {
    n: hands.length,
    hands,
    pile: CARDS.map((_, i) => i).filter((i) => !used.has(i)),
    discard: [top],
    color: CARDS[top].color,
    turn: 0,
    dir: 1,
    pending: 0,
    drawn: null,
    over: false,
    winner: null,
    settings: { stack: true },
    events: [],
    called: hands.map(() => false),
    stall: 0,
    ...extra,
  };
}

test("bộ 108 lá: mỗi hệ 25 lá, 8 lá đổi sắc", () => {
  assert.equal(CARDS.length, 108);
  for (let c = 0; c < 4; c++) assert.equal(CARDS.filter((x) => x.color === c).length, 25);
  assert.equal(CARDS.filter((x) => x.value === WILDCARD).length, 4);
  assert.equal(CARDS.filter((x) => x.value === WILD4).length, 4);
  const s = deal(4);
  assert.deepEqual(s.hands.map((h) => h.length), [7, 7, 7, 7]);
  assert.ok(CARDS[s.discard[0]].value <= 9);
  assert.equal(s.pile.length + 28 + 1, 108);
});

test("đánh cùng hệ / cùng số; sai thì bị từ chối; đổi sắc phải chọn hệ", () => {
  const s = fixed([[find(0, 5), find(1, 3), find(2, 7), find(4, WILDCARD)], [find(3, 1), find(3, 2)]], find(1, 5));
  assert.ok(play(s, 0, find(0, 5)).ok, "cùng số");
  assert.ok(play(s, 0, find(1, 3), undefined, false).ok, "cùng hệ");
  assert.equal((play(s, 0, find(2, 7)) as { error: string }).error, "CANNOT_PLAY");
  assert.equal((play(s, 0, find(4, WILDCARD)) as { error: string }).error, "NEED_COLOR");
  const w = play(s, 0, find(4, WILDCARD), 2);
  assert.ok(w.ok && w.state.color === 2);
});

test("Chặn, Đảo chiều (2 người = chặn), +2 cộng dồn và không cộng dồn", () => {
  const h = () => [[find(0, SKIP), find(0, REVERSE), find(0, DRAW2), find(0, 9)], [find(1, 1), find(1, 2), (find(0, DRAW2) + 1)], [find(2, 1), find(2, 2)]];
  let s = fixed(h(), find(0, 1));
  const sk = play(s, 0, find(0, SKIP));
  assert.ok(sk.ok && sk.state.turn === 2);
  const rv = play(s, 0, find(0, REVERSE));
  assert.ok(rv.ok && rv.state.turn === 2 && rv.state.dir === -1);
  // +2 cộng dồn: ghế 1 chồng +2 -> ghế 2 phải bốc 4
  s = (play(s, 0, find(0, DRAW2)) as { state: SMState }).state;
  assert.equal(s.pending, 2);
  s = (play(s, 1, (find(0, DRAW2) + 1)) as { state: SMState }).state;
  assert.equal(s.pending, 4);
  s = (draw(s, 2) as { state: SMState }).state;
  assert.equal(s.hands[2].length, 6);
  assert.equal(s.turn, 0);
  // không cộng dồn: người kế bốc 2 ngay và mất lượt
  let t = fixed(h(), find(0, 1), { settings: { stack: false } });
  t = (play(t, 0, find(0, DRAW2)) as { state: SMState }).state;
  assert.equal(t.hands[1].length, 5);
  assert.equal(t.turn, 2);
});

test("bốc bài: đánh được thì được đánh luôn hoặc bỏ lượt; còn 1 lá quên báo bị phạt 2", () => {
  let s = fixed([[find(2, 7), find(2, 8)], [find(3, 1)]], find(1, 5), { pile: [find(1, 9)] });
  s = (draw(s, 0) as { state: SMState }).state;
  assert.equal(s.drawn, find(1, 9));
  assert.equal((play(s, 0, find(2, 7)) as { error: string }).error, "MUST_PLAY_DRAWN");
  const p = pass(s, 0);
  assert.ok(p.ok && p.state.turn === 1);
  // quên báo
  const q = fixed([[find(0, 5), find(0, 6)], [find(3, 1)]], find(0, 1));
  const forgot = play(q, 0, find(0, 5), undefined, false);
  assert.ok(forgot.ok && forgot.state.hands[0].length === 3);
  const called = play(q, 0, find(0, 5), undefined, true);
  assert.ok(called.ok && called.state.hands[0].length === 1);
  // hết bài -> thắng, ăn điểm
  const w = play(fixed([[find(0, 5)], [find(3, 9), find(4, WILD4)]], find(0, 1)), 0, find(0, 5));
  assert.ok(w.ok && w.state.winner === 0);
  if (w.ok) assert.deepEqual(scoreOf(w.state), [59, -59]);
});

test("hết bài để bốc và không ai đánh được: ván dừng, ít điểm nhất thắng", () => {
  let s = fixed([[find(2, 7)], [find(3, 9), find(3, 8)]], find(1, 5), { pile: [] });
  s = (draw(s, 0) as { state: SMState }).state;
  assert.equal(s.over, false);
  s = (draw(s, 1) as { state: SMState }).state;
  assert.equal(s.over, true);
  assert.equal(s.winner, 0);
});

test("máy đánh hết 300 ván (2–4 người, có / không cộng dồn) không lỗi", () => {
  let seed = 11;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  for (let g = 0; g < 300; g++) {
    const n = 2 + (g % 3);
    let s = deal(n, g % n, { stack: g % 2 === 0 }, rng);
    let steps = 0;
    while (!s.over) {
      const a = botAction(s, s.turn, (["easy", "normal", "hard"] as const)[s.turn % 3], rng);
      const r = a.kind === "play" ? play(s, s.turn, a.card, a.color, a.call, rng) : a.kind === "draw" ? draw(s, s.turn, rng) : pass(s, s.turn, rng);
      assert.ok(r.ok, `ván ${g}: ${!r.ok && r.error}`);
      if (!r.ok) return;
      s = r.state;
      const total = s.hands.flat().length + s.pile.length + s.discard.length;
      assert.equal(total, 108, "không mất / nhân bài");
      if (++steps > 3000) break;
    }
    assert.ok(s.over, `ván ${g} không kết thúc`);
  }
});
