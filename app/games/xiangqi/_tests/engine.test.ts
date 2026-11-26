/** Engine cờ tướng: thấy chiếu bí 1 nước, không bỏ quân vô ích, chạy trong giới hạn thời gian */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMove, idx, KING, newGame, positionKey, ROOK, CANNON, type Side, type XqState } from "../_lib/rules";
import { engineMove } from "../_lib/engine/search";

function custom(pieces: [number, number, number][], turn: Side = 1): XqState {
  const board = new Array(90).fill(0);
  for (const [x, y, p] of pieces) board[idx(x, y)] = p;
  return { ...newGame(), board, turn, history: [positionKey(board, turn)] };
}

test("thấy nước chiếu bí ngay", () => {
  const g = custom([[4, 9, KING], [3, 0, -KING], [0, 2, ROOK], [8, 1, ROOK]]);
  const r = engineMove(g, { level: "hard", timeMs: 500 });
  assert.ok(r);
  const after = applyMove(g, r!.move[0], r!.move[1]);
  assert.ok(after.ok && after.state.winner === 1);
});

test("ăn xe được treo miễn phí (hoặc đòn khác thắng xe)", () => {
  // xe đen ở (4,4) không được bảo vệ, xe đỏ (4,7) ăn được
  const g = custom([[3, 9, KING], [5, 0, -KING], [4, 7, ROOK], [4, 4, -ROOK], [0, 0, -CANNON]]);
  const r = engineMove(g, { level: "hard", timeMs: 400 });
  assert.ok(r && r.score > 300, `điểm ${r?.score}`);
  // chỉ còn xe đen để ăn: đánh giá phải thấy lợi thế sau khi ăn
  const direct = engineMove(custom([[3, 9, KING], [5, 0, -KING], [4, 7, ROOK], [4, 4, -ROOK]]), { level: "hard", timeMs: 300 });
  assert.ok(direct && direct.score > 300);
});

test("thế ban đầu: mức Cao thủ trả nước hợp lệ trong thời gian cho phép", () => {
  const g = newGame();
  const t = Date.now();
  const r = engineMove(g, { level: "master", timeMs: 1500 });
  const ms = Date.now() - t;
  assert.ok(r);
  assert.ok(applyMove(g, r!.move[0], r!.move[1]).ok);
  assert.ok(ms < 2500, `nghĩ ${ms}ms`);
  console.log(`  độ sâu ${r!.depth}, ${r!.nodes} nút, ${ms}ms`);
});
