/** Cờ tướng: perft (đếm nước đi chuẩn), chiếu, lộ mặt tướng, chiếu bí, chiếu dai, ký hiệu */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMove, idx, initialBoard, inCheck, legalMoves, newGame, notation, notations,
  type Side, type XqState, KING, ROOK, CANNON, HORSE, PAWN, ADVISOR, ELEPHANT,
} from "../_lib/rules";

function perft(board: number[], side: Side, depth: number): number {
  if (depth === 0) return 1;
  const ms = legalMoves(board, side);
  if (depth === 1) return ms.length;
  let n = 0;
  for (const m of ms) {
    const f = m >> 8;
    const t = m & 255;
    const cap = board[t];
    board[t] = board[f];
    board[f] = 0;
    n += perft(board, (-side) as Side, depth - 1);
    board[f] = board[t];
    board[t] = cap;
  }
  return n;
}

test("perft thế ban đầu khớp số liệu chuẩn (44 / 1920 / 79666)", () => {
  const b = initialBoard();
  assert.equal(perft(b, 1, 1), 44);
  assert.equal(perft(b, 1, 2), 1920);
  assert.equal(perft(b, 1, 3), 79666);
});

function custom(pieces: [number, number, number][], turn: Side = 1): XqState {
  const g = newGame();
  const board = new Array(90).fill(0);
  for (const [x, y, p] of pieces) board[idx(x, y)] = p;
  return { ...g, board, turn, history: [] };
}

test("lộ mặt tướng: không được đi quân che duy nhất giữa hai tướng", () => {
  const g = custom([[4, 9, KING], [4, 0, -KING], [4, 5, ROOK], [0, 9, ROOK]]);
  // xe ở cột 4 đi ngang -> hai tướng đối mặt -> không hợp lệ
  const r = applyMove(g, idx(4, 5), idx(2, 5));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.error, "SELF_CHECK");
  // đi dọc trên cùng cột vẫn được
  assert.ok(applyMove(g, idx(4, 5), idx(4, 3)).ok);
});

test("cản chân mã, cản mắt tượng, pháo cần ngòi để ăn", () => {
  const b = initialBoard();
  const g = newGame();
  // mã ở (1,9) bị chân ở (1,8)? ô đó trống -> nhảy được (2,7)
  assert.ok(applyMove(g, idx(1, 9), idx(2, 7)).ok);
  const blocked = { ...g, board: b.slice() };
  blocked.board[idx(1, 8)] = PAWN; // chặn chân
  assert.equal(applyMove(blocked, idx(1, 9), idx(2, 7)).ok, false);
  // pháo (1,7) ăn mã đen (1,0) qua ngòi pháo đen (1,2)
  assert.ok(applyMove(g, idx(1, 7), idx(1, 0)).ok);
  // pháo không ăn trực tiếp không có ngòi
  assert.equal(applyMove(g, idx(1, 7), idx(1, 2)).ok, false);
  // tượng không qua sông
  const el = custom([[4, 9, KING], [3, 0, -KING], [4, 5, ELEPHANT]]);
  assert.equal(applyMove(el, idx(4, 5), idx(2, 3)).ok, false);
  // sĩ không ra khỏi cung
  const ad = custom([[4, 9, KING], [3, 0, -KING], [3, 7, ADVISOR]]);
  assert.equal(applyMove(ad, idx(3, 7), idx(2, 6)).ok, false);
});

test("tốt chỉ đi ngang sau khi qua sông, không đi lùi", () => {
  const g = newGame();
  assert.equal(applyMove(g, idx(0, 6), idx(1, 6)).ok, false);
  const t = custom([[4, 9, KING], [3, 0, -KING], [2, 4, PAWN]]);
  assert.ok(applyMove(t, idx(2, 4), idx(1, 4)).ok);
  assert.ok(applyMove(t, idx(2, 4), idx(2, 3)).ok);
  assert.equal(applyMove(t, idx(2, 4), idx(2, 5)).ok, false);
});

test("chiếu bí: hai xe kẹp tướng -> Đỏ thắng", () => {
  const g = custom([[4, 9, KING], [3, 0, -KING], [0, 2, ROOK], [8, 1, ROOK]]);
  const r = applyMove(g, idx(0, 2), idx(0, 0));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.state.winner, 1);
    assert.equal(r.state.endReason, "checkmate");
  }
});

test("mã chiếu và tốt chiếu được nhận ra", () => {
  const b = new Array(90).fill(0);
  b[idx(4, 0)] = -KING;
  b[idx(3, 9)] = KING; // khác cột -> không lộ mặt tướng
  b[idx(5, 2)] = HORSE; // mã (5,2) -> (4,0): chân (5,1) trống
  assert.ok(inCheck(b, -1));
  b[idx(5, 1)] = -ADVISOR; // chặn chân
  assert.ok(!inCheck(b, -1));
  const c = new Array(90).fill(0);
  c[idx(4, 0)] = -KING;
  c[idx(3, 9)] = KING;
  c[idx(4, 1)] = PAWN;
  assert.ok(inCheck(c, -1));
  // pháo chiếu qua ngòi
  const d = new Array(90).fill(0);
  d[idx(4, 0)] = -KING;
  d[idx(3, 9)] = KING;
  d[idx(4, 3)] = -PAWN;
  d[idx(4, 6)] = CANNON;
  assert.ok(inCheck(d, -1));
});

test("chiếu dai: bên chiếu liên tục làm lặp thế cờ 3 lần thì thua", () => {
  // Đỏ: xe chiếu qua lại; Đen: tướng chạy qua lại
  let g = custom([[3, 9, KING], [4, 0, -KING], [0, 5, ROOK], [8, 9, ROOK]]);
  g = { ...g, history: [] };
  // khởi tạo lịch sử giống newGame
  const { positionKey } = await_import();
  g.history = [positionKey(g.board, g.turn)];
  const seq: [number, number][] = [
    [idx(0, 5), idx(4, 5)], [idx(4, 0), idx(5, 0)], [idx(4, 5), idx(5, 5)], [idx(5, 0), idx(4, 0)],
    [idx(5, 5), idx(4, 5)], [idx(4, 0), idx(5, 0)], [idx(4, 5), idx(5, 5)], [idx(5, 0), idx(4, 0)],
    [idx(5, 5), idx(4, 5)],
  ];
  let last: XqState = g;
  for (const [f, t] of seq) {
    const r = applyMove(last, f, t);
    assert.ok(r.ok, `nước ${f}->${t}`);
    if (!r.ok) return;
    last = r.state;
    if (last.winner !== null || last.draw) break;
  }
  assert.equal(last.endReason, "perpetual");
  assert.equal(last.winner, -1);
});

import * as R from "../_lib/rules";
function await_import() {
  return R;
}

test("ký hiệu kiểu Việt Nam", () => {
  const b = initialBoard();
  assert.equal(notation(b, idx(7, 7), idx(4, 7)), "P2-5"); // pháo đầu
  assert.equal(notation(b, idx(7, 9), idx(6, 7)), "M2.3");
  assert.equal(notation(b, idx(1, 2), idx(4, 2)), "P2-5"); // đen cũng đếm từ phải của mình
  assert.equal(notation(b, idx(8, 9), idx(8, 8)), "X1.1");
  assert.deepEqual(notations([[idx(7, 7), idx(4, 7)], [idx(1, 0), idx(2, 2)]]), ["P2-5", "M2.3"]);
});
