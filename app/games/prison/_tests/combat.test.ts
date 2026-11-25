/** Đánh nhau: tầm / hướng / hồi chiêu, vũ khí tăng sát thương, trang bị & đổi vũ khí, độ bền, hạ gục, phản ứng của cai ngục & tù nhân. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  applyAction,
  clockInfo,
  countItem,
  createOutbox,
  currentWeapon,
  damageMultiplier,
  expectedDamage,
  ITEM_DEFS,
  PRISON_CONFIG as C,
  runTick,
  type WorldState,
} from "../_lib/engine";
import { act, makeWorld, noGuards, place, seconds, ticks } from "./helpers";
import { PRISON_MAP as MAP, zoneAt } from "../_lib/engine";

const zoneOf = (p: { x: number; y: number }) => zoneAt(MAP, p.x, p.y);

const HALL = { x: 10.5, y: 22.5 };

/** Thế giới chỉ có người chơi 1 + một tù nhân đứng cách `gap` ô phía trước (người chơi quay sang phải) */
function duel(personality = "npc_tu", gap = 0.9) {
  const w = makeWorld(1, "single", 9);
  noGuards(w);
  const n = w.inmates.find((x) => x.defId === personality)!;
  w.inmates = [n];
  n.path = [];
  n.x = HALL.x + gap;
  n.y = HALL.y;
  n.waitUntil = 1e9;
  n.goalZone = "dorm";
  n.facing = Math.PI; // quay mặt về phía người chơi (không bị đánh lén)
  place(w, "p1", HALL.x, HALL.y);
  w.players.p1.facing = 0;
  return { w, n, p: w.players.p1 };
}

/** Thế giới chỉ có một cai ngục tuần ở sân, đúng giờ ra sân (đứng sân hợp lệ) */
function guardDuel(gap = 1.0, guardFacing = Math.PI) {
  const w = makeWorld(1, "single", 4);
  w.inmates = [];
  w.camerasOffUntil = 1e9;
  const g = w.guards.find((x) => x.routeId === "yard")!;
  w.guards = [g];
  w.totalGameMinutes = 20 * 60 + 15; // giờ tự do: đứng ở sân là hợp lệ
  place(w, "p1", 30.5, 8.5);
  g.x = 30.5 + gap;
  g.y = 8.5;
  g.facing = guardFacing;
  g.path = [];
  g.pauseUntil = 1e9;
  const p = w.players.p1;
  p.facing = 0;
  return { w, g, p };
}

/** Đặt vũ khí vào ô vũ khí và rút ra */
function arm(p: { gear: { weapon: unknown }; weaponDrawn: boolean }, id: "shiv" | "club" | "pipe" | "baton") {
  p.gear.weapon = { itemId: id, quantity: 1, durability: ITEM_DEFS[id].maxDurability };
  p.weaponDrawn = true;
}

const wait = (w: WorldState, s = 1) => {
  w.time += s;
};

// ------------------------------------------------------------------ đòn đánh cơ bản

test("đánh tay không: trúng người đứng trước mặt trong tầm, sát thương gần 8", () => {
  const { w, n, p } = duel();
  const r = act(w, "p1", { type: "attack" });
  assert.equal(r.ok && r.data?.hit, true);
  const dealt = C.combat.inmateHealth - n.health;
  const base = C.combat.fists.damage * damageMultiplier(p); // tay không × (1 + sức mạnh × 0.02)
  assert.ok(dealt >= base * 0.9 - 0.06 && dealt <= base * 1.1 + 0.06, `dmg ${dealt}`);
  assert.ok(n.x > HALL.x + 0.9, "bị đẩy lùi");
  assert.equal(p.attackReadyAt > w.time, true);
});

