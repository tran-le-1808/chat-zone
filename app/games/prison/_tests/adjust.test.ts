/** Test theo tài liệu "Điều chỉnh gameplay" (mục 9): mở cả ngày, ngủ giường, gạch lỏng, kích thước người, chơi một mình, tịch thu, âm thanh, chế tạo tức thì */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  addItem,
  buildPrivate,
  clockInfo,
  CONFISCATION,
  countItem,
  createOutbox,
  isConfiscated,
  machineId,
  movementModifiers,
  PRISON_CONFIG as C,
  PRISON_MAP,
  ROLE_MODIFIERS,
  ROUTINE,
  runTick,
  zoneAt,
  type WorldState,
} from "../_lib/engine";
import { globalBellGain, mixPriority, moodFor, sectionAt, SECTION_PATTERN, sirenParams } from "../_lib/audio/mix";
import { act, makeWorld, noGuards, place, seconds, ticks } from "./helpers";

const ROOT = new URL("..", import.meta.url).pathname;

function lonely(seed = 51, n = 1) {
  const w = makeWorld(n, n > 1 ? "multi" : "single", seed);
  noGuards(w);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  return { w, p: w.players.p1 };
}

const at = (id: string) => {
  const t = PRISON_MAP.interactableById[id].tiles[0];
  return { x: t.x + 0.5, y: t.y + 0.5 };
};

// ------------------------------------------------------------------ 1. Mở cả ngày

test("thư viện và gym dùng được mọi giờ (cả sau 21:00, cả lúc điểm danh) — nhưng vắng điểm danh vẫn bị ghi vi phạm", () => {
  const { w, p } = lonely();
  w.totalGameMinutes = 8 * 60 + 29.5; // sắp điểm danh sáng
  place(w, "p1", 38.5, 28.5); // phòng gym
  assert.equal(act(w, "p1", { type: "gymStart", machineId: machineId("pressBench", 0) }).ok, true);
  const v0 = p.violationsToday.count;
  for (let i = 0; i < 20 * (ROUTINE_GRACE() + 2) && p.gym; i++) runTick(w, createOutbox(), new Map());
  assert.ok(p.gym, "không bị đuổi khỏi máy");
  assert.ok(p.violationsToday.count > v0, "vắng điểm danh vẫn bị ghi");
  assert.ok(w.journal.some((j) => j.text.includes("vắng mặt điểm danh")));
  // thư viện lúc 23:00
  act(w, "p1", { type: "gymStop" });
  w.totalGameMinutes = 1440 + 23 * 60;
  const t = PRISON_MAP.interactableById.bookshelf_0.tiles[0];
  place(w, "p1", t.x + 0.5, t.y + 1.5);
  assert.equal(act(w, "p1", { type: "interact", targetId: "bookshelf_0" }).ok, true);
});

function ROUTINE_GRACE() {
  return ROUTINE.graceMinutes;
}

// ------------------------------------------------------------------ 3. Không còn gạch lỏng

test("không còn gạch lỏng: không có ô giấu dưới sàn trong bản đồ, dữ liệu hay giao diện", () => {
  assert.ok(!PRISON_MAP.interactables.some((i) => i.id.startsWith("floor_")));
  const files = [
    join(ROOT, "_lib/engine/maps/grey_stone.map.json"),
    ...readdirSync(join(ROOT, "_lib/engine/data")).map((f) => join(ROOT, "_lib/engine/data", f)),
    ...readdirSync(join(ROOT, "_components")).map((f) => join(ROOT, "_components", f)),
    ...readdirSync(join(ROOT, "_lib/session")).map((f) => join(ROOT, "_lib/session", f)),
  ];
  for (const f of files) assert.ok(!/gạch lỏng|floor_\d/i.test(readFileSync(f, "utf8")), `còn gạch lỏng trong ${f}`);
});

// ------------------------------------------------------------------ 4. Kích thước người & tốc độ

