/**
 * 5 bot kiểm thử lối vượt ngục trên bản đồ Đá Xám (prompt bản đồ, mục 9).
 * Mỗi bot chạy từ trạng thái đầu cố định (seed cố định) tới ô thoát, và có một biến thể
 * cố ý bỏ bước để kiểm tra "thất bại đúng cách".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  BLACKOUT_SECONDS,
  cameraSees,
  countItem,
  disguiseActive,
  PRISON_CONFIG as C,
  PRISON_MAP,
  supportsNeeded,
  tunnelOf,
  VEHICLES,
  type WorldState,
} from "../_lib/engine";
import { Bot } from "./bot";
import { makeWorld, place } from "./helpers";

/** Ván 1 người, không cai ngục tuần tra / tù nhân (bot kiểm tra lối thoát, không kiểm tra AI) */
function botWorld(seed: number, keepTowers = false): WorldState {
  const w = makeWorld(1, "single", seed);
  w.inmates = [];
  w.guards = keepTowers ? w.guards.filter((g) => g.tower) : [];
  return w;
}

const setTime = (w: WorldState, day: number, hh: number, mm = 0) => {
  w.totalGameMinutes = (day - 1) * 1440 + hh * 60 + mm;
};

const exitPoint = (id: string) => {
  const e = PRISON_MAP.escapePoints.find((x) => x.id === id);
  assert.ok(e, id);
  return { x: e.x, y: e.y };
};

/** Đi tới ô thoát và chờ server xác nhận */
function reachExit(b: Bot, id: string) {
  // đi ngang qua một ô thoát khác (ngoài tường) cũng được tính là đã thoát
  const arrived = b.walkTo(exitPoint(id), 0.4, 8000);
  assert.ok(arrived || b.p.status === "ESCAPED", `không tới được ${id}`);
  for (let i = 0; i < 40 && !b.w.outcome; i++) b.tick(1);
  assert.equal(b.p.status, "ESCAPED");
  assert.equal(b.w.outcome, "ALL_ESCAPED");
}

function craftWith(b: Bot, recipeId: string, items: [Parameters<typeof addItem>[1], number][]) {
  for (const [id, n] of items) addItem(b.p.inventory, id, n);
  b.craft(recipeId);
}

// ------------------------------------------------------------------ 1. Đường hầm từ xà lim

function tunnelNight(b: Bot, digs: number, withDummy: boolean) {
  const t = tunnelOf(b.w, 0);
  if (withDummy && !b.w.beds.bedrest_0.dummy) {
    b.goNear("bedrest_0");
    b.must({ type: "bedPlace", bedId: "bedrest_0", what: "dummy" });
  }
  for (let i = 0; i < digs && t.progress < C.tunnel.segments; i++) {
    if (!countItem(b.p.inventory, "shovel")) craftWith(b, "shovel", [["sharpened_spoon", 1], ["wood", 1]]);
    // chống hầm trước khi đào tiếp (thiếu thanh chống thì có thể sập)
    while (t.supports < supportsNeeded(t.progress + 1)) {
      craftWith(b, "support", [["wood", 2]]);
      b.goNear("tunnel_0");
      b.must({ type: "tunnel", cellIndex: 0, op: "support" });
      b.finishChannel();
    }
    b.goNear("tunnel_0");
    b.must({ type: "tunnel", cellIndex: 0, op: "dig" });
    b.finishChannel(600);
    // đổ đất xuống bồn cầu
    b.goNear("toilet_0");
    while (countItem(b.p.inventory, "dirt")) {
      b.must({ type: "flush", spotId: "toilet_0" });
      b.finishChannel();
    }
    b.p.stats.energy = b.p.stats.maxEnergy;
    b.p.stats.hunger = 10;
  }
  // che miệng hầm trước khi trời sáng
  if (!t.covered) {
    b.goNear("tunnel_0");
    b.must({ type: "tunnel", cellIndex: 0, op: "cover" });
    b.finishChannel();
  }
}

