/** Prompt bổ sung: knock out khi chơi một mình, nằm theo chiều giường, 1 bộ đồ, cải trang, camera (mục 6) */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  applyMoveInput,
  countItem,
  createOutbox,
  damagePlayer,
  migrateWorld,
  PRISON_CONFIG as C,
  PRISON_MAP,
  runTick,
  type InventoryItem,
  type WorldState,
} from "../_lib/engine";
import { bedPose } from "../_lib/art/bedPose";
import { cameraFrame, pixelsPerTile } from "../_components/cameraMath";
import { act, makeWorld, noGuards, place, ticks } from "./helpers";

const K = C.knockout;

function soloWorld(minuteOfDay = 12 * 60) {
  const w = makeWorld(1, "single", 9);
  noGuards(w);
  const p = w.players.p1;
  w.totalGameMinutes = minuteOfDay;
  place(w, "p1", 30.5, 8.5); // sân
  return { w, p };
}

/** Bị tù nhân đánh hết máu rồi chạy hết tick (tua 30 phút ở cuối tick) */
function koByInmate(w: WorldState) {
  const p = w.players.p1;
  const n = w.inmates.find((x) => x.defId === "npc_hai")!;
  n.fightWith = p.id;
  n.combat = "fighting";
  damagePlayer(w, createOutbox(), p, 9999, "bị Hai Búa đánh");
  const o = createOutbox();
  runTick(w, o, new Map());
  return { n, o };
}

// ------------------------------------------------------------------ 1. Knock out khi chơi một mình

test("knock out solo: 30 phút trôi qua, tỉnh nằm trên giường phòng y tế, thể lực 100, sức mạnh −1, nhanh nhẹn −1, máu 50%, miễn đánh 2 phút", () => {
  const { w, p } = soloWorld();
  p.stats.strength = 10;
  p.stats.agility = 0; // không xuống dưới 0
  p.stats.energy = 12;
  const before = w.totalGameMinutes;
  const { n, o } = koByInmate(w);
  assert.equal(p.status, "ACTIVE");
  assert.ok(w.totalGameMinutes - before >= K.knockoutSoloMinutes && w.totalGameMinutes - before < K.knockoutSoloMinutes + 1, `trôi ${w.totalGameMinutes - before} phút`);
  assert.equal(p.bed, PRISON_MAP.infirmaryBeds[0]);
  const bed = PRISON_MAP.interactableById[p.bed!];
  assert.deepEqual({ x: p.x, y: p.y }, bed.sleepAnchor, "nằm đúng điểm nằm của giường y tế");
  assert.equal(p.stats.energy, 100);
  assert.equal(p.stats.strength, 9);
  assert.equal(p.stats.agility, 0);
  assert.equal(p.stats.health, Math.round(p.stats.maxHealth * K.knockoutHpRecoverRatio));
  assert.ok(p.invulnerableUntil > w.time, "miễn bị đánh ngay khi vừa tỉnh");
  assert.equal(n.fightWith, null, "kẻ đánh rời đi");
  assert.ok(o.events.some((e) => e.type === "player:recovered" && e.text?.includes("Sức mạnh −1") && e.text.includes("Nhanh nhẹn −1")));
  assert.ok(o.events.some((e) => e.type === "player:blackout"));
  assert.ok(w.journal.some((j) => j.text.includes("tỉnh dậy ở phòng y tế")));
  // phím di chuyển bị khoá khi đang nằm; bấm Dậy thì ngồi dậy, đứng ở ô kế chân giường
  applyMoveInput(w, "p1", { sequence: p.lastSeq + 1, directionX: 1, directionY: 0, sprint: false });
  assert.deepEqual({ x: p.x, y: p.y }, bed.sleepAnchor, "di chuyển không làm rơi khỏi giường");
  assert.equal(act(w, "p1", { type: "wake" }).ok, true);
  assert.equal(p.bed, null);
  assert.deepEqual({ x: p.x, y: p.y }, { x: bed.wakeTile!.x + 0.5, y: bed.wakeTile!.y + 0.5 });
});

