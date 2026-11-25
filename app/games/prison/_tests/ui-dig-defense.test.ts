/** Prompt bổ sung: UI gọn, ngủ mọi giường + fix lỗi nhảy xuống giường, thời gian ×0.5, đào tường / hầm, cai ngục bênh, vật che (mục 9) */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionSeconds,
  addItem,
  applyMoveInput,
  countItem,
  createOutbox,
  INTEL,
  DIG,
  PRISON_CONFIG as C,
  PRISON_MAP,
  passFlags,
  playerSolid,
  roleEfficiency,
  runTick,
  tileHardness,
  validateBeds,
  violationOf,
  type WorldState,
} from "../_lib/engine";
import uiJson from "../_lib/engine/data/ui.json";
import { zoneLabels } from "../_components/mapLabels";
import { act, guardOn, makeWorld, noGuards, place, seconds, ticks } from "./helpers";

/** Chờ thao tác giữ xong (thời gian tuỳ công cụ) */
function finish(w: WorldState) {
  for (let i = 0; i < 20 * 60 && w.players.p1.channel; i++) ticks(w, 1);
}

const CELL = PRISON_MAP.cells[0]; // A-3: x 11..13, y 37..40

function soloWorld(seed = 5) {
  const w = makeWorld(1, "single", seed);
  noGuards(w);
  w.inmates = [];
  w.totalGameMinutes = 12 * 60;
  return { w, p: w.players.p1 };
}

// ------------------------------------------------------------------ 1. UI

test("UI: mặc định tắt gợi ý chữ; phím C = chỉ số, M = bản đồ; bản đồ có tên đủ các phòng, không chồng nhãn", () => {
  assert.equal(uiJson.showHints, false);
  assert.equal(uiJson.hotkeys.stats, "C");
  assert.equal(uiJson.hotkeys.map, "M");
  assert.equal(uiJson.pauseOnPopup, false);
  const labels = zoneLabels();
  const names = labels.map((l) => l.text);
  for (const n of ["A-3", "Nhà ăn", "Xưởng", "Thư viện", "Gym", "Phòng tắm", "Phòng y tế", "Sân chơi"]) assert.ok(names.includes(n), `thiếu nhãn ${n}`);
  // không nhãn nào chồng nhau (ước lượng hộp chữ)
  const box = (l: (typeof labels)[number]) => ({ x0: l.x - (l.text.length * 5.4 + 4) / 2, x1: l.x + (l.text.length * 5.4 + 4) / 2, y0: l.y - 5.5, y1: l.y + 5.5 });
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = box(labels[i]);
      const b = box(labels[j]);
      assert.ok(!(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0), `${labels[i].text} chồng ${labels[j].text}`);
    }
  assert.ok(labels.find((l) => l.id === "office")?.restricted, "khu cấm tô màu khác");
});

// ------------------------------------------------------------------ 3. Ngủ & lỗi nhảy xuống giường

test("lỗi giường: mọi giường có điểm nằm / ô dậy hợp lệ; nằm 10 giây kể cả khi giữ phím di chuyển vẫn không bị đẩy ra; dậy ở ô dậy", () => {
  assert.deepEqual(validateBeds(PRISON_MAP), []);
  const beds = PRISON_MAP.interactables.filter((i) => i.kind === "bed");
  assert.ok(beds.length >= 16);
  for (const bed of beds) {
    const { w, p } = soloWorld();
    w.totalGameMinutes = 14 * 60; // ban ngày: cửa xà lim mở
    place(w, "p1", bed.wakeTile!.x + 0.5, bed.wakeTile!.y + 0.5);
    p.stats.energy = 100; // đầy thể lực vẫn ngủ được
    const r = act(w, "p1", { type: "interact", targetId: bed.id });
    assert.equal(r.ok, true, `${bed.id}: ${JSON.stringify(r)}`);
    const o = createOutbox();
    for (let i = 0; i < 20 * 10; i++) runTick(w, o, new Map([["p1", [{ sequence: p.lastSeq + 1, directionX: 1, directionY: 1, sprint: true }]]]));
    assert.deepEqual({ x: p.x, y: p.y }, bed.sleepAnchor, `${bed.id}: bị đẩy khỏi giường`);
    assert.equal(p.bed, bed.id);
    assert.equal(act(w, "p1", { type: "wake" }).ok, true);
    assert.deepEqual({ x: p.x, y: p.y }, { x: bed.wakeTile!.x + 0.5, y: bed.wakeTile!.y + 0.5 }, `${bed.id}: ô dậy`);
    assert.equal(playerSolid(passFlags(w, p))(bed.wakeTile!.x, bed.wakeTile!.y), false, "va chạm bật lại, đứng ở ô đi được");
  }
});

