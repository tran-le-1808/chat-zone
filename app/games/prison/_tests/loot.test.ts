/** Test theo tài liệu "lục soát người bị knock out, túi 6 ô + vũ khí + áo/quần, cải trang cai ngục" (mục 10). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  bagFits,
  countItem,
  createOutbox,
  DISGUISE,
  disguiseActive,
  fitsSlot,
  isDisguised,
  ITEM_DEFS,
  PRISON_CONFIG as C,
  PRISON_MAP,
  runTick,
  violationOf,
  type GuardEntity,
  type InmateEntity,
  type WorldState,
  actionSeconds,
} from "../_lib/engine";
import { act, makeWorld, noGuards, place, seconds, ticks } from "./helpers";

const YARD = { x: 30.5, y: 8.5 };

/** Một cai ngục nằm ngất ngay cạnh người chơi */
function downedGuard(seed = 7) {
  const w = makeWorld(1, "single", seed);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  const g = w.guards.find((x) => x.routeId === "yard")!;
  w.guards = [g];
  w.totalGameMinutes = 20 * 60 + 10; // giờ tự do
  place(w, "p1", YARD.x, YARD.y);
  g.x = YARD.x + 0.9;
  g.y = YARD.y;
  g.downUntil = w.time + 60;
  g.health = 0;
  return { w, g, p: w.players.p1 };
}

function downedInmate(defId = "npc_ba", seed = 5) {
  const w = makeWorld(1, "single", seed);
  noGuards(w);
  const n = w.inmates.find((x) => x.defId === defId)!;
  w.inmates = [n];
  place(w, "p1", YARD.x, YARD.y);
  n.x = YARD.x + 0.9;
  n.y = YARD.y;
  n.downUntil = w.time + 40;
  n.health = 0;
  n.combat = "knockedOut";
  n.state = "DOWN";
  w.totalGameMinutes = 20 * 60 + 10;
  return { w, n, p: w.players.p1 };
}

function openLoot(w: WorldState, target: string) {
  assert.equal(act(w, "p1", { type: "lootStart", targetId: target }).ok, true);
  seconds(w, actionSeconds(C.loot.openSeconds) + 0.1);
  assert.equal(w.players.p1.lootTarget, target);
}

function take(w: WorldState, target: string, slot: "bag" | "weapon" | "outfit", index = 0) {
  const r = act(w, "p1", { type: "lootTake", targetId: target, slot, index });
  assert.equal(r.ok, true, JSON.stringify(r));
  seconds(w, (slot === "outfit" ? actionSeconds(C.loot.clothingSeconds) : actionSeconds(C.loot.itemSeconds)) + 0.1);
}

// ------------------------------------------------------------------ 1. Túi đồ

test("túi đồ: 6 ô túi chính + 1 ô vũ khí + 1 ô bộ đồ; không còn ô áo / quần riêng", () => {
  assert.equal(C.player.inventorySlots, 6);
  const w = makeWorld(1);
  const p = w.players.p1;
  assert.deepEqual(Object.keys(p.gear).sort(), ["outfit", "weapon"]);
  assert.equal(ITEM_DEFS.guard_outfit.slotType, "outfit");
  assert.equal(ITEM_DEFS.guard_outfit.outfitType, "guard");
  assert.equal(ITEM_DEFS.prisoner_outfit.outfitType, "prisoner");
  for (const old of ["guard_top", "guard_bottom", "prisoner_top", "prisoner_bottom"]) assert.equal((ITEM_DEFS as Record<string, unknown>)[old], undefined, `đã bỏ ${old}`);
  p.inventory = [];
  for (const id of ["cloth", "wire", "plastic", "spoon", "food", "metal_scrap"] as const) addItem(p.inventory, id, 1);
  assert.equal(p.inventory.length, 6);
  assert.equal(bagFits(p, [{ itemId: "wood", quantity: 1 }]), false, "ô thứ 7 không có");
  assert.equal(bagFits(p, [{ itemId: "club", quantity: 1 }]), true, "vũ khí không chiếm túi chính");
  assert.equal(fitsSlot("club", "bag"), false);
  assert.equal(fitsSlot("club", "weapon"), true);
  assert.equal(fitsSlot("food", "weapon"), false);
  assert.equal(fitsSlot("guard_outfit", "outfit"), true);
  assert.equal(fitsSlot("food", "outfit"), false);
  // mặc đồ không phải bộ đồ bị từ chối
  const r = act(w, "p1", { type: "wear", index: 0 });
  assert.equal(!r.ok && r.code, "INVALID_PAYLOAD");
  // người chơi bắt đầu mặc bộ đồ tù có mã của mình
  assert.equal(p.gear.outfit?.itemId, "prisoner_outfit");
  assert.match(p.gear.outfit?.owner ?? "", /^TN-/);
  // cai ngục & tù nhân có túi theo dữ liệu
  for (const g of w.guards.filter((x) => !x.tower)) {
    assert.ok(g.bag.length <= 6);
    assert.equal(g.gear.weapon?.itemId, "baton");
    assert.equal(g.gear.outfit?.itemId, "guard_outfit");
    assert.equal(g.gear.outfit?.owner, g.code);
  }
  const hai = w.inmates.find((n) => n.defId === "npc_hai")!;
  assert.equal(hai.gear.weapon?.itemId, "club");
  assert.equal(hai.gear.outfit?.itemId, "prisoner_outfit");
  assert.equal(w.inmates.find((n) => n.defId === "npc_tu")!.gear.weapon, null, "không có vũ khí thì ô trống");
});

