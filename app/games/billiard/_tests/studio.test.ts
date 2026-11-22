/** AI Shot Studio: tìm cú đánh bằng physics thật, xác minh kỹ thuật, xếp hạng, lời bình đúng sự thật, trình tự video */
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPositions, simulateShot, type BallPositions } from "../_lib/physics";
import {
  analyzeShot,
  buildNarration,
  buildSequence,
  generateCandidates,
  goalCheck,
  randomLayout,
  SCENARIO_LIBRARY,
  searchShots,
  spinSentence,
  toSRT,
  toWebVTT,
  totalDuration,
  validateSetup,
} from "../_lib/studio";

test("thư viện: mọi thế bi hợp lệ (trong bàn, không chồng); thế bi ngẫu nhiên tất định theo seed", () => {
  for (const s of SCENARIO_LIBRARY) assert.equal(validateSetup(s.positions), null, s.id);
  assert.deepEqual(randomLayout(5), randomLayout(5));
  assert.notDeepEqual(randomLayout(5), randomLayout(6));
  assert.equal(validateSetup(randomLayout(9)), null);
  assert.ok(validateSetup([[0, 0], [0.01, 0], [0.5, 0]]), "chồng bi bị từ chối");
  assert.ok(validateSetup([[2, 0], [0.3, 0], [0.5, 0]]), "ngoài bàn bị từ chối");
});

test("phân tích = đúng kết quả simulateShot (không bịa): vị trí cuối, sự kiện, thời lượng", () => {
  const start = initialPositions();
  const shot = { cue: 0 as const, dirX: 1, dirY: 0.12, power: 0.55, tipX: 0, tipY: 0.4, elevation: 3 };
  const a = analyzeShot(start, shot);
  const sim = simulateShot(start, shot, undefined, { recordFrames: true });
  assert.deepEqual(a.final, sim.final);
  assert.deepEqual(a.events, sim.events);
  assert.equal(a.duration, sim.duration);
  assert.equal(a.cueCushions, a.contacts.filter((c) => c.kind === "cushion" && c.ball === 0).length);
});

test("draw / follow / stun đo từ chuyển động thật của bi cái sau va chạm", () => {
  const start: BallPositions = [[-0.4, 0], [0.1, 0], [1.0, 0.5]];
  const draw = analyzeShot(start, { cue: 0, dirX: 1, dirY: 0, power: 0.7, tipX: 0, tipY: -0.95, elevation: 3 });
  assert.equal(draw.spinEffect, "DRAW", "đánh dưới tâm thẳng -> bi cái lùi");
  assert.ok((draw.cutAngleDeg ?? 99) < 5);
  const follow = analyzeShot(start, { cue: 0, dirX: 1, dirY: 0, power: 0.5, tipX: 0, tipY: 0.95, elevation: 3 });
  assert.equal(follow.spinEffect, "FOLLOW");
  // lời bình: chỉ nói "spin dưới" khi đánh dưới tâm VÀ mô phỏng xác nhận
  assert.match(spinSentence({ cue: 0, dirX: 1, dirY: 0, power: 0.7, tipX: 0, tipY: -0.95, elevation: 3 }, draw) ?? "", /Spin dưới/);
  assert.doesNotMatch(spinSentence({ cue: 0, dirX: 1, dirY: 0, power: 0.5, tipX: 0, tipY: 0, elevation: 3 }, follow) ?? "", /Spin trên/, "đánh giữa tâm thì không nói spin trên");
});

test("goalCheck loại cú không ghi điểm và cú sai kỹ thuật", () => {
  const start: BallPositions = [[-0.4, 0], [0.1, 0], [1.0, 0.5]];
  const miss = { cue: 0 as const, dirX: 0, dirY: 1, power: 0.3, tipX: 0, tipY: 0, elevation: 3 };
  assert.ok(goalCheck("STRAIGHT", miss, analyzeShot(start, miss)));
  const draw = { cue: 0 as const, dirX: 1, dirY: 0, power: 0.7, tipX: 0, tipY: -0.95, elevation: 3 };
  const a = analyzeShot(start, draw);
  assert.ok(goalCheck("FOLLOW", draw, a), "cú draw không được tính là follow");
});

