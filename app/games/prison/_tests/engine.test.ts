import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  applyMoveInput,
  clockInfo,
  countItem,
  createOutbox,
  PRISON_CONFIG as C,
  PRISON_MAP,
  removePlayerFromWorld,
  runTick,
  setPlayerConnected,
  stepMove,
  playerSolid,
  zoneAt,
  type MoveInput,
  actionSeconds,
} from "../_lib/engine";
import { act, flags, guardOn, standNear, makeWorld, noGuards, out, place, placeAt, putInto, seconds, SPOT, takeFrom, ticks } from "./helpers";

// ------------------------------------------------------------------ di chuyển & va chạm

test("không đi xuyên tường; bước di chuyển tất định", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  // xà lim A-3 (x 11..13): tường trái ở x=10 -> đi sang trái mãi vẫn kẹt trong phòng
  for (let s = 1; s <= 60; s++) applyMoveInput(w, "p1", { sequence: s, directionX: -1, directionY: 0, sprint: false });
  assert.ok(p.x >= 11 + C.player.radius - 1e-6, `x=${p.x}`);
  const solid = playerSolid(flags());
  const a = stepMove({ solid, role: "SCOUT", speedMul: 1, drainMul: 1 }, { x: 10.5, y: 22.5, facing: 0, energy: 50 }, { directionX: 1, directionY: 0.3, sprint: true });
  const b = stepMove({ solid, role: "SCOUT", speedMul: 1, drainMul: 1 }, { x: 10.5, y: 22.5, facing: 0, energy: 50 }, { directionX: 1, directionY: 0.3, sprint: true });
  assert.deepEqual(a, b);
  assert.ok(a.energy < 50, "chạy tốn năng lượng");
});

test("input trùng / cũ bị bỏ qua (chống replay)", () => {
  const w = makeWorld(1);
  noGuards(w);
  assert.equal(applyMoveInput(w, "p1", { sequence: 5, directionX: 0, directionY: 1, sprint: false }), true);
  const y = w.players.p1.y;
  assert.equal(applyMoveInput(w, "p1", { sequence: 5, directionX: 0, directionY: 1, sprint: false }), false);
  assert.equal(applyMoveInput(w, "p1", { sequence: 3, directionX: 0, directionY: 1, sprint: false }), false);
  assert.equal(w.players.p1.y, y);
  assert.equal(w.players.p1.lastSeq, 5);
});

test("cửa văn phòng chỉ qua được khi có thẻ; ống gió / bên ngoài chỉ mở khi cậy lưới / đang đào tẩu", () => {
  const closed = playerSolid(flags());
  assert.equal(closed(7, 24), true, "cửa văn phòng (L)");
  assert.equal(playerSolid(flags({ openDoors: "L" }))(7, 24), false);
  assert.equal(closed(59, 29), true, "lưới thông gió đóng");
  assert.equal(closed(60, 20), true, "ống gió đóng");
  assert.equal(closed(1, 16), true, "bên ngoài đóng");
  const open = playerSolid(flags({ ventOpen: true, outsideOpen: true }));
  assert.equal(open(59, 29), false);
  assert.equal(open(60, 20), false);
  assert.equal(open(1, 16), false);
  assert.equal(closed(10, 2), true, "hàng rào");
  assert.equal(playerSolid(flags({ fenceGaps: ["10,2"] }))(10, 2), false, "ô rào đã cắt");
});

test("đồng hồ: totalGameMinutes là tổng phút đã trôi, không phải phút trong ngày", () => {
  assert.deepEqual(clockInfo(8 * 60), { day: 1, hour: 8, minute: 0, minuteOfDay: 480, period: "WAKE" });
  assert.equal(clockInfo(1440 + 23 * 60).period, "LIGHTS_OUT");
  assert.equal(clockInfo(1440 + 23 * 60).day, 2);
  assert.equal(clockInfo(1440 + 6 * 60 + 30).period, "LIGHTS_OUT", "06:30 vẫn là giờ ngủ (21:00–08:00)");
  assert.equal(clockInfo(1440 + 8 * 60 + 40).period, "ROLL_CALL");
  assert.equal(clockInfo(1440 + 19 * 60 + 45).period, "BREAK", "19:30–20:00 là khoảng nghỉ");
});

test("tất định: cùng seed + cùng input -> cùng trạng thái", () => {
  const run = () => {
    const w = makeWorld(2, "multi", 7);
    const o = createOutbox();
    for (let t = 1; t <= 400; t++) {
      const inputs = new Map<string, MoveInput[]>([
        ["p1", [{ sequence: t, directionX: Math.sin(t / 20), directionY: 1, sprint: t % 50 < 20 }]],
        ["p2", [{ sequence: t, directionX: 1, directionY: Math.cos(t / 15), sprint: false }]],
      ]);
      runTick(w, o, inputs);
    }
    return JSON.stringify(w);
  };
  assert.equal(run(), run());
});