test("bot lối 1 — ĐƯỜNG HẦM: thông minh 35, dụng cụ đào, hình nộm; đào 12 đoạn qua 2 đêm, đổ đất, chui hầm tới ô thoát Tây-Nam", () => {
  const w = botWorld(21);
  const b = new Bot(w);
  b.p.stats.intelligence = 35;
  setTime(w, 1, 12);
  b.supplies();
  craftWith(b, "dummy", [["blanket", 1], ["pillow", 1], ["clothes", 1]]);
  // về xà lim trước 21:00 (cửa xà lim khoá 21:00–08:00)
  setTime(w, 1, 20, 30);
  assert.ok(b.walkTo({ x: PRISON_MAP.cells[0].x, y: PRISON_MAP.cells[0].y }), "vào giữa xà lim A-3");
  for (const day of [1, 2]) {
    setTime(w, day, 21, 30);
    tunnelNight(b, 6, true);
    assert.equal(b.p.wantedLevel, 0, `đêm ${day}: hình nộm qua mặt cai ngục kiểm tra mỗi 20 phút`);
  }
  const t = tunnelOf(w, 0);
  assert.equal(t.progress, C.tunnel.segments, "hầm dài 12 đoạn");
  b.escapeVia("TUNNEL");
  b.goNear("tunnel_0");
  b.must({ type: "tunnel", cellIndex: 0, op: "crawl" });
  assert.equal(PRISON_MAP.zoneGrid[Math.floor(b.p.y) * PRISON_MAP.width + Math.floor(b.p.x)], "outside", "ló ra bụi cây ngoài tường");
  reachExit(b, "exit_sw");
});

test("bot lối 1 — thất bại: đào hầm ban đêm mà không đặt hình nộm -> cai ngục nhìn vào xà lim -> truy nã", () => {
  const w = botWorld(21);
  const b = new Bot(w);
  b.p.stats.intelligence = 35;
  setTime(w, 1, 21, 35);
  tunnelNight(b, 4, false);
  assert.ok(b.p.wantedLevel >= 1, "bị truy nã");
  assert.ok(w.journal.some((j) => j.text.includes("đào hầm")));
});

// ------------------------------------------------------------------ 2. Ống thông gió từ thư viện

/** Đứng trong ống gió chờ camera quay đi: các ô sắp đi qua không bị thấy trong `horizon` giây tới */
function waitCameraAway(b: Bot, camId: string, path: { x: number; y: number }[], horizon = 3) {
  const cam = PRISON_MAP.cameras.find((c) => c.id === camId)!;
  for (let i = 0; i < 400; i++) {
    const t0 = b.w.time;
    let clear = true;
    for (let dt = 0; dt <= horizon && clear; dt += 0.05) clear = path.every((q) => !cameraSees(cam, t0 + dt, q.x, q.y));
    if (clear) return;
    b.tick(1);
  }
  assert.fail(`camera ${camId} không bao giờ quay đi`);
}

test("bot lối 2 — ỐNG THÔNG GIÓ: thông minh 25, dao mài cậy lưới; bò ống tới kho, né camera C5, qua cổng lúc xe hàng tới", () => {
  const w = botWorld(22);
  const b = new Bot(w);
  b.p.stats.intelligence = 25;
  setTime(w, 1, 12);
  b.supplies();
  craftWith(b, "shiv", [["sharpened_spoon", 1], ["bandage", 1]]);
  assert.equal(b.p.gear.weapon?.itemId, "shiv", "dụng cụ cậy (bậc 2)");
  setTime(w, 1, 13, 30);
  b.goNear("vent");
  b.must({ type: "interact", targetId: "vent" });
  b.finishChannel();
  assert.equal(w.routes.ventOpen, true);
  b.escapeVia("VENT");
  // bò trong ống về hướng Đông-Bắc tới miệng ống phía kho
  assert.ok(b.walkTo({ x: 60.5, y: 16.5 }), "bò hết ống gió");
  // chờ xe hàng (14:00) trong ống — ống không thuộc khu nào nên không vi phạm
  while (w.totalGameMinutes % 1440 < 14 * 60 + 1) b.tick(20);
  const storagePath = [
    { x: 58.5, y: 16.5 },
    { x: 58.5, y: 15.5 },
    { x: 57.5, y: 13.5 },
    { x: 56.5, y: 12.5 },
  ];
  waitCameraAway(b, "C5", storagePath);
  const v0 = b.p.violationsToday.count;
  const journal0 = w.journal.length;
  for (const q of storagePath) assert.ok(b.walkTo(q, 0.2));
  assert.equal(b.p.violationsToday.count, v0, "qua kho không bị camera C5 ghi hình");
  assert.ok(!w.journal.slice(journal0).some((j) => j.text.startsWith("Camera")));
  // cổng xe tải đang mở vì xe hàng tới
  assert.ok(b.walkTo({ x: 60.5, y: 6.5 }));
  reachExit(b, "exit_truck");
});