test("ngủ: tự dậy khi bị đánh / bị gọi tên; chống bấm Ngủ–Dậy lặp trong 300 ms", () => {
  const { w, p } = soloWorld();
  place(w, "p1", CELL.x, CELL.y);
  w.totalGameMinutes = 14 * 60;
  assert.equal(act(w, "p1", { type: "interact", targetId: "bedrest_0" }).ok, true);
  const again = act(w, "p1", { type: "wake" });
  assert.equal(!again.ok && again.code, "RATE_LIMITED");
  // bị đánh: dậy
  p.channel = null;
  ticks(w, 2);
  assert.equal(p.bed, null, "hết ngủ (bị đánh / gọi) thì ngồi dậy");
});

// ------------------------------------------------------------------ 5. Thời gian thao tác

test("thời gian: thao tác có tiến trình ×0.5 (đọc sách 2.5 s, lấy đồ 0.25 s); chế tạo vẫn tức thì; cooldown không đổi", () => {
  assert.equal(C.actionTimeScale, 0.5);
  assert.equal(actionSeconds(5), 2.5);
  assert.equal(actionSeconds(C.loot.itemSeconds), C.loot.itemSeconds / 2);
  const { w, p } = soloWorld();
  const t = PRISON_MAP.interactableById.bookshelf_0.tiles[0];
  place(w, "p1", t.x + 0.5, t.y + 1.5);
  assert.equal(act(w, "p1", { type: "interact", targetId: "bookshelf_0" }).ok, true);
  assert.equal(p.channel?.duration, 2.5);
  addItem(p.inventory, "wood", 2);
  p.skills.crafting = 100;
  assert.equal(act(w, "p1", { type: "cancelChannel" }).ok, true);
  assert.equal(act(w, "p1", { type: "craft", recipeId: "support" }).ok, true);
  assert.equal(p.channel, null, "chế tạo không có thanh tiến trình");
  assert.equal(C.food.defaultCooldownSeconds, 30, "cooldown đồ ăn giữ nguyên (không × hệ số)");
  assert.equal(INTEL.shelfCooldownMinutes, 0, "đọc sách luôn +1, không chờ kệ");
});

// ------------------------------------------------------------------ 6. Đào tường / hầm

