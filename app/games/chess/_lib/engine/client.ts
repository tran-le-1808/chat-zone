"use client";

/** Gọi engine trong Web Worker (rơi về luồng chính nếu trình duyệt không hỗ trợ / worker lỗi) */
import type { ChessState } from "../rules";
import { engineMove, type EngineOptions, type EngineResult } from "./search";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: EngineResult | null) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: EngineResult | null }>) => {
      const done = pending.get(e.data.id);
      pending.delete(e.data.id);
      done?.(e.data.result ?? null);
    };
    worker.onerror = () => {
      for (const [, done] of pending) done(null);
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

export function botMove(state: ChessState, opts: EngineOptions): Promise<EngineResult | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(engineMove(state, opts));
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, (r) => resolve(r ?? engineMove(state, opts)));
    w.postMessage({ id, state, opts });
  });
}