test("bot lối 2 — thất bại: không có dụng cụ cậy thì không mở được lưới; ngoài giờ xe hàng cổng đóng", () => {
  const w = botWorld(22);
  const b = new Bot(w);
  b.goNear("vent");
  const r = b.act({ type: "interact", targetId: "vent" });
  assert.equal(!r.ok && r.code, "ITEM_NOT_OWNED");
  w.routes.ventOpen = true;
  w.teamQuests.t_supplies.status = "COMPLETED";
  setTime(w, 1, 16);
  b.escapeVia("VENT");
  assert.ok(b.walkTo({ x: 60.5, y: 16.5 }));
  assert.ok(b.walkTo({ x: 60.5, y: 6.5 }));
  for (let i = 0; i < 40; i++) b.tick(1, { dx: 1, dy: 0 });
  assert.ok(b.p.x < 61, "cổng xe tải đóng ngoài giờ xe hàng");
});

// ------------------------------------------------------------------ 3. Cải trang cai ngục + thẻ

function knockOutGuardInShower(w: WorldState, b: Bot) {
  const src = makeWorld(1, "single", 23).guards.find((g) => g.routeId === "cells")!;
  w.guards = [src];
  src.x = 28.5;
  src.y = 28.5;
  src.facing = 0;
  src.path = [];
  src.pauseUntil = 1e9;
  src.health = 1;
  place(w, "p1", 27.6, 28.5); // sau lưng cai ngục, góc phòng tắm không có camera
  b.p.facing = 0;
  b.must({ type: "attack" });
  assert.ok(src.downUntil > 0, "cai ngục bất tỉnh");
  return src;
}

test("bot lối 3 — CẢI TRANG: hạ cai ngục ở phòng tắm, lục bộ đồ + thẻ, mặc vào, qua cửa kho và cổng xe tải", () => {
  const w = botWorld(23);
  const b = new Bot(w);
  setTime(w, 1, 12);
  b.supplies();
  setTime(w, 1, 16);
  const g = knockOutGuardInShower(w, b);
  b.must({ type: "lootStart", targetId: g.id });
  b.finishChannel();
  b.must({ type: "lootTake", targetId: g.id, slot: "outfit", index: 0 });
  b.finishChannel();
  b.must({ type: "lootTake", targetId: g.id, slot: "bag", index: g.bag.findIndex((i) => i.itemId === "keycard") });
  b.finishChannel();
  // lấy áo / quần từ người bị ngất thì mặc luôn vào ô áo / quần (đồ tù cũ về túi)
  for (const id of ["guard_outfit"] as const) {
    const i = b.p.inventory.findIndex((x) => x.itemId === id);
    if (i >= 0) b.must({ type: "wear", index: i });
  }
  b.must({ type: "lootClose" });
  assert.equal(disguiseActive(w, b.p), true);
  assert.equal(countItem(b.p.inventory, "keycard"), 1);
  w.guards = []; // đi khi chưa ai phát hiện (không bị nhìn gần)
  b.escapeVia("GATE");
  // hành lang -> xưởng -> cửa kho (thẻ) -> kho -> sân xe tải -> cổng (đồng phục + thẻ)
  assert.ok(b.walkTo({ x: 39.5, y: 16.5 }));
  assert.ok(b.walkTo({ x: 43.5, y: 16.5 }), "qua cửa kho bằng thẻ");
  assert.ok(b.walkTo({ x: 60.5, y: 6.5 }));
  // qua cổng xe tải bằng đồng phục + thẻ (16:00, không có xe)
  reachExit(b, "exit_truck");
});

test("bot lối 3 — thất bại: có thẻ nhưng mặc áo tù thì cổng xe tải không mở; chốt kế hoạch thiếu đồng phục bị từ chối", () => {
  const w = botWorld(23);
  const b = new Bot(w);
  w.teamQuests.t_supplies.status = "COMPLETED";
  addItem(b.p.inventory, "keycard", 1);
  const r = b.act({ type: "escapePrepare", escapeMethod: "GATE" });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET");
  setTime(w, 1, 16);
  place(w, "p1", 60.5, 6.5);
  for (let i = 0; i < 40; i++) b.tick(1, { dx: 1, dy: 0 });
  assert.ok(b.p.x < 61, "cổng đóng");
});

// ------------------------------------------------------------------ 4. Xe giặt

function boardLaundry(w: WorldState, b: Bot) {
  setTime(w, 1, 12);
  b.supplies();
  setTime(w, 2, 9, 5); // sau điểm danh sáng, cai ngục ở xưởng
  b.escapeVia("LAUNDRY");
  b.goNear("laundry_cart");
  b.must({ type: "interact", targetId: "laundry_cart" });
  b.finishChannel();
  assert.equal(b.p.vehicle, "laundry");
}

