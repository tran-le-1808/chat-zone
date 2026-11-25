/** Test theo tài liệu bổ sung (mục 7): giường, lịch 11 khung, chế tạo mọi nơi, đánh nhau, truy nã, hình nộm, lưu/tải. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  applyAction,
  canGuardSee,
  closeLook,
  countItem,
  createOutbox,
  doorsLocked,
  ITEM_DEFS,
  passFlags,
  playerSolid,
  PRISON_CONFIG as C,
  PRISON_MAP,
  resolveRoomSearch,
  runTick,
  zoneAt,
  type WorldState,
} from "../_lib/engine";
import { act, makeWorld, noGuards, place, seconds, ticks } from "./helpers";

const BED0 = { x: 11.5, y: 38.5 }; // cạnh giường xà lim A-3 (ô 11,37)
const YARD = { x: 30.5, y: 8.5 };
const zone = (p: { x: number; y: number }) => zoneAt(PRISON_MAP, p.x, p.y);

/** Đặt giờ & chạy cho tới khi qua phút `minute` */
function runTo(w: WorldState, minuteOfDay: number, extraTicks = 30) {
  const day = Math.floor(w.totalGameMinutes / 1440);
  w.totalGameMinutes = day * 1440 + minuteOfDay - 0.5;
  return ticks(w, extraTicks);
}

function lonelyWorld(n = 1) {
  const w = makeWorld(n, n > 1 ? "multi" : "single", 21);
  noGuards(w);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  return w;
}

// ------------------------------------------------------------------ 1. Giường

test("giường: không mở được, không có ô chứa / giấu (bản đồ & dữ liệu); có thuộc tính bed, canStore=false, canHideUnder=false", () => {
  const beds = PRISON_MAP.interactables.filter((i) => i.kind === "bed");
  assert.ok(beds.length >= 9);
  const bedTiles = new Set(beds.flatMap((b) => b.tiles.map((t) => `${t.x},${t.y}`)));
  for (const it of PRISON_MAP.interactables)
    if (it.kind === "hideSpot" || it.kind === "container") for (const t of it.tiles) assert.equal(bedTiles.has(`${t.x},${t.y}`), false, `${it.id} nằm trên giường`);
  const w = lonelyWorld();
  place(w, "p1", BED0.x, BED0.y);
  // không có hành động mở / cất đồ vào giường
  const r = act(w, "p1", { type: "containerPut", containerId: "bedrest_0", index: 0, itemId: "food", quantity: 1 });
  assert.equal(!r.ok && r.code, "NOT_FOUND");
  const h = act(w, "p1", { type: "hide", spotId: "bedrest_0", itemId: "food", quantity: 1 });
  assert.equal(h.ok, false);
  // tương tác giường = ngủ (không phải mở)
  w.players.p1.stats.energy = 50;
  assert.equal(act(w, "p1", { type: "interact", targetId: "bedrest_0" }).ok, true);
  assert.equal(w.players.p1.channel?.kind, "sleep");
});

test("giường: ngày mới bắt đầu 08:00 — thức dậy; đang ngủ thì tự dậy", () => {
  const w = lonelyWorld();
  place(w, "p1", BED0.x, BED0.y);
  w.totalGameMinutes = 1440 + 6 * 60;
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  w.players.p1.stats.energy = 10;
  const o = runTo(w, 8 * 60, 40);
  assert.ok(o.events.some((e) => e.type === "game:wake"));
  assert.equal(w.players.p1.channel, null, "thức dậy lúc 08:00");
});

test("giường: ngủ trong giờ cho phép thì không sao; ngủ giữa giờ làm nhiệm vụ là vi phạm", () => {
  const w = lonelyWorld();
  place(w, "p1", BED0.x, BED0.y);
  w.players.p1.stats.energy = 10;
  w.totalGameMinutes = 20 * 60 + 15; // giờ tự do
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  seconds(w, 15);
  assert.equal(w.players.p1.violationsToday.count, 0);
  const w2 = lonelyWorld();
  place(w2, "p1", BED0.x, BED0.y);
  w2.players.p1.stats.energy = 10;
  w2.totalGameMinutes = 9 * 60 + 20; // ca làm
  act(w2, "p1", { type: "interact", targetId: "bedrest_0" });
  seconds(w2, 3);
  assert.ok(w2.players.p1.violationsToday.count >= 1);
  assert.ok(w2.journal.some((j) => j.text.includes("ngủ trong giờ")));
});

