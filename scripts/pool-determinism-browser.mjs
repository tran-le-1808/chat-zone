/**
 * 3.10.1 — So hash trạng thái giữa Node (giống server) và trình duyệt thật.
 * Cần dev server đang chạy (npm run dev) và Chrome/Chromium.
 *   node scripts/pool-determinism-browser.mjs [N] [BROWSER_PATH]
 * Firefox / Safari: chạy cùng trang /games/pool/determinism?n=N rồi dán JSON vào so sánh (hoặc Playwright).
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const N = Number(process.argv[2] ?? 300);
const BROWSER = process.argv[3] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE ?? "http://localhost:3000";
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER ?? "puppeteer-core");

const nodeOut = JSON.parse(
  execFileSync(
    process.execPath,
    ["--import", "./app/games/pool/_tests/register.mjs", "-e",
      `import("./app/games/pool/_lib/tools/determinism.ts").then(m => console.log(JSON.stringify(m.determinismHashes(${N}))))`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim().split("\n").pop(),
);
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: "new" });
const page = await browser.newPage();
if (process.env.TOKEN) await page.setCookie({ name: "token", value: process.env.TOKEN, url: BASE });
await page.goto(`${BASE}/games/pool/determinism?n=${N}`, { waitUntil: "networkidle2", timeout: 180000 });
await page.waitForFunction(() => document.querySelector("#out")?.textContent?.startsWith("{"), { timeout: 600000 });
const res = JSON.parse(await page.$eval("#out", (e) => e.textContent));
await browser.close();
const diff = res.hashes.filter((h, i) => h !== nodeOut[i]).length;
console.log(`${res.ua}\n${N} cú: lệch ${diff}, trình duyệt mất ${res.ms} ms`);
process.exit(diff ? 1 : 0);