test("knock out solo: qua giờ điểm danh không bị ghi vắng mặt (y tế xác nhận); qua 08:00 thì thông minh −2", () => {
  const { w, p } = soloWorld(8 * 60 + 20); // 08:20 -> tỉnh 08:50 (đã qua mốc kiểm tra điểm danh 08:40)
  koByInmate(w);
  assert.ok(!w.journal.some((j) => j.text.includes("vắng mặt điểm danh")));
  assert.equal(p.violationsToday.count, 0);
  const { w: w2, p: q } = soloWorld(1440 + 7 * 60 + 45); // 07:45 -> 08:15
  q.stats.intelligence = 30;
  koByInmate(w2);
  assert.equal(q.stats.intelligence, 28);
});

test("knock out solo: bị tù nhân đánh ngất không tịch thu đồ; bị cai ngục bắt thì tịch thu", () => {
  const { w, p } = soloWorld();
  addItem(p.inventory, "file", 1);
  p.gear.weapon = { itemId: "shiv", quantity: 1, durability: 5 };
  koByInmate(w);
  assert.equal(countItem(p.inventory, "file"), 1);
  assert.equal(p.gear.weapon?.itemId, "shiv");
  assert.equal(w.confiscation.items.length, 0);
  // cai ngục khống chế -> bị bắt -> tịch thu
  p.status = "KNOCKED_OUT";
  p.knockoutRecover = false;
  p.knockoutDeadline = 0;
  ticks(w, 2);
  assert.equal(countItem(p.inventory, "file"), 0);
  assert.ok(w.confiscation.items.some((e) => e.item.itemId === "file"));
});

// ------------------------------------------------------------------ 2. Nằm theo chiều giường

test("giường: dọc ở xà lim (đầu trên), ngang ở phòng y tế / biệt giam (đầu trái); ngủ thì nằm đúng điểm, dậy ở ô kế chân giường", () => {
  const cell = PRISON_MAP.interactableById.bedrest_0;
  assert.equal(cell.orientation, "vertical");
  assert.equal(cell.headSide, "top");
  assert.equal(cell.tiles.length, 2);
  const inf = PRISON_MAP.interactableById.bedrest_infirm;
  assert.equal(inf.orientation, "horizontal");
  assert.equal(inf.headSide, "left");
  assert.equal(PRISON_MAP.interactableById.bedrest_sol_0.orientation, "horizontal");
  // xoay sprite / hình nộm: dọc đầu trên -> 0; ngang đầu trái -> +90°
  assert.equal(bedPose("bedrest_0")!.rot, 0);
  assert.equal(bedPose("bedrest_infirm")!.rot, Math.PI / 2);
  // ngủ trên giường xà lim
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  p.stats.energy = 40;
  w.totalGameMinutes = 20 * 60 + 10;
  assert.equal(act(w, "p1", { type: "interact", targetId: "bedrest_0" }).ok, true);
  assert.equal(p.bed, "bedrest_0");
  assert.deepEqual({ x: p.x, y: p.y }, cell.sleepAnchor);
  ticks(w, 20);
  assert.equal(p.channel?.kind, "sleep", "vẫn ngủ");
  // đầy thể lực vẫn nằm (không tự dậy); bấm Dậy thì ngồi dậy ở ô kế chân giường
  p.stats.energy = p.stats.maxEnergy;
  ticks(w, 2);
  assert.equal(p.bed, "bedrest_0");
  assert.equal(act(w, "p1", { type: "wake" }).ok, true);
  assert.equal(p.bed, null);
  assert.deepEqual({ x: p.x, y: p.y }, { x: cell.wakeTile!.x + 0.5, y: cell.wakeTile!.y + 0.5 });
});