test("hộp va chạm 1/2 ô cho người chơi, cai ngục, tù nhân; tốc độ 1 ô mỗi bước (0,25 giây)", () => {
  assert.equal(C.player.radius * 2, 0.5);
  assert.equal(C.guard.radius, C.player.radius);
  assert.equal(C.player.walkSpeed * C.player.stepSeconds, 1);
  const { w, p } = lonely();
  p.role = "HACKER";
  p.stats.agility = 0;
  p.stats.hunger = 0;
  place(w, "p1", 28.5, 8.5);
  const steps = Math.round(C.player.stepSeconds * C.net.tickRate);
  for (let i = 0; i < steps; i++) runTick(w, createOutbox(), new Map([["p1", [{ sequence: p.lastSeq + 1, directionX: 1, directionY: 0, sprint: false }]]]));
  const mods = movementModifiers({ hunger: 0, fitness: p.skills.fitness, stamina: p.stats.stamina, agility: 0 });
  assert.ok(Math.abs(p.x - 28.5 - 1 * ROLE_MODIFIERS.HACKER.speed * mods.speedMul) < 0.02, `đi được ${p.x - 28.5} ô`);
  // nhanh nhẹn vẫn nhân vào tốc độ
  assert.ok(movementModifiers({ hunger: 0, fitness: 0, agility: 50 }).speedMul > movementModifiers({ hunger: 0, fitness: 0, agility: 0 }).speedMul);
});

test("đi qua cửa 1 ô dễ dàng; hai người đi song song trong lối 1 ô", () => {
  // cửa thư viện (ô 51,24): hai người song song đi từ thư viện ra hành lang phía trên
  const { w } = lonely(52, 2);
  const a = w.players.p1;
  const b = w.players.p2;
  place(w, "p1", 51.27, 26.5);
  place(w, "p2", 51.73, 26.5);
  for (let i = 0; i < 30; i++)
    runTick(
      w,
      createOutbox(),
      new Map([
        ["p1", [{ sequence: a.lastSeq + 1, directionX: 0, directionY: -1, sprint: false }]],
        ["p2", [{ sequence: b.lastSeq + 1, directionX: 0, directionY: -1, sprint: false }]],
      ]),
    );
  assert.ok(a.y < 23.6, `người 1 qua cửa (y=${a.y})`);
  assert.ok(b.y < 23.6, `người 2 qua cửa (y=${b.y})`);
  assert.ok(Math.abs(a.x - b.x) > 0.3, "vẫn song song");
});

// ------------------------------------------------------------------ 5. Chơi một mình: qua ngày mới

test("chơi một mình: bị bắt -> qua ngày mới, 08:00 thức dậy trong phòng biệt giam, thể lực 100, thông minh −2, ghi nhật ký, rồi được thả", () => {
  const { w, p } = lonely();
  assert.equal(w.soloMode, true);
  w.totalGameMinutes = 1440 + 14 * 60;
  p.stats.energy = 12;
  p.stats.intelligence = 30;
  place(w, "p1", 30.5, 8.5);
  p.status = "KNOCKED_OUT";
  p.knockoutDeadline = 0;
  const o = createOutbox();
  runTick(w, o, new Map());
  assert.equal(p.status, "CAPTURED");
  assert.equal(clockInfo(w.totalGameMinutes).minuteOfDay, 8 * 60);
  assert.equal(clockInfo(w.totalGameMinutes).day, 3);
  assert.match(zoneAt(PRISON_MAP, p.x, p.y) ?? "", /^solitary/);
  assert.equal(p.stats.energy, 100);
  assert.equal(p.stats.intelligence, 28);
  assert.ok(o.events.some((e) => e.type === "player:solo-night"));
  assert.ok(w.journal.some((j) => j.text.includes("đêm trong phòng biệt giam")));
  assert.ok(!w.journal.some((j) => j.text.includes("vắng mặt điểm danh")), "đang bị giam không tính vắng");
  seconds(w, C.solitary.soloWakeSeconds + 0.2);
  assert.equal(p.status, "ACTIVE");
  assert.match(zoneAt(PRISON_MAP, p.x, p.y) ?? "", /^cell_/, "được thả về xà lim");
  // chế độ nhiều người giữ biệt giam cũ
  const { w: m, p: q } = lonely(53, 2);
  assert.equal(m.soloMode, false);
  q.status = "KNOCKED_OUT";
  q.knockoutDeadline = 0;
  const t0 = m.totalGameMinutes;
  ticks(m, 1);
  assert.equal(q.status, "CAPTURED");
  assert.ok(m.totalGameMinutes - t0 < 1, "không nhảy thời gian");
  assert.equal(q.solitaryClock, "sim");
});

// ------------------------------------------------------------------ 6. Tịch thu