// ------------------------------------------------------------------ 2. Lục soát

test("lục soát: chỉ khi mục tiêu đang ngất & đứng cạnh; mở túi đúng 3 giây; lấy 1 món 0.5 giây, bộ đồ 2 giây", () => {
  const { w, n, p } = downedInmate();
  n.downUntil = 0; // đang đứng
  const r = act(w, "p1", { type: "lootStart", targetId: n.id });
  assert.equal(!r.ok && r.code, "INVALID_STATE");
  n.downUntil = w.time + 40;
  place(w, "p1", YARD.x - 3, YARD.y);
  const far = act(w, "p1", { type: "lootStart", targetId: n.id });
  assert.equal(!far.ok && far.code, "OUT_OF_RANGE");
  place(w, "p1", YARD.x, YARD.y);
  assert.equal(act(w, "p1", { type: "lootStart", targetId: n.id }).ok, true);
  seconds(w, actionSeconds(C.loot.openSeconds) - 0.2);
  assert.equal(p.lootTarget, null, "chưa đủ 3 giây");
  seconds(w, 0.3);
  assert.equal(p.lootTarget, n.id);
  // lấy món trong túi (0.5 giây)
  const first = n.bag[0].itemId;
  assert.equal(act(w, "p1", { type: "lootTake", targetId: n.id, slot: "bag", index: 0 }).ok, true);
  assert.equal(p.channel?.duration, actionSeconds(C.loot.itemSeconds));
  seconds(w, actionSeconds(C.loot.itemSeconds) + 0.1);
  assert.equal(countItem(p.inventory, first), 1);
  assert.ok(!n.bag.some((i) => i.itemId === first) || n.bag.length < 2);
  // bộ đồ: 2 giây, một ô duy nhất
  assert.equal(act(w, "p1", { type: "lootTake", targetId: n.id, slot: "outfit", index: 0 }).ok, true);
  assert.equal(p.channel?.duration, actionSeconds(C.loot.clothingSeconds));
  seconds(w, actionSeconds(C.loot.clothingSeconds) + 0.1);
  assert.equal(p.gear.outfit?.owner, "TN-0733", "mặc bộ đồ tù của Ba Sẹo");
  assert.equal(n.gear.outfit, null, "người bị lấy chỉ còn đồ lót");
  assert.ok(w.journal.some((j) => j.text.includes("lấy") && j.text.includes("Ba Sẹo")));
});