test("giường: ô kế chân giường bị chắn thì đứng ở ô trống gần nhất", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  const bed = PRISON_MAP.interactableById.bedrest_0;
  const saved = bed.wakeTile!;
  bed.wakeTile = { x: bed.tiles[0].x - 1, y: saved.y }; // ô tường
  try {
    p.stats.energy = 40;
    w.totalGameMinutes = 20 * 60 + 10;
    act(w, "p1", { type: "interact", targetId: "bedrest_0" });
    ticks(w, 8);
    assert.equal(act(w, "p1", { type: "wake" }).ok, true);
    assert.equal(p.bed, null);
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    assert.notDeepEqual([tx, ty], [bed.wakeTile.x, bed.wakeTile.y], "không đứng trong tường");
    assert.ok(Math.max(Math.abs(tx - bed.wakeTile.x), Math.abs(ty - bed.wakeTile.y)) <= 2);
  } finally {
    bed.wakeTile = saved;
  }
});

// ------------------------------------------------------------------ 3. Một bộ đồ & migrate

test("migrate save cũ (schema 10): áo -> bộ đồ cùng loại, quần thừa vào túi / bỏ; vẫn chạy tiếp được", () => {
  const w = makeWorld(1);
  const old = JSON.parse(JSON.stringify(w)) as Record<string, unknown> & WorldState;
  const op = old.players.p1 as unknown as Record<string, unknown>;
  op.gear = { weapon: null, top: { itemId: "guard_top", quantity: 1, owner: "CN-104" }, bottom: { itemId: "prisoner_bottom", quantity: 1 } };
  op.inventory = [
    { itemId: "guard_bottom", quantity: 1 },
    { itemId: "prisoner_top", quantity: 1, owner: "TN-0100" },
    { itemId: "food", quantity: 1 },
  ];
  delete op.bed;
  delete op.bedHold;
  const og = old.guards[0] as unknown as Record<string, unknown>;
  og.gear = { weapon: null, top: { itemId: "guard_top", quantity: 1 }, bottom: { itemId: "guard_bottom", quantity: 1 } };
  (old.containers.washer_0 as { items: unknown[] }).items = [{ itemId: "guard_top", quantity: 1 }, { itemId: "guard_bottom", quantity: 1 }];
  (old as unknown as { schemaVersion: number }).schemaVersion = 10;
  const m = migrateWorld(JSON.parse(JSON.stringify(old)))!;
  assert.ok(m);
  assert.equal(m.schemaVersion, 12);
  assert.equal(m.players.p1.underground, false);
  assert.deepEqual(m.dig, { holes: {}, entrances: {}, tunnels: {}, decor: {} });
  const p = m.players.p1;
  assert.deepEqual(Object.keys(p.gear).sort(), ["outfit", "weapon"]);
  assert.equal(p.gear.outfit?.itemId, "guard_outfit");
  assert.equal(p.gear.outfit?.owner, "CN-104");
  const ids = p.inventory.map((i: InventoryItem) => i.itemId).sort();
  assert.deepEqual(ids, ["clothes", "food", "prisoner_outfit"], "quần cai ngục rời bị bỏ; quần tù thừa -> quần áo tù");
  assert.equal(p.bed, null);
  assert.equal(m.guards[0].gear.outfit?.itemId, "guard_outfit");
  assert.deepEqual(
    m.containers.washer_0.items.map((i) => i.itemId),
    ["guard_outfit"],
  );
  assert.equal(migrateWorld({ schemaVersion: 3 }), null, "bản quá cũ thì bỏ");
  ticks(m, 40); // chạy tiếp không lỗi
});

test("không mặc đồ: tù nhân thấy thì bình luận (bong bóng), không đánh vì lý do này", () => {
  const w = makeWorld(1, "single", 2);
  noGuards(w);
  const p = w.players.p1;
  p.gear.outfit = null;
  w.totalGameMinutes = 20 * 60 + 10;
  const n = w.inmates.find((x) => x.defId === "npc_tu")!;
  w.inmates = [n];
  place(w, "p1", 30.5, 8.5);
  n.x = 32;
  n.y = 8.5;
  n.path = [];
  n.waitUntil = 1e9;
  n.goalZone = "yard";
  const o = createOutbox();
  for (let i = 0; i < 20; i++) runTick(w, o, new Map());
  assert.ok(o.events.some((e) => e.type === "inmate:comment" && e.playerId === "p1"));
  assert.equal(n.fightWith, null);
});