test("giường: đồ đặt trên giường (hình nộm) bị lộ ngay khi khám phòng lúc chủ phòng vắng mặt", () => {
  for (let seed = 0; seed < 30; seed++) {
    const w = lonelyWorld();
    w.rngState = seed;
    w.beds.bedrest_0.dummy = true;
    w.beds.bedrest_0.realism = 100;
    place(w, "p1", YARD.x, YARD.y);
    w.totalGameMinutes = 10 * 60;
    resolveRoomSearch(w, createOutbox(), 0, null);
    assert.equal(w.beds.bedrest_0.dummy, false, "luôn bị lộ dù hình nộm hoàn hảo");
  }
});

// ------------------------------------------------------------------ 2. Lịch mới

test("lịch: điểm danh 19:00 vắng mặt bị ghi vi phạm; hình nộm trên giường không thay được điểm danh", () => {
  const w = lonelyWorld();
  w.beds.bedrest_0.dummy = true;
  w.beds.bedrest_0.realism = 100;
  place(w, "p1", 12.5, 38.5); // ở phòng giam, không ra vạch
  runTo(w, 19 * 60 + C.violations.penaltyFine * 0 + 9, 60);
  assert.ok(w.journal.some((j) => j.text.includes("vắng mặt điểm danh")));
});

test("lịch: bỏ việc giữa ca bị trừ tiền công và ghi vi phạm nhỏ; ở xưởng thì không", () => {
  const w = lonelyWorld();
  w.players.p1.money = 50;
  place(w, "p1", YARD.x, YARD.y);
  runTo(w, 9 * 60 + 10, 40);
  assert.equal(w.players.p1.money, 50 - C.activities.absentWagePenalty);
  assert.ok(w.journal.some((j) => j.kind === "penalty" && j.text.includes("vắng việc")));
  const w2 = lonelyWorld();
  w2.players.p1.money = 50;
  place(w2, "p1", 34.5, 16.5); // xưởng
  runTo(w2, 9 * 60 + 10, 40);
  assert.equal(w2.players.p1.money, 50);
});

test("lịch: chạm máy gym là tập luôn; không tắm cả ngày mặc định không bị phạt (hygienePenaltyEnabled = false)", () => {
  const w = lonelyWorld();
  const p = w.players.p1;
  const gym = PRISON_MAP.interactableById.gym_0.tiles[0];
  place(w, "p1", gym.x + 0.5, gym.y - 0.5);
  w.totalGameMinutes = 15 * 60 + 10;
  const r = act(w, "p1", { type: "interact", targetId: "gym_0" });
  assert.equal(r.ok, true);
  assert.ok(p.gym, "đang tập");
  act(w, "p1", { type: "gymStop" });
  const rep = p.reputation.guards;
  place(w, "p1", YARD.x, YARD.y);
  runTo(w, 17 * 60, 40);
  assert.equal(p.reputation.guards, rep, "không phạt vệ sinh");
});

// ------------------------------------------------------------------ 3. Chế tạo mọi nơi

test("chế tạo: được ở xà lim, sân, nhà ăn mà không cần bàn chế tạo", () => {
  for (const [label, x, y] of [["xà lim", 12.5, 38.5], ["sân", 30.5, 8.5], ["nhà ăn", 22.5, 16.5]] as const) {
    const w = lonelyWorld();
    const p = w.players.p1;
    p.skills.crafting = 100;
    p.stats.intelligence = 50;
    place(w, "p1", x, y);
    addItem(p.inventory, "metal_scrap", 3);
    addItem(p.inventory, "plastic", 3);
    for (let i = 0; i < 3 && !countItem(p.inventory, "screwdriver"); i++) {
      assert.equal(act(w, "p1", { type: "craft", recipeId: "screwdriver" }).ok, true, label);
    }
    assert.equal(countItem(p.inventory, "screwdriver"), 1, label);
  }
});

