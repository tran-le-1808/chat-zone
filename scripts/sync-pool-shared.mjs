/**
 * Đồng bộ code dùng chung của bida lỗ (vật lý, luật, giao thức) sang backend:
 *   chat-zone/app/games/pool/_lib/{physics,rules,protocol.ts} -> login-system/src/pool/shared/
 * Frontend là nguồn chính. Chạy: npm run pool:sync-shared
 * Test determinism (app/games/pool/_tests/online.test.ts) so sánh trực tiếp kết quả của 2 bản.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "app/games/pool/_lib");
const BE = join(root, "../login-system");
const DST = join(BE, "src/pool/shared");
const HEADER =
  "// ⚠️ BẢN SAO TỰ ĐỘNG — KHÔNG SỬA Ở ĐÂY. Nguồn: chat-zone/app/games/pool/_lib (npm run pool:sync-shared)\n/* eslint-disable */\n";

rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });
for (const dir of ["physics", "rules"]) cpSync(join(SRC, dir), join(DST, dir), { recursive: true });
cpSync(join(SRC, "protocol.ts"), join(DST, "protocol.ts"));

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
const files = walk(DST);
for (const f of files) writeFileSync(f, HEADER + readFileSync(f, "utf8"));
execSync(`npx prettier --write "src/pool/shared/**/*.ts"`, { cwd: BE, stdio: "ignore" });
console.log(`Đã đồng bộ ${files.length} tệp sang ${DST}`);