// ------------------------------------------------------------------ lính gác

test("lính gác: thấy vi phạm -> heat tăng -> truy đuổi -> hạ gục -> (chơi đơn) qua đêm trong biệt giam + tịch thu vật cấm", () => {
  const w = makeWorld(1);
  const g = guardOn(w, "cells");
  w.guards = [g];
  g.x = SPOT.officeGuard.x;
  g.y = SPOT.officeGuard.y;
  g.facing = 0;
  g.path = [];
  addItem(w.players.p1.inventory, "file", 1);
  addItem(w.players.p1.inventory, "cloth", 2);
  placeAt(w, "p1", SPOT.office); // trong văn phòng (khu cấm), ngay trước mặt lính
  const o = createOutbox();
  const states = new Set<string>();
  for (let i = 0; i < 20 * 8 && w.players.p1.status === "ACTIVE"; i++) {
    runTick(w, o, new Map());
    states.add(g.state);
  }
  assert.ok(states.has("SUSPICIOUS") || states.has("CHASE"));
  assert.ok(states.has("CHASE"));
  assert.ok(w.teamHeat > 0);
  assert.equal(w.players.p1.status, "KNOCKED_OUT");
  assert.ok(o.events.some((e) => e.type === "guard:alert"));
  seconds(w, C.rescue.knockoutWindowSoloSeconds + 0.2);
  const p = w.players.p1;
  assert.equal(p.status, "CAPTURED");
  assert.equal(countItem(p.inventory, "file"), 0, "giũa bị tịch thu");
  assert.ok(w.confiscation.items.some((e) => e.playerId === "p1" && e.item.itemId === "file"), "giũa nằm trong kho tịch thu");
  assert.equal(countItem(p.inventory, "cloth"), 2, "đồ thường giữ lại");
  assert.equal(zoneAt(PRISON_MAP, p.x, p.y), `solitary_${p.solitaryCell}`);
  // chơi đơn: đã qua ngày mới — 08:00, thức dậy trong phòng biệt giam rồi được thả
  w.guards = [];
  assert.equal(clockInfo(w.totalGameMinutes).minuteOfDay, 8 * 60);
  assert.equal(p.stats.energy, p.stats.maxEnergy);
  seconds(w, C.solitary.soloWakeSeconds + 0.2);
  assert.equal(p.status, "ACTIVE");
  assert.equal(p.solitaryUntil, null);
});

test("lính gác: mất dấu -> SEARCH -> RETURN -> PATROL", () => {
  const w = makeWorld(1);
  const g = guardOn(w, "cells");
  w.guards = [g];
  g.state = "CHASE";
  g.targetPlayerId = "p1";
  g.lastKnown = { ...SPOT.office };
  placeAt(w, "p1", SPOT.cell(0)); // ở xà lim, khuất tầm nhìn
  const seen = new Set<string>();
  for (let i = 0; i < 20 * 30; i++) {
    ticks(w, 1);
    seen.add(g.state);
  }
  assert.ok(seen.has("SEARCH"));
  assert.ok(seen.has("RETURN"));
  assert.equal(g.state, "PATROL");
});

test("lính gác nghe tiếng chạy -> INVESTIGATE; Scout chạy êm hơn", () => {
  const w = makeWorld(1);
  const g = guardOn(w, "cells");
  w.guards = [g];
  g.x = 10.5;
  g.y = 22.5;
  g.facing = 0; // quay mặt sang phải
  g.path = [];
  w.players.p1.role = "HACKER";
  place(w, "p1", 8.0, 22.5); // phía sau lưng lính, 2.5 ô
  const o = createOutbox();
  for (let s = 1; s <= 4; s++) runTick(w, o, new Map([["p1", [{ sequence: s, directionX: 0, directionY: -0.2, sprint: true }]]]));
  assert.equal(g.state, "INVESTIGATE");
});

// ------------------------------------------------------------------ hồi sinh & giải cứu

