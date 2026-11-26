/** Test theo tài liệu "Thể lực, điểm thông minh, chế tạo theo thông minh, thư viện & đồ ăn bổ sung" (mục 5) */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  canRecoverStamina,
  countItem,
  craftFailureLoss,
  craftSuccessChance,
  createOutbox,
  ITEM_DEFS,
  machineId,
  PRISON_CONFIG as C,
  PRISON_MAP,
  RECIPE_BY_ID,
  RECIPES,
  runTick,
  SHOP_ITEMS,
  stepMove,
  moveContextFor,
  ROUTINE,
  type WorldState,
  actionSeconds,
} from "../_lib/engine";
import { act, makeWorld, noGuards, place, seconds, ticks } from "./helpers";

const S = C.stamina;
const I = C.intelligence;

function lonely(seed = 31) {
  const w = makeWorld(1, "single", seed);
  noGuards(w);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  return { w, p: w.players.p1 };
}

const at = (id: string) => {
  const t = PRISON_MAP.interactableById[id].tiles[0];
  return { x: t.x + 0.5, y: t.y + 0.5 };
};

// ------------------------------------------------------------------ 1. Tiêu hao

test("thể lực: tối đa 100; 1 lần gym hoàn thành −4; dưới 4 không bắt đầu lần mới; tập dở tính theo tỉ lệ nhịp", () => {
  const { w, p } = lonely();
  assert.equal(p.stats.maxEnergy, S.staminaMax);
  assert.equal(p.stats.energy, 100);
  w.totalGameMinutes = 15 * 60 + 5;
  place(w, "p1", 38.5, 28.5);
  assert.equal(act(w, "p1", { type: "gymStart", machineId: machineId("pressBench", 0) }).ok, true);
  for (let i = 0; i < 10; i++) {
    act(w, "p1", { type: "gymPress", side: 0 });
    act(w, "p1", { type: "gymPress", side: 1 });
  }
  assert.equal(p.stats.energy, 96);
  // tập dở 5/10 nhịp rồi nghỉ: −2
  for (let i = 0; i < 5; i++) {
    act(w, "p1", { type: "gymPress", side: 0 });
    act(w, "p1", { type: "gymPress", side: 1 });
  }
  act(w, "p1", { type: "gymStop" });
  assert.equal(p.stats.energy, 94);
  p.stats.energy = 3.9;
  const r = act(w, "p1", { type: "gymStart", machineId: machineId("treadmill", 0) });
  assert.equal(!r.ok && r.message, "Hết thể lực, hãy nghỉ hoặc ăn");
});

test("thể lực: đào −2, trèo rào −6, chế tạo −1 mỗi lần, chạy −1 mỗi giây", () => {
  const { w, p } = lonely();
  // chế tạo tức thì: −1 thể lực mỗi lần
  p.role = "HACKER";
  p.skills.crafting = 0;
  p.stats.intelligence = 50;
  addItem(p.inventory, "makeshift_rope", 3);
  addItem(p.inventory, "metal_scrap", 1);
  place(w, "p1", 30.5, 8.5);
  act(w, "p1", { type: "craft", recipeId: "rope" });
  assert.equal(p.stats.energy, 100 - S.craftStaminaCost);
  // trèo: buộc dây leo lên hàng rào trong của sân
  p.stats.energy = 50;
  if (!countItem(p.inventory, "rope")) addItem(p.inventory, "rope", 1);
  place(w, "p1", 10.5, 5.5);
  assert.equal(act(w, "p1", { type: "interact", targetId: "fence_inner" }).ok, true);
  seconds(w, 20);
  assert.deepEqual(w.routes.fenceGaps, ["10,4"]);
  assert.equal(p.stats.energy, 50 - S.climbCost);
  // chạy: −1 mỗi giây (Sức bền 5 -> hệ số 1)
  p.stats.energy = 50;
  place(w, "p1", 30.5, 8.5);
  for (let i = 0; i < 20; i++) runTick(w, createOutbox(), new Map([["p1", [{ sequence: p.lastSeq + 1, directionX: i % 2 ? 1 : -1, directionY: 0, sprint: true }]]]));
  assert.ok(Math.abs(p.stats.energy - (50 - C.player.sprintDrain)) < 0.01, `thể lực ${p.stats.energy}`);
});

