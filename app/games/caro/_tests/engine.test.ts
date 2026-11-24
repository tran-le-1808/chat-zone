/** Engine bot Cao thủ: ép thắng (VCF), phòng thủ, sách khai cuộc, đọc PSQ, chuẩn hoá thế cờ, sức mạnh */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMove, newGame, type CaroGameState, type CaroRule } from "../_lib/rules";
import { chooseCaroMove } from "../_lib/bot";
import { CaroEngine, engineMove } from "../_lib/engine/search";
import { canonical, type Move } from "../_lib/engine/book";
import { parsePsq } from "../_lib/engine/psq";

function play(rule: CaroRule, seq: Move[]): CaroGameState {
  let g = newGame(rule);
  for (const [x, y] of seq) {
    const r = applyMove(g, x, y);
    assert.ok(r.ok, `${x},${y}`);
    g = r.state;
  }
  return g;
}

test("VCF: tìm ra chuỗi '4' ép thắng (đối thủ chặn từng nước vẫn thua)", () => {
  // X có hai hàng 3 hở ở hai hướng giao nhau -> có thể ép bằng chuỗi 4
  const g = play("free", [[5, 5], [0, 19], [6, 5], [2, 19], [7, 5], [4, 19], [9, 7], [6, 19], [9, 8], [8, 19], [9, 9], [10, 19]]);
  assert.equal(g.turn, 1);
  const e = new CaroEngine(g);
  assert.ok(e.vcf(1, 10) >= 0, "X có chuỗi ép thắng");
  // đi theo engine tới hết: X phải thắng dù O chặn hợp lý (bot Khó)
  let s = g;
  for (let k = 0; k < 30 && s.winner === null; k++) {
    const m = s.turn === 1 ? engineMove(s, { timeMs: 400 })!.move : chooseCaroMove(s, "hard", () => 0.5)!;
    const r = applyMove(s, m[0], m[1]);
    assert.ok(r.ok);
    s = r.state;
  }
  assert.equal(s.winner, 1);
});

test("thắng ngay > chặn ngay; phòng thủ phá chuỗi ép thắng của đối thủ", () => {
  // O (đến lượt) có 4 quân -> thắng ngay dù X cũng đang đe doạ
  let g = play("free", [[3, 3], [10, 10], [4, 3], [11, 10], [5, 3], [12, 10], [6, 3], [13, 10], [0, 0]]);
  let r = engineMove(g, { timeMs: 200 })!;
  assert.equal(r.source, "win");
  // X có 4 quân -> O phải chặn
  g = play("free", [[3, 3], [10, 10], [4, 3], [12, 14], [5, 3], [15, 2], [6, 3]]);
  r = engineMove(g, { timeMs: 200 })!;
  assert.equal(r.source, "block");
  assert.ok((r.move[0] === 2 || r.move[0] === 7) && r.move[1] === 3);
  // X (vừa đi) có chuỗi ép thắng nếu được đi tiếp -> O đến lượt phải phá
  g = play("free", [[5, 5], [15, 15], [6, 5], [15, 13], [7, 5], [13, 15], [9, 7], [12, 16], [9, 8]]);
  assert.equal(g.turn, 2);
  r = engineMove(g, { timeMs: 600 })!;
  const after = applyMove(g, r.move[0], r.move[1]);
  assert.ok(after.ok);
  assert.ok(new CaroEngine(after.state).vcf(1, 8) < 0, `nước ${r.move} phá được chuỗi ép thắng của X`);
});

test("sách khai cuộc: dùng nước có tỉ lệ thắng cao; bỏ nước từng thua nhiều", () => {
  const g = play("free", [[10, 10]]);
  const good = engineMove(g, { timeMs: 200, book: [{ x: 11, y: 11, n: 12, score: 0.8 }] })!;
  assert.equal(good.source, "book");
  assert.deepEqual(good.move, [11, 11]);
  const weak = engineMove(g, { timeMs: 200, book: [{ x: 11, y: 11, n: 2, score: 0.9 }] })!;
  assert.notEqual(weak.source, "book", "ít ván quá thì không tin sách");
  const bad = engineMove(g, { timeMs: 200, book: [{ x: 9, y: 9, n: 20, score: 0.1 }, { x: 11, y: 9, n: 20, score: 0.1 }] })!;
  assert.ok(!(bad.move[0] === 9 && bad.move[1] === 9) && !(bad.move[0] === 11 && bad.move[1] === 9), "tránh nước từng thua");
});

test("chuẩn hoá thế cờ: xoay / lật / tịnh tiến cho cùng khoá; nước map ngược đúng", () => {
  const moves: Move[] = [[9, 9], [10, 10], [9, 10], [8, 11]];
  const tf = (m: Move): Move => [18 - m[1], m[0] - 2]; // xoay + tịnh tiến
  const a = canonical(moves);
  const b = canonical(moves.map(tf));
  assert.equal(a.key, b.key);
  const next: Move = [8, 9];
  assert.deepEqual(b.fromCanon(a.toCanon(next)), tf(next));
  // số quân khác nhau -> khoá khác
  assert.notEqual(canonical(moves.slice(0, 3)).key, a.key);
});

test("đọc file PSQ (Gomocup): kích thước, nước đi đếm từ 1, số nước khai cuộc đặt sẵn", () => {
  const g = parsePsq("Piskvorky 20x20, 11:11, 0\n1,18,0\n3,20,0\n6,19,0\n5,15,58890\n5,17,71745\nENGINE.zip\n-1\n1,Freestyle20_1\n");
  assert.ok(g);
  assert.equal(g.size, 20);
  assert.deepEqual(g.moves[0], [0, 17]);
  assert.equal(g.moves.length, 5);
  assert.equal(g.opening, 3);
  assert.equal(parsePsq("rác"), null);
});

test("Cao thủ (engine) thắng bot Khó cũ ở cả hai luật, mỗi nước dưới 1,5 giây", () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let wins = 0;
  let worst = 0;
  for (let game = 0; game < 4; game++) {
    let g = newGame(game < 2 ? "free" : "block2");
    const me = (game % 2 === 0 ? 1 : 2) as 1 | 2;
    while (g.winner === null && !g.draw && g.moves.length < 200) {
      let m: Move;
      if (g.turn === me) {
        const t0 = Date.now();
        m = engineMove(g, { timeMs: 300 })!.move;
        worst = Math.max(worst, Date.now() - t0);
      } else m = g.moves.length ? chooseCaroMove(g, "hard", rnd)! : [10, 10];
      const r = applyMove(g, m[0], m[1]);
      assert.ok(r.ok);
      g = r.state;
    }
    if (g.winner === me) wins++;
  }
  assert.equal(wins, 4, `thắng ${wins}/4`);
  assert.ok(worst < 1500, `chậm nhất ${worst} ms`);
});
