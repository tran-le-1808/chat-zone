/** Tự luyện & đấu bot: trận cục bộ theo đúng luật server, đặt bi, đánh lại, bot tìm cú bằng physics thật */
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPositions, judgeShot, simulateShot, type BallPositions } from "../_lib/physics";
import { LocalCaromMatch, PRACTICE_TARGET, SETTLE_MS, validPlacement } from "../_lib/practice/localMatch";
import { chooseBotShot } from "../_lib/practice/bot";

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}
const SCORE: BallPositions = [[-0.4, 0], [0.1, 0], [0.6, 0.01]];
const scoreShot = { dirX: 1, dirY: 0, power: 0.6, tipX: 0, tipY: 0.95, elevation: 5 };
const missShot = { dirX: 0, dirY: 1, power: 0.2, tipX: 0, tipY: 0, elevation: 5 };

test("trận cục bộ: kết quả cú đánh = simulateShot + judgeShot (giống server), bận tới khi bi dừng + 700 ms", () => {
  const c = clock();
  const m = new LocalCaromMatch({ kind: "practice", mode: "free", target: 10, me: "u1", now: c.now });
  assert.equal(m.setLayout(SCORE), true);
  const r = m.shoot(scoreShot, 0);
  assert.equal(r.ok, true, r.error);
  const sim = simulateShot(SCORE, { ...scoreShot, cue: 0 }, undefined, { recordFrames: true });
  assert.deepEqual(m.match.balls, sim.final);
  assert.equal(m.match.lastShot?.verdict.scored, judgeShot(sim.events, 0, { mode: "free" }).scored);
  assert.equal(m.match.busyUntil, c.now() + Math.ceil(sim.duration * 1000) + SETTLE_MS);
  assert.equal(m.shoot(scoreShot, 0).error, "Bi vẫn đang lăn");
  assert.equal(m.match.target, PRACTICE_TARGET, "tự luyện không có mục tiêu điểm");
});

test("tự luyện: hụt không mất lượt; đặt bi hợp lệ / từ chối chồng bi, ngoài bàn; đánh lại khôi phục thế bi + điểm", () => {
  const c = clock();
  const m = new LocalCaromMatch({ kind: "practice", mode: "free", target: 10, me: "u1", now: c.now });
  const before = m.match.balls.map(([x, y]) => [x, y]);
  assert.equal(m.shoot(missShot, 0).ok, true);
  assert.equal(m.match.turn, 0, "tự luyện: vẫn lượt mình");
  assert.equal(m.placeBall(2, 0, 0), false, "đang lăn thì không đặt bi");
  c.advance(60_000);
  assert.equal(m.undo(), true);
  assert.deepEqual(m.match.balls, before);
  assert.equal(m.match.stats[0].shots, 0);
  assert.equal(m.placeBall(2, 0.3, 0.2), true);
  assert.deepEqual(m.match.balls[2], [0.3, 0.2]);
  assert.equal(m.placeBall(2, m.match.balls[1][0] + 0.01, m.match.balls[1][1]), false, "chồng lên bi vàng");
  assert.equal(m.placeBall(1, 5, 0), true, "ngoài bàn: kẹp vào trong mép");
  assert.ok(Math.abs(m.match.balls[1][0]) < 1.42);
  assert.equal(validPlacement(m.match.balls, 0, 0.3, 0.2), false);
  m.setCueBall(1);
  assert.equal(m.match.turn, 1, "chọn bi vàng làm bi cái");
  const seq = m.match.seq;
  assert.equal(m.setLayout([[0, 0], [0, 0], [0.5, 0]]), false, "thế bi lỗi bị từ chối");
  assert.equal(m.match.seq, seq);
});

test("đấu bot: ghi điểm đánh tiếp, hụt sang lượt bot; đủ điểm thì thắng; chặn đánh sai lượt", () => {
  const c = clock();
  const m = new LocalCaromMatch({ kind: "bot", mode: "free", target: 1, me: "u1", bot: "bot", now: c.now });
  assert.deepEqual(m.match.players, ["u1", "bot"]);
  assert.equal(m.shoot(missShot, 1).error, "Chưa tới lượt");
  assert.equal(m.shoot(missShot, 0).ok, true);
  assert.equal(m.match.turn, 1, "hụt -> sang bot");
  assert.equal(m.match.stats[1].innings, 1);
  c.advance(60_000);
  // bot ghi 1 điểm (đặt thế bi cho bi vàng là bi cái): thắng vì mục tiêu = 1
  const m2 = new LocalCaromMatch({ kind: "bot", mode: "free", target: 1, me: "u1", now: c.now });
  m2.match = { ...m2.match, balls: SCORE };
  assert.equal(m2.shoot(scoreShot, 0).ok, true);
  if (m2.match.lastShot?.verdict.scored) {
    assert.equal(m2.match.winner, 0);
    assert.equal(m2.shoot(scoreShot, 0).error, "Trận đấu đã kết thúc");
  }
});

test("bot: chỉ đề xuất cú đã mô phỏng; không run tay thì cú dự định ghi điểm; cấp khó ổn định hơn cấp dễ", async () => {
  const hard = await chooseBotShot(SCORE, 0, "free", "hard", 3, { noise: 0 });
  assert.ok(hard);
  assert.equal(hard.foundScoring, true);
  const sim = simulateShot(SCORE, hard.planned);
  assert.equal(judgeShot(sim.events, 0, { mode: "free" }).scored, true, "cú dự định ghi điểm trong physics");
  assert.deepEqual(hard.shot, hard.planned, "noise = 0 -> đánh đúng cú dự định");
  // cấp khó trúng nhiều hơn cấp dễ trên cùng thế bi khai cuộc (có run tay)
  const start = initialPositions();
  const rate = async (lv: "easy" | "hard") => {
    let ok = 0;
    for (let s = 1; s <= 6; s++) {
      const b = await chooseBotShot(start, 0, "free", lv, s);
      if (b && judgeShot(simulateShot(start, b.shot).events, 0, { mode: "free" }).scored) ok++;
    }
    return ok;
  };
  const [e, h] = [await rate("easy"), await rate("hard")];
  assert.ok(h >= e, `khó ${h}/6 >= dễ ${e}/6`);
  const ctl = new AbortController();
  ctl.abort();
  assert.equal(await chooseBotShot(start, 0, "free", "hard", 1, { signal: ctl.signal }), null, "huỷ được");
});