test("đánh theo hướng: sau lưng / quá xa / xuyên tường thì không trúng", () => {
  const behind = duel("npc_tu", -0.9);
  assert.equal(act(behind.w, "p1", { type: "attack" }).ok && behind.n.health === C.combat.inmateHealth, true, "sau lưng");
  const far = duel("npc_tu", 2.6);
  act(far.w, "p1", { type: "attack" });
  assert.equal(far.n.health, C.combat.inmateHealth, "quá xa");
  // phòng giặt cách hành lang một bức tường (cửa ở x=7): đứng sát tường phía hành lang đánh lên
  const wall = duel();
  place(wall.w, "p1", 9.5, 21.1);
  wall.p.facing = -Math.PI / 2;
  wall.n.x = 9.5;
  wall.n.y = 19.95;
  act(wall.w, "p1", { type: "attack" });
  assert.equal(wall.n.health, C.combat.inmateHealth, "không đánh xuyên tường");
});

test("hồi chiêu: đánh liên tiếp bị chặn, hết hồi chiêu đánh tiếp; đánh hụt vẫn mất hồi chiêu; cùng requestId không đánh hai lần", () => {
  const { w, n } = duel();
  assert.equal(act(w, "p1", { type: "attack" }, "swing-1").ok, true);
  const dup = act(w, "p1", { type: "attack" }, "swing-1");
  assert.equal(dup.ok && dup.duplicate, true);
  const early = act(w, "p1", { type: "attack" });
  assert.equal(!early.ok && early.code, "RATE_LIMITED");
  const h1 = n.health;
  wait(w, C.combat.fists.cooldown + 0.05);
  n.x = HALL.x + 0.9;
  assert.equal(act(w, "p1", { type: "attack" }).ok, true);
  assert.ok(n.health < h1);
  // đánh hụt cũng bị hồi chiêu
  const miss = duel("npc_tu", 4);
  assert.equal(act(miss.w, "p1", { type: "attack" }).ok, true);
  assert.equal(!act(miss.w, "p1", { type: "attack" }).ok, true);
});

test("không đánh được khi bị hạ gục / biệt giam; đánh sẽ huỷ thao tác đang giữ; đồng đội không bị đánh nhầm", () => {
  const { w, p } = duel();
  p.status = "KNOCKED_OUT";
  const r = act(w, "p1", { type: "attack" });
  assert.equal(!r.ok && r.code, "INVALID_STATE");
  p.status = "ACTIVE";
  p.channel = { kind: "craft", targetId: "x", elapsed: 0, duration: 5, startX: p.x, startY: p.y };
  act(w, "p1", { type: "attack" });
  assert.equal(p.channel, null);
  const t = makeWorld(2, "multi", 3);
  noGuards(t);
  t.inmates = [];
  place(t, "p1", HALL.x, HALL.y);
  place(t, "p2", HALL.x + 0.8, HALL.y);
  t.players.p1.facing = 0;
  const hp = t.players.p2.stats.health;
  act(t, "p1", { type: "attack" });
  assert.equal(t.players.p2.stats.health, hp);
});

// ------------------------------------------------------------------ vũ khí

test("vũ khí tăng sát thương: dao < gậy < ống < dùi cui đều hơn tay không; đòn trúng nằm trong khoảng dao động", () => {
  const { w, p } = duel();
  const fists = expectedDamage(p);
  const order = ["shiv", "club", "pipe", "baton"] as const;
  let prev = fists;
  for (const id of order) {
    arm(p, id);
    const e = expectedDamage(p);
    assert.ok(e > fists, `${id} phải mạnh hơn tay không`);
    assert.ok(e >= prev - 4, "thứ tự mạnh dần");
    prev = e;
  }
  assert.ok(expectedDamage(p) > fists * 2.5, "dùi cui mạnh hơn nhiều so với tay không");
  // đòn thật với ống thép
  const { w: w2, n, p: p2 } = duel();
  arm(p2, "pipe");
  act(w2, "p1", { type: "attack" });
  const dealt = C.combat.inmateHealth - n.health;
  const base = ITEM_DEFS.pipe.weapon!.damage * damageMultiplier(p2);
  assert.ok(dealt >= base * 0.9 - 0.06 && dealt <= base * 1.1 + 0.06, `ống thép gây ${dealt}`);
  assert.ok(dealt > C.combat.fists.damage * 1.5);
  void w;
});

