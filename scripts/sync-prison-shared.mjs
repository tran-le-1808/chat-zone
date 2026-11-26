/**
 * Đồng bộ engine Prison Break dùng chung sang backend:
 *   chat-zone/app/games/prison/_lib/engine -> login-system/src/prison/shared
 * Frontend là nguồn chính (giống bida lỗ). Chạy: npm run prison:sync-shared
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "app/games/prison/_lib/engine");
const BE = join(root, "../login-system");
const DST = join(BE, "src/prison/shared");
const HEADER =
  "// ⚠️ BẢN SAO TỰ ĐỘNG — KHÔNG SỬA Ở ĐÂY. Nguồn: chat-zone/app/games/prison/_lib/engine (npm run prison:sync-shared)\n/* eslint-disable */\n";

rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });
cpSync(SRC, DST, { recursive: true });
const files = readdirSync(DST).filter((f) => f.endsWith(".ts"));
for (const f of files) writeFileSync(join(DST, f), HEADER + readFileSync(join(DST, f), "utf8"));
execSync(`npx prettier --write "src/prison/shared/**/*.ts"`, { cwd: BE, stdio: "ignore" });
console.log(`Đã đồng bộ ${files.length} tệp sang ${DST}`);
