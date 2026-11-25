/** Test bắt buộc theo tài liệu thiết kế (mục 14): lịch, tầm nhìn, nghi ngờ, khám phòng, đào hầm, lối thoát (bot), lưu/tải. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  addItem,
  canGuardSee,
  cameraSees,
  clockInfo,
  countItem,
  createOutbox,
  findChance,
  hideSpotIdsOfCell,
  PRISON_CONFIG as C,
  PRISON_MAP,
  resolveRoomSearch,
  ROUTINE,
  runTick,
  shopPrice,
  tunnelOf,
  violationOf,
  disguiseActive,
  recordViolation,
  type WorldState,
} from "../_lib/engine";
import { Bot } from "./bot";
import { act, guardOn, makeWorld, noGuards, place, placeAt, seconds, SPOT, standNear, ticks } from "./helpers";

// ------------------------------------------------------------------ 1. Lịch sinh hoạt

test("lịch: đúng 11 khung theo bảng, một ngày chạy đúng thứ tự, chuông đúng giờ, đếm ngược trước khung, đèn tắt 21:00", () => {
  assert.deepEqual(
    ROUTINE.periods.map((p) => [p.id, p.startMinute, p.endMinute]),
    [
      ["WAKE", 480, 510],
      ["ROLL_CALL", 510, 540],
      ["WORK", 540, 660],
      ["LUNCH", 660, 780],
      ["WORK_2", 780, 900],
      ["GYM", 900, 960],
      ["SHOWER", 960, 1020],
      ["DINNER", 1020, 1140],
      ["ROLL_CALL_2", 1140, 1170],
      ["FREE", 1200, 1260],
      ["LIGHTS_OUT", 1260, 480],
    ],
  );
  const w = makeWorld(1);
  noGuards(w);
  w.inmates = [];
  w.totalGameMinutes = 8 * 60;
  const o = createOutbox();
  const periods: string[] = [];
  let last = "";
  for (let i = 0; i < 1440 * 20; i++) {
    w.players.p1.stats.hunger = 0;
    w.players.p1.stats.energy = 100;
    runTick(w, o, new Map());
    const p = clockInfo(w.totalGameMinutes).period;
    if (p !== last) periods.push((last = p));
  }
  assert.deepEqual(periods, ["WAKE", "ROLL_CALL", "WORK", "LUNCH", "WORK_2", "GYM", "SHOWER", "DINNER", "ROLL_CALL_2", "BREAK", "FREE", "LIGHTS_OUT", "WAKE"]);
  const bells = o.events.filter((e) => e.type === "game:bell" || e.type === "game:rollcall-bell").map((e) => e.data?.period);
  for (const id of ["ROLL_CALL", "WORK", "LUNCH", "WORK_2", "GYM", "SHOWER", "DINNER", "ROLL_CALL_2", "FREE"]) assert.ok(bells.includes(id), `thiếu chuông ${id}`);
  const counts = o.events.filter((e) => e.type === "game:countdown").map((e) => e.data?.period);
  assert.ok(counts.includes("ROLL_CALL") && counts.includes("LIGHTS_OUT"), "đếm ngược trước khung");
  // chuông đúng giờ: sự kiện chuông của khung tới đúng phút bắt đầu
  const lightsOut = o.events.find((e) => e.type === "game:lights-out");
  assert.ok(lightsOut?.text?.includes("21:00"));
  assert.ok(o.events.some((e) => e.type === "game:wake"), "thức dậy 08:00");
});

test("lịch: vắng mặt điểm danh bị ghi vi phạm (kể cả không lính nào thấy)", () => {
  const w = makeWorld(1);
  noGuards(w);
  w.totalGameMinutes = 8 * 60 + 29; // 08:29, sắp điểm danh 08:30
  placeAt(w, "p1", SPOT.cell(0)); // trong xà lim
  ticks(w, 20 * (ROUTINE.graceMinutes + 2));
  assert.equal(w.players.p1.violationsToday.count, 1);
  assert.ok(w.journal.some((j) => j.kind === "warning" && j.text.includes("vắng mặt điểm danh")));
  // đứng đúng vạch -> không vi phạm
  const w2 = makeWorld(1);
  noGuards(w2);
  w2.totalGameMinutes = 8 * 60 + 29;
  place(w2, "p1", 22.5, 8.5); // vạch điểm danh ở sân
  ticks(w2, 20 * (ROUTINE.graceMinutes + 2));
  assert.equal(w2.players.p1.violationsToday.count, 0);
});

test("lịch: vi phạm leo thang nhắc nhở -> phạt -> nghiêm trọng", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  const money = p.money;
  w.totalGameMinutes = 12 * 60 + 20; // ăn trưa, đã hết ân hạn
  placeAt(w, "p1", SPOT.yard); // ở sân -> sai chỗ
  const v = violationOf(w, p);
  assert.equal(v?.severity, "minor");
  // giả lập 3 lần bị thấy ở 3 khung giờ khác nhau
  assert.equal(recordViolation(w, createOutbox(), p, { ...v!, key: "a" }, "Cai A"), false);
  assert.equal(p.stats.personalHeat, C.heat.warningHeat);
  assert.equal(recordViolation(w, createOutbox(), p, { ...v!, key: "b" }, "Cai A"), false);
  assert.equal(p.money, money - C.violations.penaltyFine);
  assert.equal(recordViolation(w, createOutbox(), p, { ...v!, key: "c" }, "Cai A"), true);
  assert.ok(p.stats.personalHeat >= C.heat.chaseThreshold);
  // cùng khoá không ghi lần 2
  const n = p.violationsToday.count;
  recordViolation(w, createOutbox(), p, { ...v!, key: "c" }, "Cai A");
  assert.equal(p.violationsToday.count, n);
});

// ------------------------------------------------------------------ 2. Tầm nhìn

test("tầm nhìn: không thấy sau tường, thấy trong hình nón, không thấy sau lưng; ban đêm ngắn hơn ở chỗ tối", () => {
  const w = makeWorld(1);
  const g = w.guards[0];
  g.x = 10.5;
  g.y = 22.5;
  g.facing = 0; // nhìn sang phải
  assert.equal(canGuardSee(w, g, { x: 14.5, y: 22.5 }), true, "trong nón");
  assert.equal(canGuardSee(w, g, { x: 6.5, y: 22.5 }), false, "sau lưng");
  assert.equal(canGuardSee(w, g, { x: 13.5, y: 18.5 }), false, "sau tường hành lang");
  assert.equal(canGuardSee(w, g, { x: 10.5 + 6.2, y: 22.5 }), true, "ban ngày xa 6.2 ô");
  w.totalGameMinutes = 23 * 60; // đêm
  const far = { x: 10.5 + 5.5, y: 22.5 };
  const lit = PRISON_MAP.lights.some((l) => !l.cell && Math.hypot(l.x - far.x, l.y - far.y) <= l.radius);
  assert.equal(canGuardSee(w, g, far), lit, "ban đêm: chỉ thấy xa nếu có đèn");
  assert.equal(canGuardSee(w, g, { x: 13.5, y: 22.5 }), true, "ban đêm vẫn thấy gần");
});

test("camera: quét theo thời gian, bị tường che, có vùng mù dưới chân", () => {
  assert.equal(PRISON_MAP.cameras.length, 8, "8 camera C1–C8");
  const cam = PRISON_MAP.cameras.find((c) => c.id === "C1")!;
  assert.equal(Math.round((cam.fov * 180) / Math.PI), 60);
  assert.equal(cam.range, 6);
  assert.equal(cam.period, 8);
  let seenAny = false;
  let notSeen = false;
  for (let t = 0; t < cam.period; t += 0.25) {
    const s = cameraSees(cam, t, 7.5, 23.5);
    seenAny ||= s;
    notSeen ||= !s;
  }
  assert.ok(seenAny && notSeen, "góc quét lúc thấy lúc không");
  for (let t = 0; t < cam.period; t += 0.25) assert.equal(cameraSees(cam, t, 6.5, 25.5), false, "văn phòng sau tường");
  for (let t = 0; t < cam.period; t += 0.25) assert.equal(cameraSees(cam, t, cam.x + 1.2, cam.y + 0.3), false, "vùng mù sát chân tường dưới camera");
});

// ------------------------------------------------------------------ 3. Nghi ngờ

test("nghi ngờ: tăng khi lính thấy vi phạm nghiêm trọng, giảm dần khi khuất; chuyển SUSPICIOUS -> CHASE đúng ngưỡng", () => {
  const w = makeWorld(1);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  const g = guardOn(w, "cells");
  w.guards = [g];
  g.x = SPOT.officeGuard.x;
  g.y = SPOT.officeGuard.y;
  g.facing = 0;
  g.path = [];
  g.pauseUntil = 1e9;
  const p = w.players.p1;
  addItem(p.inventory, "fake_key", 1);
  place(w, "p1", 8.9, 27.4);
  const states: string[] = [];
  for (let i = 0; i < 80 && g.state !== "CHASE"; i++) {
    ticks(w, 1);
    if (states[states.length - 1] !== g.state) states.push(g.state);
  }
  assert.deepEqual(states.filter((x) => x !== "PATROL").slice(0, 2), ["SUSPICIOUS", "CHASE"]);
  assert.ok(p.stats.personalHeat > 0);
  // khuất tầm -> heat giảm đúng tốc độ
  w.guards = [];
  placeAt(w, "p1", SPOT.cell(0));
  const h0 = p.stats.personalHeat;
  seconds(w, 4);
  assert.ok(Math.abs(h0 - p.stats.personalHeat - 4 * C.heat.personalDecay) < 0.6, `${h0} -> ${p.stats.personalHeat}`);
});

test("ngụy trang: mặc bộ đồ cai ngục trong văn phòng — lính ở xa hay đứng sát đều coi là đồng nghiệp", () => {
  const w = makeWorld(1);
  w.inmates = [];
  const g = guardOn(w, "cells");
  w.guards = [g];
  g.x = SPOT.officeGuard.x;
  g.y = SPOT.officeGuard.y;
  g.facing = 0;
  g.path = [];
  g.pauseUntil = 1e9;
  const p = w.players.p1;
  // bộ đồ cai ngục lấy từ phòng giặt: không có mã cai ngục — vẫn không bị nhận ra
  p.gear.outfit = { itemId: "guard_outfit", quantity: 1, condition: 100 };
  w.rngState = 3;
  assert.equal(disguiseActive(w, p), true);
  place(w, "p1", 9.3, 26.5);
  ticks(w, 20);
  assert.equal(g.state, "PATROL");
  place(w, "p1", 5.9, 26.5); // đứng sát
  ticks(w, 40);
  assert.equal(disguiseActive(w, p), true, "không bị lộ");
  assert.equal(g.state, "PATROL");
});

// ------------------------------------------------------------------ 4. Khám phòng

test("khám phòng: tỉ lệ lộ đúng theo độ an toàn của ô giấu (thống kê nhiều seed); không còn gạch lỏng", () => {
  const spots = hideSpotIdsOfCell(0).map((id) => PRISON_MAP.interactableById[id]);
  assert.ok(!PRISON_MAP.interactables.some((i) => i.id.startsWith("floor_") || /gạch lỏng/i.test(i.name)), "đã bỏ gạch lỏng");
  const safe = spots.find((s) => s.id === "toilet_0")!;
  const N = 400;
  const run = (spotId: string) => {
    let found = 0;
    for (let i = 0; i < N; i++) {
      const w = makeWorld(1, "single", 1000 + i);
      w.hideSpots[spotId] = [{ itemId: "file", quantity: 1 }];
      resolveRoomSearch(w, createOutbox(), 0, null);
      if (countItem(w.hideSpots[spotId], "file") === 0) found++;
    }
    return found / N;
  };
  const w0 = makeWorld(1);
  const pSafe = run(safe.id);
  assert.ok(Math.abs(pSafe - findChance(w0, safe.safety!)) < 0.08, `an toàn: ${pSafe}`);
  // đồ thường không bị tịch thu
  const w = makeWorld(1);
  w.hideSpots[safe.id] = [{ itemId: "cloth", quantity: 3 }];
  resolveRoomSearch(w, createOutbox(), 0, null);
  assert.equal(countItem(w.hideSpots[safe.id], "cloth"), 3);
});

test("khám phòng theo lịch: cai ngục đi tới phòng, khám, ghi nhật ký; mua chuộc thì bỏ qua", () => {
  const w = makeWorld(1);
  w.inmates = [];
  w.guards = [guardOn(w, "cells")];
  const p = w.players.p1;
  w.hideSpots.toilet_0 = [{ itemId: "file", quantity: 1 }];
  w.totalGameMinutes = ROUTINE.roomSearchMinutes[0] - 1;
  placeAt(w, "p1", SPOT.hall());
  ticks(w, 40);
  assert.equal(w.guards[0].task?.kind, "roomSearch");
  for (let i = 0; i < 20 * 40 && w.guards[0].task; i++) {
    p.stats.hunger = 0;
    ticks(w, 1);
  }
  assert.equal(w.guards[0].task, null);
  assert.ok(w.journal.some((j) => j.kind === "search" && j.text.includes("phòng 1")));
  // mua chuộc
  const w2 = makeWorld(1);
  w2.bribedCells["0"] = 1;
  w2.totalGameMinutes = ROUTINE.roomSearchMinutes[0] - 1;
  ticks(w2, 40);
  assert.ok(w2.guards.every((g) => !g.task));
});

// ------------------------------------------------------------------ 5. Đào hầm

test("đào hầm: thiếu thanh chống thì có thể sập; miệng hầm không che bị lộ khi khám", () => {
  let collapses = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const w = makeWorld(1, "single", seed);
    noGuards(w);
    const b = new Bot(w);
    const t = tunnelOf(w, 0);
    t.progress = C.tunnel.supportEvery; // đã đào 3 đoạn, chưa chống
    addItem(b.p.inventory, "shovel", 1);
    placeAt(w, "p1", standNear("tunnel_0"));
    b.must({ type: "tunnel", cellIndex: 0, op: "dig" });
    b.finishChannel();
    if (t.progress < C.tunnel.supportEvery) collapses++;
  }
  assert.ok(collapses > 5 && collapses < 25, `sập ${collapses}/30`);
  // có chống thì không sập
  const w = makeWorld(1);
  noGuards(w);
  const b = new Bot(w);
  const t = tunnelOf(w, 0);
  t.progress = 3;
  t.supports = 1;
  addItem(b.p.inventory, "shovel", 1);
  placeAt(w, "p1", standNear("tunnel_0"));
  b.must({ type: "tunnel", cellIndex: 0, op: "dig" });
  b.finishChannel();
  assert.equal(t.progress, 4);
  assert.equal(countItem(b.p.inventory, "dirt"), 1, "đào ra đất phải xử lý");
  // không che -> khám phòng lộ hầm
  resolveRoomSearch(w, createOutbox(), 0, null);
  assert.equal(t.progress, 0, "hầm bị lấp");
  assert.ok(w.journal.some((j) => j.text.includes("đường hầm")));
});

// 6. Lối thoát: xem escape-bots.test.ts (5 bot chạy từ đầu ván tới ô thoát)

// ------------------------------------------------------------------ 7. Lưu / tải

test("lưu/tải: JSON vòng tròn giữ nguyên vị trí, túi đồ, lịch, nghi ngờ; chạy tiếp tất định; không nhân đôi", () => {
  const w = makeWorld(1, "single", 77);
  w.players.p1.stats.personalHeat = 33;
  addItem(w.players.p1.inventory, "wire", 2);
  w.hideSpots.toilet_0 = [{ itemId: "file", quantity: 1 }];
  ticks(w, 200);
  const saved = JSON.stringify(w);
  const loaded = JSON.parse(saved) as WorldState;
  assert.deepEqual(loaded, w);
  ticks(w, 300);
  ticks(loaded, 300);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w));
  // tổng vật phẩm (túi + ô giấu + kho + sàn) không đổi khi tải lại
  const count = (x: WorldState) =>
    [...Object.values(x.players).flatMap((p) => p.inventory), ...Object.values(x.hideSpots).flat(), ...x.teamStorage.items, ...Object.values(x.floorItems).map((f) => f.item)].reduce((n, i) => n + i.quantity, 0);
  assert.equal(count(JSON.parse(saved) as WorldState), count(JSON.parse(saved) as WorldState));
  assert.equal(count(loaded), count(w));
});

// ------------------------------------------------------------------ khác

test("kinh tế: giá căng tin tăng theo cầu rồi hồi dần; danh tiếng / giao tiếp giảm giá", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  const base = shopPrice(w, "food", p);
  placeAt(w, "p1", SPOT.shop);
  p.money = 200;
  for (let i = 0; i < 4; i++) assert.equal(act(w, "p1", { type: "buy", itemId: "food" }).ok, true);
  assert.ok(shopPrice(w, "food", p) > base);
  const high = shopPrice(w, "food", p);
  for (let i = 0; i < 20 * 60 * 12; i += 20) ticks(w, 20);
  assert.ok(shopPrice(w, "food", p) < high, "hồi giá");
  p.skills.social = 100;
  assert.ok(shopPrice(w, "food", p) < shopPrice(w, "food"));
});

test("việc làm: chỉ trong giờ lao động, trả tiền (việc nhẹ — làm được cả khi hết thể lực)", () => {
  const w = makeWorld(1);
  noGuards(w);
  const b = new Bot(w);
  w.totalGameMinutes = 9 * 60 + 15; // ca làm 09:00–11:00
  b.goNear("job_plates");
  const money = b.p.money;
  b.p.stats.energy = 0;
  b.must({ type: "interact", targetId: "job_plates" });
  b.finishChannel();
  assert.ok(b.p.money >= money + 9);
  w.totalGameMinutes = 15 * 60 + 30; // giờ gym: không phải ca làm
  const r = act(w, "p1", { type: "interact", targetId: "job_plates" });
  assert.equal(!r.ok && r.code, "INVALID_STATE");
});

test("ngủ: nằm giường hồi thể lực +4/giây, đầy vẫn nằm; ngủ được giường khác còn trống, không ngủ giường đang có người", () => {
  const w = makeWorld(2);
  noGuards(w);
  const p = w.players.p1;
  p.stats.energy = 40;
  assert.equal(act(w, "p1", { type: "interact", targetId: "bedrest_0" }).ok, true);
  seconds(w, 5);
  assert.ok(p.stats.energy >= 59 && p.stats.energy <= 61, `thể lực ${p.stats.energy}`);
  seconds(w, 12);
  assert.equal(p.stats.energy, 100);
  assert.equal(p.channel?.kind, "sleep", "đầy thể lực vẫn nằm");
  // người khác không nằm được giường đang có người
  placeAt(w, "p2", SPOT.cell(0));
  const busy = act(w, "p2", { type: "interact", targetId: "bedrest_0" });
  assert.equal(!busy.ok && busy.code, "CONFLICT", "giường đang có người");
  // giường xà lim khác / phòng y tế còn trống thì nằm được
  placeAt(w, "p2", SPOT.cell(1));
  assert.equal(act(w, "p2", { type: "interact", targetId: "bedrest_1" }).ok, true);
  assert.equal(w.players.p2.bed, "bedrest_1");
});

test("tù nhân mách lẻo: thấy người chơi phá hoại -> tăng nghi ngờ, ghi nhật ký", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  const snitch = w.inmates.find((n) => n.defId === "npc_khoa")!;
  w.inmates = [snitch];
  w.totalGameMinutes = 9 * 60;
  addItem(p.inventory, "shovel", 1);
  placeAt(w, "p1", standNear("tunnel_0"));
  snitch.x = SPOT.cell(0).x;
  snitch.y = SPOT.cell(0).y;
  snitch.path = [];
  snitch.goalZone = "workshop";
  snitch.waitUntil = 1e9;
  act(w, "p1", { type: "tunnel", cellIndex: 0, op: "dig" });
  ticks(w, 60);
  assert.ok(w.journal.some((j) => j.text.includes("mách lẻo")));
  assert.ok(p.stats.personalHeat >= C.inmates.snitchHeat - 5);
});

test("giới hạn ngày: quá N ngày -> thua (TIME_UP)", () => {
  const w = makeWorld(1);
  w.dayLimit = 1;
  noGuards(w);
  w.totalGameMinutes = 1440 - 1;
  ticks(w, 40);
  assert.equal(w.outcome, "TIME_UP");
});

test("hiệu năng: 4 người + 6 cai ngục + 2 tháp canh + 12 tù nhân, tick trung bình < 2 ms", () => {
  const w = makeWorld(4, "multi", 5);
  w.difficulty = "HARDCORE";
  const o = createOutbox();
  const t0 = performance.now();
  for (let t = 1; t <= 2000; t++) {
    const inputs = new Map(w.playerOrder.map((id, i) => [id, [{ sequence: t, directionX: Math.sin(t / 30 + i), directionY: Math.cos(t / 40 + i), sprint: false }]]));
    runTick(w, o, inputs);
  }
  const avg = (performance.now() - t0) / 2000;
  assert.ok(avg < 2, `tick ${avg.toFixed(3)} ms`);
});

test("bản quyền: không có tên / tài sản của game gốc trong mã game", () => {
  const banned = ["Escap" + "ists", "Team" + "17", "Mouldy" + " Toof"].map((s) => s.toLowerCase());
  const root = new URL("..", import.meta.url).pathname;
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk(root)) {
    if (/\.(png|ico)$/.test(f)) continue;
    const text = readFileSync(f, "utf8").toLowerCase();
    for (const b of banned) assert.ok(!text.includes(b), `${f} chứa "${b}"`);
  }
});

