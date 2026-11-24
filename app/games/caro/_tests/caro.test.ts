/** Cờ caro: luật chặn 1 đầu / chặn 2 đầu, nước đi hợp lệ, bot */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMove, BOARD_SIZE, checkWin, emptyBoard, idx, newGame, type CaroGameState, type CaroRule } from "../_lib/rules";
import { chooseCaroMove, winsAt } from "../_lib/bot";

/** Dựng bàn từ danh sách quân: X (1) và O (2) */
function board(xs: [number, number][], os: [number, number][] = []) {
  const b = emptyBoard();
  for (const [x, y] of xs) b[idx(x, y)] = 1;
  for (const [x, y] of os) b[idx(x, y)] = 2;
  return b;
}
const row = (y: number, from: number, n: number) => Array.from({ length: n }, (_, i) => [from + i, y] as [number, number]);

function play(rule: CaroRule, seq: [number, number][]): CaroGameState {
  let g = newGame(rule);
  for (const [x, y] of seq) {
    const r = applyMove(g, x, y);
    assert.ok(r.ok, `nước ${x},${y}`);
    g = r.state;
  }
  return g;
}

test("5 quân liền thắng theo cả 4 hướng; 4 quân thì chưa", () => {
  for (const cells of [row(5, 3, 5), Array.from({ length: 5 }, (_, i) => [7, 2 + i] as [number, number]), Array.from({ length: 5 }, (_, i) => [2 + i, 2 + i] as [number, number]), Array.from({ length: 5 }, (_, i) => [10 + i, 10 - i] as [number, number])]) {
    const b = board(cells);
    const w = checkWin(b, cells[2][0], cells[2][1], "free");
    assert.ok(w);
    assert.equal(w.cells.length, 5);
  }
  assert.equal(checkWin(board(row(5, 3, 4)), 4, 5, "free"), null);
  assert.ok(checkWin(board(row(5, 3, 6)), 5, 5, "block2"), "6 quân liền vẫn thắng");
});

test("chặn 2 đầu: 5 quân bị chặn cả hai đầu KHÔNG thắng; bị chặn 1 đầu vẫn thắng; mép bàn không tính là chặn", () => {
  const five = row(5, 3, 5);
  const both = board(five, [[2, 5], [8, 5]]);
  assert.equal(checkWin(both, 5, 5, "block2"), null);
  assert.ok(checkWin(both, 5, 5, "free"), "chặn 1 đầu (luật tự do): vẫn thắng");
  const one = board(five, [[2, 5]]);
  assert.ok(checkWin(one, 5, 5, "block2"));
  // sát mép trái + đối thủ chặn bên phải: mép không tính -> vẫn thắng
  const edge = board(row(0, 0, 5), [[5, 0]]);
  assert.ok(checkWin(edge, 2, 0, "block2"));
});

test("nước đi: X đi trước, luân phiên; ô đã có quân / ngoài bàn bị từ chối; hết ván thì không đi tiếp", () => {
  let g = newGame("free");
  assert.equal(g.turn, 1);
  let r = applyMove(g, 3, 3);
  assert.ok(r.ok);
  g = r.state;
  assert.equal(g.turn, 2);
  r = applyMove(g, 3, 3);
  assert.equal(!r.ok && r.error, "OCCUPIED");
  assert.equal((applyMove(g, BOARD_SIZE, 0) as { error: string }).error, "OUT_OF_BOARD");
  assert.equal((applyMove(g, 1.5, 0) as { error: string }).error, "OUT_OF_BOARD");
  const won = play("free", [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0]]);
  assert.equal(won.winner, 1);
  assert.equal(won.winLine?.length, 5);
  assert.equal((applyMove(won, 9, 9) as { error: string }).error, "GAME_OVER");
});