test("hồi sinh: 5 giây, máu 30%, năng lượng 25%; người thứ hai bị CONFLICT; di chuyển huỷ thao tác", () => {
  const w = makeWorld(3);
  noGuards(w);
  const [a, b, c] = [w.players.p1, w.players.p2, w.players.p3];
  place(w, "p1", 10.5, 22.5);
  place(w, "p2", 11.3, 22.5);
  place(w, "p3", 9.7, 22.5);
  a.status = "KNOCKED_OUT";
  a.knockoutDeadline = w.time + 45;
  assert.equal(act(w, "p2", { type: "revive", targetPlayerId: "p1" }).ok, true);
  const second = act(w, "p3", { type: "revive", targetPlayerId: "p1" });
  assert.equal(second.ok, false);
  assert.equal(!second.ok && second.code, "CONFLICT");
  seconds(w, 2);
  assert.equal(a.status, "KNOCKED_OUT");
  // p2 bước đi -> huỷ
  runTick(w, out(), new Map([["p2", Array.from({ length: 3 }, (_, i) => ({ sequence: 100 + i, directionX: 1, directionY: 0, sprint: false }))]]));
  assert.equal(b.channel, null);
  assert.equal(act(w, "p3", { type: "revive", targetPlayerId: "p1" }).ok, true);
  seconds(w, actionSeconds(C.rescue.reviveSeconds) + 0.1);
  assert.equal(a.status, "ACTIVE");
  const h30 = a.stats.maxHealth * 0.3; // 30% máu tối đa (máu tối đa có cộng Sức mạnh)
  assert.ok(a.stats.health >= h30 - 0.5 && a.stats.health < h30 + 1, `health=${a.stats.health}`);
  assert.ok(a.stats.energy >= 25 && a.stats.energy < 27, `energy=${a.stats.energy}`);
  assert.ok(a.invulnerableUntil > w.time);
  void c;
});

test("hồi sinh: ngoài tầm -> OUT_OF_RANGE; hết 45s -> bị bắt", () => {
  const w = makeWorld(2);
  noGuards(w);
  place(w, "p1", 10.5, 22.5);
  place(w, "p2", 20.5, 22.5);
  w.players.p1.status = "KNOCKED_OUT";
  w.players.p1.knockoutDeadline = w.time + C.rescue.knockoutWindowSeconds;
  const r = act(w, "p2", { type: "revive", targetPlayerId: "p1" });
  assert.equal(!r.ok && r.code, "OUT_OF_RANGE");
  seconds(w, C.rescue.knockoutWindowSeconds + 0.1);
  assert.equal(w.players.p1.status, "CAPTURED");
  assert.equal(w.teamQuests["d_rescue_p1"]?.status, "ACTIVE");
});

test("giải cứu: cần kẹp mở khóa + đứng ở cửa đúng; hoàn tất atomic, không cứu trùng", () => {
  const w = makeWorld(3);
  noGuards(w);
  const prisoner = w.players.p1;
  prisoner.status = "KNOCKED_OUT";
  prisoner.knockoutDeadline = 0;
  ticks(w, 1);
  assert.equal(prisoner.status, "CAPTURED");
  const door = PRISON_MAP.solitaryCells[prisoner.solitaryCell!].doorId;
  placeAt(w, "p2", SPOT.solitaryDoor(prisoner.solitaryCell!));
  placeAt(w, "p3", SPOT.solitaryDoor(prisoner.solitaryCell!), 0.5);
  let r = act(w, "p2", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: door });
  assert.equal(!r.ok && r.code, "ITEM_NOT_OWNED");
  addItem(w.players.p2.inventory, "lockpick", 1);
  addItem(w.players.p3.inventory, "lockpick", 1);
  r = act(w, "p2", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: "sol_door_9" });
  assert.equal(!r.ok && r.code, "INVALID_PAYLOAD");
  assert.equal(act(w, "p2", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: door }).ok, true);
  const dupe = act(w, "p3", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: door });
  assert.equal(!dupe.ok && dupe.code, "CONFLICT");
  seconds(w, C.rescue.rescueSeconds * 0.65 + 0.2); // p2 là Fighter? -> dùng thời gian thật của kênh
  seconds(w, C.rescue.rescueSeconds);
  assert.equal(prisoner.status, "ACTIVE");
  assert.equal(w.teamQuests["d_rescue_p1"].status, "COMPLETED");
  assert.equal(w.players.p2.inventory.find((i) => i.itemId === "lockpick")?.durability, 2);
  const money = w.players.p2.money;
  // yêu cầu cứu lần nữa sau khi đã thả -> INVALID_STATE, không thưởng thêm
  const again = act(w, "p3", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: door });
  assert.equal(!again.ok && again.code, "INVALID_STATE");
  assert.equal(w.players.p2.money, money);
});

test("giải cứu: mục tiêu rời trận giữa chừng -> kênh giải cứu bị huỷ, quest FAILED", () => {
  const w = makeWorld(2);
  noGuards(w);
  w.players.p1.status = "KNOCKED_OUT";
  w.players.p1.knockoutDeadline = 0;
  ticks(w, 1);
  placeAt(w, "p2", SPOT.solitaryDoor(w.players.p1.solitaryCell!));
  addItem(w.players.p2.inventory, "lockpick", 1);
  const door = PRISON_MAP.solitaryCells[w.players.p1.solitaryCell!].doorId;
  assert.equal(act(w, "p2", { type: "rescueStart", targetPlayerId: "p1", rescuePointId: door }).ok, true);
  removePlayerFromWorld(w, out(), "p1", "mất kết nối quá lâu");
  assert.equal(w.players.p2.channel, null);
  assert.equal(w.teamQuests["d_rescue_p1"].status, "FAILED");
  assert.deepEqual(w.requiredPlayerIds, ["p2"]);
});

