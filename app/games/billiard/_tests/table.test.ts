/** Test hình học hiển thị bàn Carom: băng khớp mặt thi đấu, khung theo phủ bì, kim cương đối xứng */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PHYSICS } from "../_lib/physics/config";
import { CAROM_TABLE_CONFIGS, diamondLayout, railWidths } from "../_lib/physics/table";
import { buildCushionPositions, cushionProfile } from "../_lib/tableMesh";

const TYPES = Object.values(CAROM_TABLE_CONFIGS);

test("băng: mũi băng đúng mép thi đấu ở đúng độ cao tiếp xúc của vật lý; không lấn vào mặt thi đấu", () => {
  for (const cfg of TYPES) {
    const prof = cushionProfile(cfg);
    const minU = Math.min(...prof.map(([u]) => u));
    assert.equal(minU, 0, "điểm trong cùng của băng là mũi băng");
    const nose = prof.find(([u]) => u === 0)!;
    assert.equal(nose[1], DEFAULT_PHYSICS.cushionHeight, "mũi băng = độ cao tiếp xúc vật lý");
    assert.equal(Math.max(...prof.map(([, v]) => v)), DEFAULT_PHYSICS.railTopHeight, "mặt trên băng = mặt trên khung (cơ không xuyên)");
    assert.equal(Math.max(...prof.map(([u]) => u)), cfg.cushion.width);
    const pos = buildCushionPositions(cfg);
    const hl = cfg.playingSurface.length / 2;
    const hw = cfg.playingSurface.width / 2;
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
      // không đỉnh nào nằm trong mặt thi đấu
      assert.ok(Math.abs(x) >= hl - 1e-6 || Math.abs(z) >= hw - 1e-6, `đỉnh lấn mặt thi đấu: ${x},${z}`);
      // không vượt ra ngoài khung gỗ
      assert.ok(Math.abs(x) <= hl + cfg.cushion.width + 1e-6 && Math.abs(z) <= hw + cfg.cushion.width + 1e-6);
      assert.ok(y >= 0 && y <= cfg.cushion.height + 1e-9);
    }
  }
});

test("băng liền khối: mỗi cạnh đều có mặt (4 cạnh × mặt cắt), góc nối vát chéo không hở", () => {
  const cfg = CAROM_TABLE_CONFIGS.THREE_CUSHION;
  const pos = buildCushionPositions(cfg);
  const prof = cushionProfile(cfg);
  assert.equal(pos.length, prof.length * 4 * 6 * 3, "đủ tam giác cho 4 cạnh, mặt cắt khép kín");
  // tại mỗi góc, đỉnh của hai cạnh kề trùng nhau (cùng nằm trên đường chéo) -> không hở
  const hl = cfg.playingSurface.length / 2;
  const hw = cfg.playingSurface.width / 2;
  for (const [u] of prof) {
    let found = 0;
    for (let i = 0; i < pos.length; i += 3)
      if (Math.abs(Math.abs(pos[i]) - (hl + u)) < 1e-6 && Math.abs(Math.abs(pos[i + 2]) - (hw + u)) < 1e-6) found++;
    assert.ok(found >= 8, `góc chéo tại u=${u}`);
  }
});

test("khung gỗ theo phủ bì cấu hình; 3 băng khung dày hơn Libre; kim cương nằm trên khung", () => {
  for (const cfg of TYPES) {
    const rw = railWidths(cfg);
    assert.ok(rw.end > 0 && rw.side > 0);
    for (const d of diamondLayout(cfg)) {
      const onLong = Math.abs(Math.abs(d.y) - (cfg.playingSurface.width / 2 + cfg.cushion.width + rw.side / 2)) < 1e-9;
      const onShort = Math.abs(Math.abs(d.x) - (cfg.playingSurface.length / 2 + cfg.cushion.width + rw.end / 2)) < 1e-9;
      assert.ok(onLong || onShort);
    }
  }
  assert.ok(railWidths(CAROM_TABLE_CONFIGS.THREE_CUSHION).end > railWidths(CAROM_TABLE_CONFIGS.LIBRE).end);
});
