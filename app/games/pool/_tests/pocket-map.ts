/**
 * Bản đồ tỉ lệ vào lỗ (mục 1.5.1): bắn N bi ngẫu nhiên (góc tới, độ lệch, tốc độ) vào mỗi loại lỗ.
 * Xuất CSV (từng cú) + PNG (heatmap: trục ngang = góc lệch so với trục lỗ, trục dọc = độ lệch ngang;
 * ảnh trái = chậm 0.5–2.5 m/s, phải = nhanh 4–7 m/s; xanh = vào, đỏ = trượt).
 * Chạy: npm run pool:pocket-map  (tuỳ chọn POCKET_MAP_N=10000, POCKET_PRESET=wpa|easy|pro)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { configForPreset, type PocketPreset } from "../_lib/physics/config";
import { tableFor } from "../_lib/physics/table";
import { probePocket } from "../_lib/tools/pocketProbe";
import { rng } from "../_lib/rules/rack";

const N = Number(process.env.POCKET_MAP_N ?? 10000);
const preset = (process.env.POCKET_PRESET ?? "wpa") as PocketPreset;
const OUT = new URL("../../../../reports/pocket-map/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const c = configForPreset(preset);
const T = tableFor(c);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let k = n;
  for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
  return k >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let crc = 0xffffffff;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const chunk = (type: string, data: Uint8Array) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), Buffer.from(data)]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.subarray(y * w * 3, (y + 1) * w * 3)).copy(raw, y * (w * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

const GA = 48; // ô góc
const GO = 48; // ô độ lệch
const CELL = 6;
for (const pk of [T.pockets[2], T.pockets[1]]) {
  const kind = pk.kind;
  const maxAng = kind === "corner" ? 60 : 75;
  const rand = rng(kind === "corner" ? 1 : 2);
  const rows = ["angle_deg,offset_m,speed_mps,pocketed,touched_jaw,touched_back"];
  const bins = [0, 1].map(() => Array.from({ length: GA * GO }, () => [0, 0]));
  for (let i = 0; i < N; i++) {
    const ang = (rand() * 2 - 1) * maxAng;
    const off = (rand() * 2 - 1) * 0.06;
    const fast = rand() < 0.5;
    const v = fast ? 4 + rand() * 3 : 0.5 + rand() * 2;
    const r = probePocket(pk, ang, off, v, c);
    rows.push(`${ang.toFixed(2)},${off.toFixed(4)},${v.toFixed(2)},${+r.pocketed},${+r.touchedJaw},${+r.touchedBack}`);
    const ia = Math.min(GA - 1, Math.floor(((ang + maxAng) / (2 * maxAng)) * GA));
    const io = Math.min(GO - 1, Math.floor(((off + 0.06) / 0.12) * GO));
    const cell = bins[fast ? 1 : 0][io * GA + ia];
    cell[0] += +r.pocketed;
    cell[1]++;
  }
  writeFileSync(new URL(`${kind}-${preset}.csv`, OUT), rows.join("\n"));
  const W = (GA * CELL) * 2 + CELL * 2;
  const H = GO * CELL;
  const img = new Uint8Array(W * H * 3).fill(30);
  bins.forEach((b, k) => {
    for (let io = 0; io < GO; io++)
      for (let ia = 0; ia < GA; ia++) {
        const [inn, tot] = b[io * GA + ia];
        const rate = tot ? inn / tot : -1;
        const col = rate < 0 ? [40, 40, 48] : [Math.round(200 * (1 - rate)) + 30, Math.round(200 * rate) + 30, 60];
        for (let y = 0; y < CELL; y++)
          for (let x = 0; x < CELL; x++) {
            const px = k * (GA * CELL + CELL * 2) + ia * CELL + x;
            const py = (GO - 1 - io) * CELL + y;
            img.set(col, (py * W + px) * 3);
          }
      }
  });
  writeFileSync(new URL(`${kind}-${preset}.png`, OUT), png(W, H, img));
  const total = rows.length - 1;
  const inn = rows.slice(1).filter((r) => r.split(",")[3] === "1").length;
  console.log(`${pk.name} (${kind}, ${preset}): ${total} cú, vào ${((inn / total) * 100).toFixed(1)}%`);
}
console.log("Đã ghi vào", OUT.pathname);