// ------------------------------------------------------------------ túi đồ, chế tạo, kho, giao dịch

test("chế tạo: cần nguyên liệu (không cần bàn); retry cùng requestId không tạo đồ 2 lần", () => {
  const w = makeWorld(2);
  noGuards(w);
  const p = w.players.p1; // HACKER
  p.stats.intelligence = 50; // đủ thông minh cho mọi bậc chế tạo (test này không kiểm tra thư viện)
  addItem(p.inventory, "metal_scrap", 2);
  addItem(p.inventory, "plastic", 2);
  placeAt(w, "p1", SPOT.cell(0)); // trong xà lim, không có bàn chế tạo
  let r: ReturnType<typeof act>;
  p.skills.crafting = 100; // tỉ lệ thành công tối đa
  r = act(w, "p1", { type: "craft", recipeId: "screwdriver" }, "craft-1");
  assert.equal(r.ok, true);
  const again = act(w, "p1", { type: "craft", recipeId: "screwdriver" }, "craft-1");
  assert.equal(again.ok && again.duplicate, true);
  assert.equal(countItem(p.inventory, "screwdriver"), 1);
  assert.equal(countItem(p.inventory, "metal_scrap"), 1);
  r = act(w, "p1", { type: "craft", recipeId: "rope" });
  assert.equal(!r.ok && r.code, "INSUFFICIENT_ITEMS");
  // Mechanic: dụng cụ +1 độ bền
  const m = w.players.p2;
  m.role = "MECHANIC";
  addItem(m.inventory, "metal_scrap", 3);
  addItem(m.inventory, "plastic", 3);
  placeAt(w, "p2", SPOT.cell(0));
  m.skills.crafting = 100;
  m.stats.intelligence = 50;
  // tỉ lệ thành công tối đa 98%: thử lại nếu xui
  for (let i = 0; i < 3 && !countItem(m.inventory, "screwdriver"); i++) {
    assert.equal(act(w, "p2", { type: "craft", recipeId: "screwdriver" }).ok, true);
  }
  assert.equal(m.inventory.find((i) => i.itemId === "screwdriver")?.durability, 4);
});

test("kho nhóm: gửi/rút cần đứng ở kho, kiểm tra số lượng & sức chứa", () => {
  const w = makeWorld(2);
  noGuards(w);
  addItem(w.players.p1.inventory, "cloth", 3);
  let r = act(w, "p1", { type: "deposit", itemId: "cloth", quantity: 2 });
  assert.equal(!r.ok && r.code, "OUT_OF_RANGE");
  placeAt(w, "p1", SPOT.stash);
  placeAt(w, "p2", SPOT.stash, 0, 1);
  assert.equal(act(w, "p1", { type: "deposit", itemId: "cloth", quantity: 2 }).ok, true);
  r = act(w, "p1", { type: "deposit", itemId: "cloth", quantity: 5 });
  assert.equal(!r.ok && r.code, "INSUFFICIENT_ITEMS");
  assert.equal(countItem(w.teamStorage.items, "cloth"), 2);
  assert.equal(act(w, "p2", { type: "withdraw", itemId: "cloth", quantity: 2 }).ok, true);
  r = act(w, "p2", { type: "withdraw", itemId: "cloth", quantity: 1 });
  assert.equal(!r.ok && r.code, "INSUFFICIENT_ITEMS");
  assert.equal(countItem(w.players.p2.inventory, "cloth"), 2);
  assert.equal(countItem(w.players.p1.inventory, "cloth"), 1);
});

test("giao dịch: chỉ người nhận chấp nhận; commit atomic; chấp nhận trùng không nhân đôi", () => {
  const w = makeWorld(3);
  noGuards(w);
  place(w, "p1", 10.5, 22.5);
  place(w, "p2", 11.5, 22.5);
  place(w, "p3", 12.5, 22.5);
  addItem(w.players.p1.inventory, "wire", 2);
  addItem(w.players.p2.inventory, "plastic", 1);
  const req = act(w, "p1", { type: "tradeRequest", targetPlayerId: "p2", offered: [{ itemId: "wire", quantity: 2 }], requested: [{ itemId: "plastic", quantity: 1 }] });
  assert.equal(req.ok, true);
  const tradeId = String(req.ok && req.data?.tradeId);
  const stranger = act(w, "p3", { type: "tradeAccept", tradeId });
  assert.equal(!stranger.ok && stranger.code, "FORBIDDEN");
  assert.equal(act(w, "p2", { type: "tradeAccept", tradeId }, "acc-1").ok, true);
  const dupSame = act(w, "p2", { type: "tradeAccept", tradeId }, "acc-1");
  assert.equal(dupSame.duplicate, true);
  const dupNew = act(w, "p2", { type: "tradeAccept", tradeId }, "acc-2");
  assert.equal(!dupNew.ok && dupNew.code, "DUPLICATE_REQUEST");
  assert.equal(countItem(w.players.p2.inventory, "wire"), 2);
  assert.equal(countItem(w.players.p1.inventory, "plastic"), 1);
  assert.equal(countItem(w.players.p1.inventory, "wire"), 0);
});

