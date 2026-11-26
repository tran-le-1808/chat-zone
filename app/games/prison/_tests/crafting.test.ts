/** Hệ thống chế tạo mở rộng: nhóm vật phẩm, linh kiện, công cụ nhiều cấp, sửa chữa, đồ hỗ trợ (Phase 8) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  actionSeconds,
  addItem,
  countItem,
  createOutbox,
  ITEM_DEFS,
  ITEM_IDS,
  maxSlots,
  PRISON_CONFIG as C,
  PRISON_MAP,
  RECIPES,
  RECIPE_BY_ID,
  runTick,
  toolSpec,
  violationOf,
  type ItemId,
  type WorldState,
} from "../_lib/engine";
import { act, guardOn, makeWorld, noGuards, place, seconds, SPOT, ticks } from "./helpers";

function crafter(intelligence = 50) {
  const w = makeWorld(1, "single", 4);
  noGuards(w);
  w.inmates = [];
  const p = w.players.p1;
  p.inventory = [];
  p.stats.intelligence = intelligence;
  p.skills.crafting = 100;
  return { w, p };
}

/** Chế tạo tới khi có món (tỉ lệ thành công 95% tối đa) */
function craftSure(w: WorldState, recipeId: string, refill: [ItemId, number][]) {
  const p = w.players.p1;
  for (let i = 0; i < 8 && !countItem(p.inventory, RECIPE_BY_ID[recipeId].output as ItemId) && p.gear.weapon?.itemId !== RECIPE_BY_ID[recipeId].output; i++) {
    for (const [id, n] of refill) addItem(p.inventory, id, n);
    assert.equal(act(w, "p1", { type: "craft", recipeId }).ok, true);
  }
}

// ------------------------------------------------------------------ dữ liệu

test("vật phẩm: mọi món có nhóm & độ hiếm; đủ nguyên liệu thô, linh kiện, công cụ, hỗ trợ, cải trang, đặc biệt", () => {
  const cats = new Set<string>();
  for (const id of ITEM_IDS) {
    const d = ITEM_DEFS[id];
    assert.ok(d.category, `${id} thiếu nhóm`);
    assert.ok(["common", "uncommon", "rare", "epic"].includes(d.rarity ?? ""), `${id} thiếu độ hiếm`);
    cats.add(d.category!);
  }
  for (const c of ["raw", "component", "tool", "weapon", "disguise", "utility", "special"]) assert.ok(cats.has(c), `thiếu nhóm ${c}`);
  for (const id of ["adhesive", "tape", "metal_sheet", "glass", "gear_parts", "metal_component", "mechanical_component", "electrical_component", "reinforced_material", "reinforced_shovel", "pickaxe", "improved_pickaxe", "improved_cutters", "crowbar", "improved_lockpick", "multitool", "repair_kit", "storage_pouch", "firecracker", "worker_outfit", "map_sketch"])
    assert.ok(ITEM_DEFS[id as ItemId], id);
});

test("công thức: hợp lệ (nguyên liệu tồn tại, số lượng dương), không bản vẽ, không thời gian chờ; bậc ↔ thông minh nhất quán", () => {
  const intelByTier = [0, 15, 25, 35, 45];
  for (const r of RECIPES) {
    assert.ok(ITEM_DEFS[r.output], `${r.id}: thành phẩm`);
    assert.ok(r.ingredients.length > 0, r.id);
    for (const i of r.ingredients) {
      assert.ok(ITEM_DEFS[i.itemId], `${r.id}: ${i.itemId}`);
      assert.ok(Number.isInteger(i.quantity) && i.quantity > 0, `${r.id}: số lượng`);
    }
    assert.equal(r.intelligenceRequired, intelByTier[r.tier - 1], r.id);
    const raw = r as unknown as Record<string, unknown>;
    assert.equal(raw.blueprintItemId, undefined);
    assert.equal(raw.craftSeconds, undefined);
  }
  // nâng cấp công cụ = công cụ cũ + vật liệu
  assert.ok(RECIPE_BY_ID.reinforced_shovel.ingredients.some((i) => i.itemId === "shovel"));
  assert.ok(RECIPE_BY_ID.improved_cutters.ingredients.some((i) => i.itemId === "wire_cutters"));
  // dao đa năng đắt hơn đồ chuyên dụng
  assert.ok(RECIPE_BY_ID.multitool.ingredients.length >= 4);
});

