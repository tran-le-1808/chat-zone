import { test } from "node:test";
import assert from "node:assert/strict";
import type { BallSpot, ShotResult } from "../_lib/physics/types";
import { POOL_TABLE as T } from "../_lib/physics/table";
import { applyDecision, newRack, resolveShot } from "../_lib/rules/engine";
import { legalTargets } from "../_lib/rules/common";
import type { RackState } from "../_lib/rules/types";

const NAMES: [string, string] = ["An", "Bình"];

/** Nhật ký cú đánh giả lập (luật chỉ đọc cấu trúc này) */
function result(p: Partial<ShotResult> & { final?: BallSpot[] }, before: BallSpot[]): ShotResult {
  const pocketed = p.pocketed ?? [];
  const gone = new Set(pocketed.map((x) => x.ball));
  return {
    firstHit: null,
    cushionAfterContact: [],
    objectBallsToCushion: [],
    offTable: [],
    scratch: gone.has(0),
    miscue: false,
    duration: 3,
    final: p.final ?? before.filter((b) => !gone.has(b.n)),
    ...p,
    pocketed,
  };
}

const spots = (ns: number[]): BallSpot[] =>
  ns.map((n, i) => ({ n, x: n === 0 ? -0.8 : 0.1 + (i % 5) * 0.12, y: -0.4 + Math.floor(i / 5) * 0.2 }));

function eightPlaying(over: Partial<RackState> = {}): RackState {
  return {
    ...newRack("eight", 0, 1),
    isBreak: false,
    ballInHand: null,
    balls: spots([0, 1, 2, 3, 8, 9, 10, 11]),
    ...over,
  };
}
function ninePlaying(over: Partial<RackState> = {}): RackState {
  return {
    ...newRack("nine", 0, 1),
    isBreak: false,
    ballInHand: null,
    balls: spots([0, 3, 4, 7, 9]),
    ...over,
  };
}

// ---------------------------- 8 BI ----------------------------

test("8 bi: bi 8 vào khi phá -> người phá chọn đặt lại bi 8 / xếp lại", () => {
  const r = newRack("eight", 0, 5);
  const v = resolveShot(r, {}, result({ firstHit: 1, pocketed: [{ ball: 8, pocket: 2 }] }, r.balls), NAMES);
  assert.equal(v.rack.winner, null);
  assert.deepEqual(v.rack.decision, { kind: "eightOnBreak", by: 0 });
  const d = applyDecision(v.rack, "spotAndContinue", NAMES).rack;
  assert.equal(d.turn, 0);
  assert.equal(d.isBreak, false);
  assert.equal(d.openTable, true);
  const eight = d.balls.find((b) => b.n === 8)!;
  assert.ok(Math.abs(eight.x - T.footSpot.x) < 0.1 && eight.y === 0, "bi 8 trên đường foot spot");
  const re = applyDecision(v.rack, "rerack", NAMES).rack;
  assert.equal(re.isBreak, true);
  assert.equal(re.breaker, 0);
  assert.equal(re.balls.length, 16);
});

test("8 bi: bi 8 vào khi phá kèm scratch -> đối thủ chọn (đặt lại + bi trong tay sau vạch)", () => {
  const r = newRack("eight", 0, 5);
  const v = resolveShot(
    r, {},
    result({ firstHit: 1, pocketed: [{ ball: 8, pocket: 2 }, { ball: 0, pocket: 0 }] }, r.balls),
    NAMES,
  );
  assert.deepEqual(v.rack.decision, { kind: "eightOnBreakScratch", by: 1 });
  const d = applyDecision(v.rack, "spotWithBallInHand", NAMES).rack;
  assert.equal(d.turn, 1);
  assert.equal(d.ballInHand, "kitchen");
  assert.ok(d.balls.some((b) => b.n === 8) && d.balls.some((b) => b.n === 0));
});

test("8 bi: scratch khi phá -> lỗi, bi đã vào giữ nguyên, đối thủ bi trong tay sau head string", () => {
  const r = newRack("eight", 0, 5);
  const v = resolveShot(
    r, {},
    result({ firstHit: 1, pocketed: [{ ball: 3, pocket: 0 }, { ball: 0, pocket: 1 }] }, r.balls),
    NAMES,
  );
  assert.ok(v.foul);
  assert.equal(v.rack.turn, 1);
  assert.equal(v.rack.ballInHand, "kitchen");
  assert.equal(v.rack.restrictToFrontOfHeadString, true);
  assert.equal(v.rack.openTable, true);
  assert.ok(!v.rack.balls.some((b) => b.n === 3), "bi 3 không được đặt lại");
});

