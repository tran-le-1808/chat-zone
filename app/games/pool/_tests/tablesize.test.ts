import { test } from "node:test";
import assert from "node:assert/strict";
import { configForTable, TABLE_SIZES, TABLE_SIZE_ORDER } from "../_lib/physics/config";
import { tableFor, tableOfSize } from "../_lib/physics/table";
import { simulateShot } from "../_lib/physics/simulator";
import { clampCuePlacement, isValidCuePlacement, rackFor } from "../_lib/rules/rack";
import { newRack, startMatch, nextRack } from "../_lib/rules/engine";

test("mặt chơi theo cỡ bàn: tỉ lệ 2:1, 9 feet giữ nguyên 254 × 127 cm", () => {
  for (const k of TABLE_SIZE_ORDER) {
    const t = TABLE_SIZES[k];
    assert.ok(Math.abs(t.length / t.width - 2) < 0.01, k);
    const c = configForTable("wpa", k);
    assert.equal(c.tableLength, t.length);
    assert.equal(c.tableWidth, t.width);
  }
  assert.equal(configForTable().tableLength, 2.54);
  assert.equal(tableOfSize("9ft").L, 2.54);
  assert.ok(tableOfSize("7ft").L < tableOfSize("8ft").L);
});

test("hình học bàn được cache riêng theo cỡ bàn (không lẫn với 9 feet)", () => {
  const a = tableFor(configForTable("wpa", "7ft"));
  const b = tableFor(configForTable("wpa", "9ft"));
  assert.notEqual(a.L, b.L);
  assert.equal(a.footSpot.x, a.L / 4);
  assert.equal(a.headStringX, -a.L / 4);
});

test("xếp bi: đỉnh khung ở foot spot của đúng cỡ bàn, mọi bi nằm trong bàn", () => {
  for (const k of TABLE_SIZE_ORDER) {
    const T = tableOfSize(k);
    for (const type of ["eight", "nine"] as const) {
      const balls = rackFor(type, 42, k);
      const apex = balls.reduce((m, b) => (b.x < m.x ? b : m));
      assert.ok(Math.abs(apex.x - T.footSpot.x) < 1e-9, `${k} ${type}`);
      for (const b of balls) assert.ok(Math.abs(b.x) < T.L / 2 && Math.abs(b.y) < T.W / 2);
    }
  }
});

test("ván mới lưu cỡ bàn; bi cái đặt sau vạch đầu bàn của bàn đó", () => {
  const r = newRack("eight", 0, 7, "7ft");
  assert.equal(r.size, "7ft");
  const cue = r.balls.find((b) => b.n === 0)!;
  assert.ok(cue.x <= tableOfSize("7ft").headStringX);
  // bàn 9 feet: không ghi size (tương thích bản lưu cũ)
  assert.equal(newRack("eight", 0, 7).size, undefined);
  const m = startMatch({ type: "nine", players: [{ name: "A", ai: null }, { name: "B", ai: null }], raceTo: 3, breakRule: "alternate", autoCall: true, seed: 1, tableSize: "8ft" });
  assert.equal(m.rack.size, "8ft");
  assert.equal(nextRack(m).rack.size, "8ft");
});

test("đặt bi cái: giới hạn theo bàn nhỏ", () => {
  const T = tableOfSize("7ft");
  // x = -1.1 m nằm ngoài bàn 7 feet (nửa chiều dài ≈ 0.99 m)
  assert.equal(isValidCuePlacement([], -1.1, 0, true, "7ft"), false);
  assert.equal(isValidCuePlacement([], -1.1, 0, true, "9ft"), true);
  const p = clampCuePlacement(-5, 5, true, "7ft");
  assert.ok(p.x >= -T.L / 2 && p.y <= T.W / 2);
});

test("phá bi trên bàn 7 feet: bi dừng trong bàn hoặc vào lỗ", () => {
  const c = configForTable("wpa", "7ft");
  const r = newRack("eight", 0, 11, "7ft");
  const cue = r.balls.find((b) => b.n === 0)!;
  const trace = simulateShot(r.balls, { dirX: 1, dirY: (0 - cue.y) * 0.01, power: 0.9, tipX: 0, tipY: 0, elevation: 0 }, { config: c });
  const T = tableFor(c);
  const res = trace.result;
  for (const b of res.final) assert.ok(Math.abs(b.x) <= T.L / 2 && Math.abs(b.y) <= T.W / 2, `bi ${b.n} ngoài bàn`);
  assert.ok(res.final.length + res.pocketed.length + res.offTable.length >= 16);
  // cú phá thật sự làm bi tản ra
  const moved = res.final.filter((b) => {
    const s0 = r.balls.find((x) => x.n === b.n);
    return s0 && Math.hypot(b.x - s0.x, b.y - s0.y) > 0.05;
  }).length;
  assert.ok(moved >= 5, `chỉ ${moved} bi di chuyển`);
});