test("tìm kiếm: chỉ trả cú hợp lệ (mô phỏng lại vẫn đạt mục tiêu), tất định theo seed, không sửa thế bi gốc", async () => {
  const s = SCENARIO_LIBRARY.find((x) => x.id === "follow-through")!;
  const start = s.positions.map(([x, y]) => [x, y]) as BallPositions;
  const before = JSON.stringify(start);
  const r1 = await searchShots(start, 0, { category: "FOLLOW", preset: "EASY_AND_CLEAR", seed: 11, maxSimulations: 500 });
  const r2 = await searchShots(start, 0, { category: "FOLLOW", preset: "EASY_AND_CLEAR", seed: 11, maxSimulations: 500 });
  assert.equal(JSON.stringify(start), before, "thế bi gốc không bị sửa");
  assert.ok(r1.candidates.length > 0, "tìm được cú follow");
  assert.deepEqual(r1.candidates.map((c) => c.shot), r2.candidates.map((c) => c.shot), "tất định");
  assert.ok(r1.rejected > 0, "có cú bị loại");
  for (const c of r1.candidates) {
    const again = analyzeShot(start, c.shot);
    assert.equal(goalCheck("FOLLOW", c.shot, again), null, "xác minh lại bằng physics");
    assert.deepEqual(again.final, c.analysis.final);
    assert.ok(c.breakdown.repeatability >= 0 && c.breakdown.repeatability <= 1);
  }
  assert.ok(r1.candidates.every((c, i, arr) => i === 0 || arr[i - 1].shot !== c.shot), "không trùng");
});

test("tìm kiếm: huỷ được (AbortSignal), có giới hạn thời gian, báo tiến độ; thế bi lỗi thì báo lỗi, không bịa kết quả", async () => {
  const ctl = new AbortController();
  const stages: string[] = [];
  const p = searchShots(initialPositions(), 0, { category: "CUSHION", preset: "ARTISTIC", seed: 3, signal: ctl.signal, sliceMs: 1, onProgress: (x) => stages.push(x.stage) });
  setTimeout(() => ctl.abort(), 30);
  const r = await p;
  assert.equal(r.cancelled, true);
  assert.ok(stages.length > 0);
  const t = await searchShots(initialPositions(), 0, { category: "ARTISTIC", preset: "ARTISTIC", seed: 3, timeBudgetMs: 50 });
  assert.equal(t.timedOut, true);
  const bad = await searchShots([[0, 0], [0, 0], [0.5, 0]], 0, { category: "STRAIGHT", preset: "TECHNICAL", seed: 1 });
  assert.ok(bad.error);
  assert.equal(bad.candidates.length, 0);
});

test("mỗi kịch bản trong thư viện đều tìm được ít nhất 1 cú đạt mục tiêu bằng physics thật", async () => {
  for (const s of SCENARIO_LIBRARY) {
    const r = await searchShots(s.positions, 0, { category: s.category, difficulty: s.difficulty, preset: "TECHNICAL", seed: 7, maxSimulations: 1400, timeBudgetMs: 60000, count: 2 });
    assert.ok(r.candidates.length > 0, `${s.id}: không tìm được (${r.evaluated} mô phỏng)`);
  }
});

test("lời bình + phụ đề: theo mốc sự kiện thật của cú đánh, không chồng lấn, xuất WebVTT / SRT", async () => {
  const s = SCENARIO_LIBRARY.find((x) => x.id === "one-cushion")!;
  const r = await searchShots(s.positions, 0, { category: "CUSHION", difficulty: "BEGINNER", preset: "EASY_AND_CLEAR", seed: 2, maxSimulations: 900 });
  const c = r.candidates[0];
  assert.ok(c);
  const scenes = buildSequence({ mode: "CINEMATIC", shotDuration: c.analysis.duration, replay: true });
  assert.deepEqual(scenes.map((x) => x.id), ["intro", "setup", "aim", "shot", "replay", "result"]);
  assert.ok(totalDuration(scenes) > c.analysis.duration);
  for (const style of ["COACH", "SPORTS_COMMENTATOR", "CALM_ANALYST", "SHORTS", "CINEMATIC"] as const) {
    const n = buildNarration({ title: s.title, category: "CUSHION", shot: c.shot, analysis: c.analysis, scenes, style });
    assert.ok(n.segments.length >= 4, style);
    for (let i = 1; i < n.segments.length; i++) assert.ok(n.segments[i].start >= n.segments[i - 1].end - 1e-6 || n.segments[i].scene === "result", `${style}: chồng lấn`);
    // không nói "draw"/"spin dưới" khi không đánh dưới tâm
    if (c.shot.tipY > -0.3) assert.ok(!n.segments.some((x) => /spin dưới|lùi lại/i.test(x.text)), style);
    const shotScene = scenes.find((x) => x.id === "shot")!;
    const firstHit = c.analysis.contacts.find((x) => x.kind === "ball" && x.ball === 0)!;
    if (style === "COACH") assert.ok(n.segments.some((x) => Math.abs(x.start - (shotScene.start + firstHit.t)) < 1.5), "bình luận lần chạm đầu đúng lúc");
  }
  const n = buildNarration({ title: s.title, category: "CUSHION", shot: c.shot, analysis: c.analysis, scenes, style: "COACH" });
  assert.match(toWebVTT(n.segments), /^WEBVTT\n\n1\n00:00:00\.\d{3} --> /);
  assert.match(toSRT(n.segments), /^1\n00:00:00,\d{3} --> /);
});

