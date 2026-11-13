import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { simulateShot as clientSim } from "../_lib/physics/simulator";
import { configForPreset } from "../_lib/physics/config";
import { randomShots } from "../_lib/tools/determinism";
import { ballsHash, shotCommandFromInput, validateShotInput, POOL_PROTOCOL_VERSION } from "../_lib/protocol";

/**
 * 3.10.1 — Determinism: client (engine trong trình duyệt) và server (bản sao trong login-system)
 * phải cho trạng thái bit-giống-nhau. Ở đây so 2 bản mã nguồn chạy trong Node; so trình duyệt
 * thật (Chrome) bằng tools/determinism-browser (Puppeteer) — xem README.
 */
const BACKEND = new URL("../../../../../login-system/src/pool/shared/physics/simulator.ts", import.meta.url);

test("3.10.1 — 1000 cú đánh ngẫu nhiên: hash client == hash server (bản sao backend)", async (t) => {
  if (!existsSync(BACKEND)) return t.skip("không có thư mục login-system cạnh chat-zone");
  const server = (await import(BACKEND.href)) as { simulateShot: typeof clientSim };
  const backendCfg = (await import(new URL("config.ts", BACKEND).href)) as { configForPreset: typeof configForPreset };
  const N = Number(process.env.DETERMINISM_N ?? 1000);
  let mismatch = 0;
  for (const s of randomShots(N)) {
    const tip = Math.hypot(s.input.tipX, s.input.tipY);
    const input = tip > 1 ? { ...s.input, tipX: s.input.tipX / tip, tipY: s.input.tipY / tip } : s.input;
    const cmd = shotCommandFromInput(input);
    const a = clientSim(s.balls, cmd, { config: configForPreset(s.preset) });
    const b = server.simulateShot(s.balls, cmd, { config: backendCfg.configForPreset(s.preset) });
    if (a.hash !== b.hash) mismatch++;
  }
  assert.equal(mismatch, 0, `${mismatch}/${N} cú lệch trạng thái`);
});

test("Giao thức: input hợp lệ được nhận, giá trị vượt giới hạn bị từ chối", () => {
  const base = { v: POOL_PROTOCOL_VERSION, seq: 3, shotId: "x", aimAngle: 1, power: 0.5, tipX: 0, tipY: 0, elevation: 0, clientStateHash: ballsHash([]) };
  assert.equal(validateShotInput(base).ok, true);
  assert.deepEqual(validateShotInput({ ...base, power: 1.2 }), { ok: false, code: "OUT_OF_RANGE" });
  assert.deepEqual(validateShotInput({ ...base, elevation: 85 }), { ok: false, code: "OUT_OF_RANGE" });
  assert.deepEqual(validateShotInput({ ...base, tipX: 0.8, tipY: 0.8 }), { ok: false, code: "OUT_OF_RANGE" });
  assert.deepEqual(validateShotInput({ ...base, v: 0 }), { ok: false, code: "BAD_VERSION" });
  assert.deepEqual(validateShotInput({ ...base, power: "1" }), { ok: false, code: "BAD_INPUT" });
  assert.deepEqual(validateShotInput({ ...base, call: { ball: 20, pocket: 1 } }), { ok: false, code: "BAD_INPUT" });
});