test("8 bi: phá không hợp lệ (< 4 bi chạm băng, không bi vào) -> đối thủ chọn, không phải lỗi", () => {
  const r = newRack("eight", 0, 5);
  const v = resolveShot(r, {}, result({ firstHit: 1, objectBallsToCushion: [2, 3, 4] }, r.balls), NAMES);
  assert.equal(v.foul, null);
  assert.deepEqual(v.rack.decision, { kind: "illegalBreak", by: 1 });
  assert.equal(applyDecision(v.rack, "acceptTable", NAMES).rack.turn, 1);
  assert.equal(applyDecision(v.rack, "rerackSelfBreak", NAMES).rack.breaker, 1);
  assert.equal(applyDecision(v.rack, "rerackOpponentBreak", NAMES).rack.breaker, 0);
});

test("8 bi: bàn mở, chạm bi 8 trước -> lỗi, đối thủ bi trong tay", () => {
  const r = eightPlaying();
  const v = resolveShot(r, { call: { ball: 1, pocket: 0 } }, result({ firstHit: 8, cushionAfterContact: [8] }, r.balls), NAMES);
  assert.match(v.foul!, /bi 8/);
  assert.equal(v.rack.turn, 1);
  assert.equal(v.rack.ballInHand, "table");
  assert.ok(v.messages.some((m) => m.text.includes("Đối thủ") || m.text.includes("bi trong tay")));
});

test("8 bi: gọi bi vào sai lỗ -> hết lượt (không lỗi), bàn vẫn mở", () => {
  const r = eightPlaying();
  const v = resolveShot(r, { call: { ball: 2, pocket: 0 } }, result({ firstHit: 2, pocketed: [{ ball: 2, pocket: 5 }] }, r.balls), NAMES);
  assert.equal(v.foul, null);
  assert.equal(v.continues, false);
  assert.equal(v.rack.turn, 1);
  assert.equal(v.rack.openTable, true);
});

test("8 bi: gọi đúng bi trơn khi bàn mở -> chia nhóm, đánh tiếp", () => {
  const r = eightPlaying();
  const v = resolveShot(r, { call: { ball: 2, pocket: 0 } }, result({ firstHit: 2, pocketed: [{ ball: 2, pocket: 0 }] }, r.balls), NAMES);
  assert.equal(v.continues, true);
  assert.deepEqual(v.rack.groups, ["solids", "stripes"]);
  assert.equal(v.rack.openTable, false);
  assert.deepEqual(legalTargets(v.rack, 0), [1, 3]);
});

test("8 bi: bi 8 vào cùng scratch -> thua ván", () => {
  const r = eightPlaying({ openTable: false, groups: ["solids", "stripes"], balls: spots([0, 8, 9, 10]) });
  const v = resolveShot(
    r, { call: { ball: 8, pocket: 3 } },
    result({ firstHit: 8, pocketed: [{ ball: 8, pocket: 3 }, { ball: 0, pocket: 1 }] }, r.balls),
    NAMES,
  );
  assert.equal(v.rack.winner, 1);
});

test("8 bi: bi 8 vào khi chưa sạch nhóm -> thua; vào đúng lỗ gọi sau khi sạch nhóm -> thắng; sai lỗ -> thua", () => {
  const notCleared = eightPlaying({ openTable: false, groups: ["solids", "stripes"] });
  const lose = resolveShot(
    notCleared, { call: { ball: 1, pocket: 0 } },
    result({ firstHit: 1, pocketed: [{ ball: 8, pocket: 2 }] }, notCleared.balls),
    NAMES,
  );
  assert.equal(lose.rack.winner, 1);

  const cleared = eightPlaying({ openTable: false, groups: ["solids", "stripes"], balls: spots([0, 8, 9, 10]) });
  const win = resolveShot(cleared, { call: { ball: 8, pocket: 3 } }, result({ firstHit: 8, pocketed: [{ ball: 8, pocket: 3 }] }, cleared.balls), NAMES);
  assert.equal(win.rack.winner, 0);
  const wrong = resolveShot(cleared, { call: { ball: 8, pocket: 3 } }, result({ firstHit: 8, pocketed: [{ ball: 8, pocket: 4 }] }, cleared.balls), NAMES);
  assert.equal(wrong.rack.winner, 1);
});

test("8 bi: không bi nào chạm băng sau va chạm -> lỗi", () => {
  const r = eightPlaying();
  const v = resolveShot(r, { call: { ball: 1, pocket: 0 } }, result({ firstHit: 1 }, r.balls), NAMES);
  assert.match(v.foul!, /chạm băng/);
  assert.equal(v.rack.ballInHand, "table");
});