test("lục soát: di chuyển làm gián đoạn; mục tiêu tỉnh giữa chừng thì dừng ngay và đánh nhau", () => {
  const { w, n, p } = downedInmate("npc_hai");
  assert.equal(act(w, "p1", { type: "lootStart", targetId: n.id }).ok, true);
  runTick(w, createOutbox(), new Map([["p1", Array.from({ length: 4 }, (_, i) => ({ sequence: 10 + i, directionX: -1, directionY: 0, sprint: false }))]]));
  assert.equal(p.channel, null, "di chuyển -> dừng");
  place(w, "p1", YARD.x, YARD.y);
  openLoot(w, n.id);
  assert.equal(act(w, "p1", { type: "lootTake", targetId: n.id, slot: "bag", index: 0 }).ok, true);
  n.downUntil = w.time; // tỉnh dậy
  ticks(w, 2);
  assert.equal(p.channel, null);
  assert.equal(p.lootTarget, null);
  assert.equal(n.fightWith, "p1");
  assert.equal(n.combat, "fighting", "tỉnh dậy là lao vào đánh");
});

test("lục soát cai ngục bị cai ngục khác nhìn thấy: vẫn cho lục nhưng nghi ngờ tăng mạnh và bị truy đuổi", () => {
  const { w, g, p } = downedGuard();
  const other = makeWorld(1, "single", 7).guards.find((x) => x.routeId === "work")!;
  other.x = YARD.x - 3;
  other.y = YARD.y;
  other.facing = 0;
  other.path = [];
  other.pauseUntil = 1e9;
  w.guards.push(other);
  const o = createOutbox();
  const r = act(w, "p1", { type: "lootStart", targetId: g.id });
  assert.equal(r.ok, true);
  assert.ok(p.stats.personalHeat >= C.loot.watchedHeat);
  for (let i = 0; i < 40; i++) runTick(w, o, new Map());
  assert.ok(o.events.some((e) => e.type === "guard:alert" && e.playerId === "p1"), "bị phát hiện & truy đuổi");
});

// ------------------------------------------------------------------ 3. Lấy vũ khí

test("lấy vũ khí: vào ô vũ khí; vũ khí cũ rơi xuống đất khi ô đã có", () => {
  const { w, g, p } = downedGuard();
  p.gear.weapon = { itemId: "shiv", quantity: 1, durability: 3 };
  openLoot(w, g.id);
  take(w, g.id, "weapon");
  assert.equal(p.gear.weapon?.itemId, "baton");
  assert.equal(g.gear.weapon, null);
  assert.ok(Object.values(w.floorItems).some((f) => f.item.itemId === "shiv"), "dao cũ rơi xuống đất");
  assert.equal(countItem(p.inventory, "baton"), 0, "vũ khí không vào túi chính");
});

// ------------------------------------------------------------------ 4. Mặc đồ

test("mặc đồ: bộ cũ vào túi chính; túi đầy thì rơi xuống đất; cởi ra thì còn đồ lót", () => {
  const { w, g, p } = downedGuard();
  p.inventory = [];
  openLoot(w, g.id);
  take(w, g.id, "outfit");
  assert.equal(p.gear.outfit?.itemId, "guard_outfit");
  assert.equal(countItem(p.inventory, "prisoner_outfit"), 1, "bộ đồ tù cũ vào túi");
  assert.equal(isDisguised(p), true);
  assert.equal(g.gear.outfit, null, "cai ngục bị lột chỉ còn đồ lót");
  // mặc lại đồ tù -> bộ cai ngục về túi (đổi chỗ), không mặc được 2 bộ
  const idx = p.inventory.findIndex((i) => i.itemId === "prisoner_outfit");
  assert.equal(act(w, "p1", { type: "wear", index: idx }).ok, true);
  assert.equal(p.gear.outfit?.itemId, "prisoner_outfit");
  assert.equal(countItem(p.inventory, "guard_outfit"), 1);
  assert.equal(isDisguised(p), false);
  // cởi khi túi đầy -> bộ đồ rơi xuống đất tại chân; người còn đồ lót
  for (const id of ["cloth", "wire", "plastic", "spoon", "metal_scrap"] as const) addItem(p.inventory, id, 1);
  assert.equal(p.inventory.length, 6);
  assert.equal(act(w, "p1", { type: "takeOff", slot: "outfit" }).ok, true);
  assert.equal(p.gear.outfit, null);
  assert.ok(Object.values(w.floorItems).some((f) => f.item.itemId === "prisoner_outfit" && Math.abs(f.x - p.x) < 0.01), "rơi tại chân");
  assert.equal(act(w, "p1", { type: "takeOff", slot: "outfit" }).ok, false, "đồ lót không cởi / lấy được");
});

