import { test } from "node:test";
import assert from "node:assert/strict";
import { POOL_PHYSICS as C, POOL_TABLE as T, simulateShot, type BallSpot, type ShotCommand } from "../_lib/physics/index";
import { newRack, resolvePractice, resolveShot } from "../_lib/rules/engine";
import { offTableText } from "../_lib/rules/common";
import { isValidCuePlacement } from "../_lib/rules/rack";
import type { RackState } from "../_lib/rules/types";

const NAMES: [string, string] = ["An", "Bình"];
const pocketName = (id: number) => T.pockets[id].name.toLowerCase();
const jumpOut: ShotCommand = { dirX: 1, dirY: 0, power: 1, tipX: 0, tipY: 0, elevation: 55 };

/** Bàn giữa ván: bi cái gần băng phải, vài bi khác rải rác */
const midGame = (type: "eight" | "nine"): RackState => ({
  ...newRack(type, 0, 3),
  isBreak: false,
  ballInHand: null,
  balls: [
    { n: 0, x: 0.95, y: 0 },
    { n: 1, x: -0.4, y: 0.3 },
    { n: 3, x: -0.1, y: -0.35 },
    { n: 8, x: 0.3, y: 0.25 },
    { n: 9, x: -0.7, y: -0.1 },
    { n: 11, x: 0.1, y: 0.5 },
  ],
});

test("Mô phỏng thật: bi cái bay khỏi bàn -> sự kiện offtable có vị trí, vận tốc, độ cao; bi không còn trong ván", () => {
  const r = midGame("eight");
  const tr = simulateShot(r.balls, jumpOut);
  assert.deepEqual(tr.result.offTable, [0]);
  assert.ok(!tr.result.final.some((b) => b.n === 0));
  const ev = tr.events.find((e) => e.type === "offtable");
  assert.ok(ev && ev.type === "offtable");
  if (ev.type !== "offtable") return;
  assert.ok(ev.vx > 0 && ev.h >= C.cushionHeight - 1e-6, "vượt băng ở độ cao ≥ mũi băng");
  assert.ok(Math.abs(ev.x) >= T.L / 2 - 1e-6, "tâm bi đã qua đường mũi băng");
});

test("TẬP LUYỆN: bi cái văng khỏi bàn luôn quay lại để đặt (bi trong tay), không mất luôn", () => {
  const r = midGame("eight");
  const res = simulateShot(r.balls, jumpOut).result;
  assert.deepEqual(res.offTable, [0]);
  const out = resolvePractice(r, res, pocketName);
  const cue = out.rack.balls.find((b) => b.n === 0);
  assert.ok(cue, "bi cái phải có mặt trên bàn để đặt lại");
  assert.equal(out.rack.ballInHand, "table");
  assert.equal(out.rack.balls.length, r.balls.length, "không bi nào bị mất");
  assert.ok(isValidCuePlacement(out.rack.balls.filter((b) => b.n !== 0), cue.x, cue.y, false), "vị trí đặt sẵn hợp lệ");
  assert.ok(out.messages.some((m) => m.tone === "foul" && /Bi cái văng khỏi bàn/.test(m.text)));
});

test("TẬP LUYỆN: bi khác văng khỏi bàn được đặt lại lên bàn; bi vào lỗ thì vẫn bỏ ra; đánh thường không đổi", () => {
  const r = midGame("eight");
  const ghost: BallSpot[] = r.balls.filter((b) => b.n !== 11);
  const out = resolvePractice(r, { firstHit: 3, pocketed: [{ ball: 9, pocket: 1 }], cushionAfterContact: [], objectBallsToCushion: [], offTable: [11], scratch: false, miscue: false, final: ghost.filter((b) => b.n !== 9), duration: 3 }, pocketName);
  assert.ok(out.rack.balls.some((b) => b.n === 11), "bi 11 văng ra được đặt lại");
  assert.ok(!out.rack.balls.some((b) => b.n === 9), "bi 9 vào lỗ thì bỏ ra (mục tiêu tập luyện)");
  assert.equal(out.rack.ballInHand, null, "bi cái còn trên bàn: tiếp tục đánh");
  assert.ok(out.rack.balls.some((b) => b.n === 0));
  // Cú đánh thường: không bi nào bị thêm / mất
  const calm = simulateShot(r.balls, { dirX: -1, dirY: 0.2, power: 0.3, tipX: 0, tipY: 0, elevation: 0 }).result;
  const same = resolvePractice(r, calm, pocketName);
  assert.equal(same.rack.ballInHand, null);
  assert.ok(same.rack.balls.every((b) => r.balls.some((o) => o.n === b.n)));
});

for (const type of ["eight", "nine"] as const) {
  test(`THI ĐẤU ${type === "eight" ? "8" : "9"} bi: bi cái văng khỏi bàn -> lỗi, bi cái quay lại bàn cho đối thủ đặt (bi trong tay), thông báo nêu rõ bi nào`, () => {
    const r = midGame(type);
    if (type === "eight") {
      r.openTable = false;
      r.groups = ["solids", "stripes"];
    }
    const res = simulateShot(r.balls, jumpOut).result;
    const decl = type === "eight" ? { call: { ball: 1, pocket: 0 } } : {};
    const v = resolveShot(r, decl, res, NAMES);
    assert.ok(v.foul && /bi cái văng khỏi bàn/i.test(v.foul), v.foul ?? "không có lỗi");
    assert.equal(v.rack.turn, 1);
    assert.equal(v.rack.ballInHand, "table");
    const cue = v.rack.balls.find((b) => b.n === 0);
    assert.ok(cue, "bi cái phải quay lại bàn");
    assert.ok(isValidCuePlacement(v.rack.balls.filter((b) => b.n !== 0), cue.x, cue.y, false));
    assert.ok(v.messages.some((m) => /văng khỏi bàn/.test(m.text) && /bi trong tay/.test(m.text)));
  });
}

test("Thông báo nêu đúng bi văng khỏi bàn", () => {
  assert.equal(offTableText({ offTable: [0] }), "Bi cái văng khỏi bàn");
  assert.equal(offTableText({ offTable: [3, 7] }), "Bi 3, 7 văng khỏi bàn");
  assert.equal(offTableText({ offTable: [0, 5] }), "Bi cái và bi 5 văng khỏi bàn");
});