test("Sức mạnh và Thể lực cũng tăng sát thương (Fighter đánh mạnh hơn)", () => {
  const w = makeWorld(2, "multi", 6);
  const [a, b] = [w.players.p1, w.players.p2]; // p1 HACKER, p2 FIGHTER
  assert.ok(damageMultiplier(b) > damageMultiplier(a));
  const before = damageMultiplier(a);
  a.skills.fitness = 100;
  assert.ok(Math.abs(damageMultiplier(a) - before - C.combat.fitnessDamagePer100) < 1e-9);
});

test("ô vũ khí: rút / cất (R); chỉ rút được vũ khí đang ở ô vũ khí; cất đi thì đánh tay không; bỏ xuống đất", () => {
  const { w, p } = duel();
  const none = act(w, "p1", { type: "equip", itemId: "club" });
  assert.equal(!none.ok && none.code, "ITEM_NOT_OWNED");
  const notWeapon = act(w, "p1", { type: "equip", itemId: "food" });
  assert.equal(!notWeapon.ok && notWeapon.code, "INVALID_STATE");
  p.gear.weapon = { itemId: "club", quantity: 1, durability: 8 };
  assert.equal(currentWeapon(p).itemId, null, "chưa rút -> tay không");
  act(w, "p1", { type: "equip", itemId: "club" });
  assert.equal(currentWeapon(p).itemId, "club");
  act(w, "p1", { type: "equip", itemId: null });
  assert.equal(currentWeapon(p).name, "Tay không");
  assert.equal(act(w, "p1", { type: "dropWeapon" }).ok, true);
  assert.equal(p.gear.weapon, null);
  assert.ok(Object.values(w.floorItems).some((f) => f.item.itemId === "club"), "vũ khí nằm trên đất");
});

test("độ bền: mỗi đòn trúng mòn 1; đánh hụt không mòn; hết bền thì gãy và tự tháo", () => {
  const { w, n, p } = duel();
  arm(p, "shiv");
  n.health = 9999;
  const max = ITEM_DEFS.shiv.maxDurability!;
  assert.equal(p.gear.weapon?.durability, max);
  // hụt: không mòn
  n.x = 20;
  act(w, "p1", { type: "attack" });
  assert.equal(p.gear.weapon?.durability, max);
  n.x = HALL.x + 0.9;
  const o = createOutbox();
  for (let i = 0; i < max; i++) {
    wait(w, 1);
    n.x = HALL.x + 0.9;
    n.downUntil = 0;
    assert.equal(applyAction(w, o, "p1", { type: "attack" }, `dur-${i}`).ok, true);
  }
  assert.equal(p.gear.weapon, null, "dao gãy");
  assert.equal(p.weaponDrawn, false);
  assert.ok(o.events.some((e) => e.type === "combat:weapon-broken"));
});

test("chế tạo vũ khí ở bất kỳ đâu: dao mài, gậy, ống thép", () => {
  const w = makeWorld(1, "single", 12);
  noGuards(w);
  const p = w.players.p1;
  p.skills.crafting = 100;
  p.stats.intelligence = 50; // đủ thông minh cho mọi bậc chế tạo (test này không kiểm tra thư viện)
  addItem(p.inventory, "wood", 2);
  addItem(p.inventory, "cloth", 2);
  place(w, "p1", 12.5, 38.5);
  assert.equal(act(w, "p1", { type: "craft", recipeId: "club" }).ok, true);
  assert.equal(p.gear.weapon?.itemId, "club", "vũ khí chế xong vào ô vũ khí, không chiếm túi");
  assert.equal(countItem(p.inventory, "club"), 0);
  addItem(p.inventory, "sharpened_spoon", 1);
  addItem(p.inventory, "bandage", 1);
  assert.equal(act(w, "p1", { type: "craft", recipeId: "shiv" }).ok, true);
  assert.equal(p.gear.weapon?.itemId, "shiv");
  assert.ok(Object.values(w.floorItems).some((f) => f.item.itemId === "club"), "gậy cũ rơi xuống đất");
  addItem(p.inventory, "metal_scrap", 2);
  assert.equal(act(w, "p1", { type: "craft", recipeId: "pipe" }).ok, true);
  assert.equal(p.gear.weapon?.itemId, "pipe");
});