// ------------------------------------------------------------------ 5. Cải trang

function disguisedNear(dist: number, opts: { night?: boolean; seed?: number } = {}) {
  const w = makeWorld(1, "single", opts.seed ?? 11);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  const g = w.guards.find((x) => x.routeId === "yard")!;
  w.guards = [g];
  w.totalGameMinutes = opts.night ? 1440 + 23 * 60 : 16 * 60 + 10;
  const p = w.players.p1;
  p.gear.outfit = { itemId: "guard_outfit", quantity: 1, owner: "CN-999", condition: 5 };
  place(w, "p1", YARD.x, YARD.y);
  g.x = YARD.x + dist;
  g.y = YARD.y;
  g.facing = Math.PI;
  g.path = [];
  g.pauseUntil = 1e9;
  return { w, g, p };
}

test("cải trang: mặc bộ đồ cai ngục thì cai ngục không bao giờ nhận ra — sát mặt, mã lạ, đồ rách, ban đêm, nhiều seed", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const night of [false, true]) {
      const { w, g, p } = disguisedNear(0.9, { seed, night });
      const o = createOutbox();
      for (let i = 0; i < 20 * 10; i++) runTick(w, o, new Map());
      assert.equal(disguiseActive(w, p), true, `seed ${seed}`);
      assert.notEqual(g.state, "CHASE");
      assert.equal(p.wantedLevel, 0, "không truy nã vì ngoài xà lim sau 21:00");
      assert.equal(p.violationsToday.count, 0, "không vi phạm vì danh tính");
      assert.ok(!o.events.some((e) => e.type === "disguise:challenge" || e.type === "disguise:blown"), "không hỏi đáp, không lộ");
      assert.equal(w.challenges.p1, undefined);
    }
  }
});

test("cải trang: vào khu cấm (văn phòng, kho) không bị coi là vi phạm; camera không ghi hình", () => {
  const { w, p } = disguisedNear(3);
  w.camerasOffUntil = 0;
  place(w, "p1", 50.5, 17.5); // trong kho (khu cấm), trước camera C5
  assert.equal(violationOf(w, p), null);
  const o = createOutbox();
  for (let i = 0; i < 20 * 10; i++) runTick(w, o, new Map());
  assert.ok(!o.events.some((e) => e.type === "camera:spotted"));
  assert.equal(p.violationsToday.count, 0);
});

test("cải trang: bị thấy đánh cai ngục khác -> báo động và mất cải trang (tạm thời)", () => {
  const { w, g, p } = disguisedNear(3);
  const victim = makeWorld(1, "single", 11).guards.find((x) => x.routeId === "cells")!;
  victim.x = YARD.x + 0.8;
  victim.y = YARD.y;
  victim.path = [];
  victim.pauseUntil = 1e9;
  w.guards.push(victim);
  p.facing = 0;
  act(w, "p1", { type: "attack" });
  const o = createOutbox();
  const states = new Set<string>();
  for (let i = 0; i < 20 * 2; i++) {
    runTick(w, o, new Map());
    states.add(g.state);
  }
  assert.equal(disguiseActive(w, p), false, "mất cải trang");
  assert.ok(o.events.some((e) => e.type === "disguise:blown"));
  assert.ok(o.events.some((e) => e.type === "guard:alert"), "cai ngục báo động");
  assert.ok(states.has("CHASE"), "cai ngục truy đuổi");
});

test("cải trang: điểm danh khi mặc đồ cai ngục bỏ qua (disguiseBypassRollCall)", () => {
  const { w, p } = disguisedNear(20);
  w.guards = [];
  w.totalGameMinutes = 8 * 60 + 29;
  place(w, "p1", 6.5, 26.5); // trong văn phòng, không ở vạch điểm danh
  ticks(w, 20 * 15);
  assert.ok(!w.journal.some((j) => j.text.includes("vắng mặt điểm danh")));
  assert.equal(p.violationsToday.count, 0);
});