// ------------------------------------------------------------------ 5. Camera

const SIZES = [
  [640, 360],
  [915, 412],
  [1024, 768],
  [390, 844],
  [1920, 1080],
] as const;
const MAP = { width: PRISON_MAP.width, height: PRISON_MAP.height };

test("camera: zoom nguyên (16 px × k); nhân vật ở đúng tâm màn hình (≤ 2 px) khi không chạm biên, ở 5 kích thước", () => {
  for (const [width, height] of SIZES) {
    const z = pixelsPerTile({ width, height });
    assert.equal(z % 16, 0, `${width}×${height}: zoom ${z}`);
    assert.equal(z, 16 * Math.max(1, Math.floor(Math.min(width, height) / 270)));
    const f = cameraFrame({ target: { x: 32, y: 22 }, viewport: { width, height }, map: MAP });
    const fitsX = MAP.width >= width / z;
    const fitsY = MAP.height >= height / z;
    // trục nào bản đồ lớn hơn khung nhìn thì nhân vật nằm đúng tâm; trục nào nhỏ hơn thì bản đồ được căn giữa
    if (fitsX) assert.ok(Math.abs(f.screenX - width / 2) <= 2, `${width}×${height}: x ${f.screenX}`);
    else assert.equal(f.x, MAP.width / 2);
    if (fitsY) assert.ok(Math.abs(f.screenY - height / 2) <= 2, `${width}×${height}: y ${f.screenY}`);
    else assert.equal(f.y, MAP.height / 2);
  }
});

test("camera: sát biên thì kẹp (không lộ vùng trống); bản đồ nhỏ hơn viewport thì căn giữa; đổi kích thước không lệch", () => {
  for (const [width, height] of SIZES) {
    const f = cameraFrame({ target: { x: 0.5, y: 0.5 }, viewport: { width, height }, map: MAP });
    const halfW = width / 2 / f.zoom;
    const halfH = height / 2 / f.zoom;
    const g = cameraFrame({ target: { x: 63.5, y: 43.5 }, viewport: { width, height }, map: MAP });
    if (MAP.width >= halfW * 2) {
      assert.ok(f.x - halfW >= -1e-9 && g.x + halfW <= MAP.width + 1e-9, `${width}×${height}: không lộ hai bên`);
      assert.equal(f.clampedX, true);
    } else assert.equal(f.x, MAP.width / 2);
    if (MAP.height >= halfH * 2) {
      assert.ok(f.y - halfH >= -1e-9 && g.y + halfH <= MAP.height + 1e-9, `${width}×${height}: không lộ trên dưới`);
      assert.equal(f.clampedY, true);
    } else assert.equal(f.y, MAP.height / 2);
  }
  const small = cameraFrame({ target: { x: 1, y: 1 }, viewport: { width: 1920, height: 1080 }, map: { width: 10, height: 6 } });
  assert.deepEqual([small.x, small.y], [5, 3], "căn giữa bản đồ nhỏ");
  // xoay màn hình: tâm vẫn đúng ngay khung hình kế tiếp (không lerp)
  const a = cameraFrame({ target: { x: 30, y: 20 }, viewport: { width: 844, height: 390 }, map: MAP });
  const b = cameraFrame({ target: { x: 30, y: 20 }, viewport: { width: 390, height: 844 }, map: MAP });
  assert.ok(Math.abs(a.screenX - 422) <= 2 && Math.abs(a.screenY - 195) <= 2 && Math.abs(b.screenX - 195) <= 2);
  // sau khi tỉnh dậy ở phòng y tế: camera đặt ngay vào nhân vật
  const { w, p } = soloWorld();
  koByInmate(w);
  const c = cameraFrame({ target: { x: p.x, y: p.y }, viewport: { width: 1024, height: 768 }, map: MAP });
  assert.ok(Math.abs(c.screenX - 512) <= 2 && Math.abs(c.screenY - 384) <= 2);
});