test("tịch thu: vũ khí & đồ vượt ngục & đồ cấm vào kho; đồ hợp lệ và bộ đồ tù giữ nguyên; bảng 'đã bị tịch thu'", () => {
  const { w, p } = lonely();
  p.gear.weapon = { itemId: "pipe", quantity: 1, durability: 5 };
  p.gear.outfit = { itemId: "guard_outfit", quantity: 1, owner: "CN-104", condition: 100 };
  p.inventory = [];
  for (const id of ["rope", "food", "bandage", "keycard", "dummy", "cloth"] as const) addItem(p.inventory, id, 1);
  p.money = 30;
  p.status = "KNOCKED_OUT";
  p.knockoutDeadline = 0;
  ticks(w, 1);
  assert.equal(p.gear.weapon, null);
  assert.equal(p.gear.outfit?.itemId, "prisoner_outfit", "trả lại bộ đồ tù");
  for (const id of ["food", "bandage", "cloth"] as const) assert.equal(countItem(p.inventory, id), 1, `${id} giữ nguyên`);
  for (const id of ["rope", "keycard", "dummy"] as const) assert.equal(countItem(p.inventory, id), 0, `${id} bị tịch thu`);
  const seized = w.confiscation.items.filter((e) => e.playerId === "p1").map((e) => e.item.itemId).sort();
  assert.deepEqual(seized, ["dummy", "guard_outfit", "keycard", "pipe", "rope"]);
  assert.equal(isConfiscated("food"), false);
  assert.equal(isConfiscated("prisoner_outfit"), false);
  assert.equal(isConfiscated("shiv"), true);
  const priv = buildPrivate(w, "p1")!;
  assert.equal(priv.confiscated.items.length, 5);
  assert.ok(priv.confiscated.reclaimPrice >= CONFISCATION.minBribe);
  assert.ok(w.journal.some((j) => j.text.startsWith("Bị tịch thu:")));
});

function seizedWorld() {
  const { w, p } = lonely();
  addItem(p.inventory, "lockpick", 1);
  p.gear.weapon = { itemId: "shiv", quantity: 1, durability: 3 };
  p.status = "KNOCKED_OUT";
  p.knockoutDeadline = 0;
  ticks(w, 1);
  seconds(w, C.solitary.soloWakeSeconds + 0.2);
  assert.equal(p.status, "ACTIVE");
  return { w, p };
}

test("kho tịch thu: chuộc lại bằng hối lộ cai ngục; đột nhập tủ tang vật; quá hạn thì bị huỷ", () => {
  // hối lộ
  const a = seizedWorld();
  const g = makeWorld(1).guards.find((x) => x.routeId === "yard")!;
  g.x = 30.5;
  g.y = 9.2;
  g.path = [];
  g.pauseUntil = 1e9;
  g.state = "PATROL";
  a.w.guards = [g];
  place(a.w, "p1", 30.5, 8.5);
  const price = buildPrivate(a.w, "p1")!.confiscated.reclaimPrice;
  a.p.money = price - 1;
  assert.equal(act(a.w, "p1", { type: "reclaimConfiscated", guardId: g.id }).ok, false, "thiếu tiền");
  a.p.money = price + 5;
  assert.equal(act(a.w, "p1", { type: "reclaimConfiscated", guardId: g.id }).ok, true);
  assert.equal(a.p.money, 5);
  assert.equal(countItem(a.p.inventory, "lockpick"), 1);
  assert.equal(a.p.gear.weapon?.itemId, "shiv");
  assert.equal(a.w.confiscation.items.length, 0);
  // đột nhập
  const b = seizedWorld();
  const lk = at(CONFISCATION.lockerId);
  place(b.w, "p1", lk.x, lk.y + 1);
  assert.equal(act(b.w, "p1", { type: "interact", targetId: CONFISCATION.lockerId }).ok, true);
  seconds(b.w, CONFISCATION.breakInSeconds + 0.2);
  assert.equal(countItem(b.p.inventory, "lockpick"), 1);
  assert.equal(b.w.confiscation.items.length, 0);
  // huỷ sau keepDays ngày (08:00)
  const c = seizedWorld();
  const day = clockInfo(c.w.totalGameMinutes).day;
  c.w.totalGameMinutes = (day - 1 + CONFISCATION.keepDays) * 1440 + 8 * 60 - 0.5;
  ticks(c.w, 30);
  assert.equal(c.w.confiscation.items.length, 0);
  assert.ok(c.w.journal.some((j) => j.text.includes("Kho tịch thu đã huỷ")));
});

// ------------------------------------------------------------------ 7. Âm thanh