test("cải trang: tù nhân coi như cai ngục — không bán đồ cấm", () => {
  const w = makeWorld(1, "single", 4);
  noGuards(w);
  const ba = w.inmates.find((n) => n.defId === "npc_ba")!;
  w.inmates = [ba];
  const p = w.players.p1;
  p.money = 200;
  place(w, "p1", ba.x + 0.6, ba.y);
  ba.path = [];
  ba.waitUntil = 1e9;
  p.gear.outfit = { itemId: "guard_outfit", quantity: 1 };
  const r = act(w, "p1", { type: "npcBuy", npcId: ba.id, itemId: "shiv" });
  assert.equal(!r.ok && r.code, "FORBIDDEN");
  p.gear.outfit = { itemId: "prisoner_outfit", quantity: 1 };
  assert.equal(act(w, "p1", { type: "npcBuy", npcId: ba.id, itemId: "shiv" }).ok, true);
});

test("cải trang: cửa văn phòng vẫn cần thẻ; bộ đồ cai ngục + thẻ (thật hoặc giả) mới qua cổng xe tải", async () => {
  const { w, p } = disguisedNear(20);
  const { addItem: add, passFlags, playerSolid } = await import("../_lib/engine");
  w.totalGameMinutes = 16 * 60; // ngoài giờ xe hàng (14:00–14:20 cổng tự mở)
  const office = () => playerSolid(passFlags(w, p))(7, 24);
  const gate = () => playerSolid(passFlags(w, p))(61, 6);
  assert.equal(office(), true, "bộ đồ không mở được cửa thẻ");
  assert.equal(gate(), true);
  add(p.inventory, "fake_keycard", 1);
  assert.equal(office(), false, "thẻ giả mở cửa văn phòng");
  assert.equal(gate(), false, "bộ đồ cai ngục + thẻ qua cổng");
  p.gear.outfit = { itemId: "prisoner_outfit", quantity: 1 };
  assert.equal(gate(), true, "đồ tù + thẻ không qua cổng");
});

test("không mặc đồ: ra hành lang / sân bị nhắc nhở (vi phạm nhỏ), trong xà lim / phòng tắm / y tế thì không; tắt được bằng cấu hình", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  p.gear.outfit = null;
  w.totalGameMinutes = 20 * 60 + 15; // giờ tự do
  place(w, "p1", PRISON_MAP.cells[0].x, PRISON_MAP.cells[0].y);
  assert.equal(violationOf(w, p), null, "trong xà lim");
  place(w, "p1", 27.5, 27.5);
  assert.equal(violationOf(w, p), null, "phòng tắm");
  place(w, "p1", 19.5, 27.5);
  assert.equal(violationOf(w, p), null, "phòng y tế");
  place(w, "p1", 10.5, 22.5);
  assert.equal(violationOf(w, p)?.severity, "minor", "hành lang");
  DISGUISE.outfitRequiredOutsideCell = false;
  try {
    assert.equal(violationOf(w, p), null, "tắt cấu hình");
  } finally {
    DISGUISE.outfitRequiredOutsideCell = true;
  }
});

// ------------------------------------------------------------------ 6. Knock out cai ngục

test("đánh ngất cai ngục: đồng nghiệp không biết ngay; điểm danh bỏ sót -> phát hiện mất tích & điều tra; mỗi ngày chỉ ngất một lần", () => {
  const { w, g, p } = downedGuard();
  const g2 = makeWorld(1, "single", 7).guards.find((x) => x.routeId === "cells")!;
  g2.x = 10.5;
  g2.y = 22.5;
  g2.path = [];
  g2.pauseUntil = 1e9;
  w.guards.push(g2);
  place(w, "p1", 12.5, 38.5);
  g.koDay = 1;
  g.downUntil = w.time + 1e6;
  ticks(w, 10);
  assert.equal(g.missingReported, false, "chưa ai biết");
  w.totalGameMinutes = 1440 + 8 * 60 + 30 + C.violations.penaltyFine * 0 + 9;
  const o = createOutbox();
  for (let i = 0; i < 40; i++) runTick(w, o, new Map());
  assert.equal(g.missingReported, true);
  assert.ok(o.events.some((e) => e.type === "game:guard-missing"));
  assert.notEqual(g2.state, "PATROL", "đồng nghiệp đi điều tra");
  // ngày đã ngất rồi thì không ngất lần hai
  const d = downedGuard(9);
  d.g.downUntil = 0;
  d.g.health = 3;
  d.g.koDay = Math.floor(d.w.totalGameMinutes / 1440) + 1;
  d.g.facing = 0;
  d.w.players.p1.facing = 0;
  act(d.w, "p1", { type: "attack" });
  assert.equal(d.g.downUntil, 0);
  assert.ok(d.g.health >= 1);
  void p;
});