test("8 bi: sau scratch khi phá, nhắm bi nằm sau head string -> lỗi", () => {
  const balls: BallSpot[] = [{ n: 0, x: -0.9, y: 0 }, { n: 5, x: T.headStringX - 0.1, y: 0.3 }, { n: 6, x: 0.5, y: 0 }];
  const r = eightPlaying({ balls, restrictToFrontOfHeadString: true });
  const v = resolveShot(r, { call: { ball: 5, pocket: 0 } }, result({ firstHit: 5, cushionAfterContact: [5] }, balls), NAMES);
  assert.match(v.foul!, /vạch đầu bàn/);
});

test("8 bi: đánh phòng thủ (safety) -> bi vào không được đánh tiếp", () => {
  const r = eightPlaying({ openTable: false, groups: ["solids", "stripes"] });
  const v = resolveShot(r, { safety: true }, result({ firstHit: 1, pocketed: [{ ball: 1, pocket: 0 }] }, r.balls), NAMES);
  assert.equal(v.foul, null);
  assert.equal(v.rack.turn, 1);
});

// ---------------------------- 9 BI ----------------------------

test("9 bi: bi 9 vào khi phá hợp lệ -> thắng", () => {
  const r = newRack("nine", 0, 3);
  const v = resolveShot(r, {}, result({ firstHit: 1, pocketed: [{ ball: 9, pocket: 1 }] }, r.balls), NAMES);
  assert.equal(v.rack.winner, 0);
});

test("9 bi: phá không chạm bi 1 trước -> lỗi, bi trong tay toàn bàn", () => {
  const r = newRack("nine", 0, 3);
  const v = resolveShot(r, {}, result({ firstHit: 4, objectBallsToCushion: [1, 2, 3, 4, 5] }, r.balls), NAMES);
  assert.ok(v.foul);
  assert.equal(v.rack.ballInHand, "table");
  assert.equal(v.rack.pushOutAvailable, true);
});

test("9 bi: bi 9 vào kèm lỗi -> đặt lại bi 9 lên foot spot", () => {
  const r = ninePlaying();
  const v = resolveShot(
    r, {},
    result({ firstHit: 3, pocketed: [{ ball: 9, pocket: 2 }, { ball: 0, pocket: 1 }] }, r.balls),
    NAMES,
  );
  assert.equal(v.rack.winner, null);
  const nine = v.rack.balls.find((b) => b.n === 9);
  assert.ok(nine && nine.y === 0 && nine.x >= T.footSpot.x - 1e-9);
  assert.equal(v.rack.ballInHand, "table");
});

test("9 bi: combo hợp lệ đưa bi 9 vào -> thắng", () => {
  const r = ninePlaying();
  const v = resolveShot(r, {}, result({ firstHit: 3, pocketed: [{ ball: 9, pocket: 5 }] }, r.balls), NAMES);
  assert.equal(v.rack.winner, 0);
});

test("9 bi: chạm sai bi thấp nhất -> lỗi", () => {
  const r = ninePlaying();
  const v = resolveShot(r, {}, result({ firstHit: 4, cushionAfterContact: [4] }, r.balls), NAMES);
  assert.match(v.foul!, /bi 3/);
});

test("9 bi: push out rồi nhường lượt", () => {
  const r = ninePlaying({ pushOutAvailable: true });
  const v = resolveShot(r, { pushOut: true }, result({ firstHit: 7 }, r.balls), NAMES);
  assert.equal(v.foul, null, "push out không cần chạm bi thấp nhất / chạm băng");
  assert.deepEqual(v.rack.decision, { kind: "pushOutResponse", by: 1 });
  const back = applyDecision(v.rack, "passBack", NAMES).rack;
  assert.equal(back.turn, 0);
  assert.equal(back.decision, null);
  const shoot = applyDecision(v.rack, "shoot", NAMES).rack;
  assert.equal(shoot.turn, 1);
});

test("9 bi: 3 lỗi liên tiếp -> thua ván (cảnh báo ở lỗi thứ 2)", () => {
  let r = ninePlaying();
  const foulShot = () => result({ firstHit: null }, r.balls);
  let v = resolveShot(r, {}, foulShot(), NAMES);
  assert.deepEqual(v.rack.fouls, [1, 0]);
  // Đối thủ đánh hợp lệ nhưng không vào -> trả lượt
  r = { ...v.rack, turn: 0, ballInHand: "table" };
  v = resolveShot(r, {}, foulShot(), NAMES);
  assert.equal(v.rack.fouls[0], 2);
  assert.ok(v.messages.some((m) => m.tone === "warn" && m.text.includes("2 lỗi")));
  r = { ...v.rack, turn: 0 };
  v = resolveShot(r, {}, foulShot(), NAMES);
  assert.equal(v.rack.winner, 1);
});

