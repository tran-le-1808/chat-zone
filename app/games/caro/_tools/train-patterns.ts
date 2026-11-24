/**
 * CÔNG CỤ HỌC HÌNH CỜ từ ván của các bot mạnh (file PSQ, vd. kho kết quả Gomocup).
 *   node --import ./app/games/pool/_tests/register.mjs app/games/caro/_tools/train-patterns.ts <rule> <thư_mục_psq> [tối_đa_ván]
 *   rule: free | block2. Ghi ra app/games/caro/_lib/engine/data/patterns-<rule>.json
 * Chỉ học các nước của BÊN THẮNG, bỏ qua thế khai cuộc đặt sẵn; ván không phân thắng thua bị bỏ.
 * Kết quả chỉ là thống kê (log-odds theo mã hình cờ), không chứa ván gốc.
 * Lưu ý: đã đo (tự đấu 40 ván / luật) — dùng bảng này trong engine KHÔNG làm bot mạnh hơn, nên bot hiện không dùng.
 * Dữ liệu Gomocup ghi "Copyright © Gomocup": hỏi ban tổ chức trước khi phát hành bảng dẫn xuất.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyMove, newGame, type CaroRule, type Stone } from "../_lib/rules";
import { cellKeys, type PatternTable } from "../_lib/engine/patterns";
import { parsePsq } from "../_lib/engine/psq";

const [rule, dir, maxArg] = process.argv.slice(2) as [CaroRule, string, string | undefined];
if ((rule !== "free" && rule !== "block2") || !dir) {
  console.error("Cách dùng: train-patterns.ts <free|block2> <thư_mục_psq> [tối_đa_ván]");
  process.exit(1);
}
const MAX = Number(maxArg ?? Infinity);

function* files(d: string): Generator<string> {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (f.toLowerCase().endsWith(".psq")) yield p;
  }
}

const offered = new Float64Array(65536);
const chosen = new Float64Array(65536);
let games = 0;
let skipped = 0;
let samples = 0;
const t0 = Date.now();
for (const f of files(dir)) {
  if (games >= MAX) break;
  const psq = parsePsq(readFileSync(f, "latin1"));
  if (!psq) {
    skipped++;
    continue;
  }
  // đi lại toàn bộ ván để biết ai thắng (theo luật của game này)
  let g = newGame(rule, psq.size);
  const states = [g];
  let ok = true;
  for (const [x, y] of psq.moves) {
    const r = applyMove(g, x, y);
    if (!r.ok) {
      ok = false;
      break;
    }
    g = r.state;
    states.push(g);
    if (g.winner !== null) break;
  }
  if (!ok || g.winner === null) {
    skipped++;
    continue;
  }
  const winner = g.winner as Stone;
  games++;
  const n = psq.size;
  for (let k = psq.opening; k < states.length - 1; k++) {
    const s = states[k];
    if (s.turn !== winner) continue;
    const [mx, my] = psq.moves[k];
    // các ô có thể chọn: trống, trong phạm vi 2 ô quanh quân đã có
    const seen = new Uint8Array(n * n);
    for (const [px, py] of s.moves)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const i = y * n + x;
          if (seen[i] || s.board[i] !== 0) continue;
          seen[i] = 1;
          for (const key of cellKeys(s.board, n, x, y, winner)) offered[key]++;
        }
    for (const key of cellKeys(s.board, n, mx, my, winner)) chosen[key]++;
    samples++;
  }
  if (games % 2000 === 0) console.log(`  ${games} ván, ${samples} nước, ${Math.round((Date.now() - t0) / 1000)}s`);
}

let tc = 0;
let to = 0;
for (let k = 0; k < 65536; k++) {
  tc += chosen[k];
  to += offered[k];
}
const base = tc / to;
const w: [number, number][] = [];
for (let k = 0; k < 65536; k++) {
  if (offered[k] < 30) continue;
  const p = (chosen[k] + 1) / (offered[k] + 2);
  const v = Math.max(-3, Math.min(3, Math.log(p / base)));
  if (Math.abs(v) >= 0.05) w.push([k, Math.round(v * 100) / 100]);
}
const table: PatternTable = { rule, games, samples, w };
const out = new URL(`../_lib/engine/data/patterns-${rule}.json`, import.meta.url);
mkdirSync(new URL("../_lib/engine/data/", import.meta.url), { recursive: true });
writeFileSync(out, JSON.stringify(table));
console.log(`Xong: ${games} ván (bỏ ${skipped}), ${samples} nước của bên thắng, ${w.length} mã hình -> ${out.pathname} (${Math.round(JSON.stringify(table).length / 1024)} KB), ${Math.round((Date.now() - t0) / 1000)}s`);