test("nguồn nguyên liệu: nguyên liệu mới có trong tủ trên bản đồ và NPC bán", () => {
  const loot = new Set(PRISON_MAP.interactables.flatMap((i) => i.loot ?? []));
  for (const id of ["adhesive", "tape", "metal_sheet", "gear_parts", "glass"]) assert.ok(loot.has(id as ItemId), `${id} không có trong tủ nào`);
  const sells = JSON.parse(readFileSync(new URL("../_lib/engine/data/inmates.json", import.meta.url), "utf8")) as { sells: { itemId: string }[] }[];
  const sold = new Set(sells.flatMap((d) => d.sells.map((s) => s.itemId)));
  for (const id of ["tape", "adhesive", "metal_sheet", "gear_parts"]) assert.ok(sold.has(id), `${id} không NPC nào bán`);
});

// ------------------------------------------------------------------ chế tạo

test("chế tạo: chuỗi linh kiện -> nâng cấp công cụ; ×N trong một yêu cầu dừng khi hết nguyên liệu; số lượng sai bị từ chối", () => {
  const { w, p } = crafter();
  addItem(p.inventory, "metal_scrap", 6);
  addItem(p.inventory, "adhesive", 3);
  const r = act(w, "p1", { type: "craft", recipeId: "metal_component", quantity: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.data?.attempts, 3, "chỉ đủ nguyên liệu cho 3 lần");
  assert.ok(countItem(p.inventory, "metal_component") >= 2, "linh kiện chồng trong một ô");
  assert.equal(countItem(p.inventory, "metal_scrap") + countItem(p.inventory, "adhesive") <= 3, true);
  for (const q of [0, 11, 2.5]) {
    const bad = act(w, "p1", { type: "craft", recipeId: "metal_component", quantity: q });
    assert.equal(!bad.ok && bad.code, "INVALID_PAYLOAD", `quantity ${q}`);
  }
  // linh kiện -> cụm cơ khí -> nâng cấp kẹp mở khoá
  p.inventory = [];
  craftSure(w, "mechanical_component", [["gear_parts", 1], ["metal_component", 1]]);
  const before = p.inventory.length;
  craftSure(w, "improved_lockpick", [["mechanical_component", 1], ["lockpick", 1]]);
  assert.equal(countItem(p.inventory, "improved_lockpick"), 1);
  assert.ok(RECIPE_BY_ID.improved_lockpick.ingredients.some((i) => i.itemId === "lockpick"), "kẹp cũ là nguyên liệu nâng cấp");
  void before;
});

test("chế tạo: thiếu nguyên liệu / thiếu thông minh / túi đầy thì không chế và không mất nguyên liệu; cùng requestId không chế hai lần", () => {
  const { w, p } = crafter(20);
  addItem(p.inventory, "metal_sheet", 1);
  addItem(p.inventory, "tape", 1);
  const dumb = act(w, "p1", { type: "craft", recipeId: "crowbar" }); // bậc 2 cần 15 -> đủ; bậc 3 cần 25
  assert.equal(dumb.ok, true);
  const locked = act(w, "p1", { type: "craft", recipeId: "worker_outfit" });
  assert.equal(!locked.ok && locked.code, "INSUFFICIENT_ITEMS");
  p.stats.intelligence = 10;
  addItem(p.inventory, "clothes", 1);
  addItem(p.inventory, "cloth", 2);
  addItem(p.inventory, "tape", 1);
  const lowInt = act(w, "p1", { type: "craft", recipeId: "worker_outfit" });
  assert.equal(!lowInt.ok && lowInt.code, "REQUIREMENTS_NOT_MET");
  assert.equal(countItem(p.inventory, "cloth"), 2, "không mất nguyên liệu");
  // túi đầy: nguyên liệu còn dư (không giải phóng ô) và thành phẩm cần ô mới -> từ chối, không mất gì
  p.stats.intelligence = 50;
  p.inventory = [];
  addItem(p.inventory, "metal_scrap", 3);
  addItem(p.inventory, "adhesive", 2);
  for (const id of ["food", "bandage", "wire", "plastic"] as const) addItem(p.inventory, id, 1);
  assert.equal(p.inventory.length, maxSlots(p));
  const before = JSON.stringify(p.inventory);
  const full = act(w, "p1", { type: "craft", recipeId: "metal_component" });
  assert.equal(!full.ok && full.code, "OVER_CAPACITY");
  assert.equal(JSON.stringify(p.inventory), before, "không trừ nguyên liệu");
  // trùng requestId
  p.inventory = [];
  addItem(p.inventory, "metal_scrap", 4);
  addItem(p.inventory, "adhesive", 2);
  act(w, "p1", { type: "craft", recipeId: "metal_component" }, "same-req");
  const dup = act(w, "p1", { type: "craft", recipeId: "metal_component" }, "same-req");
  assert.equal(dup.duplicate, true);
  assert.equal(countItem(p.inventory, "adhesive"), 1, "chỉ trừ nguyên liệu một lần");
});

test("chế tạo: cập nhật nhiệm vụ 'Tay nghề' đúng một lần mỗi món", () => {
  const { w, p } = crafter();
  assert.equal(act(w, "p1", { type: "questAccept", questId: "p_craft" }).ok, true);
  addItem(p.inventory, "cloth", 2);
  addItem(p.inventory, "tape", 1);
  for (let i = 0; i < 6 && !countItem(p.inventory, "storage_pouch"); i++) {
    act(w, "p1", { type: "craft", recipeId: "storage_pouch" });
    if (!countItem(p.inventory, "storage_pouch")) {
      addItem(p.inventory, "cloth", 2);
      addItem(p.inventory, "tape", 1);
    }
  }
  assert.equal(w.personalQuests.p1.p_craft.objectiveProgress.craft, 1);
});

// ------------------------------------------------------------------ công cụ & tương tác thế giới

test("công cụ: cuốc chim đục tường nhanh hơn xẻng; xẻng gia cố đào sàn nhanh hơn; dao đa năng kém đồ chuyên dụng", () => {
  const dur = (tool: ItemId, x: number, y: number, at: { x: number; y: number }) => {
    const { w, p } = crafter();
    addItem(p.inventory, tool, 1);
    place(w, "p1", at.x, at.y);
    const r = act(w, "p1", { type: "dig", x, y });
    assert.equal(r.ok, true, `${tool}: ${JSON.stringify(r)}`);
    return p.channel!.duration;
  };
  const wallAt = { x: 11.5, y: 37.5 }; // tường thường (11,36) phía trên
  const pick = dur("pickaxe", 11, 36, wallAt);
  const shovel = dur("shovel", 11, 36, wallAt);
  assert.ok(pick < shovel, `cuốc ${pick} < xẻng ${shovel}`);
  assert.ok(dur("improved_pickaxe", 11, 36, wallAt) < pick);
  const floorAt = { x: 12.5, y: 38.5 };
  assert.ok(dur("reinforced_shovel", 12, 39, floorAt) < dur("shovel", 12, 39, floorAt));
  // dao đa năng chỉ cấp đào 1: đào được đất sân (mềm), chậm hơn xẻng; sàn xi măng thì không đủ cứng
  const yard = { x: 30.5, y: 8.5 };
  assert.ok(dur("multitool", 31, 8, yard) > dur("shovel", 31, 8, yard), "đa năng chậm hơn xẻng");
  assert.ok(toolSpec("multitool")!.cut!.efficiency < toolSpec("wire_cutters")!.cut!.efficiency);
});

test("công cụ: xà beng cậy lưới gió nhanh nhưng ồn — cai ngục gần đó nghe thấy và tới xem", () => {
  const { w, p } = crafter();
  addItem(p.inventory, "crowbar", 1);
  const t = PRISON_MAP.interactableById.vent.tiles[0];
  place(w, "p1", t.x - 0.5, t.y + 0.5);
  const r = act(w, "p1", { type: "interact", targetId: "vent" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(p.channel!.duration < actionSeconds(C.interaction.openVentSeconds), "nhanh hơn tua vít");
  const g = guardOn(makeWorld(1, "single", 4), "cells");
  g.x = t.x - 3;
  g.y = t.y + 0.5;
  g.facing = Math.PI; // quay lưng
  g.path = [];
  g.pauseUntil = 1e9;
  w.guards = [g];
  const states = new Set<string>();
  for (let i = 0; i < 6; i++) {
    ticks(w, 1);
    states.add(g.state);
  }
  assert.ok(states.has("INVESTIGATE"), `nghe tiếng xà beng: ${[...states].join()}`);
});

test("công cụ: kìm cắt thép cắt rào nhanh hơn; bộ mở khoá tinh / dao đa năng dùng được để giải cứu", () => {
  const fence = (tool: ItemId) => {
    const { w, p } = crafter();
    addItem(p.inventory, tool, 1);
    place(w, "p1", 10.5, 5.5);
    assert.equal(act(w, "p1", { type: "interact", targetId: "fence_inner" }).ok, true);
    return p.channel!.duration;
  };
  assert.ok(fence("improved_cutters") < fence("wire_cutters"));
  assert.ok(fence("multitool") > fence("wire_cutters"));
  for (const tool of ["improved_lockpick", "multitool"] as const) {
    const w = makeWorld(2);
    noGuards(w);
    w.players.p1.status = "KNOCKED_OUT";
    w.players.p1.knockoutDeadline = 0;
    ticks(w, 1);
    const door = PRISON_MAP.solitaryCells[w.players.p1.solitaryCell!].doorId;
    const s = SPOT.solitaryDoor(w.players.p1.solitaryCell!);
    place(w, "p2", s.x, s.y);
    addItem(w.players.p2.inventory, tool, 1);
    assert.equal(act(w, "p2", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: door }).ok, true, tool);
    seconds(w, 10);
    assert.equal(w.players.p1.status, "ACTIVE", `${tool} mở được cửa biệt giam`);
  }
});

test("độ bền: dùng thì mòn, hết thì gãy và mất; Bộ sửa chữa phục hồi 50% nhưng không vượt tối đa", () => {
  const { w, p } = crafter();
  addItem(p.inventory, "crowbar", 1);
  const cb = p.inventory.find((i) => i.itemId === "crowbar")!;
  const max = ITEM_DEFS.crowbar.maxDurability!;
  cb.durability = 1;
  addItem(p.inventory, "repair_kit", 2);
  assert.equal(act(w, "p1", { type: "useItem", itemId: "repair_kit" }).ok, true);
  assert.equal(cb.durability, Math.min(max, 1 + Math.ceil(max / 2)));
  cb.durability = max - 1;
  act(w, "p1", { type: "useItem", itemId: "repair_kit" });
  assert.equal(cb.durability, max, "không vượt tối đa");
  addItem(p.inventory, "repair_kit", 1);
  const none = act(w, "p1", { type: "useItem", itemId: "repair_kit" });
  assert.equal(!none.ok && none.code, "INVALID_STATE", "không có gì để sửa");
  // gãy
  cb.durability = 1;
  const t = PRISON_MAP.interactableById.vent.tiles[0];
  place(w, "p1", t.x - 0.5, t.y + 0.5);
  act(w, "p1", { type: "interact", targetId: "vent" });
  seconds(w, actionSeconds(C.interaction.openVentSeconds) + 0.2);
  assert.equal(w.routes.ventOpen, true);
  assert.equal(countItem(p.inventory, "crowbar"), 0, "hết độ bền thì gãy, mất khỏi túi");
});

// ------------------------------------------------------------------ đồ hỗ trợ & cải trang

test("hỗ trợ: Túi đeo hông +2 ô; Pháo dụ cai ngục tới chỗ nổ; Sơ đồ chép tay hiện cai ngục 90 giây", () => {
  const { w, p } = crafter();
  assert.equal(maxSlots(p), 6);
  addItem(p.inventory, "storage_pouch", 1);
  assert.equal(maxSlots(p), 8);
  // pháo
  place(w, "p1", 30.5, 8.5);
  p.facing = 0;
  const g = guardOn(makeWorld(1, "single", 4), "yard");
  g.x = 38.5;
  g.y = 8.5;
  g.facing = 0;
  g.path = [];
  g.pauseUntil = 1e9;
  w.guards = [g];
  addItem(p.inventory, "firecracker", 1);
  assert.equal(act(w, "p1", { type: "useItem", itemId: "firecracker" }).ok, true);
  assert.equal(g.state, "INVESTIGATE");
  assert.ok(Math.abs(g.lastKnown!.x - 34.5) < 0.01, "tới chỗ pháo nổ, không phải chỗ người ném");
  // sơ đồ
  addItem(p.inventory, "map_sketch", 1);
  act(w, "p1", { type: "useItem", itemId: "map_sketch" });
  assert.ok(w.intelUntil >= w.time + 89);
});

test("cải trang: bộ đồ công nhân cho vào kho / phòng điện trong giờ làm việc; ngoài giờ hoặc đồ tù thì vẫn là khu cấm", () => {
  const { w, p } = crafter();
  place(w, "p1", 50.5, 17.5); // trong kho
  w.totalGameMinutes = 9 * 60 + 30; // ca làm
  assert.equal(violationOf(w, p)?.reason, "vào khu cấm", "đồ tù");
  p.gear.outfit = { itemId: "worker_outfit", quantity: 1 };
  assert.equal(violationOf(w, p), null, "đồ công nhân trong giờ làm");
  w.totalGameMinutes = 20 * 60 + 15;
  assert.equal(violationOf(w, p)?.reason, "vào khu cấm", "ngoài giờ làm");
  // xưởng / kho tính là chỗ làm việc khi đi ca
  const o = createOutbox();
  w.totalGameMinutes = 9 * 60 + 30;
  runTick(w, o, new Map());
  assert.equal(p.violationsToday.count, 0);
});