test("chế tạo tức thì: bấm là ra vật phẩm ngay, không thanh tiến trình", () => {
  const w = lonelyWorld();
  const p = w.players.p1;
  p.stats.intelligence = 50;
  p.skills.crafting = 100;
  place(w, "p1", YARD.x, YARD.y);
  addItem(p.inventory, "metal_scrap", 1);
  addItem(p.inventory, "plastic", 1);
  const r = act(w, "p1", { type: "craft", recipeId: "screwdriver" });
  assert.equal(r.ok, true);
  assert.equal(p.channel, null, "không có thanh tiến trình");
  assert.equal(countItem(p.inventory, "screwdriver") + (r.ok && r.data?.success === false ? 1 : 0), 1);
});

test("chế tạo đồ cấm trước mặt cai ngục bị phát hiện ngay (vi phạm nghiêm trọng)", () => {
  const w = makeWorld(1, "single", 8);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  const g = w.guards.find((x) => x.routeId === "yard")!;
  w.guards = [g];
  w.totalGameMinutes = 20 * 60 + 10;
  place(w, "p1", YARD.x, YARD.y);
  g.x = YARD.x + 3;
  g.y = YARD.y;
  g.facing = Math.PI;
  g.path = [];
  g.pauseUntil = 1e9;
  const p = w.players.p1;
  addItem(p.inventory, "wood", 2);
  addItem(p.inventory, "cloth", 1);
  act(w, "p1", { type: "craft", recipeId: "club" });
  // chế tạo tức thì: bị ghi vi phạm ngay tại thời điểm chế tạo
  assert.ok(w.journal.some((j) => j.text.includes("chế tạo đồ cấm")));
  assert.ok(p.stats.personalHeat >= C.heat.chaseThreshold - 1);
  const o = createOutbox();
  for (let i = 0; i < 40; i++) runTick(w, o, new Map());
  assert.ok(o.events.some((e) => e.type === "guard:alert" || e.type === "player:captured" || e.type === "player:knocked-out"), "cai ngục truy đuổi");
});

// ------------------------------------------------------------------ 4. Đánh nhau

function brawl(attackerOf: string, extra: string[] = []) {
  const w = makeWorld(1, "single", 31);
  noGuards(w);
  const all = w.inmates;
  const target = all.find((x) => x.defId === attackerOf)!;
  w.inmates = [target, ...extra.map((id) => all.find((x) => x.defId === id)!)];
  for (const n of w.inmates) {
    n.path = [];
    n.waitUntil = 1e9;
    n.goalZone = "dorm";
    n.facing = Math.PI;
  }
  target.x = 11.4;
  target.y = 22.5;
  w.inmates.slice(1).forEach((n, i) => {
    n.x = 13 + i;
    n.y = 22.5;
  });
  place(w, "p1", 10.5, 22.5);
  w.players.p1.facing = 0;
  return { w, target, p: w.players.p1 };
}

test("đánh nhau: tù nhân hung hăng đánh trả, tù nhân hiền thường chạy (đã có ở combat.test) — người cùng nhóm lao vào", () => {
  let joined = 0;
  for (let seed = 0; seed < 20; seed++) {
    const { w, target } = brawl("npc_ba", ["npc_hai"]); // cùng nhóm "choden"
    w.rngState = 500 + seed;
    act(w, "p1", { type: "attack" });
    const hai = w.inmates.find((n) => n.defId === "npc_hai")!;
    if (hai.fightWith === "p1") joined++;
    void target;
  }
  assert.ok(joined >= 14, `Hai Búa lao vào ${joined}/20`);
  // khác nhóm thì không lao vào
  const { w } = brawl("npc_ba", ["npc_tu"]);
  act(w, "p1", { type: "attack" });
  assert.equal(w.inmates.find((n) => n.defId === "npc_tu")!.fightWith, null);
});

test("đánh nhau: tối đa 3 người tham gia một trận", () => {
  const { w } = brawl("npc_hai", ["npc_ba"]);
  // thêm nhiều tù nhân cùng nhóm "choden" (bản sao) đứng gần
  const base = w.inmates[1];
  for (let i = 0; i < 5; i++) w.inmates.push({ ...base, id: `clone_${i}`, grudges: [], x: 12 + i * 0.4, y: 23.2 });
  for (const n of w.inmates) n.facing = Math.PI;
  w.inmates[0].health = 9999;
  for (let k = 0; k < 4; k++) {
    w.time += 1;
    w.inmates[0].x = 11.4;
    act(w, "p1", { type: "attack" });
  }
  const fighters = w.inmates.filter((n) => n.fightWith === "p1" && (n.combat === "fighting" || n.combat === "threatened"));
  assert.ok(fighters.length <= C.combat.ai.maxParticipants, `${fighters.length} người`);
});

