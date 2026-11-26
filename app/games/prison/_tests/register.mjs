/**
 * Cho `node --test` chạy trực tiếp engine TypeScript của Prison Break:
 * - import tương đối không đuôi -> thử ".ts" / "/index.ts"
 * - import "*.json" (dữ liệu game, bản đồ Tiled) không cần import attribute
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (!specifier.startsWith(".")) throw err;
      for (const suffix of [".ts", "/index.ts"]) {
        try {
          return next(specifier + suffix, context);
        } catch {}
      }
      throw err;
    }
  },
  load(url, context, next) {
    if (url.endsWith(".json")) {
      const text = readFileSync(fileURLToPath(url), "utf8");
      return { format: "module", source: `export default ${text};`, shortCircuit: true };
    }
    return next(url, context);
  },
});
