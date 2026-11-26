/**
 * Prompt "Nhặt đồ, vứt đồ, lối chơi & vượt ngục" — Phần A / D1: đồ trên mặt đất.
 * Vứt ra ô trước mặt, ném qua rào, nhặt tất cả, gộp chồng, cai ngục dọn đồ cấm, tù nhân nhặt đồ,
 * tự biến mất, dọn lúc điểm danh, lưu / tải.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  countItem,
  createOutbox,
  FLOOR,
  ITEM_DEFS,
  migrateWorld,
  PRISON_MAP,
  sweepFloorContraband,
  type WorldState,
} from "../_lib/engine";
import inmatesJson from "../_lib/engine/data/inmates.json";
import { act, makeWorld, noGuards, place, seconds } from "./helpers";

const isGreedy = (defId: string) => (inmatesJson as { id: string; personality: string }[]).some((d) => d.id === defId && d.personality === "greedy");

function soloWorld(seed = 7) {
  const w = makeWorld(1, "single", seed);
  noGuards(w);
  w.inmates = [];
  w.totalGameMinutes = 12 * 60; // giờ ăn trưa: đứng ngoài sân không vi phạm
  return { w, p: w.players.p1 };
}

const floorOf = (w: WorldState) => Object.values(w.floorItems);

test("vứt: rơi giữa ô trước mặt theo hướng nhìn; ô trước mặt bị chắn (hàng rào) thì rơi ở ô đang đứng; mặc định 1 món, cả chồng khi gửi đủ số", () => {
  const { w, p } = soloWorld();
  place(w, "p1", 20.5, 8.5);
  p.facing = 0; // nhìn sang Đông
  addItem(p.inventory, "wire", 3);
  let r = act(w, "p1", { type: "dropItem", itemId: "wire", quantity: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(floorOf(w).map((f) => [f.x, f.y, f.item.quantity]), [[21.5, 8.5, 1]]);
  assert.equal(countItem(p.inventory, "wire"), 2);
  // nhìn lên hàng rào trong (y = 4): rơi ngay dưới chân
  place(w, "p1", 20.5, 5.5);
  p.facing = -Math.PI / 2;
  r = act(w, "p1", { type: "dropItem", itemId: "wire", quantity: 2 });
  assert.equal(r.ok, true);
  const f = floorOf(w).find((x) => x.item.quantity === 2)!;
  assert.deepEqual([f.x, f.y], [20.5, 5.5], "rơi ở ô đang đứng");
  assert.equal(f.droppedBy, "p1");
  assert.equal(f.droppedAt, w.totalGameMinutes);
  assert.equal(countItem(p.inventory, "wire"), 0);
  r = act(w, "p1", { type: "dropItem", itemId: "wire", quantity: 1 });
  assert.equal(!r.ok && r.code, "INSUFFICIENT_ITEMS");
});

test("gộp chồng: nguyên liệu tối đa 5 / ô, socola 3, vũ khí & bộ đồ 1; nhặt món cùng loại gộp vào ô đang có", () => {
  assert.equal(ITEM_DEFS.wire.maxStack, 5);
  assert.equal(ITEM_DEFS.cloth.maxStack, 5);
  assert.equal(ITEM_DEFS.chocolate.maxStack, 3);
  assert.equal(ITEM_DEFS.shiv.maxStack, 1);
  assert.equal(ITEM_DEFS.guard_outfit.maxStack, 1);
  const { w, p } = soloWorld();
  place(w, "p1", 20.5, 8.5);
  p.facing = 0;
  addItem(p.inventory, "wire", 7);
  assert.deepEqual(p.inventory.filter((i) => i.itemId === "wire").map((i) => i.quantity).sort(), [2, 5]);
  act(w, "p1", { type: "dropItem", itemId: "wire", quantity: 1 });
  const slots = p.inventory.length;
  const id = floorOf(w)[0].id;
  place(w, "p1", 21.5, 8.5);
  assert.equal(act(w, "p1", { type: "interact", targetId: id }).ok, true);
  assert.equal(p.inventory.length, slots, "gộp vào ô đang có, không tốn ô mới");
  assert.equal(countItem(p.inventory, "wire"), 7);
});

test("nhặt: vũ khí vào ô vũ khí; nhặt tất cả theo thứ tự gần → xa tới khi đầy túi; túi đầy thì báo OVER_CAPACITY", () => {
  const { w, p } = soloWorld();
  place(w, "p1", 20.5, 8.5);
  p.inventory = [];
  w.floorItems.a = { id: "a", x: 20.5, y: 8.5, item: { itemId: "shiv", quantity: 1, durability: 5 } };
  assert.equal(act(w, "p1", { type: "interact", targetId: "a" }).ok, true);
  assert.equal(p.gear.weapon?.itemId, "shiv", "vũ khí vào ô vũ khí");
  // 8 món khác loại quanh chân, túi 6 ô: nhặt 6 món gần nhất
  const ids = ["wire", "cloth", "plastic", "spoon", "wood", "food", "bandage", "sugar"] as const;
  ids.forEach((itemId, i) => {
    w.floorItems[`f${i}`] = { id: `f${i}`, x: 20.5 + (i % 2 ? 0.1 : -0.1) * (i + 1), y: 8.5, item: { itemId, quantity: 1 } };
  });
  w.floorItems.far = { id: "far", x: 20.5 + FLOOR.pickupRadiusTiles + 0.5, y: 8.5, item: { itemId: "flour", quantity: 1 } };
  const r = act(w, "p1", { type: "pickupAll" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(p.inventory.length, 6);
  assert.deepEqual(p.inventory.map((i) => i.itemId).sort(), [...ids.slice(0, 6)].sort(), "lấy 6 món gần nhất");
  assert.ok(w.floorItems.far, "ngoài bán kính nhặt thì không lấy");
  assert.equal(r.ok && r.data?.full, true);
  const again = act(w, "p1", { type: "pickupAll" });
  assert.equal(!again.ok && again.code, "OVER_CAPACITY", "túi đầy");
});

test("ném: bay tối đa ~3.5 ô, dừng trước tường, bay qua được hàng rào; tiếng rơi kéo cai ngục gần đó tới (đánh lạc hướng)", () => {
  const { w, p } = soloWorld();
  addItem(p.inventory, "food", 3);
  place(w, "p1", 20.5, 8.5);
  let r = act(w, "p1", { type: "throwItem", itemId: "food", dirX: 1, dirY: 0 });
  assert.equal(r.ok, true, JSON.stringify(r));
  let f = floorOf(w).at(-1)!;
  assert.ok(f.x > 23.5 && f.x <= 20.5 + FLOOR.throwRangeTiles + 1e-6, `rơi xa ${f.x}`);
  // sát tường Đông của sân (x = 45 là tường)
  place(w, "p1", 43.5, 8.5);
  act(w, "p1", { type: "throwItem", itemId: "food", dirX: 1, dirY: 0 });
  f = floorOf(w).at(-1)!;
  assert.ok(f.x < 45, "không bay xuyên tường");
  // qua hàng rào phía Bắc
  place(w, "p1", 20.5, 5.5);
  act(w, "p1", { type: "throwItem", itemId: "food", dirX: 0, dirY: -1 });
  f = floorOf(w).at(-1)!;
  assert.ok(f.y < 4, `bay qua hàng rào trong (y=${f.y})`);
  // tiếng động: cai ngục trong bán kính đi điều tra chỗ đồ rơi
  const w2 = makeWorld(1, "single", 7);
  w2.inmates = [];
  w2.totalGameMinutes = 12 * 60;
  const g = w2.guards.find((x) => !x.tower)!;
  w2.guards = [g];
  g.x = 26.5;
  g.y = 9.5;
  g.state = "PATROL";
  place(w2, "p1", 20.5, 8.5);
  addItem(w2.players.p1.inventory, "food", 1);
  r = act(w2, "p1", { type: "throwItem", itemId: "food", dirX: 1, dirY: 0 });
  assert.equal(r.ok, true);
  assert.equal(g.state, "INVESTIGATE");
  assert.ok(g.lastKnown && Math.abs(g.lastKnown.x - 24) < 0.6, "tới chỗ đồ rơi");
});

test("vứt đồ kim loại kêu to: cai ngục trong ~2.5 ô nghe thấy; đồ mềm thì không", () => {
  const w = makeWorld(1, "single", 9);
  w.inmates = [];
  w.totalGameMinutes = 12 * 60;
  const g = w.guards.find((x) => !x.tower)!;
  w.guards = [g];
  g.x = 22.5;
  g.y = 10.5;
  g.state = "PATROL";
  const p = w.players.p1;
  place(w, "p1", 20.5, 8.5);
  p.facing = 0;
  addItem(p.inventory, "cloth", 1);
  addItem(p.inventory, "metal_scrap", 1);
  act(w, "p1", { type: "dropItem", itemId: "cloth", quantity: 1 });
  assert.equal(g.state, "PATROL", "vải rơi không kêu");
  act(w, "p1", { type: "dropItem", itemId: "metal_scrap", quantity: 1 });
  assert.equal(g.state, "INVESTIGATE", "sắt vụn rơi kêu to");
});

test("cai ngục thấy đồ cấm trên đất: tới nhặt, tịch thu (ghi tên người vứt), tăng nghi ngờ; đồ thường để yên", () => {
  const w = makeWorld(1, "single", 11);
  w.inmates = [];
  w.totalGameMinutes = 12 * 60;
  const g = w.guards.find((x) => !x.tower)!;
  w.guards = [g];
  g.x = 24.5;
  g.y = 8.5;
  g.facing = Math.PI; // nhìn về phía Tây
  g.path = [];
  g.state = "PATROL";
  w.floorItems.c = { id: "c", x: 21.5, y: 8.5, item: { itemId: "file", quantity: 1 }, droppedAt: w.totalGameMinutes, droppedBy: "p1" };
  w.floorItems.n = { id: "n", x: 21.5, y: 9.5, item: { itemId: "food", quantity: 1 }, droppedAt: w.totalGameMinutes };
  place(w, "p1", 10.5, 8.5);
  const heat = w.teamHeat;
  for (let i = 0; i < 30 && w.floorItems.c; i++) seconds(w, 0.5);
  assert.equal(w.floorItems.c, undefined, "đồ cấm bị nhặt");
  assert.ok(w.floorItems.n, "đồ thường vẫn nằm đó");
  assert.ok(w.confiscation.items.some((e) => e.item.itemId === "file" && e.playerId === "p1"), "vào kho tịch thu, ghi người vứt");
  assert.ok(w.teamHeat > heat, "nghi ngờ tăng");
  assert.ok(w.journal.some((j) => j.text.includes("tịch thu")));
});

test("tù nhân NPC nhặt đồ dưới chân theo tính cách (tham lam nhặt nhiều nhất), đồ vào túi của họ", () => {
  assert.ok(FLOOR.inmatePickupChance.greedy > FLOOR.inmatePickupChance.calm);
  const w = makeWorld(1, "single", 13);
  noGuards(w);
  w.totalGameMinutes = 12 * 60;
  const n = w.inmates.find((x) => isGreedy(x.defId))!;
  assert.ok(n, "có tù nhân tham lam");
  w.inmates = [n];
  n.state = "IDLE";
  n.path = [];
  n.waitUntil = 1e9;
  n.bag = [];
  w.floorItems.x = { id: "x", x: n.x, y: n.y, item: { itemId: "chocolate", quantity: 1 }, droppedAt: w.totalGameMinutes };
  for (let i = 0; i < 40 && w.floorItems.x; i++) seconds(w, 0.5);
  assert.equal(w.floorItems.x, undefined, "tù nhân đã nhặt");
  assert.equal(countItem(n.bag, "chocolate"), 1);
});

test("đồ trên đất tự biến mất sau 2 ngày game; điểm danh dọn đồ cấm ngoài xà lim (trong xà lim chờ khám phòng)", () => {
  const { w } = soloWorld();
  assert.equal(FLOOR.worldItemDespawnDays, 2);
  w.floorItems.old = { id: "old", x: 20.5, y: 8.5, item: { itemId: "food", quantity: 1 }, droppedAt: w.totalGameMinutes - 2 * 1440 };
  w.floorItems.fresh = { id: "fresh", x: 20.5, y: 9.5, item: { itemId: "food", quantity: 1 }, droppedAt: w.totalGameMinutes - 1440 };
  w.floorItems.legacy = { id: "legacy", x: 20.5, y: 10.5, item: { itemId: "food", quantity: 1 } };
  seconds(w, 0.1);
  assert.equal(w.floorItems.old, undefined, "quá 2 ngày -> biến mất");
  assert.ok(w.floorItems.fresh);
  assert.ok(Math.abs((w.floorItems.legacy.droppedAt ?? -99) - w.totalGameMinutes) < 1, "bản lưu cũ: tính từ lúc tải");
  // điểm danh
  const cell = w.players.p1.cellIndex;
  const c = PRISON_MAP.cells[cell];
  w.floorItems.yard = { id: "yard", x: 20.5, y: 7.5, item: { itemId: "file", quantity: 1 }, droppedAt: w.totalGameMinutes };
  w.floorItems.cell = { id: "cell", x: c.x, y: c.y, item: { itemId: "file", quantity: 1 }, droppedAt: w.totalGameMinutes };
  assert.equal(sweepFloorContraband(w, createOutbox()), 1);
  assert.equal(w.floorItems.yard, undefined);
  assert.ok(w.floorItems.cell, "đồ cấm trong xà lim chờ khám phòng");
  assert.ok(w.floorItems.fresh, "đồ thường không bị dọn");
});

test("lưu / tải giữ nguyên đồ trên đất (vị trí, người vứt, thời điểm rơi), vật chứa, túi, ô vũ khí, ô bộ đồ", () => {
  const { w, p } = soloWorld();
  place(w, "p1", 20.5, 8.5);
  p.facing = 0;
  addItem(p.inventory, "wire", 2);
  act(w, "p1", { type: "dropItem", itemId: "wire", quantity: 2 });
  addItem(p.inventory, "food", 1);
  const loaded = migrateWorld(JSON.parse(JSON.stringify(w)))!;
  assert.deepEqual(loaded.floorItems, w.floorItems);
  assert.deepEqual(loaded.containers, w.containers);
  assert.deepEqual(loaded.players.p1.inventory, p.inventory);
  assert.deepEqual(loaded.players.p1.gear, p.gear);
});