test("đánh nhau: tù nhân ngất rồi tỉnh lại ở phòng y tế; đánh trong tầm cai ngục tăng nghi ngờ mạnh", () => {
  const { w, target } = brawl("npc_tu");
  target.health = 2;
  act(w, "p1", { type: "attack" });
  assert.equal(target.combat, "knockedOut");
  seconds(w, C.combat.inmateDownSeconds + 1);
  assert.equal(target.combat, "idle");
  assert.equal(zone(target), "infirmary");
  // trong tầm cai ngục
  const w2 = makeWorld(1, "single", 2);
  w2.camerasOffUntil = 1e9;
  const g = w2.guards.find((x) => x.routeId === "yard")!;
  w2.guards = [g];
  const n = w2.inmates.find((x) => x.defId === "npc_tu")!;
  w2.inmates = [n];
  w2.totalGameMinutes = 20 * 60 + 10;
  place(w2, "p1", YARD.x, YARD.y);
  w2.players.p1.facing = 0;
  n.x = YARD.x + 0.9;
  n.y = YARD.y;
  n.path = [];
  n.waitUntil = 1e9;
  n.goalZone = "yard";
  g.x = YARD.x + 2;
  g.y = YARD.y + 2.5;
  g.facing = -Math.PI / 2 - 0.4;
  g.path = [];
  g.pauseUntil = 1e9;
  act(w2, "p1", { type: "attack" });
  ticks(w2, 40);
  assert.ok(w2.players.p1.stats.personalHeat >= C.heat.chaseThreshold - 1);
  assert.ok(w2.journal.some((j) => j.text.includes("đánh nhau")));
});

test("đánh nhau: tù nhân nóng tính có thù chủ động gây sự; báo cai ngục thì kẻ gây sự bỏ chạy (+uy tín cai ngục, −uy tín tù nhân)", () => {
  const { w, target, p } = brawl("npc_hai");
  target.grudges.push("p1");
  target.x = 13;
  ticks(w, 6);
  assert.equal(target.fightWith, "p1");
  assert.equal(target.combat, "fighting");
  const g0 = p.reputation.guards;
  const i0 = p.reputation.inmates;
  assert.equal(act(w, "p1", { type: "report", npcId: target.id }).ok, true);
  assert.equal(target.combat, "retreating");
  assert.ok(p.reputation.guards > g0 && p.reputation.inmates < i0);
  const bad = act(w, "p1", { type: "report", npcId: target.id });
  assert.equal(!bad.ok && bad.code, "INVALID_STATE");
});

// ------------------------------------------------------------------ 5. Truy nã

function curfewWithGuard() {
  const w = makeWorld(1, "single", 6);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  const g = w.guards.find((x) => x.routeId === "yard")!;
  w.guards = [g];
  w.totalGameMinutes = 1440 + 22 * 60 + 30;
  place(w, "p1", YARD.x, YARD.y);
  g.x = YARD.x + 3;
  g.y = YARD.y;
  g.facing = Math.PI;
  g.path = [];
  g.pauseUntil = 1e9;
  return { w, g, p: w.players.p1 };
}

test("truy nã: ngoài xà lim sau 21:00 và bị cai ngục thấy -> truy nã 1 sao, còi + tăng viện, nhật ký ghi rõ cấp", () => {
  const { w, p } = curfewWithGuard();
  const o = createOutbox();
  for (let i = 0; i < 6; i++) runTick(w, o, new Map());
  assert.equal(p.wantedLevel, 1);
  assert.ok(o.events.some((e) => e.type === "violation:wanted" && e.data?.level === 1));
  assert.ok(w.journal.some((j) => /Phát hiện ngoài xà lim sau 21:00 — truy nã cấp 1|phát hiện ngoài xà lim sau 21:00 — truy nã cấp 1/.test(j.text)));
});

test("truy nã: ở trong xà lim / không bị thấy thì không truy nã", () => {
  const { w, g, p } = curfewWithGuard();
  place(w, "p1", 12.5, 38.5);
  g.x = 10.5;
  g.y = 22.5;
  ticks(w, 20);
  assert.equal(p.wantedLevel, 0);
  // ở ngoài nhưng khuất tầm nhìn: chưa bị truy nã
  const b = curfewWithGuard();
  b.g.facing = 0;
  ticks(b.w, 20);
  assert.equal(b.p.wantedLevel, 0);
});