test("đánh cai ngục trong tầm nhìn của cai ngục khác -> báo động (đồng nghiệp truy đuổi)", () => {
  const { w, g } = downedGuard();
  g.downUntil = 0;
  g.health = 60;
  g.facing = 0;
  const other = makeWorld(1, "single", 7).guards.find((x) => x.routeId === "work")!;
  other.x = YARD.x - 3;
  other.y = YARD.y;
  other.facing = 0;
  other.path = [];
  other.pauseUntil = 1e9;
  w.guards.push(other);
  w.players.p1.facing = 0;
  act(w, "p1", { type: "attack" });
  const o = createOutbox();
  for (let i = 0; i < 40; i++) runTick(w, o, new Map());
  assert.ok(other.state === "CHASE" || o.events.some((e) => e.type === "guard:alert"), other.state);
});

// ------------------------------------------------------------------ 7. Knock out tù nhân

test("tù nhân tỉnh dậy thấy mất đồ: hung hăng thì trả thù, hiền thì báo cai ngục", () => {
  const angry = downedInmate("npc_hai");
  openLoot(angry.w, angry.n.id);
  take(angry.w, angry.n.id, "weapon");
  angry.n.downUntil = angry.w.time;
  place(angry.w, "p1", 12.5, 38.5); // đã đi xa
  const o = createOutbox();
  for (let i = 0; i < 4; i++) runTick(angry.w, o, new Map());
  assert.ok(angry.n.grudges.includes("p1"));
  assert.ok(o.events.some((e) => e.type === "inmate:revenge"));
  const calm = downedInmate("npc_tu");
  openLoot(calm.w, calm.n.id);
  take(calm.w, calm.n.id, "bag");
  calm.n.downUntil = calm.w.time;
  place(calm.w, "p1", 12.5, 38.5);
  const h0 = calm.p.stats.personalHeat;
  ticks(calm.w, 4);
  assert.ok(calm.p.stats.personalHeat > h0);
  assert.ok(calm.w.journal.some((j) => j.text.includes("báo cai ngục bị")));
});

test("mặc bộ đồ tù của người khác: chủ đồ gặp thì nhận ra", () => {
  const { w, n, p } = downedInmate("npc_hai");
  openLoot(w, n.id);
  take(w, n.id, "outfit");
  n.downUntil = 0;
  n.combat = "idle";
  n.state = "IDLE";
  n.x = YARD.x + 2;
  n.waitUntil = 1e9;
  n.goalZone = "yard";
  n.path = [];
  const o = createOutbox();
  for (let i = 0; i < 6; i++) runTick(w, o, new Map());
  assert.ok(o.events.some((e) => e.type === "inmate:recognized"));
  assert.equal(n.fightWith, "p1");
  assert.equal(n.gear.outfit?.itemId, "prisoner_outfit", "tỉnh dậy kiếm bộ đồ khác mặc");
  void p;
});

// ------------------------------------------------------------------ 8. Lưu / tải

test("lưu/tải: giữ túi, vũ khí, bộ đồ, trạng thái cải trang và cai ngục đang ngất", () => {
  const { w, g, p } = downedGuard();
  openLoot(w, g.id);
  take(w, g.id, "outfit");
  take(w, g.id, "weapon");
  const loaded = JSON.parse(JSON.stringify(w)) as WorldState;
  assert.deepEqual(loaded.players.p1.gear, p.gear);
  assert.deepEqual(loaded.players.p1.inventory, p.inventory);
  assert.equal(isDisguised(loaded.players.p1), true);
  assert.equal(loaded.guards[0].downUntil, g.downUntil);
  assert.equal(loaded.guards[0].gear.outfit, null);
  ticks(w, 20);
  ticks(loaded, 20);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w));
  void ITEM_DEFS;
});

export type { GuardEntity, InmateEntity };
