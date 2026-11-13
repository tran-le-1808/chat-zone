import { test } from "node:test";
import assert from "node:assert/strict";
import { POOL_PHYSICS as C, POCKET_PRESETS, configForPreset } from "../_lib/physics/config";
import { tableFor } from "../_lib/physics/table";
import { effectiveWidth, probePocket } from "../_lib/tools/pocketProbe";
import { rng } from "../_lib/rules/rack";

const T = tableFor(C);
const corner = T.pockets[2];
const side = T.pockets[1];

test("1.5.2 — khoảng cách 2 điểm mũi lỗ = đúng preset (sai số < 0.1 mm)", () => {
  for (const [key, p] of Object.entries(POCKET_PRESETS)) {
    const t = tableFor(configForPreset(key as keyof typeof POCKET_PRESETS));
    for (const pk of t.pockets) {
      const [[x1, y1], [x2, y2]] = pk.tips;
      const d = Math.hypot(x1 - x2, y1 - y2);
      const want = pk.kind === "corner" ? p.corner : p.side;
      assert.ok(Math.abs(d - want) < 1e-4, `${key} ${pk.name}: ${d}`);
    }
  }
});

test("1.4 — thềm đúng chuẩn WPA: góc 2.54–5.72 cm, giữa 0–0.95 cm; hố ≈ 2.2–2.4 × đường kính bi", () => {
  const D = 2 * C.ballRadius;
  for (const pk of T.pockets) {
    if (pk.kind === "corner") assert.ok(pk.shelf >= 0.0254 && pk.shelf <= 0.0572);
    else assert.ok(pk.shelf >= 0 && pk.shelf <= 0.0095);
    const k = (2 * pk.r) / D;
    assert.ok(k >= 2.2 && k <= 2.4, `${pk.name} hố ${k.toFixed(2)}×`);
  }
});

test("1.4 — bi lăn chính giữa vào lỗ góc, tốc độ vừa -> vào", () => {
  assert.equal(probePocket(corner, 0, 0, 1.5).pocketed, true);
  assert.equal(probePocket(side, 0, 0, 1.5).pocketed, true);
});

test("1.4 — độ rộng hiệu dụng lỗ góc khi đi thẳng (tâm bi đi lọt) ≤ 11.43 − 5.715 cm", () => {
  const max = C.cornerMouth - 2 * C.ballRadius;
  for (const v of [1, 2, 4]) {
    const w = effectiveWidth(corner, v);
    assert.ok(w <= max + 0.0005, `${v} m/s: rộng ${(w * 100).toFixed(2)} cm > ${(max * 100).toFixed(2)} cm`);
    assert.ok(w >= max * 0.5, `${v} m/s: quá hẹp ${(w * 100).toFixed(2)} cm`);
  }
  // Tính cả bi sượt mặt vát rồi trượt vào: rộng hơn nhưng vẫn nhỏ hơn miệng lỗ
  assert.ok(effectiveWidth(corner, 1.5, C, 0, false) < C.cornerMouth - C.ballRadius);
});

test("1.4 — bi chạm mũi lỗ sai góc -> rung mép và bật ra", () => {
  // Bi đi sát băng vào lỗ góc (lệch 40° so với trục), chạm mũi lỗ: có những vị trí rung rồi bật ra
  let rattledOut = 0;
  for (let off = -0.05; off <= 0.05; off += 0.002) {
    const r = probePocket(corner, 40, off, 2.5);
    if (r.touchedJaw && !r.pocketed) rattledOut++;
  }
  assert.ok(rattledOut >= 3, `chỉ ${rattledOut} cú rung mép bật ra`);
});

test("1.4 — lỗ giữa từ chối bi đi chéo nhiều, đánh mạnh", () => {
  assert.equal(probePocket(side, 0, 0, 5).pocketed, true);
  const straight = effectiveWidth(side, 5, C, 0, false);
  const steepFast = effectiveWidth(side, 5, C, 55, false);
  const steepSlow = effectiveWidth(side, 1, C, 55, false);
  assert.ok(steepFast < straight * 0.35, `55° nhanh ${steepFast} vs thẳng ${straight}`);
  assert.ok(steepFast < steepSlow, `55°: nhanh ${steepFast} ≥ chậm ${steepSlow}`);
});

test("1.4 — đánh quá mạnh thẳng vào lỗ: đập thành sau lỗ", () => {
  const r = probePocket(corner, 0, 0, 7);
  assert.equal(r.touchedBack, true);
});

test("1.5.1 — bản đồ tỉ lệ vào lỗ: thu hẹp khi góc lệch tăng và khi tốc độ tăng", () => {
  const rand = rng(99);
  const N = Number(process.env.POCKET_SAMPLES ?? 1500);
  for (const pk of [corner, side]) {
    const rate = (angLo: number, angHi: number, vLo: number, vHi: number) => {
      let inn = 0;
      for (let i = 0; i < N; i++) {
        const ang = angLo + rand() * (angHi - angLo);
        const off = (rand() * 2 - 1) * 0.05;
        const v = vLo + rand() * (vHi - vLo);
        if (probePocket(pk, rand() < 0.5 ? ang : -ang, off, v).pocketed) inn++;
      }
      return inn / N;
    };
    const straightSlow = rate(0, 10, 1, 2.5);
    const cutSlow = rate(35, 50, 1, 2.5);
    const cutFast = rate(35, 50, 5, 7);
    assert.ok(cutSlow < straightSlow, `${pk.name}: góc lệch ${cutSlow} ≥ thẳng ${straightSlow}`);
    assert.ok(cutFast <= cutSlow, `${pk.name}: nhanh ${cutFast} > chậm ${cutSlow}`);
  }
});