test("âm thanh: chuông điểm danh 08:30 & 19:00 (+ cảnh báo trước 1 phút, chuông kết thúc 09:00 & 19:30)", () => {
  const { w } = lonely();
  w.totalGameMinutes = 1440 + 8 * 60;
  const o = createOutbox();
  const at: Record<string, number[]> = {};
  for (let i = 0; i < 20 * 12 * 60; i++) {
    w.players.p1.stats.hunger = 0;
    const before = o.events.length;
    runTick(w, o, new Map());
    for (const e of o.events.slice(before)) if (e.type.startsWith("game:rollcall")) (at[e.type] ??= []).push(clockInfo(w.totalGameMinutes).minuteOfDay);
  }
  assert.deepEqual(at["game:rollcall-bell"], [8 * 60 + 30, 19 * 60]);
  assert.deepEqual(at["game:rollcall-warning"], [8 * 60 + 30 - C.rollcall.warningMinutes, 19 * 60 - C.rollcall.warningMinutes]);
  assert.deepEqual(at["game:rollcall-end"], [9 * 60, 19 * 60 + 30]);
});

test("âm thanh: nhạc nền theo khu & 3 đoạn luân phiên; còi to dần theo số sao; ưu tiên còi > chuông > hiệu ứng > nhạc", () => {
  assert.equal(moodFor("gym", 15, false), "gym");
  assert.equal(moodFor("library", 15, false), "library");
  assert.equal(moodFor("yard", 15, false), "calm");
  assert.equal(moodFor("cell_0", 23, false), "silent");
  assert.ok(new Set(SECTION_PATTERN).size >= 3, "ít nhất 3 đoạn khác nhau");
  const sections = Array.from({ length: 32 }, (_, bar) => sectionAt(bar));
  assert.ok(new Set(sections).size >= 3);
  const [s1, s2, s3] = [1, 2, 3].map(sirenParams);
  assert.ok(s1.gain < s2.gain && s2.gain < s3.gain);
  assert.ok(s1.rate < s2.rate && s2.rate < s3.rate);
  assert.ok(s1.center < s3.center);
  const siren = mixPriority({ siren: true, bell: true });
  const bell = mixPriority({ siren: false, bell: true });
  const calm = mixPriority({ siren: false, bell: false });
  assert.ok(siren.music < bell.music && bell.music < calm.music, "nhạc nền bị hạ khi có còi / chuông");
  assert.ok(siren.music < siren.sfx, "hiệu ứng ưu tiên hơn nhạc");
  assert.ok(globalBellGain("cell_0") < globalBellGain("yard") && globalBellGain("cell_0") > 0, "chuông nghe ở mọi khu, nhỏ hơn trong phòng kín");
});

// ------------------------------------------------------------------ 8. Chế tạo tức thì

test("chế tạo tức thì: ra vật phẩm ngay; thiếu nguyên liệu / thông minh thì từ chối", () => {
  const { w, p } = lonely();
  p.stats.intelligence = 50;
  p.skills.crafting = 100;
  place(w, "p1", 30.5, 8.5);
  addItem(p.inventory, "wood", 2);
  const r = act(w, "p1", { type: "craft", recipeId: "support" });
  assert.equal(r.ok, true);
  assert.equal(p.channel, null);
  if (r.ok && r.data?.success) assert.equal(countItem(p.inventory, "support"), 1);
  const none = act(w, "p1", { type: "craft", recipeId: "shovel" });
  assert.equal(!none.ok && none.code, "INSUFFICIENT_ITEMS");
  p.stats.intelligence = 0;
  addItem(p.inventory, "sharpened_spoon", 1);
  addItem(p.inventory, "wood", 1);
  const dumb = act(w, "p1", { type: "craft", recipeId: "shovel" });
  assert.equal(!dumb.ok && dumb.code, "REQUIREMENTS_NOT_MET");
});

// ------------------------------------------------------------------ 9. Lưu / tải

test("lưu/tải: giữ trạng thái ngủ, kho tịch thu, chế độ solo", () => {
  const { w } = seizedWorld();
  const p = w.players.p1;
  p.stats.energy = 20;
  place(w, "p1", at("bedrest_0").x, at("bedrest_0").y);
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  const loaded = JSON.parse(JSON.stringify(w)) as WorldState;
  assert.equal(loaded.soloMode, true);
  assert.equal(loaded.players.p1.channel?.kind, "sleep");
  assert.deepEqual(loaded.confiscation, w.confiscation);
  seconds(w, 3);
  seconds(loaded, 3);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w));
});
