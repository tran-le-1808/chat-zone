/**
 * Cho phép `node --test` chạy trực tiếp file .ts của Next (import không có đuôi):
 * thử thêm ".ts" hoặc "/index.ts" khi Node không tìm thấy module tương đối.
 * Node ≥ 23.6 tự bỏ kiểu TypeScript (type stripping).
 */
import { registerHooks } from "node:module";

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
});