test("9 bi: cú đánh hợp lệ xoá chuỗi lỗi", () => {
  const r = ninePlaying({ fouls: [2, 0] });
  const v = resolveShot(r, {}, result({ firstHit: 3, cushionAfterContact: [3] }, r.balls), NAMES);
  assert.deepEqual(v.rack.fouls, [0, 0]);
});

test("9 bi: không băng sau va chạm -> lỗi", () => {
  const r = ninePlaying();
  const v = resolveShot(r, {}, result({ firstHit: 3 }, r.balls), NAMES);
  assert.match(v.foul!, /chạm băng/);
});

// ---------------------- BI VĂNG KHỎI BÀN (jump shot) ----------------------

/** Nhật ký cú đánh có bi văng khỏi bàn: bi đó không còn trong `final` */
const offTableResult = (before: BallSpot[], off: number[], p: Partial<ShotResult> = {}) =>
  result({ ...p, offTable: off, final: before.filter((b) => !off.includes(b.n)) }, before);

test("8 bi: bi 8 văng khỏi bàn khi phá -> như bi 8 vào lỗ: người phá chọn đặt lại / xếp lại", () => {
  const r = newRack("eight", 0, 5);
  const v = resolveShot(r, {}, offTableResult(r.balls, [8], { firstHit: 1 }), NAMES);
  assert.deepEqual(v.rack.decision, { kind: "eightOnBreak", by: 0 });
  assert.equal(v.rack.winner, null);
  const d = applyDecision(v.rack, "spotAndContinue", NAMES).rack;
  assert.ok(d.balls.some((b) => b.n === 8), "bi 8 được đặt lại");
});

test("8 bi: làm bi 8 văng khỏi bàn khi đang chơi -> thua ván", () => {
  const r = eightPlaying({ openTable: false, groups: ["solids", "stripes"], balls: spots([0, 1, 2, 8, 9, 10]) });
  const v = resolveShot(r, { call: { ball: 1, pocket: 0 } }, offTableResult(r.balls, [8], { firstHit: 1, cushionAfterContact: [1] }), NAMES);
  assert.equal(v.rack.winner, 1);
  assert.match(v.rack.winReason ?? "", /văng khỏi bàn/);
});

test("8 bi: bi thường / bi cái văng khỏi bàn -> lỗi, đối thủ bi trong tay, bi văng không được đặt lại", () => {
  const r = eightPlaying({ openTable: false, groups: ["solids", "stripes"] });
  const obj = resolveShot(r, { call: { ball: 1, pocket: 0 } }, offTableResult(r.balls, [10], { firstHit: 1, cushionAfterContact: [1] }), NAMES);
  assert.match(obj.foul!, /văng khỏi bàn/);
  assert.equal(obj.rack.ballInHand, "table");
  assert.ok(!obj.rack.balls.some((b) => b.n === 10));
  const cue = resolveShot(r, { call: { ball: 1, pocket: 0 } }, offTableResult(r.balls, [0], { firstHit: 1 }), NAMES);
  assert.match(cue.foul!, /văng khỏi bàn/);
  assert.equal(cue.rack.turn, 1);
  assert.ok(cue.rack.balls.some((b) => b.n === 0), "bi cái được đặt lại trong tay để đối thủ kéo thả");
});

test("9 bi: bi 9 văng khỏi bàn -> lỗi và bi 9 được đặt lại; bi khác văng thì không đặt lại", () => {
  const r = ninePlaying();
  const nine = resolveShot(r, {}, offTableResult(r.balls, [9], { firstHit: 3, cushionAfterContact: [3] }), NAMES);
  assert.ok(nine.foul);
  assert.equal(nine.rack.winner, null, "bi 9 văng không phải thắng");
  const spot = nine.rack.balls.find((b) => b.n === 9)!;
  assert.ok(spot && spot.y === 0 && spot.x >= T.footSpot.x - 1e-9, "đặt lại trên foot spot");
  assert.equal(nine.rack.ballInHand, "table");
  const seven = resolveShot(r, {}, offTableResult(r.balls, [7], { firstHit: 3, cushionAfterContact: [3] }), NAMES);
  assert.ok(seven.foul);
  assert.ok(!seven.rack.balls.some((b) => b.n === 7));
});