test("vũ khí là đồ cấm: bị bắt thì tịch thu và tháo khỏi tay", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  arm(p, "pipe");
  p.status = "KNOCKED_OUT";
  p.knockoutDeadline = 0;
  ticks(w, 2);
  assert.equal(p.status, "CAPTURED");
  assert.equal(p.gear.weapon, null);
  assert.equal(p.weaponDrawn, false);
});

// ------------------------------------------------------------------ tù nhân

test("hạ gục tù nhân: lấy tiền, mất uy tín, nằm bất tỉnh rồi tỉnh lại với nửa máu; không bị đánh tiếp khi nằm", () => {
  const { w, n, p } = duel();
  n.health = 3;
  const money = p.money;
  const rep = p.reputation.inmates;
  act(w, "p1", { type: "attack" });
  assert.ok(n.health <= 0 && n.downUntil > 0 && n.state === "DOWN");
  assert.ok(p.money > money, "cướp được tiền");
  assert.ok(p.reputation.inmates < rep - C.combat.inmateRepLoss + 0.5);
  assert.ok(w.journal.some((j) => j.text.includes("đánh gục")));
  wait(w, C.combat.fists.cooldown + 0.1);
  const m2 = p.money;
  act(w, "p1", { type: "attack" });
  assert.equal(p.money, m2, "không đánh được người đang nằm");
  seconds(w, C.combat.inmateDownSeconds + 1);
  assert.equal(n.downUntil, 0);
  assert.equal(n.health, Math.round(C.combat.inmateHealth / 2));
  assert.notEqual(n.state, "DOWN");
});

test("tù nhân nóng tính đánh trả (sau 0.3–0.8 giây); thua trận thì ngất, tỉnh ở phòng y tế, không bị bắt", () => {
  const { w, n, p } = duel("npc_hai");
  n.health = 9999;
  p.stats.health = 4;
  act(w, "p1", { type: "attack" });
  assert.equal(n.fightWith, "p1");
  assert.equal(n.combat, "threatened");
  assert.ok(n.reactAt - w.time >= 0.3 - 1e-6 && n.reactAt - w.time <= 0.8 + 1e-6, "phản ứng có độ trễ");
  for (let i = 0; i < 80 && p.status === "ACTIVE"; i++) ticks(w, 1);
  assert.equal(p.status, "KNOCKED_OUT");
  assert.equal(p.knockoutRecover, true);
  ticks(w, 2);
  assert.notEqual(n.combat, "fighting", "ngừng đánh người đã ngất");
  seconds(w, C.combat.recoverSeconds + 1);
  assert.equal(p.status, "ACTIVE", "tự tỉnh, không vào biệt giam");
  assert.ok(p.stats.health >= 29);
  assert.equal(zoneOf(p), "infirmary", "được đưa tới phòng y tế");
});

test("tù nhân hiền thường bỏ chạy thay vì đánh trả (thống kê nhiều seed)", () => {
  let fled = 0;
  for (let seed = 0; seed < 60; seed++) {
    const { w, n } = duel("npc_tu");
    w.rngState = 1000 + seed;
    n.health = 9999;
    act(w, "p1", { type: "attack" });
    ticks(w, 20);
    if (n.combat === "retreating") fled++;
  }
  assert.ok(fled >= 45, `bỏ chạy ${fled}/60`);
});

// ------------------------------------------------------------------ cai ngục

test("tấn công cai ngục: vi phạm nghiêm trọng, nó quay lại truy đuổi, trại tăng báo động", () => {
  const { w, g, p } = guardDuel(1.0, 0); // cai ngục quay lưng (facing 0) -> đòn đánh lén
  const heat = w.teamHeat;
  const r = act(w, "p1", { type: "attack" });
  assert.equal(r.ok && r.data?.hit, true);
  assert.equal(r.ok && r.data?.sneak, true);
  assert.ok(g.health < C.combat.guardHealth);
  assert.equal(g.state, "CHASE");
  assert.equal(g.targetPlayerId, "p1");
  assert.ok(w.teamHeat >= heat + C.combat.assaultTeamHeat - 1);
  assert.ok(p.stats.personalHeat >= C.heat.chaseThreshold - 1);
  assert.ok(w.journal.some((j) => j.kind === "violation" && j.text.includes("tấn công")));
});

