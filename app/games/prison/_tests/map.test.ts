/** Nghiệm thu bản đồ "Nhà tù Đá Xám" (prompt bản đồ: mục 1–6, 10–11) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyShift,
  createOutbox,
  DOOR_RULES,
  ESCAPE_METHODS,
  INMATE_DEFS,
  PATROLS,
  PRISON_MAP,
  RECIPE_BY_ID,
  tileAt,
  zoneAt,
  ZONE_BY_ID,
} from "../_lib/engine";
import { makeWorld, ticks } from "./helpers";

const ENGINE = new URL("../_lib/engine/", import.meta.url).pathname;

test("bản đồ: 64 × 44 ô, ô 16 px, tên gốc (không dùng tên nhà tù của game khác)", () => {
  assert.equal(PRISON_MAP.id, "grey_stone");
  assert.equal(PRISON_MAP.name, "Nhà tù Đá Xám");
  assert.equal(PRISON_MAP.width, 64);
  assert.equal(PRISON_MAP.height, 44);
  const raw = JSON.parse(readFileSync(join(ENGINE, "maps/grey_stone.map.json"), "utf8"));
  assert.equal(raw.tilewidth, 16);
  const names = raw.layers.map((l: { name: string }) => l.name);
  for (const l of ["floor", "walls", "objects", "zones", "cameras", "spawns", "escape"]) assert.ok(names.includes(l), `thiếu lớp ${l}`);
});

test("bản đồ: đủ các khu ở mục 3, mức an ninh đúng, khu cấm = an ninh 3", () => {
  const want: Record<string, number> = {
    hall: 1,
    canteen: 1,
    workshop: 2,
    laundry: 2,
    library: 1,
    gym: 1,
    shower: 1,
    infirmary: 1,
    yard: 2,
    storage: 3,
    office: 3,
    solitary: 3,
    confiscation: 3,
    truck_gate: 3,
    power: 3,
    block_a: 1,
    block_b: 1,
    outside: 0,
  };
  for (const [id, sec] of Object.entries(want)) {
    const z = ZONE_BY_ID[id];
    assert.ok(z, `thiếu khu ${id}`);
    assert.equal(z.security, sec, id);
    assert.equal(z.restricted, sec >= 3, id);
  }
  assert.equal(PRISON_MAP.cells.length, 12, "12 xà lim (A 6 + B 6)");
  for (let i = 0; i < 12; i++) assert.ok(ZONE_BY_ID[`cell_${i}`]?.cellBlock, `cell_${i}`);
  assert.equal(ZONE_BY_ID.cell_0.name, "Xà lim A-3", "người chơi ở A-3");
  // xà lim A-1 sát tường Tây
  const a1 = ZONE_BY_ID.cell_4;
  assert.equal(a1.name, "Xà lim A-1");
  assert.equal(tileAt(PRISON_MAP, a1.rects[0][0] - 1, a1.rects[0][1]), "#");
  assert.equal(tileAt(PRISON_MAP, a1.rects[0][0] - 2, a1.rects[0][1]), "o", "sau tường là bên ngoài");
});

test("sức chứa: 12 tù nhân NPC; 6 cai ngục ca ngày + 2 tháp canh; ca đêm 4 người đi hành lang, 2 người nghỉ", () => {
  assert.equal(INMATE_DEFS.length, 12);
  const w = makeWorld(1);
  assert.equal(w.inmates.length, 12);
  const patrol = w.guards.filter((g) => !g.tower);
  const towers = w.guards.filter((g) => g.tower);
  assert.equal(patrol.length, 6);
  assert.equal(towers.length, 2);
  const count = (r: string) => patrol.filter((g) => g.routeId === r).length;
  assert.deepEqual([count("cells"), count("work"), count("yard")], [2, 2, 2], "3 tuyến × 2");
  applyShift(w, createOutbox(), true);
  const night = patrol.map((g) => g.routeId).sort();
  assert.deepEqual(night, [...PATROLS.night].sort());
  assert.equal(patrol.filter((g) => g.routeId.startsWith("night_")).length, 4);
  // đổi ca đúng 21:00 theo lịch
  const w2 = makeWorld(1);
  w2.inmates = [];
  w2.totalGameMinutes = 21 * 60 - 0.5;
  ticks(w2, 20);
  assert.equal(w2.guards.filter((g) => g.routeId.startsWith("night_")).length, 4);
});

test("cửa: xà lim khoá 21:00–08:00 (chìa phòng), kho cần chìa kho, văn phòng cần thẻ, cổng xe tải mở khi xe tới", () => {
  const count = (ch: string) => PRISON_MAP.tiles.join("").split(ch).length - 1;
  assert.equal(count("c"), 12, "12 cửa xà lim");
  assert.ok(count("K") >= 1 && count("L") >= 1 && count("G") >= 1 && count("F") > 40);
  assert.deepEqual(DOOR_RULES.c.openWith, ["cell_key"]);
  assert.equal(DOOR_RULES.c.lockedFrom, "21:00");
  assert.ok(DOOR_RULES.K.openWith.includes("fake_key"));
  assert.deepEqual(DOOR_RULES.L.openWith, ["keycard", "fake_keycard"]);
  assert.equal(DOOR_RULES.G.openWhileTruck, true);
});

test("camera: 8 camera C1–C8 ở đúng khu; tháp canh nhìn 10 ô, mất điện còn 4 ô", () => {
  const where: Record<string, string> = { C1: "hall", C2: "hall", C3: "workshop", C4: "yard", C5: "storage", C6: "office", C7: "solitary", C8: "truck_gate" };
  for (const [id, zone] of Object.entries(where)) {
    const c = PRISON_MAP.cameras.find((x) => x.id === id);
    assert.ok(c, id);
    assert.equal(zoneAt(PRISON_MAP, c.x, c.y), zone, id);
    assert.equal(c.blindRadius, 2);
  }
  assert.equal(PRISON_MAP.towers.length, 2);
  assert.equal(PATROLS.tower.visionRange, 10);
  assert.equal(PATROLS.tower.blackoutVisionRange, 4);
});

test("tuần tra: luôn có khoảng trống để hành động — hành lang trống ≥ 60 giây, khu xà lim trống ≥ 60 giây trong 10 phút ca ngày", () => {
  for (const seed of [1, 2, 3]) {
    const w = makeWorld(1, "single", seed);
    w.inmates = [];
    w.totalGameMinutes = 9 * 60;
    const gap = { hall: { cur: 0, max: 0 }, block: { cur: 0, max: 0 } };
    for (let i = 0; i < 20 * 600; i++) {
      ticks(w, 1);
      const pats = w.guards.filter((g) => !g.tower);
      const busy = {
        hall: pats.some((g) => zoneAt(PRISON_MAP, g.x, g.y) === "hall" && g.y > 20 && g.y < 24),
        block: pats.some((g) => /^(block_|cell_)/.test(zoneAt(PRISON_MAP, g.x, g.y) ?? "")),
      };
      for (const k of ["hall", "block"] as const) {
        gap[k].cur = busy[k] ? 0 : gap[k].cur + 0.05;
        gap[k].max = Math.max(gap[k].max, gap[k].cur);
      }
    }
    assert.ok(gap.hall.max >= 60, `seed ${seed}: hành lang trống tối đa ${gap.hall.max.toFixed(0)}s`);
    assert.ok(gap.block.max >= 60, `seed ${seed}: khu xà lim trống tối đa ${gap.block.max.toFixed(0)}s`);
  }
});

test("lối thoát: 7 lối trong data/escapes.json, ô thoát Tây-Nam / Nam / Đông / sau cổng xe tải đều ở ngoài tường", () => {
  assert.deepEqual([...ESCAPE_METHODS].sort(), ["FENCE", "GATE", "LAUNDRY", "TRUCK", "TUNNEL", "VENT", "WALL"]);
  const ids = PRISON_MAP.escapePoints.map((e) => e.id).sort();
  assert.deepEqual(ids, ["exit_e", "exit_s", "exit_sw", "exit_truck"]);
  for (const e of PRISON_MAP.escapePoints) assert.equal(zoneAt(PRISON_MAP, e.x, e.y), "outside", e.id);
  assert.ok(PRISON_MAP.tunnelExit && zoneAt(PRISON_MAP, PRISON_MAP.tunnelExit.x, PRISON_MAP.tunnelExit.y) === "outside");
  for (const v of ["laundry", "supply"]) assert.equal(zoneAt(PRISON_MAP, PRISON_MAP.vehicleDrops[v].x, PRISON_MAP.vehicleDrops[v].y), "outside", v);
  // ống gió nối thư viện với kho
  assert.equal(zoneAt(PRISON_MAP, 58.5, 29.5), "library");
  assert.equal(zoneAt(PRISON_MAP, 58.5, 16.5), "storage");
  for (let y = 16; y <= 29; y++) assert.equal(tileAt(PRISON_MAP, 60, y), "u");
});

test("chế tạo: vật phẩm chủ chốt theo bảng mục 6 (bậc / thông minh), không bản vẽ, không thời gian chờ", () => {
  const table: [string, number, number][] = [
    ["makeshift_rope", 1, 0],
    ["sharpened_spoon", 1, 0],
    ["shiv", 2, 15],
    ["lockpick", 2, 15],
    ["cell_key", 3, 25],
    ["fake_key", 3, 25],
    ["dummy", 3, 25],
    ["shovel", 4, 35],
    ["fake_keycard", 4, 35],
    ["wire_cutters", 4, 35],
    ["rope", 5, 45],
    ["jammer", 5, 45],
  ];
  for (const [id, tier, intel] of table) {
    const r = RECIPE_BY_ID[id];
    assert.ok(r, id);
    assert.equal(r.tier, tier, id);
    assert.equal(r.intelligenceRequired, intel, id);
    assert.equal((r as unknown as Record<string, unknown>).craftSeconds, undefined);
  }
  assert.deepEqual(RECIPE_BY_ID.rope.ingredients, [
    { itemId: "makeshift_rope", quantity: 3 },
    { itemId: "metal_scrap", quantity: 1 },
  ]);
});

test("dữ liệu: các file mục 10 có mặt", () => {
  for (const f of ["maps/grey_stone.map.json", "data/zones.json", "data/cameras.json", "data/patrols.json", "data/doors.json", "data/escapes.json", "data/recipes.json", "data/vehicles.json"])
    assert.ok(existsSync(join(ENGINE, f)), f);
});
