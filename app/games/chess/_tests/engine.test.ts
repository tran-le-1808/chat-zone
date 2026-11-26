/** Engine cờ vua: thấy chiếu hết 1 nước, ăn quân treo, chạy trong giới hạn thời gian */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMove, newGame } from "../_lib/rules";
import { engineMove } from "../_lib/engine/search";

test("thấy chiếu hết 1 nước (mạt hàng cuối)", () => {
  const g = newGame("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
  const r = engineMove(g, { level: "hard", timeMs: 400 });
  assert.ok(r);
  const a = applyMove(g, r!.move[0], r!.move[1], r!.move[2]);
  assert.ok(a.ok && a.state.winner === 1);
});

test("ăn hậu treo", () => {
  const g = newGame("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1");
  const r = engineMove(g, { level: "medium", timeMs: 300 });
  assert.ok(r && r.score > 500, `điểm ${r?.score}`);
});

test("thế ban đầu: mức Cao thủ trả nước hợp lệ trong thời gian cho phép", () => {
  const g = newGame();
  const t = Date.now();
  const r = engineMove(g, { level: "master", timeMs: 1500 });
  const ms = Date.now() - t;
  assert.ok(r && applyMove(g, r.move[0], r.move[1], r.move[2]).ok);
  assert.ok(ms < 2500, `nghĩ ${ms}ms`);
  console.log(`  độ sâu ${r!.depth}, ${r!.nodes} nút, ${ms}ms`);
});