test("đánh lén (từ phía sau) mạnh hơn đánh trực diện", () => {
  const back = guardDuel(1.0, 0);
  const front = guardDuel(1.0, Math.PI);
  front.g.state = "PATROL";
  const rb = act(back.w, "p1", { type: "attack" });
  const rf = act(front.w, "p1", { type: "attack" });
  assert.equal(rb.ok && rb.data?.sneak, true);
  assert.equal(rf.ok && rf.data?.sneak, false);
  const ratio = (C.combat.guardHealth - back.g.health) / (C.combat.guardHealth - front.g.health);
  assert.ok(ratio > 1.2, `tỉ lệ ${ratio}`);
});

test("hạ gục cai ngục: nằm tại chỗ, không hành động, tỉnh lại được tăng cường (máu cao hơn)", () => {
  const { w, g, p } = guardDuel(1.0, Math.PI);
  g.health = 2;
  act(w, "p1", { type: "attack" });
  assert.ok(g.downUntil > 0 && g.health === 0);
  assert.equal(g.targetPlayerId, null);
  assert.equal(g.gear.weapon?.itemId, "baton", "dùi cui vẫn trên người cai ngục (lục soát để lấy)");
  const { x, y } = g;
  seconds(w, 3);
  assert.deepEqual({ x: g.x, y: g.y }, { x, y }, "cai ngục bất tỉnh không đi");
  assert.notEqual(p.status, "KNOCKED_OUT");
  place(w, "p1", 12.5, 38.5); // chạy về xà lim cho khỏi bị truy đuổi
  seconds(w, C.guard.recoveryTime + 1);
  assert.equal(g.downUntil, 0);
  assert.equal(g.reinforced, true);
  assert.ok(g.health > C.guard.knockoutHp, "tăng cường");
});

test("cầm vũ khí ra ngoài bị cai ngục thấy là vi phạm; cất đi thì thôi", () => {
  const { w, p } = guardDuel(4.0, Math.PI);
  ticks(w, 40);
  assert.equal(p.violationsToday.count, 0, "tay không đứng sân: không sao");
  arm(p, "club");
  ticks(w, 40);
  assert.ok(p.violationsToday.count >= 1);
  assert.ok(w.journal.some((j) => j.text.includes("cầm vũ khí")));
  act(w, "p1", { type: "equip", itemId: null });
  const n = p.violationsToday.count;
  ticks(w, 60);
  assert.equal(p.violationsToday.count, n);
});

test("đánh nhau trước mặt cai ngục -> bị truy đuổi (kể cả đánh hụt)", () => {
  const { w, g } = guardDuel(5.0, Math.PI);
  assert.equal(g.state, "PATROL");
  act(w, "p1", { type: "attack" }); // vung tay đấm gió
  const states = new Set<string>();
  for (let i = 0; i < 80; i++) {
    ticks(w, 1);
    states.add(g.state);
  }
  assert.ok(states.has("CHASE"), [...states].join());
});

test("cai ngục cần thời gian mới tóm được: kịp đánh trả trong cửa sổ tóm", () => {
  const { w, g, p } = guardDuel(0.6, Math.PI);
  g.state = "CHASE";
  g.targetPlayerId = "p1";
  g.lastKnown = { x: p.x, y: p.y };
  g.health = 1;
  const o = createOutbox();
  runTick(w, o, new Map());
  assert.equal(p.status, "ACTIVE", "chưa bị tóm ngay lập tức");
  act(w, "p1", { type: "attack" });
  assert.ok(g.downUntil > 0);
  ticks(w, 40);
  assert.equal(p.status, "ACTIVE", "đã hạ gục lính trước khi bị tóm");
});

test("trạng thái chiến đấu có trong view & lưu/tải giữ nguyên", () => {
  const { w, p } = duel();
  arm(p, "pipe");
  act(w, "p1", { type: "attack" });
  const saved = JSON.stringify(w);
  const loaded = JSON.parse(saved) as WorldState;
  assert.deepEqual(loaded, w);
  assert.equal(loaded.players.p1.gear.weapon?.itemId, "pipe");
  assert.ok(clockInfo(w.totalGameMinutes).day >= 1);
});