test("đào: không có công cụ thì không đào; muỗng mài chỉ đục được vách mỏng giữa hai xà lim; tường ngoài cứng cấp 3", () => {
  const { w, p } = soloWorld();
  place(w, "p1", 11.5, 39.5);
  assert.equal(tileHardness(10, 39), 1, "vách giữa A-3 và A-2");
  assert.equal(tileHardness(11, 36), 2, "tường thường");
  assert.equal(tileHardness(12, 41), 3, "tường ngoài (chỉ Cuốc chim cải tiến)");
  let r = act(w, "p1", { type: "dig", x: 10, y: 39 });
  assert.equal(!r.ok && r.code, "ITEM_NOT_OWNED");
  addItem(p.inventory, "sharpened_spoon", 1);
  place(w, "p1", 11.5, 37.5);
  r = act(w, "p1", { type: "dig", x: 11, y: 36 });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET", "muỗng không đủ cứng cho tường thường");
  place(w, "p1", 12.5, 40.5);
  r = act(w, "p1", { type: "dig", x: 12, y: 41 });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET", "muỗng không đục nổi tường ngoài");
  // đục vách mỏng -> lỗ đi qua được; độ bền muỗng giảm
  place(w, "p1", 11.5, 39.5);
  const dur = p.inventory.find((i) => i.itemId === "sharpened_spoon")!.durability!;
  r = act(w, "p1", { type: "dig", x: 10, y: 39 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(p.channel?.duration, actionSeconds(DIG.wallSeconds / roleEfficiency("sharpened_spoon", "dig", "wall")), "muỗng đục tường chậm hơn");
  finish(w);
  assert.ok(w.dig.holes["10,39"]);
  assert.equal(p.inventory.find((i) => i.itemId === "sharpened_spoon")?.durability, dur - 1);
  assert.equal(playerSolid(passFlags(w, p))(10, 39), false, "lỗ tường đi qua được");
  for (let i = 0; i < 20; i++) applyMoveInput(w, "p1", { sequence: p.lastSeq + 1, directionX: -1, directionY: 0, sprint: false });
  assert.ok(p.x < 10, "chui sang xà lim bên cạnh");
});

test("đào: công cụ gãy khi hết độ bền; đào hầm dưới đất qua tường ngoài; lên mặt đất bên ngoài chỉ khi đang đào tẩu", () => {
  const { w, p } = soloWorld();
  addItem(p.inventory, "shovel", 1);
  p.inventory.find((i) => i.itemId === "shovel")!.durability = 10;
  place(w, "p1", 12.5, 38.5);
  const dig = (x: number, y: number) => {
    p.stats.energy = 100;
    const r = act(w, "p1", { type: "dig", x, y });
    assert.equal(r.ok, true, `${x},${y}: ${JSON.stringify(r)}`);
    seconds(w, actionSeconds(DIG.tunnelSeconds) + actionSeconds(DIG.floorSeconds));
  };
  dig(12, 39); // mở miệng hầm
  assert.ok(w.dig.entrances["12,39"]);
  place(w, "p1", 12.5, 39.5);
  assert.equal(act(w, "p1", { type: "hatch" }).ok, true);
  assert.equal(p.underground, true);
  const down = () => {
    for (let i = 0; i < 5; i++) applyMoveInput(w, "p1", { sequence: p.lastSeq + 1, directionX: 0, directionY: 1, sprint: false });
  };
  dig(12, 40);
  down();
  dig(12, 41); // dưới tường ngoài
  down();
  dig(12, 42); // ra ngoài
  for (let i = 0; i < 20; i++) down();
  assert.ok(p.y > 42, `đi trong hầm tới (12,42): y=${p.y}`);
  const up = act(w, "p1", { type: "dig", x: 12, y: 42 });
  assert.equal(!up.ok && up.code, "INVALID_STATE", "chưa đào tẩu thì không lên mặt đất bên ngoài");
  // độ bền: hết thì gãy
  p.inventory.find((i) => i.itemId === "shovel")!.durability = 1;
  dig(13, 42);
  assert.equal(countItem(p.inventory, "shovel"), 0, "gãy");
});

test("đào: kiệt sức thì có thể sập (thống kê nhiều seed)", () => {
  let collapses = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { w, p } = soloWorld(seed);
    addItem(p.inventory, "sharpened_spoon", 1);
    place(w, "p1", 11.5, 39.5);
    p.stats.energy = 10; // dưới ngưỡng thấp
    assert.equal(act(w, "p1", { type: "dig", x: 10, y: 39 }).ok, true);
    finish(w);
    if (!w.dig.holes["10,39"]) collapses++;
  }
  assert.ok(collapses > 5 && collapses < 30, `sập ${collapses}/40`);
});

// ------------------------------------------------------------------ 8. Vật che

function guardNear(w: WorldState, x: number, y: number, facing: number) {
  const g = guardOn(makeWorld(1, "single", 5), "cells");
  g.x = x;
  g.y = y;
  g.facing = facing;
  g.path = [];
  g.pauseUntil = 1e9;
  w.guards = [g];
  return g;
}

test("vật che: chế ảnh / thảm (bậc 2, thông minh 15); lỗ chưa che bị cai ngục thấy ngay trong 3 ô và lấp lại; đã che thì nhìn qua không thấy", () => {
  const { w, p } = soloWorld();
  p.stats.intelligence = 15;
  p.skills.crafting = 100;
  for (let i = 0; i < 6 && !countItem(p.inventory, "wall_picture"); i++) {
    addItem(p.inventory, "photo", 1);
    addItem(p.inventory, "wood", 1);
    assert.equal(act(w, "p1", { type: "craft", recipeId: "wall_picture" }).ok, true);
  }
  for (let i = 0; i < 6 && !countItem(p.inventory, "floor_rug"); i++) {
    addItem(p.inventory, "cloth", 1);
    addItem(p.inventory, "blanket", 1);
    assert.equal(act(w, "p1", { type: "craft", recipeId: "floor_rug" }).ok, true);
  }
  assert.equal(countItem(p.inventory, "wall_picture") + countItem(p.inventory, "floor_rug"), 2);
  // lỗ chưa che ở vách xà lim, cai ngục đứng ở hành lang khu A nhìn xuống
  w.dig.holes["11,36"] = { by: "p1", day: 1 };
  guardNear(w, 11.5, 34.2, Math.PI / 2);
  w.inmates = [];
  ticks(w, 6);
  assert.equal(w.dig.holes["11,36"], undefined, "lỗ chưa che bị phát hiện và lấp lại");
  assert.ok(p.stats.personalHeat >= DIG.foundHeat - 5);
  // đục lại rồi treo ảnh che
  w.dig.holes["11,36"] = { by: "p1", day: 1 };
  place(w, "p1", 11.5, 37.5);
  assert.equal(act(w, "p1", { type: "placeDecor", itemId: "wall_picture", x: 11, y: 36 }).ok, true);
  ticks(w, 40);
  assert.ok(w.dig.holes["11,36"], "đã che: cai ngục nhìn qua không thấy");
  // gỡ ra để chui qua, rồi treo lại
  assert.equal(act(w, "p1", { type: "takeDecor", x: 11, y: 36 }).ok, true);
  assert.equal(countItem(p.inventory, "wall_picture"), 1);
});

test("vật che: thảm che miệng hầm; khám phòng chỉ phát hiện theo xác suất (≈20%); chưa che thì khám là lộ", async () => {
  const { resolveRoomSearch } = await import("../_lib/engine");
  let found = 0;
  const N = 200;
  for (let seed = 0; seed < N; seed++) {
    const w = makeWorld(1, "single", 900 + seed);
    w.dig.entrances["12,39"] = { by: "p1", day: 1 };
    w.dig.tunnels["12,39"] = "p1";
    w.dig.decor["12,39"] = "floor_rug";
    resolveRoomSearch(w, createOutbox(), 0, null);
    if (!w.dig.entrances["12,39"]) found++;
  }
  assert.ok(Math.abs(found / N - 0.2) < 0.08, `thảm: ${found}/${N}`);
  const w = makeWorld(1);
  w.dig.entrances["12,39"] = { by: "p1", day: 1 };
  w.dig.tunnels["12,39"] = "p1";
  resolveRoomSearch(w, createOutbox(), 0, null);
  assert.equal(w.dig.entrances["12,39"], undefined, "chưa che: khám là lộ, hầm bị lấp");
  assert.equal(w.dig.tunnels["12,39"], undefined);
});

// ------------------------------------------------------------------ 7. Cai ngục bênh người bị đánh

function brawl(withGuard: boolean) {
  const w = makeWorld(1, "single", 8);
  w.totalGameMinutes = 16 * 60 + 10;
  w.camerasOffUntil = 1e9;
  const p = w.players.p1;
  place(w, "p1", 30.5, 8.5);
  const n = w.inmates.find((x) => x.defId === "npc_hai")!;
  w.inmates = [n];
  n.x = 31.3;
  n.y = 8.5;
  n.path = [];
  n.waitUntil = 1e9;
  n.goalZone = "yard";
  // tù nhân chủ động gây sự
  n.combat = "fighting";
  n.fightWith = "p1";
  n.reactAt = w.time;
  n.aggressorAt = w.time;
  w.guards = [];
  const g = withGuard ? guardNear(w, 35.5, 8.5, Math.PI) : null;
  return { w, p, n, g };
}

test("cai ngục bênh: tù nhân đánh người chơi trước mặt cai ngục -> cai ngục khống chế tù nhân, người chơi không bị phạt", () => {
  const { w, p, n, g } = brawl(true);
  const o = createOutbox();
  const states = new Set<string>();
  for (let i = 0; i < 20 * 12 && n.downUntil <= 0; i++) {
    runTick(w, o, new Map());
    states.add(g!.state);
  }
  assert.ok(o.events.some((e) => e.type === "guard:intervene"));
  assert.ok(n.downUntil > 0, "tù nhân bị khống chế");
  assert.ok(o.events.some((e) => e.type === "guard:subdue"));
  assert.notEqual(g!.targetPlayerId, "p1");
  assert.equal(p.violationsToday.count, 0, "người bị đánh không bị phạt");
});

test("cai ngục bênh: đánh trả trong cửa sổ phòng vệ không bị phạt; người chơi đánh trước thì bị phạt; không có cai ngục thì không ai can thiệp", () => {
  const { w, p } = brawl(false);
  // bị tấn công trước rồi đánh trả
  p.attackedAt = w.time;
  p.lastAttackAt = w.time;
  assert.equal(violationOf(w, p)?.reason === "đánh nhau", false, "phòng vệ chính đáng");
  // đánh trước (không bị tấn công gần đây)
  p.attackedAt = -1e9;
  assert.equal(violationOf(w, p)?.reason, "đánh nhau");
  // không cai ngục: không có sự kiện can thiệp
  const o = createOutbox();
  for (let i = 0; i < 40; i++) runTick(w, o, new Map());
  assert.ok(!o.events.some((e) => e.type === "guard:intervene"));
});

// ------------------------------------------------------------------ 10. Lưu / tải

test("lưu/tải: giữ lỗ, hầm, vật che, độ bền công cụ, trạng thái dưới hầm và đang nằm ngủ", () => {
  const { w, p } = soloWorld();
  w.dig.holes["10,38"] = { by: "p1", day: 1 };
  w.dig.entrances["12,39"] = { by: "p1", day: 1 };
  w.dig.tunnels["12,39"] = "p1";
  w.dig.decor["12,39"] = "floor_rug";
  addItem(p.inventory, "shovel", 1);
  p.inventory.find((i) => i.itemId === "shovel")!.durability = 2;
  place(w, "p1", CELL.x, CELL.y);
  w.totalGameMinutes = 14 * 60;
  act(w, "p1", { type: "interact", targetId: "bedrest_0" });
  const loaded = JSON.parse(JSON.stringify(w)) as WorldState;
  assert.deepEqual(loaded.dig, w.dig);
  assert.equal(loaded.players.p1.bed, "bedrest_0");
  assert.equal(loaded.players.p1.inventory.find((i) => i.itemId === "shovel")?.durability, 2);
  ticks(w, 40);
  ticks(loaded, 40);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w));
});