test("giao dịch: bên gửi tiêu mất đồ trước khi chấp nhận -> huỷ, không ai mất/thêm đồ", () => {
  const w = makeWorld(2);
  noGuards(w);
  placeAt(w, "p1", SPOT.stash);
  placeAt(w, "p2", SPOT.stash, -1);
  addItem(w.players.p1.inventory, "wire", 1);
  const req = act(w, "p1", { type: "tradeRequest", targetPlayerId: "p2", offered: [{ itemId: "wire", quantity: 1 }], requested: [] });
  const tradeId = String(req.ok && req.data?.tradeId);
  assert.equal(act(w, "p1", { type: "deposit", itemId: "wire", quantity: 1 }).ok, true);
  const r = act(w, "p2", { type: "tradeAccept", tradeId });
  assert.equal(!r.ok && r.code, "INSUFFICIENT_ITEMS");
  assert.equal(countItem(w.players.p2.inventory, "wire"), 0);
  assert.equal(countItem(w.teamStorage.items, "wire"), 1);
  assert.equal(Object.keys(w.trades).length, 0);
});

test("tủ: mở ra thấy đủ đồ, lấy ra / cất vào từng ô; kiểm tra tầm với, ô thay đổi, số lượng, sức chứa", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  const box = w.containers.toolbox_0;
  assert.ok(box.items.length > 0, "tủ có sẵn đồ");
  // ngoài tầm
  placeAt(w, "p1", SPOT.hall(20.5));
  assert.equal(takeFrom(w, "p1", "toolbox_0", box.items[0].itemId).ok, false);
  place(w, "p1", 30.5, 14.5); // cạnh hộp dụng cụ (29,13)
  const opened = act(w, "p1", { type: "interact", targetId: "toolbox_0" });
  assert.equal(opened.ok && opened.data?.opened, "container");
  const first = box.items[0];
  const qty = (list: { quantity: number }[]) => list.reduce((n, i) => n + i.quantity, 0);
  const total0 = qty(box.items) + qty(p.inventory);
  const inv0 = qty(p.inventory);
  assert.equal(takeFrom(w, "p1", "toolbox_0", first.itemId).ok, true);
  assert.equal(qty(p.inventory), inv0 + 1);
  // ô thay đổi / lấy quá số lượng
  assert.equal(act(w, "p1", { type: "containerTake", containerId: "toolbox_0", index: 0, itemId: "wood", quantity: 1 }).ok, false, "sai vật phẩm trong ô");
  const over = act(w, "p1", { type: "containerTake", containerId: "toolbox_0", index: 0, itemId: box.items[0]?.itemId ?? first.itemId, quantity: 99 });
  assert.equal(!over.ok && over.code, "INSUFFICIENT_ITEMS");
  // cất lại đúng đồ
  assert.equal(putInto(w, "p1", "toolbox_0", first.itemId).ok, true);
  assert.equal(qty(box.items) + qty(p.inventory), total0, "tổng đồ được bảo toàn");
  // đầy ô -> OVER_CAPACITY
  const full = w.containers.desk_0; // bàn có 6 ô
  placeAt(w, "p1", SPOT.cell(0));
  full.items = Array.from({ length: 6 }, () => ({ itemId: "spoon" as const, quantity: 5 })); // 6 chồng đầy, không gộp được
  addItem(p.inventory, "cloth", 1);
  const r = putInto(w, "p1", "desk_0", "cloth");
  assert.equal(!r.ok && r.code, "OVER_CAPACITY");
  // túi đầy -> không lấy được và tủ không mất đồ
  while (p.inventory.length < 9) addItem(p.inventory, "wire", 9);
  const before = full.items.length;
  const r2 = act(w, "p1", { type: "containerTake", containerId: "desk_0", index: 0, itemId: "spoon", quantity: 1 });
  assert.equal(!r2.ok && r2.code, "OVER_CAPACITY");
  assert.equal(full.items.length, before);
});