test("bộ sinh ứng viên: mọi lệnh đánh đều qua kiểm tra như server (hướng, lực 0–1, điểm chạm trong vòng tròn)", () => {
  for (const cat of ["STRAIGHT", "CUT", "FOLLOW", "DRAW", "STUN", "ENGLISH", "CUSHION", "POSITION", "ARTISTIC", "CHALLENGE"] as const) {
    const list = generateCandidates(cat, initialPositions(), 0, 1);
    assert.ok(list.length > 20, cat);
    for (const s of list) {
      assert.ok(s.power > 0 && s.power <= 1);
      assert.ok(Math.hypot(s.tipX, s.tipY) <= 1 + 1e-9);
      assert.ok(Math.abs(Math.hypot(s.dirX, s.dirY) - 1) < 1e-9);
    }
  }
});

import { compareOutcome, eventsBetween, frameAt, pathUntil, physicsTimeAt, techniqueLabels } from "../_lib/studio";

test("điều phối video: đúng cảnh, thời gian physics (quay chậm theo tỉ lệ), vị trí bi lấy từ quỹ đạo thật", () => {
  const start: BallPositions = [[-0.4, 0], [0.1, 0], [1.0, 0.5]];
  const shot = { cue: 0 as const, dirX: 1, dirY: 0, power: 0.7, tipX: 0, tipY: -0.95, elevation: 3 };
  const a = analyzeShot(start, shot);
  const scenes = buildSequence({ mode: "CINEMATIC", shotDuration: a.duration, replay: true, replayRate: 0.5 });
  const shotScene = scenes.find((x) => x.id === "shot")!;
  const replay = scenes.find((x) => x.id === "replay")!;
  assert.ok(Math.abs(physicsTimeAt(shotScene, shotScene.start + 1.2, a.duration)! - 1.2) < 1e-9);
  assert.ok(Math.abs(physicsTimeAt(replay, replay.start + 2, a.duration)! - 1) < 1e-9);
  assert.equal(physicsTimeAt(scenes[0], 0.5, a.duration), null);
  // trước cú đánh: bi ở thế ban đầu; kết quả: bi ở vị trí cuối của physics
  const f0 = frameAt(scenes, a, 0.1);
  assert.deepEqual(f0.balls.map((b) => [b.x, b.y]), start);
  const fEnd = frameAt(scenes, a, totalDuration(scenes) - 0.1);
  assert.equal(fEnd.scene?.id, "result");
  assert.deepEqual(fEnd.balls.map((b) => [b.x, b.y]), a.final);
  // âm thanh: mọi sự kiện được phát đúng một lần khi đi qua cảnh đánh
  const all = eventsBetween(a.events, -1, a.duration);
  assert.equal(all.length, a.events.length);
  assert.equal(eventsBetween(a.events, -1, 0.5).length + eventsBetween(a.events, 0.5, a.duration).length, a.events.length);
  // đường bi: điểm đầu = thế ban đầu
  assert.deepEqual(pathUntil(a, 0, 0)[0], start[0]);
});

test("đối chiếu dự kiến – thực tế: cùng physics thì khớp; lệch thì báo mismatch, không tuyên bố thành công", () => {
  const start: BallPositions = [[-0.4, 0], [0.1, 0], [1.0, 0.5]];
  const shot = { cue: 0 as const, dirX: 1, dirY: 0, power: 0.7, tipX: 0, tipY: -0.95, elevation: 3 };
  const a = analyzeShot(start, shot);
  assert.equal(compareOutcome(a, analyzeShot(start, shot)).match, true, "physics tất định");
  const b = analyzeShot(start, { ...shot, power: 0.6 });
  const cmp = compareOutcome(a, b);
  assert.equal(cmp.match, false);
  assert.ok(cmp.reason);
  // nhãn kỹ thuật chỉ gồm điều đã xác minh
  assert.ok(techniqueLabels(shot, a).includes("DRAW"));
  assert.ok(!techniqueLabels({ ...shot, tipY: 0 }, analyzeShot(start, { ...shot, tipY: 0 })).includes("DRAW"));
});
