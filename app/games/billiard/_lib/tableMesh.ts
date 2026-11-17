/**
 * Hình học hiển thị của băng bàn Carom (thuần, không phụ thuộc Three.js — test được bằng Node).
 * Toạ độ three: X = chiều dài, Y lên trên (mặt vải Y = 0), Z = −y vật lý.
 */
import type { CaromTableConfig } from "./physics";

/**
 * Mặt cắt băng cao su (u = khoảng cách ra ngoài từ mép thi đấu, v = độ cao).
 * Chân băng lùi vào trong, MŨI BĂNG (u = 0) ở đúng độ cao tiếp xúc của vật lý, mặt trên vát tới mép khung gỗ.
 */
export function cushionProfile(cfg: CaromTableConfig): [number, number][] {
  const { width: w, height: h, noseHeight: n } = cfg.cushion;
  return [
    [w, 0],
    [0.012, 0],
    [0.003, n * 0.62],
    [0.0006, n - 0.004],
    [0, n],
    [0.0012, n + 0.0035],
    [0.006, h - 0.004],
    [0.016, h],
    [w, h],
  ];
}

/**
 * Băng liền một khối: quét mặt cắt quanh hình chữ nhật mặt thi đấu (góc vát 45°, không hở, không chồng mesh).
 * Trả về vị trí đỉnh (x, y, z) theo từng tam giác.
 */
export function buildCushionPositions(cfg: CaromTableConfig): Float32Array {
  const hl = cfg.playingSurface.length / 2;
  const hw = cfg.playingSurface.width / 2;
  const prof = cushionProfile(cfg);
  const corners: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  const at = (k: number, c: number): [number, number, number] => {
    const [u, v] = prof[k];
    const [sx, sy] = corners[c];
    return [sx * (hl + u), v, -sy * (hw + u)];
  };
  const out: number[] = [];
  for (let k = 0; k < prof.length; k++) {
    const k2 = (k + 1) % prof.length;
    for (let c = 0; c < 4; c++) {
      const c2 = (c + 1) % 4;
      for (const p of [at(k, c), at(k, c2), at(k2, c2), at(k, c), at(k2, c2), at(k2, c)]) out.push(...p);
    }
  }
  return new Float32Array(out);
}
