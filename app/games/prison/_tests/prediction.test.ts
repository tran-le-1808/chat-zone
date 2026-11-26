import { test } from "node:test";
import assert from "node:assert/strict";
import { createOutbox, movementModifiers, playerSolid, runTick, type MoveInput } from "../_lib/engine";
import { ClockSync, InterpolationBuffer, LocalPredictor } from "../_lib/net/prediction";
import { flags, makeWorld, noGuards } from "./helpers";

/** Giống client thật: hệ số lấy từ chỉ số người chơi do server gửi */
const ctxFor = (s = { hunger: 20, fitness: 0, stamina: 5, agility: 5 }) => ({
  solid: playerSolid(flags()),
  role: "HACKER" as const,
  ...movementModifiers(s),
});

test("prediction khớp server khi không mất gói: sai số 0 sau reconcile", () => {
  const w = makeWorld(1);
  noGuards(w);
  w.players.p1.role = "HACKER";
  const p = w.players.p1;
  const pred = new LocalPredictor();
  pred.state = { x: p.x, y: p.y, facing: p.facing, energy: p.stats.energy };
  const o = createOutbox();
  const sent: MoveInput[] = [];
  for (let i = 0; i < 60; i++) {
    const inp = pred.makeInput(i < 30 ? 0.3 : 1, 1, i % 3 === 0);
    pred.applyLocal(ctxFor(), inp);
    sent.push(inp);
  }
  // server nhận trễ: mới xử lý 40 input đầu
  for (const inp of sent.slice(0, 40)) runTick(w, o, new Map([["p1", [inp]]]));
  const err = pred.reconcile(ctxFor(), { x: p.x, y: p.y, facing: p.facing, energy: p.stats.energy, lastSeq: p.lastSeq }, true);
  assert.equal(pred.pendingCount, 20);
  // server bù năng lượng hồi khi không chạy -> sai số vị trí vẫn 0 (năng lượng còn dư)
  assert.ok(err < 1e-6, `err=${err}`);
});

test("reconcile: server dịch chuyển (bị bắt) -> nhảy thẳng, không kéo lệch hiển thị", () => {
  const pred = new LocalPredictor();
  pred.state = { x: 10, y: 8, facing: 0, energy: 100 };
  pred.applyLocal(ctxFor(), pred.makeInput(1, 0, false));
  const err = pred.reconcile(ctxFor(), { x: 20, y: 4, facing: 0, energy: 100, lastSeq: 1 }, false);
  assert.ok(err > 2.5);
  assert.deepEqual(pred.visualOffset, { x: 0, y: 0 });
  assert.equal(pred.state?.x, 20);
});

test("sequence sau khi kết nối lại luôn lớn hơn lastSeq của server", () => {
  const pred = new LocalPredictor();
  pred.syncSequence(500);
  assert.equal(pred.makeInput(0, 1, false).sequence, 501);
});

test("nội suy: giữa 2 mẫu, gói đến muộn bị bỏ, không ngoại suy", () => {
  const b = new InterpolationBuffer();
  b.push("g", 1000, { x: 0, y: 0, facing: 0 });
  b.push("g", 1100, { x: 1, y: 2, facing: 0 });
  b.push("g", 1050, { x: 99, y: 99, facing: 0 });
  assert.deepEqual(b.sample("g", 1050), { x: 0.5, y: 1, facing: 0 });
  assert.deepEqual(b.sample("g", 5000), { x: 1, y: 2, facing: 0 });
  assert.equal(b.sample("x", 1), null);
});

test("đồng bộ đồng hồ chọn mẫu ít trễ nhất", () => {
  const c = new ClockSync();
  c.update(10_000, 1_000); // offset 9000 (trễ cao)
  c.update(10_200, 1_150); // offset 9050
  assert.equal(c.offset, 9050);
  assert.equal(c.serverNow(2000), 11050);
});