// ------------------------------------------------------------------ 2. Hồi phục

test("ngủ giường: mọi lúc +4 thể lực/giây, dừng ở 100 nhưng KHÔNG tự dậy; ngủ được cả khi thể lực đầy; bấm Dậy thì dậy", () => {
  const { w, p } = lonely();
  for (const minute of [1440 + 23 * 60, 2 * 1440 + 13 * 60 + 30]) {
    w.totalGameMinutes = minute;
    if (p.bed) {
      seconds(w, 0.5);
      act(w, "p1", { type: "wake" });
      seconds(w, 0.5);
    }
    place(w, "p1", at("bedrest_0").x, at("bedrest_0").y + 1);
    p.stats.energy = 30;
    assert.equal(act(w, "p1", { type: "interact", targetId: "bedrest_0" }).ok, true);
    seconds(w, 5);
    assert.ok(Math.abs(p.stats.energy - 50) <= 0.3, `thể lực ${p.stats.energy}`);
    seconds(w, 20);
    assert.equal(p.stats.energy, 100, "không vượt 100");
    assert.equal(p.channel?.kind, "sleep", "đầy vẫn nằm, không tự dậy");
  }
  seconds(w, 0.5);
  assert.equal(act(w, "p1", { type: "wake" }).ok, true);
  assert.equal(p.channel, null, "Dậy");
  assert.equal(p.bed, null);
  seconds(w, 0.5);
  p.stats.energy = 100;
  assert.equal(act(w, "p1", { type: "interact", targetId: "bedrest_0" }).ok, true, "đầy thể lực vẫn ngủ được (nằm chờ thời gian)");
  assert.equal(act(w, "p1", { type: "wake" }).ok, false, "chống bấm lặp 300 ms");
});

test("ngủ giường: không miễn điểm danh — bị gọi dậy trước giờ điểm danh (chuông cảnh báo) và khi cai ngục gọi tên", () => {
  const { w, p } = lonely();
  w.totalGameMinutes = 1440 + 8 * 60 + 30 - C.rollcall.warningMinutes - 0.5;
  place(w, "p1", at("bedrest_0").x, at("bedrest_0").y);
  p.stats.energy = 1;
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  const o = createOutbox();
  for (let i = 0; i < 20 && p.channel; i++) runTick(w, o, new Map());
  assert.equal(p.channel, null, "bị gọi dậy");
  assert.ok(o.events.some((e) => e.type === "game:rollcall-warning"));
  assert.ok(o.events.some((e) => e.type === "player:woken" && e.playerId === "p1"));
  assert.ok(p.stats.energy < 100);
  // cai ngục gọi tên lúc đêm (điểm danh đêm)
  const night = ROUTINE.nightChecks.find((n) => n.kind === "rollcall")!;
  w.totalGameMinutes = 2 * 1440 + night.minute - 0.5;
  p.stats.energy = 1;
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  ticks(w, 20);
  assert.equal(p.channel, null, "bị gọi tên thì dậy");
});