test("bot lối 4 — XE GIẶT: vào xe trước 10:00, xe ra cổng, qua kiểm tra, nhảy xe chạy tới ô thoát Đông", () => {
  const w = botWorld(25);
  const b = new Bot(w);
  boardLaundry(w, b);
  // nằm yên: không đi được
  const x0 = b.p.x;
  b.tick(10, { dx: 1, dy: 0 });
  assert.equal(b.p.x, x0, "nằm trong xe không di chuyển");
  while (b.p.vehicle && w.totalGameMinutes % 1440 < 10 * 60 + 1) b.tick(20);
  assert.equal(b.p.vehicle, null);
  assert.equal(b.p.status, "ACTIVE", "qua được kiểm tra xe (seed cố định)");
  assert.equal(PRISON_MAP.zoneGrid[Math.floor(b.p.y) * PRISON_MAP.width + Math.floor(b.p.x)], "outside", "đã ở ngoài cổng");
  reachExit(b, "exit_e");
});

test("bot lối 4 — thất bại: chưa chốt kế hoạch / sau 10:00 không lên xe được; bị kiểm tra xe thì bị bắt", () => {
  const w = botWorld(24);
  const b = new Bot(w);
  setTime(w, 1, 9, 30);
  b.goNear("laundry_cart");
  const noPlan = b.act({ type: "interact", targetId: "laundry_cart" });
  assert.equal(!noPlan.ok && noPlan.code, "INVALID_STATE");
  const w2 = botWorld(24);
  const b2 = new Bot(w2);
  const chance = VEHICLES.laundry.inspectChance;
  VEHICLES.laundry.inspectChance = 1; // cai ngục chắc chắn kiểm tra xe
  try {
    boardLaundry(w2, b2);
    while (b2.p.vehicle && w2.totalGameMinutes % 1440 < 10 * 60 + 1) b2.tick(20);
    assert.notEqual(b2.p.status, "ACTIVE", "bị lôi ra khỏi xe");
    assert.ok(w2.journal.some((j) => j.text.includes("trốn trong xe giặt")));
  } finally {
    VEHICLES.laundry.inspectChance = chance;
  }
  setTime(w2, 3, 10, 30);
  const late = new Bot(botWorld(25));
  late.w.teamQuests.t_supplies.status = "COMPLETED";
  setTime(late.w, 1, 10, 30);
  late.escapeVia("LAUNDRY");
  late.goNear("laundry_cart");
  const r = late.act({ type: "interact", targetId: "laundry_cart" });
  assert.equal(!r.ok && r.code, "INVALID_STATE", "xe giặt đã đi");
});

// ------------------------------------------------------------------ 5. Cắt điện + vượt rào

function fenceRun(seed: number, blackout: boolean) {
  const w = botWorld(seed, true);
  const b = new Bot(w);
  b.p.stats.intelligence = 45;
  setTime(w, 1, 12);
  b.supplies();
  craftWith(b, "jammer", [["wire", 1], ["battery", 1], ["circuit_board", 1]]);
  craftWith(b, "wire_cutters", [["metal_scrap", 2], ["plastic", 1]]);
  craftWith(b, "fake_key", [["plastic", 1], ["key_mold", 1]]);
  craftWith(b, "dummy", [["blanket", 1], ["pillow", 1], ["clothes", 1]]);
  b.goNear("bedrest_0");
  b.must({ type: "bedPlace", bedId: "bedrest_0", what: "dummy" });
  // đêm: đã lẻn vào phòng điện cạnh kho
  setTime(w, 1, 22, 5);
  place(w, "p1", 49.5, 9.5);
  if (blackout) {
    b.goNear("power_panel");
    b.must({ type: "interact", targetId: "power_panel" });
    b.finishChannel();
  }
  return { w, b };
}