test("tủ: lấy ra / cất vào bằng cùng requestId không thực hiện hai lần; tổng đồ được bảo toàn", () => {
  const w = makeWorld(1);
  noGuards(w);
  place(w, "p1", 30.5, 14.5);
  const box = w.containers.toolbox_0;
  const total = () => box.items.reduce((n, i) => n + i.quantity, 0) + w.players.p1.inventory.reduce((n, i) => n + i.quantity, 0);
  const t0 = total();
  const it = box.items[0];
  const a = { type: "containerTake", containerId: "toolbox_0", index: 0, itemId: it.itemId, quantity: 1 } as const;
  assert.equal(act(w, "p1", a, "take-1").ok, true);
  const again = act(w, "p1", a, "take-1");
  assert.equal(again.ok && again.duplicate, true);
  assert.equal(total(), t0, "không nhân đôi / mất đồ");
});

test("tủ công cộng được bổ sung đồ mỗi sáng; bàn cá nhân thì không", () => {
  const w = makeWorld(1);
  noGuards(w);
  w.inmates = [];
  w.containers.toolbox_0.items = [];
  w.containers.desk_0.items = [];
  w.totalGameMinutes = 1440 + 6 * 60 - 1;
  ticks(w, 40);
  assert.ok(w.containers.toolbox_0.items.length >= C.interaction.containerStock - 0, "tủ công cộng được bổ sung");
  assert.equal(w.containers.desk_0.items.length, 0, "bàn cá nhân không bị bổ sung");
});

// ------------------------------------------------------------------ nhiệm vụ

test("quest cá nhân: nhận -> tiến trình từ sự kiện server -> nhận thưởng đúng 1 lần", () => {
  const w = makeWorld(1);
  noGuards(w);
  const p = w.players.p1;
  assert.equal(act(w, "p1", { type: "questAccept", questId: "p_scavenge" }).ok, true);
  // lấy-cất-lấy ở cùng một tủ chỉ tính 1 lần mỗi ngày (chống cày)
  placeAt(w, "p1", SPOT.cell(0));
  for (let i = 0; i < 3; i++) {
    assert.equal(takeFrom(w, "p1", "desk_0", w.containers.desk_0.items[0].itemId).ok, true);
    assert.equal(putInto(w, "p1", "desk_0", w.players.p1.inventory[w.players.p1.inventory.length - 1].itemId).ok, true);
  }
  assert.equal(w.personalQuests.p1.p_scavenge.objectiveProgress.search, 1);
  place(w, "p1", 30.5, 14.5);
  assert.equal(takeFrom(w, "p1", "toolbox_0", w.containers.toolbox_0.items[0].itemId).ok, true);
  place(w, "p1", 39.5, 18.5);
  assert.equal(takeFrom(w, "p1", "toolbox_1", w.containers.toolbox_1.items[0].itemId).ok, true);
  assert.equal(w.personalQuests.p1.p_scavenge.objectiveProgress.search, 3);
  const money = p.money;
  assert.equal(act(w, "p1", { type: "questComplete", questId: "p_scavenge" }).ok, true);
  const twice = act(w, "p1", { type: "questComplete", questId: "p_scavenge" });
  assert.equal(!twice.ok && twice.code, "DUPLICATE_REQUEST");
  assert.equal(p.money, money + 30);
});

test("quest cá nhân: chưa xong không nhận thưởng; bỏ quest rồi nhận lại", () => {
  const w = makeWorld(1);
  noGuards(w);
  act(w, "p1", { type: "questAccept", questId: "p_craft" });
  const r = act(w, "p1", { type: "questComplete", questId: "p_craft" });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET");
  assert.equal(act(w, "p1", { type: "questAbandon", questId: "p_craft" }).ok, true);
  assert.equal(w.personalQuests.p1.p_craft.status, "ABANDONED");
  assert.equal(act(w, "p1", { type: "questAccept", questId: "p_craft" }).ok, true);
});

test("quest nhóm: một bản ghi / phiên; góp đồ không vượt mức, không cộng trùng, thưởng cả đội", () => {
  const w = makeWorld(3);
  noGuards(w);
  // mỗi người có sẵn 1 bánh mì
  const r1 = act(w, "p1", { type: "questContribute", questId: "t_supplies", objectiveId: "food", quantity: 1 }, "c1");
  assert.equal(r1.ok, true);
  const retry = act(w, "p1", { type: "questContribute", questId: "t_supplies", objectiveId: "food", quantity: 1 }, "c1");
  assert.equal(retry.duplicate, true);
  assert.equal(w.teamQuests.t_supplies.objectiveProgress.food, 1);
  addItem(w.players.p2.inventory, "food", 2);
  // p2 góp 3 nhưng chỉ còn thiếu 1 -> chỉ trừ 1
  const r2 = act(w, "p2", { type: "questContribute", questId: "t_supplies", objectiveId: "food", quantity: 3 });
  assert.equal(r2.ok && r2.data?.contributed, 1);
  assert.equal(countItem(w.players.p2.inventory, "food"), 2);
  const r3 = act(w, "p3", { type: "questContribute", questId: "t_supplies", objectiveId: "food", quantity: 1 });
  assert.equal(!r3.ok && r3.code, "INVALID_STATE");
  assert.equal(Object.keys(w.teamQuests).filter((k) => k === "t_supplies").length, 1);
  const m = [w.players.p1.money, w.players.p2.money, w.players.p3.money];
  assert.equal(act(w, "p3", { type: "questComplete", questId: "t_supplies" }).ok, true);
  assert.deepEqual([w.players.p1.money, w.players.p2.money, w.players.p3.money], m.map((x) => x + 25));
  const again = act(w, "p1", { type: "questComplete", questId: "t_supplies" });
  assert.equal(!again.ok && again.code, "DUPLICATE_REQUEST");
});