test("truy nã: bị thấy lại sau khoảng chờ -> tăng sao; từ 2 sao phong toả cửa khu (cần kẹp / thẻ)", () => {
  const { w, p } = curfewWithGuard();
  ticks(w, 6);
  assert.equal(p.wantedLevel, 1);
  w.totalGameMinutes += C.wanted.redetectCooldownMinutes + 1;
  ticks(w, 6);
  assert.equal(p.wantedLevel, 2);
  assert.equal(doorsLocked(w), true);
  const solid = playerSolid(passFlags(w, p));
  assert.equal(solid(7, 20), true, "cửa khu (phòng giặt) bị khoá");
  addItem(p.inventory, "lockpick", 1);
  assert.equal(playerSolid(passFlags(w, p))(7, 20), false, "có kẹp mở khoá thì qua được");
});

test("truy nã: không bị ai thấy đủ lâu thì giảm dần về 0", () => {
  const { w, p } = curfewWithGuard();
  ticks(w, 6);
  p.wantedLevel = 2;
  w.guards = [];
  // cai ngục ca đêm nhìn vào xà lim mỗi 20 phút: cần hình nộm tốt trên giường để không bị truy nã thêm
  w.beds.bedrest_0.dummy = true;
  w.beds.bedrest_0.realism = 100;
  for (let i = 0; i < C.wanted.decayMinutes * 2 * 20 + 80; i++) ticks(w, 1);
  assert.equal(p.wantedLevel, 0);
  assert.ok(w.journal.some((j) => j.text.includes("hết truy nã")));
});

test("truy nã: bị bắt -> biệt giam, đồ hợp lệ giữ nguyên, reset truy nã", () => {
  const { w, p } = curfewWithGuard();
  ticks(w, 6);
  addItem(p.inventory, "cloth", 4);
  p.status = "KNOCKED_OUT";
  p.knockoutDeadline = 0;
  ticks(w, 2);
  assert.equal(p.status, "CAPTURED");
  assert.equal(p.wantedLevel, 0);
  assert.equal(countItem(p.inventory, "cloth"), 4, "đồ hợp lệ không bị tịch thu");
});

// ------------------------------------------------------------------ 6. Hình nộm

function decoyNight(realism: number, seed: number) {
  const w = lonelyWorld();
  w.rngState = seed;
  w.beds.bedrest_0.dummy = true;
  w.beds.bedrest_0.realism = realism;
  place(w, "p1", YARD.x, YARD.y); // vắng mặt
  return w;
}

test("hình nộm: chế tạo từ chăn + gối + quần áo ở bất kỳ đâu; độ chân thực theo Khéo tay", () => {
  const w = lonelyWorld();
  const p = w.players.p1;
  p.stats.intelligence = 50; // hình nộm là bậc 3
  place(w, "p1", YARD.x, YARD.y);
  addItem(p.inventory, "blanket", 1);
  addItem(p.inventory, "pillow", 1);
  addItem(p.inventory, "clothes", 1);
  p.skills.crafting = 0;
  for (let i = 0; i < 4 && !countItem(p.inventory, "dummy"); i++) {
    act(w, "p1", { type: "craft", recipeId: "dummy" });
    if (!countItem(p.inventory, "dummy")) {
      addItem(p.inventory, "blanket", 1);
      addItem(p.inventory, "pillow", 1);
      addItem(p.inventory, "clothes", 1);
    }
  }
  const low = p.inventory.find((i) => i.itemId === "dummy")!.quality!;
  assert.equal(ITEM_DEFS.dummy.isDecoy, true);
  const w2 = lonelyWorld();
  const q = w2.players.p1;
  q.skills.crafting = 100;
  q.stats.intelligence = 50;
  addItem(q.inventory, "blanket", 1);
  addItem(q.inventory, "pillow", 1);
  addItem(q.inventory, "clothes", 1);
  act(w2, "p1", { type: "craft", recipeId: "dummy" });
  const high = q.inventory.find((i) => i.itemId === "dummy")!.quality!;
  assert.ok(high > low, `${high} > ${low}`);
  // đặt lên giường giữ độ chân thực
  place(w2, "p1", BED0.x, BED0.y);
  assert.equal(act(w2, "p1", { type: "bedPlace", bedId: "bedrest_0", what: "dummy" }).ok, true);
  assert.equal(w2.beds.bedrest_0.realism, high);
});