test("bot lối 5 — CẮT ĐIỆN: thông minh 45, thiết bị phá điện + kìm cắt; mất điện 90 giây, cắt 2 lớp rào, né tháp canh, tới ô thoát Đông", () => {
  const { w, b } = fenceRun(25, true);
  assert.ok(w.blackoutUntil > w.time, "đang mất điện");
  assert.equal(w.blackoutUntil - w.time <= BLACKOUT_SECONDS, true);
  assert.ok(w.camerasOffUntil >= w.blackoutUntil, "camera tắt");
  const until = w.blackoutUntil;
  assert.ok(b.walkTo({ x: 11.5, y: 5.5 }, 0.2, 8000), "chạy ra sân");
  b.must({ type: "interact", targetId: "fence_inner" });
  b.finishChannel();
  assert.ok(b.walkTo({ x: 11.5, y: 3.5 }), "qua lỗ rào trong");
  b.must({ type: "interact", targetId: "fence_outer" });
  b.finishChannel();
  assert.ok(w.time < until, `cắt xong 2 lớp rào trong ${BLACKOUT_SECONDS} giây mất điện`);
  assert.ok(!b.p.violationKeys.some((k) => k.startsWith("tower:")), "tháp canh không thấy (tối chỉ nhìn 4 ô)");
  assert.equal(b.p.wantedLevel, 0);
  b.escapeVia("FENCE");
  assert.ok(b.walkTo({ x: 11.5, y: 1.0 }), "ra ngoài hàng rào");
  assert.ok(b.walkTo({ x: 62.5, y: 1.0 }, 0.3, 8000));
  reachExit(b, "exit_e");
});

test("bot lối 5 — thất bại: không cắt điện thì tháp canh (đèn pha, 10 ô) thấy người ở sân sau 21:00 -> truy nã", () => {
  const { b } = fenceRun(25, false);
  assert.ok(b.walkTo({ x: 11.5, y: 5.5 }, 0.2, 8000));
  b.act({ type: "interact", targetId: "fence_inner" });
  b.tick(40);
  assert.ok(b.p.wantedLevel >= 1, "bị tháp canh phát hiện");
});

// ------------------------------------------------------------------ 6. Đục tường ngoài (lối mới)

/** Đứng trong xà lim A-3, sát tường ngoài phía Nam (y = 41) */
const WALL_SPOT = { x: 12.5, y: 40.5 };
const OUTER = { x: 12, y: 41 };

function wallNight(w: WorldState, b: Bot, cover: boolean) {
  b.p.stats.intelligence = 35;
  setTime(w, 1, 12);
  b.supplies();
  // chế tạo có thể hỏng (mất nguyên liệu): làm lại tới khi có
  for (let i = 0; i < 20 && !countItem(b.p.inventory, "improved_pickaxe") && b.p.gear.weapon?.itemId !== "improved_pickaxe"; i++) {
    b.p.inventory = b.p.inventory.filter((x) => x.itemId !== "pickaxe" && x.itemId !== "reinforced_material");
    craftWith(b, "improved_pickaxe", [["pickaxe", 1], ["reinforced_material", 1]]);
  }
  craftWith(b, "dummy", [["blanket", 1], ["pillow", 1], ["clothes", 1]]);
  b.goNear("bedrest_0");
  b.must({ type: "bedPlace", bedId: "bedrest_0", what: "dummy" });
  setTime(w, 1, 20, 30);
  assert.ok(b.walkTo(WALL_SPOT), "về xà lim trước 21:00");
  setTime(w, 1, 21, 30);
  // cuốc chim thường (cấp 2) không đục nổi tường ngoài (cấp 3)
  b.must({ type: "dig", x: OUTER.x, y: OUTER.y });
  b.finishChannel(800);
  assert.ok(w.dig.holes[`${OUTER.x},${OUTER.y}`], "đục thủng tường ngoài");
  if (cover) {
    addItem(b.p.inventory, "wall_picture", 1);
    b.must({ type: "placeDecor", itemId: "wall_picture", x: OUTER.x, y: OUTER.y });
  }
}

test("bot lối 6 — ĐỤC TƯỜNG: thông minh 35, Cuốc chim cải tiến; đêm đặt hình nộm, đục thủng tường ngoài, treo ảnh che; đào tẩu chui qua lỗ tới ô thoát", () => {
  const w = botWorld(26);
  const b = new Bot(w);
  wallNight(w, b, true);
  assert.equal(b.p.wantedLevel, 0, "hình nộm qua mặt kiểm tra đêm");
  // chưa đào tẩu: lỗ mở ra bên ngoài nhưng chưa bước ra được
  b.tick(20, { dx: 0, dy: 1 });
  assert.ok(b.p.y < 42, "chưa bắt đầu đào tẩu thì không ra ngoài");
  b.escapeVia("WALL");
  // lỗ đang treo ảnh: gỡ ảnh rồi chui qua
  b.must({ type: "takeDecor", x: OUTER.x, y: OUTER.y });
  assert.ok(b.walkTo({ x: 12.5, y: 42.5 }), "chui qua lỗ ra bãi đất ngoài");
  reachExit(b, "exit_sw");
});