// ------------------------------------------------------------------ đào tẩu & chiến thắng chung

function readyWorld(n: number) {
  const w = makeWorld(n);
  noGuards(w);
  w.teamQuests.t_supplies.status = "COMPLETED";
  w.routes.ventOpen = true;
  return w;
}

function walkOut(w: ReturnType<typeof makeWorld>, pid: string) {
  // đã ra ngoài tường (bên Tây), đi xuống ô thoát Tây-Nam
  place(w, pid, 1.0, 37.5);
  const p = w.players[pid];
  const o = createOutbox();
  for (let i = 0; i < 40 && p.status === "ACTIVE"; i++)
    runTick(w, o, new Map([[pid, [{ sequence: p.lastSeq + 1, directionX: 0, directionY: 1, sprint: false }]]]));
}

test("đào tẩu: cần quest nhóm + lối thoát mở; ready check; một người thoát không kết thúc trận", () => {
  const w = makeWorld(2);
  noGuards(w);
  let r = act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET");
  w.teamQuests.t_supplies.status = "COMPLETED";
  r = act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET");
  w.routes.ventOpen = true;
  assert.equal(act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" }).ok, true);
  assert.equal(w.escape.status, "READY_CHECK");
  act(w, "p1", { type: "escapeReady", ready: true });
  r = act(w, "p1", { type: "escapeStart" });
  assert.equal(!r.ok && r.code, "REQUIREMENTS_NOT_MET");
  act(w, "p2", { type: "escapeReady", ready: true });
  assert.equal(act(w, "p2", { type: "escapeStart" }).ok, true);
  assert.equal(w.escape.status, "EXECUTING");
  // enter-point khi chưa tới nơi -> OUT_OF_RANGE (không tin client)
  r = act(w, "p1", { type: "escapeEnterPoint", escapePointId: "exit_truck" });
  assert.equal(!r.ok && r.code, "OUT_OF_RANGE");
  walkOut(w, "p1");
  assert.equal(w.players.p1.status, "ESCAPED");
  assert.equal(w.outcome, null, "một người thoát không thắng");
  assert.notEqual(w.escape.status, "ALL_ESCAPED");
  walkOut(w, "p2");
  ticks(w, 1);
  assert.equal(w.escape.status, "ALL_ESCAPED");
  assert.equal(w.outcome, "ALL_ESCAPED");
});

for (const n of [1, 4]) {
  test(`đào tẩu ${n} người: chỉ ALL_ESCAPED khi mọi requiredPlayerIds đều ESCAPED`, () => {
    const w = readyWorld(n);
    act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" });
    for (const id of w.requiredPlayerIds) act(w, id, { type: "escapeReady", ready: true });
    assert.equal(act(w, "p1", { type: "escapeStart" }).ok, true);
    w.requiredPlayerIds.forEach((id, i) => {
      walkOut(w, id);
      ticks(w, 1);
      if (i < n - 1) assert.equal(w.outcome, null);
    });
    assert.equal(w.outcome, "ALL_ESCAPED");
  });
}

test("đào tẩu: bị bắt giữa chừng -> RESCUE_REQUIRED; cứu xong -> EXECUTING; tất cả bị bắt -> FAILED", () => {
  const w = readyWorld(2);
  act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" });
  act(w, "p1", { type: "escapeReady", ready: true });
  act(w, "p2", { type: "escapeReady", ready: true });
  act(w, "p1", { type: "escapeStart" });
  w.players.p2.status = "KNOCKED_OUT";
  w.players.p2.knockoutDeadline = 0;
  ticks(w, 2);
  assert.equal(w.players.p2.status, "CAPTURED");
  assert.equal(w.escape.status, "RESCUE_REQUIRED");
  assert.equal(w.escape.playerStatuses.p2.status, "CAPTURED");
  placeAt(w, "p1", SPOT.solitaryDoor(w.players.p2.solitaryCell!));
  addItem(w.players.p1.inventory, "lockpick", 1);
  const door = PRISON_MAP.solitaryCells[w.players.p2.solitaryCell!].doorId;
  assert.equal(act(w, "p1", { type: "rescueStart", targetPlayerId: "p2", rescuePointId: door }).ok, true);
  seconds(w, C.rescue.rescueSeconds + 0.2);
  assert.equal(w.players.p2.status, "ACTIVE");
  assert.equal(w.escape.status, "EXECUTING");
  for (const id of ["p1", "p2"]) {
    w.players[id].status = "KNOCKED_OUT";
    w.players[id].knockoutDeadline = 0;
  }
  ticks(w, 2);
  assert.equal(w.escape.status, "FAILED");
  w.players.p1.solitaryUntil = 1e9;
  w.players.p2.solitaryUntil = 1e9;
  seconds(w, C.escape.failedResetSeconds + 0.2);
  assert.equal(w.escape.status, "PREPARING");
});

test("đào tẩu: người còn trong tù rời trận (hết grace) -> bị loại khỏi danh sách bắt buộc, đồ vào kho", () => {
  const w = readyWorld(2);
  act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" });
  act(w, "p1", { type: "escapeReady", ready: true });
  act(w, "p2", { type: "escapeReady", ready: true });
  act(w, "p1", { type: "escapeStart" });
  walkOut(w, "p1");
  assert.equal(w.outcome, null);
  addItem(w.players.p2.inventory, "wire", 2);
  removePlayerFromWorld(w, out(), "p2", "mất kết nối quá 120 giây");
  ticks(w, 1);
  assert.equal(countItem(w.teamStorage.items, "wire"), 2);
  assert.equal(w.outcome, "ALL_ESCAPED");
});

test("người mất kết nối: lính bỏ qua, thao tác giữ bị huỷ", () => {
  const w = makeWorld(2);
  noGuards(w);
  placeAt(w, "p1", SPOT.cell(0));
  act(w, "p1", { type: "interact", targetId: "desk_0" });
  setPlayerConnected(w, out(), "p1", false);
  assert.equal(w.players.p1.channel, null);
});

test("vòng chơi đơn hoàn chỉnh: lục soát -> chế Tua vít -> mở ống -> quest nhóm -> đào tẩu -> thắng", () => {
  const w = makeWorld(1, "single", 3);
  noGuards(w);
  const p = w.players.p1;
  p.stats.intelligence = 50; // đủ thông minh cho mọi bậc chế tạo (test này không kiểm tra thư viện)
  // lấy nguyên liệu: đảm bảo đúng món trong tủ (đồ ngẫu nhiên) rồi lấy ra như người chơi mở modal
  const grab = (id: string, want: Parameters<typeof countItem>[1]) => {
    placeAt(w, "p1", standNear(id));
    if (!w.containers[id].items.some((i) => i.itemId === want)) w.containers[id].items.push({ itemId: want, quantity: 1 });
    assert.equal(takeFrom(w, "p1", id, want).ok, true);
  };
  grab("toolbox_1", "metal_scrap");
  grab("canteen_bin", "plastic");
  placeAt(w, "p1", SPOT.workshop);
  p.skills.crafting = 100;
  assert.equal(act(w, "p1", { type: "craft", recipeId: "screwdriver" }).ok, true);
  assert.equal(countItem(p.inventory, "screwdriver"), 1);
  placeAt(w, "p1", standNear("vent"));
  assert.equal(act(w, "p1", { type: "interact", targetId: "vent" }).ok, true);
  seconds(w, C.interaction.openVentSeconds + 0.2);
  assert.equal(w.routes.ventOpen, true);
  assert.equal(w.teamQuests.t_route.objectiveProgress.route, 1);
  // mua thêm bánh mì ở căng tin (đã có 1 bánh lúc đầu)
  placeAt(w, "p1", SPOT.shop);
  assert.equal(act(w, "p1", { type: "buy", itemId: "food" }).ok, true);
  assert.equal(act(w, "p1", { type: "questContribute", questId: "t_supplies", objectiveId: "food", quantity: 2 }).ok, true);
  assert.equal(act(w, "p1", { type: "questComplete", questId: "t_supplies" }).ok, true);
  assert.equal(act(w, "p1", { type: "escapePrepare", escapeMethod: "VENT" }).ok, true);
  assert.equal(act(w, "p1", { type: "escapeReady", ready: true }).ok, true);
  assert.equal(act(w, "p1", { type: "escapeStart" }).ok, true);
  // bò qua ống gió tới kho rồi ra cổng: phần đi đường có bot riêng (escape-bots); ở đây đứng sau cổng xe tải
  place(w, "p1", 62.6, 6.5);
  const o = createOutbox();
  for (let i = 0; i < 40 && !w.outcome; i++) runTick(w, o, new Map([["p1", [{ sequence: p.lastSeq + 1, directionX: 0, directionY: 1, sprint: false }]]]));
  assert.equal(w.outcome, "ALL_ESCAPED");
});