test("hình nộm: nhìn thoáng ban đêm — hình nộm tốt thường qua mắt, giường trống thì truy nã", () => {
  let fooled = 0;
  for (let seed = 0; seed < 40; seed++) {
    const w = decoyNight(90, seed);
    runTo(w, 22 * 60, 30);
    if (w.players.p1.wantedLevel === 0) fooled++;
  }
  assert.ok(fooled >= 36, `qua mắt ${fooled}/40`);
  const empty = lonelyWorld();
  place(empty, "p1", YARD.x, YARD.y);
  runTo(empty, 22 * 60, 30);
  assert.equal(empty.players.p1.wantedLevel, 1);
});

test("hình nộm: nhìn kỹ — hình nộm kém lộ ngay, hình nộm tốt có xác suất lộ thấp hơn nhưng > 0", () => {
  const exposed = (realism: number) => {
    let n = 0;
    for (let seed = 0; seed < 200; seed++) {
      const w = lonelyWorld();
      w.rngState = seed;
      w.beds.bedrest_0.dummy = true;
      w.beds.bedrest_0.realism = realism;
      place(w, "p1", 12.5, 38.5); // chủ phòng có mặt (nhìn kỹ hình nộm trên giường)
      if (closeLook(w, createOutbox(), 0, () => {})) n++;
    }
    return n / 200;
  };
  const poor = exposed(10);
  const good = exposed(95);
  assert.ok(poor > 0.9, `kém: ${poor}`);
  assert.ok(good > 0 && good < poor, `tốt: ${good}`);
});

test("hình nộm: điểm danh đêm gọi tên -> lộ (truy nã), trừ khi đồng đội trong xà lim trả lời thay", () => {
  const w = decoyNight(100, 1);
  runTo(w, 2 * 60, 5);
  seconds(w, 11);
  assert.equal(w.beds.bedrest_0.dummy, false);
  assert.ok(w.players.p1.wantedLevel >= 1);
  // co-op: p2 đứng trong xà lim của p1 và trả lời thay
  const m = makeWorld(2, "multi", 3);
  noGuards(m);
  m.inmates = [];
  m.camerasOffUntil = 1e9;
  m.beds.bedrest_0.dummy = true;
  m.beds.bedrest_0.realism = 100;
  place(m, "p1", YARD.x, YARD.y);
  place(m, "p2", 12.5, 38.5);
  runTo(m, 2 * 60, 20);
  assert.ok(m.nightRollcall);
  assert.equal(act(m, "p2", { type: "answerRollcall" }).ok, true);
  seconds(m, 11);
  assert.equal(m.players.p1.wantedLevel, 0);
  assert.equal(m.beds.bedrest_0.dummy, true);
});

test("hình nộm: không tránh được điểm danh 08:30", () => {
  const w = decoyNight(100, 2);
  w.totalGameMinutes = 1440;
  runTo(w, 8 * 60 + 39, 40);
  assert.ok(w.journal.some((j) => j.text.includes("vắng mặt điểm danh")));
});

// ------------------------------------------------------------------ 7. Lưu / tải

test("lưu/tải: giữ giường, hình nộm đang đặt, truy nã và trạng thái đánh nhau", () => {
  const { w, target } = brawl("npc_hai");
  w.beds.bedrest_0.dummy = true;
  w.beds.bedrest_0.realism = 77;
  w.beds.bedrest_0.meter = 12;
  w.players.p1.wantedLevel = 2;
  act(w, "p1", { type: "attack" });
  const loaded = JSON.parse(JSON.stringify(w)) as WorldState;
  assert.deepEqual(loaded.beds.bedrest_0, w.beds.bedrest_0);
  assert.equal(loaded.players.p1.wantedLevel, 2);
  assert.equal(loaded.inmates[0].combat, target.combat);
  assert.equal(loaded.inmates[0].fightWith, "p1");
  ticks(w, 30);
  ticks(loaded, 30);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w), "chạy tiếp tất định");
  void applyAction;
  void canGuardSee;
});