test("bot lối 6 — thất bại: Cuốc chim thường không đục được tường ngoài; chưa có lỗ thì chốt kế hoạch bị từ chối; lỗ không che bị cai ngục thấy và lấp lại", () => {
  const w = botWorld(26);
  const b = new Bot(w);
  w.teamQuests.t_supplies.status = "COMPLETED";
  const r0 = b.act({ type: "escapePrepare", escapeMethod: "WALL" });
  assert.equal(!r0.ok && r0.code, "REQUIREMENTS_NOT_MET");
  addItem(b.p.inventory, "pickaxe", 1);
  setTime(w, 1, 12);
  place(w, "p1", WALL_SPOT.x, WALL_SPOT.y);
  const r = b.act({ type: "dig", x: OUTER.x, y: OUTER.y });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET", "cuốc chim thường không đủ cứng");
  // đục xong nhưng không che: cai ngục khu xà lim đi ngang thấy lỗ trong 3 ô
  const w2 = botWorld(27);
  const b2 = new Bot(w2);
  wallNight(w2, b2, false);
  const g = makeWorld(1, "single", 27).guards.find((x) => x.routeId === "cells")!;
  w2.guards = [g];
  g.x = 12.5;
  g.y = 38.5;
  g.facing = Math.PI / 2;
  g.path = [];
  g.pauseUntil = 1e9;
  setTime(w2, 2, 8, 30);
  b2.tick(5);
  assert.equal(w2.dig.holes[`${OUTER.x},${OUTER.y}`], undefined, "lỗ bị lấp");
  const r2 = b2.act({ type: "escapePrepare", escapeMethod: "WALL" });
  assert.equal(!r2.ok && r2.code, "REQUIREMENTS_NOT_MET", "lối đã bị chặn");
});

// ------------------------------------------------------------------ 7. Cổng xe tải bằng chìa / thẻ (lối mới)

const STORAGE_PATH = [
  { x: 44.5, y: 16.5 },
  { x: 47.5, y: 14.5 },
  { x: 56.5, y: 13.5 },
  { x: 56.5, y: 12.5 },
];

test("bot lối 7 — CỔNG XE TẢI: chìa kho giả mở cửa sau xưởng, chờ xe hàng 14:00 trong kho, né camera C5, qua cổng đang mở", () => {
  const w = botWorld(28);
  const b = new Bot(w);
  setTime(w, 1, 12);
  b.supplies();
  craftWith(b, "fake_key", [["plastic", 1], ["key_mold", 1]]);
  assert.equal(countItem(b.p.inventory, "fake_key"), 1);
  b.escapeVia("TRUCK");
  setTime(w, 1, 13, 50);
  assert.ok(b.walkTo({ x: 39.5, y: 16.5 }), "vào xưởng");
  assert.ok(b.walkTo({ x: 43.5, y: 16.5 }), "qua cửa sau xưởng bằng chìa kho giả");
  while (w.totalGameMinutes % 1440 < 14 * 60 + 1) b.tick(20);
  waitCameraAway(b, "C5", STORAGE_PATH);
  for (const q of STORAGE_PATH) assert.ok(b.walkTo(q, 0.2), `đi tới ${q.x},${q.y}`);
  assert.ok(b.walkTo({ x: 60.5, y: 6.5 }), "ra sân xe tải");
  reachExit(b, "exit_truck");
});

test("bot lối 7 — thất bại: không có chìa / thẻ thì cửa kho đóng và chốt kế hoạch bị từ chối; có chìa nhưng ngoài giờ xe hàng cổng đóng", () => {
  const w = botWorld(28);
  const b = new Bot(w);
  w.teamQuests.t_supplies.status = "COMPLETED";
  const r = b.act({ type: "escapePrepare", escapeMethod: "TRUCK" });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET");
  setTime(w, 1, 13, 50);
  place(w, "p1", 39.5, 16.5);
  for (let i = 0; i < 40; i++) b.tick(1, { dx: 1, dy: 0 });
  assert.ok(b.p.x < 41, "cửa kho khoá");
  addItem(b.p.inventory, "fake_key", 1);
  b.escapeVia("TRUCK");
  setTime(w, 1, 16);
  place(w, "p1", 60.5, 6.5);
  for (let i = 0; i < 40; i++) b.tick(1, { dx: 1, dy: 0 });
  assert.ok(b.p.x < 61, "cổng đóng ngoài giờ xe hàng");
});