test("phòng tắm: vòi luôn xả nước; đứng ô dưới vòi +4 thể lực/giây mọi giờ, bước ra thì dừng; tự cởi bộ đồ và mặc lại", () => {
  const { w, p } = lonely();
  const spot = PRISON_MAP.interactableById.shower_0.showerSpot!;
  for (const minute of [16 * 60 + 5, 20 * 60 + 5, 1440 + 3 * 60]) {
    w.totalGameMinutes = minute;
    place(w, "p1", spot.x + 0.5, spot.y + 0.5);
    p.stats.energy = 40;
    seconds(w, 5);
    assert.ok(Math.abs(p.stats.energy - 60) <= 0.5, `thể lực ${p.stats.energy} lúc ${minute}`);
    assert.equal(p.gear.outfit, null, "đứng dưới vòi: bộ đồ để trên giá");
    assert.ok(p.showerOutfit, "bộ đồ trên giá");
    // bước ra: dừng hồi, mặc lại
    place(w, "p1", spot.x + 0.5, spot.y - 0.5);
    seconds(w, 0.2);
    const e = p.stats.energy;
    seconds(w, 2);
    assert.ok(Math.abs(p.stats.energy - e) < 0.01, "bước ra thì dừng");
    assert.equal((p.gear.outfit as { itemId: string } | null)?.itemId, "prisoner_outfit", "mặc lại khi bước ra");
  }
  // không cần bấm tương tác, tương tác cũng không mở thao tác nào
  place(w, "p1", spot.x + 0.5, spot.y + 0.5);
  const r = act(w, "p1", { type: "interact", targetId: "shower_0" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(p.channel, null);
});

test("hồi phục: không hồi khi nghỉ trong khu cấm hoặc khi đang bị truy nã", () => {
  const { w, p } = lonely();
  assert.equal(canRecoverStamina({ x: 7.5, y: 26.5, wantedLevel: 0 }), false, "văn phòng là khu cấm");
  assert.equal(canRecoverStamina({ x: 30.5, y: 8.5, wantedLevel: 0 }), true);
  w.totalGameMinutes = 20 * 60 + 5;
  place(w, "p1", at("bedrest_0").x, at("bedrest_0").y);
  p.stats.energy = 30;
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  for (let i = 0; i < 100; i++) {
    p.wantedLevel = 1; // giữ trạng thái truy nã (không để tự giảm trong lúc test)
    p.wantedSeenAt = w.totalGameMinutes;
    runTick(w, createOutbox(), new Map());
  }
  assert.equal(p.stats.energy, 30, "đang bị truy nã: nằm cũng không hồi");
});

// ------------------------------------------------------------------ 3. Thể lực bằng 0

test("thể lực 0: không tập gym, không chạy bộ, không đào, không trèo; vẫn đi bộ (chậm 15% khi < 20)", () => {
  const { w, p } = lonely();
  p.stats.energy = 0;
  w.totalGameMinutes = 15 * 60 + 5;
  place(w, "p1", 38.5, 28.5);
  assert.equal(act(w, "p1", { type: "gymStart", machineId: machineId("pressBench", 0) }).ok, false);
  assert.equal(act(w, "p1", { type: "gymStart", machineId: machineId("treadmill", 0) }).ok, false);
  addItem(p.inventory, "shovel", 1);
  place(w, "p1", at("tunnel_0").x, at("tunnel_0").y);
  const dig = act(w, "p1", { type: "tunnel", cellIndex: 0, op: "dig" });
  assert.equal(!dig.ok && dig.message, "Hết thể lực, hãy nghỉ hoặc ăn");
  addItem(p.inventory, "rope", 1);
  place(w, "p1", 10.5, 5.5);
  assert.equal(act(w, "p1", { type: "interact", targetId: "fence_inner" }).ok, false);
  // đi bộ vẫn được, chậm 15%
  place(w, "p1", 30.5, 8.5);
  const ctx = moveContextFor(w, p);
  const walk = (energy: number) => stepMove(ctx, { x: 30.5, y: 8.5, facing: 0, energy }, { directionX: 1, directionY: 0, sprint: false }).x - 30.5;
  assert.ok(walk(0) > 0);
  assert.ok(Math.abs(walk(0) / walk(100) - S.lowSpeedMultiplier) < 1e-3);
  assert.ok(Math.abs(walk(19.9) / walk(20) - S.lowSpeedMultiplier) < 1e-3);
  // không chạy nhanh được khi hết thể lực
  assert.equal(stepMove(ctx, { x: 30.5, y: 8.5, facing: 0, energy: 0 }, { directionX: 1, directionY: 0, sprint: true }).sprinting, false);
});

// ------------------------------------------------------------------ 4. Thông minh & thư viện

function atShelf(w: WorldState, shelf = "bookshelf_0") {
  const t = PRISON_MAP.interactableById[shelf].tiles[0];
  place(w, "p1", t.x + 0.5, t.y + 1.5);
  w.totalGameMinutes = 20 * 60 + 5; // giờ tự do
}

test("thông minh: bắt đầu 20; E ở kệ đọc 5 giây +1; di chuyển giữa chừng không cộng; thư viện mở mọi giờ", () => {
  const { w, p } = lonely();
  assert.equal(p.stats.intelligence, 20);
  assert.ok(PRISON_MAP.interactables.filter((i) => i.kind === "bookshelf").length >= 4, "thư viện có nhiều kệ (dữ liệu Tiled)");
  atShelf(w);
  assert.equal(act(w, "p1", { type: "interact", targetId: "bookshelf_0" }).ok, true);
  assert.equal(p.channel?.duration, actionSeconds(I.shelfReadSeconds));
  seconds(w, actionSeconds(I.shelfReadSeconds) - 0.3);
  assert.equal(p.stats.intelligence, 20);
  seconds(w, 0.5);
  assert.equal(p.stats.intelligence, 21);
  assert.ok(w.journal.some((j) => j.text === "Đọc kệ sách lịch sử, thông minh 21/50"));
  // di chuyển giữa chừng
  assert.equal(act(w, "p1", { type: "interact", targetId: "bookshelf_1" }).ok, true);
  seconds(w, 2);
  runTick(w, createOutbox(), new Map([["p1", Array.from({ length: 3 }, (_, i) => ({ sequence: p.lastSeq + 1 + i, directionX: 1, directionY: 0, sprint: false }))]]));
  assert.equal(p.channel, null);
  seconds(w, 5);
  assert.equal(p.stats.intelligence, 21, "không cộng");
  // ngoài giờ
  w.totalGameMinutes = 10 * 60;
  // thư viện mở cả ngày: 10:00, 23:00, giữa giờ điểm danh
  for (const minute of [10 * 60, 23 * 60, 8 * 60 + 40]) {
    atShelf(w, "bookshelf_3");
    w.totalGameMinutes = 3 * 1440 + minute;
    assert.equal(act(w, "p1", { type: "interact", targetId: "bookshelf_3" }).ok, true, `lúc ${minute}`);
    act(w, "p1", { type: "cancelChannel" });
  }
});

test("thông minh: đọc sách ở thư viện luôn +1 mỗi lần đọc xong (đọc lại ngay cùng kệ vẫn cộng); không vượt 50", () => {
  const { w, p } = lonely();
  atShelf(w);
  for (const expected of [21, 22, 23]) {
    act(w, "p1", { type: "interact", targetId: "bookshelf_0" });
    seconds(w, I.shelfReadSeconds + 0.1);
    assert.equal(p.stats.intelligence, expected, "cùng kệ, đọc liền vẫn +1");
  }
  act(w, "p1", { type: "interact", targetId: "bookshelf_1" });
  seconds(w, I.shelfReadSeconds + 0.1);
  assert.equal(p.stats.intelligence, 24);
  // trần 50
  p.stats.intelligence = 50;
  w.totalGameMinutes += 120;
  w.totalGameMinutes = 2 * 1440 + 20 * 60 + 5;
  act(w, "p1", { type: "interact", targetId: "bookshelf_2" });
  seconds(w, I.shelfReadSeconds + 0.1);
  assert.equal(p.stats.intelligence, I.intelligenceMax);
});

// ------------------------------------------------------------------ 5. Suy giảm

test("suy giảm: 08:00 mỗi ngày thông minh −2; không xuống dưới 0", () => {
  const { w, p } = lonely();
  w.totalGameMinutes = 1440 + 7 * 60 + 58;
  const o = createOutbox();
  for (let i = 0; i < 200; i++) runTick(w, o, new Map());
  assert.equal(p.stats.intelligence, 18);
  assert.ok(o.events.some((e) => e.type === "library:decay" && e.text === "🧠 Ngày mới: thông minh −2"));
  p.stats.intelligence = 1;
  w.totalGameMinutes = 2 * 1440 + 7 * 60 + 58;
  ticks(w, 200);
  assert.equal(p.stats.intelligence, 0);
  w.totalGameMinutes = 3 * 1440 + 7 * 60 + 58;
  ticks(w, 200);
  assert.equal(p.stats.intelligence, 0);
});

// ------------------------------------------------------------------ 6. Chế tạo theo bậc

test("chế tạo bậc: không còn bản vẽ; thiếu thông minh thì không chế được dù đủ nguyên liệu; đủ thì chế được ở mọi nơi", () => {
  assert.ok(!Object.keys(ITEM_DEFS).some((id) => id.startsWith("bp_")), "không còn vật phẩm bản vẽ");
  for (const r of RECIPES) {
    assert.ok(r.tier >= 1 && r.tier <= 5);
    assert.equal(r.intelligenceRequired, C.crafting.tierIntelligence[r.tier - 1]);
    assert.equal((r as unknown as Record<string, unknown>).craftSeconds, undefined, "không còn thời gian chế tạo");
    assert.equal((r as unknown as Record<string, unknown>).blueprintItemId, undefined);
  }
  assert.equal(RECIPE_BY_ID.rope.tier, 5);
  assert.equal(RECIPE_BY_ID.support.intelligenceRequired, 0);
  const { w, p } = lonely();
  place(w, "p1", 22.5, 16.5); // nhà ăn, không có bàn
  addItem(p.inventory, "plastic", 1);
  addItem(p.inventory, "key_mold", 1);
  const low = act(w, "p1", { type: "craft", recipeId: "fake_key" }); // bậc 3 cần 25
  assert.equal(!low.ok && low.code, "REQUIREMENTS_NOT_MET");
  p.stats.intelligence = 25;
  assert.equal(act(w, "p1", { type: "craft", recipeId: "fake_key" }).ok, true);
  // bậc 1 chế được ngay với 0 thông minh
  const { w: w2, p: q } = lonely();
  q.stats.intelligence = 0;
  addItem(q.inventory, "wood", 2);
  place(w2, "p1", 30.5, 8.5);
  assert.equal(act(w2, "p1", { type: "craft", recipeId: "support" }).ok, true);
});

// ------------------------------------------------------------------ 7. Tỉ lệ thành công

test("tỉ lệ thành công: vừa đủ 70%, dư 10 điểm 95% (trần), thiếu thì 0; thất bại mất 50% nguyên liệu", () => {
  const base = { role: "HACKER" as const, skills: { crafting: 0, fitness: 0, dexterity: 0, social: 0 } };
  const st = (intelligence: number) => ({ ...base, stats: { intelligence } as never });
  assert.equal(craftSuccessChance(st(25), "fake_key"), 0.7);
  assert.equal(craftSuccessChance(st(29), "fake_key"), 0.8);
  assert.equal(craftSuccessChance(st(35), "fake_key"), 0.95);
  assert.equal(craftSuccessChance(st(50), "fake_key"), 0.95);
  assert.equal(craftSuccessChance(st(24), "fake_key"), 0);
  // Khéo tay vẫn cộng thêm nhưng không vượt 95%
  assert.ok(craftSuccessChance({ ...st(25), skills: { ...base.skills, crafting: 100 } }, "fake_key") > 0.7);
  assert.deepEqual(craftFailureLoss("rope"), [
    { itemId: "makeshift_rope", quantity: 1 },
    { itemId: "metal_scrap", quantity: 1 },
  ]);
  assert.deepEqual(craftFailureLoss("support"), [{ itemId: "wood", quantity: 1 }]);
  // thất bại thật: tìm hạt giống làm hỏng lần chế tạo đầu
  let failed = false;
  for (let seed = 1; seed < 80 && !failed; seed++) {
    const { w, p } = lonely(seed);
    p.role = "HACKER";
    p.skills.crafting = 0;
    p.stats.intelligence = 0;
    addItem(p.inventory, "wood", 2);
    place(w, "p1", 30.5, 8.5);
    act(w, "p1", { type: "craft", recipeId: "support" });
    if (!countItem(p.inventory, "support")) {
      failed = true;
      assert.equal(countItem(p.inventory, "wood"), 1, "mất 50% (1/2 gỗ)");
      assert.equal(p.stats.intelligence, 0, "không phạt thông minh");
    }
  }
  assert.ok(failed, "có lần thất bại để kiểm tra");
});

// ------------------------------------------------------------------ 8. Đồ ăn

test("đồ ăn: socola +25; chờ 30 giây mới ăn lại; không vượt 100; bán ở căng tin; món tự chế đúng bậc", () => {
  const { w, p } = lonely();
  assert.equal(ITEM_DEFS.chocolate.staminaRestore, 25);
  assert.equal(ITEM_DEFS.chocolate.consumable, true);
  assert.equal(ITEM_DEFS.chocolate.cooldownSeconds, 30);
  assert.equal(ITEM_DEFS.chocolate.contraband, false);
  for (const id of ["chocolate", "energy_bar", "condensed_milk"] as const) assert.ok(SHOP_ITEMS.some((s) => s.itemId === id), `căng tin bán ${id}`);
  p.stats.energy = 50;
  addItem(p.inventory, "chocolate", 3);
  assert.equal(act(w, "p1", { type: "useItem", itemId: "chocolate" }).ok, true);
  assert.equal(p.stats.energy, 75);
  const again = act(w, "p1", { type: "useItem", itemId: "chocolate" });
  assert.equal(!again.ok && again.code, "RATE_LIMITED");
  assert.equal(countItem(p.inventory, "chocolate"), 2, "không mất món khi đang chờ");
  // món khác không chung thời gian chờ
  addItem(p.inventory, "condensed_milk", 1);
  assert.equal(act(w, "p1", { type: "useItem", itemId: "condensed_milk" }).ok, true);
  assert.equal(p.stats.energy, 90);
  seconds(w, 30.1);
  assert.equal(act(w, "p1", { type: "useItem", itemId: "chocolate" }).ok, true);
  assert.equal(p.stats.energy, 100, "không vượt 100");
  // tự chế: nước tăng lực bậc 1, socola tự làm bậc 2 (cần 15)
  assert.equal(RECIPE_BY_ID.energy_drink.tier, 1);
  assert.equal(RECIPE_BY_ID.homemade_chocolate.tier, 2);
  assert.equal(RECIPE_BY_ID.energy_bar.tier, 2);
  const { w: w2, p: q } = lonely();
  q.stats.intelligence = 14;
  addItem(q.inventory, "sugar", 3);
  addItem(q.inventory, "flour", 1);
  addItem(q.inventory, "plastic", 1);
  place(w2, "p1", 30.5, 8.5);
  assert.equal(act(w2, "p1", { type: "craft", recipeId: "homemade_chocolate" }).ok, false);
  assert.equal(act(w2, "p1", { type: "craft", recipeId: "energy_drink" }).ok, true);
  q.skills.crafting = 100;
  q.stats.intelligence = 15;
  assert.equal(act(w2, "p1", { type: "craft", recipeId: "homemade_chocolate" }).ok, true);
});

// ------------------------------------------------------------------ 9. Lưu / tải

test("lưu/tải: giữ thể lực, thông minh, thời gian chờ kệ sách & đồ ăn, trạng thái đang ngủ", () => {
  const { w, p } = lonely();
  atShelf(w);
  act(w, "p1", { type: "interact", targetId: "bookshelf_0" });
  seconds(w, I.shelfReadSeconds + 0.1);
  p.stats.energy = 61;
  addItem(p.inventory, "chocolate", 1);
  act(w, "p1", { type: "useItem", itemId: "chocolate" });
  place(w, "p1", at("bedrest_0").x, at("bedrest_0").y);
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  seconds(w, 1);
  const loaded = JSON.parse(JSON.stringify(w)) as WorldState;
  const lp = loaded.players.p1;
  assert.equal(lp.stats.energy, p.stats.energy);
  assert.equal(lp.stats.intelligence, 21);
  assert.equal(lp.shelfReads.bookshelf_0, p.shelfReads.bookshelf_0);
  assert.equal(lp.foodCooldowns.chocolate, p.foodCooldowns.chocolate);
  assert.equal(lp.channel?.kind, "sleep");
  seconds(w, 3);
  seconds(loaded, 3);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w));
});