test("chặn 2 đầu trong ván thật: O chặn hai đầu thì X đủ 5 quân vẫn chưa thắng", () => {
  // X: (3..7,5); O chặn (2,5) và (8,5)
  const g = play("block2", [[3, 5], [2, 5], [4, 5], [8, 5], [5, 5], [0, 0], [6, 5], [0, 1], [7, 5]]);
  assert.equal(g.winner, null);
  const f = play("free", [[3, 5], [2, 5], [4, 5], [8, 5], [5, 5], [0, 0], [6, 5], [0, 1], [7, 5]]);
  assert.equal(f.winner, 1);
});

test("bot: thắng ngay khi có thể; chặn nước thắng của đối thủ (vừa, khó); khó chặn 3 mở", () => {
  // bot là O (lượt 2): O có 4 quân -> đi nước thắng
  let g = play("free", [[0, 0], [5, 5], [0, 2], [6, 5], [0, 4], [7, 5], [0, 6], [8, 5], [10, 10]]);
  assert.equal(g.turn, 2);
  for (const lv of ["medium", "hard"] as const) {
    const m = chooseCaroMove(g, lv, () => 0.5)!;
    const r = applyMove(g, m[0], m[1]);
    assert.ok(r.ok && r.state.winner === 2, `${lv} thắng ngay`);
  }
  // X có 4 quân mở 1 đầu -> O phải chặn
  g = play("free", [[3, 3], [10, 10], [4, 3], [11, 12], [5, 3], [14, 2], [6, 3]]);
  assert.equal(g.turn, 2);
  for (const lv of ["medium", "hard"] as const) {
    const [x, y] = chooseCaroMove(g, lv, () => 0.5)!;
    assert.ok((x === 2 && y === 3) || (x === 7 && y === 3), `${lv} chặn 4 (${x},${y})`);
  }
  // X có 3 mở hai đầu -> bot khó chặn ở đầu
  g = play("free", [[5, 5], [12, 12], [6, 5], [14, 3], [7, 5]]);
  const [hx, hy] = chooseCaroMove(g, "hard", () => 0.5)!;
  assert.ok(hy === 5 && (hx === 4 || hx === 8 || hx === 3 || hx === 9), `khó chặn 3 mở (${hx},${hy})`);
});

test("bot luật chặn 2 đầu: không coi 5 quân bị chặn hai đầu là nước thắng", () => {
  // O có 4 quân (3..6, 5) nhưng X chặn ở (2,5); nếu O đi (7,5) mà (8,5) là X thì không thắng
  const g = play("block2", [[2, 5], [3, 5], [8, 5], [4, 5], [0, 0], [5, 5], [0, 2], [6, 5], [0, 4]]);
  assert.equal(g.turn, 2);
  const r = applyMove(g, 7, 5);
  assert.ok(r.ok && r.state.winner === null, "luật chặn 2 đầu");
  assert.equal(winsAt(g.board, g.size, 7, 5, 2, "block2"), false, "bot không coi (7,5) là nước thắng");
  assert.equal(winsAt(g.board, g.size, 7, 5, 2, "free"), true, "luật tự do thì là nước thắng");
});

test("bot tự đấu: cấp khó thắng cấp dễ đa số ván; mọi nước bot đi đều hợp lệ", () => {
  let hardWins = 0;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let game = 0; game < 6; game++) {
    let g = newGame(game % 2 ? "block2" : "free");
    const hardIs = (game % 2 === 0 ? 1 : 2) as 1 | 2;
    while (g.winner === null && !g.draw && g.moves.length < 400) {
      const lv = g.turn === hardIs ? "hard" : "easy";
      const m = chooseCaroMove(g, lv, rnd);
      assert.ok(m);
      const r = applyMove(g, m[0], m[1]);
      assert.ok(r.ok, "nước bot hợp lệ");
      g = r.state;
    }
    if (g.winner === hardIs) hardWins++;
  }
  assert.ok(hardWins >= 5, `khó thắng ${hardWins}/6`);
});
