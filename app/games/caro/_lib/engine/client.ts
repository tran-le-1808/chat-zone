"use client";

/**
 * Bot "Cao thủ" phía trình duyệt: tra sách khai cuộc trên server (học từ các ván đã chơi) → engine
 * (VCF + alpha-beta) chạy trong Web Worker. Gửi ván đã chơi lên server để bot học.
 */
import API from "@/lib/api";
import type { CaroGameState, CaroRule } from "../rules";
import type { BookMove } from "./book";
import { engineMove, type EngineResult } from "./search";

export const MASTER_TIME_MS = 1200;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: EngineResult | null) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: EngineResult | null; error?: string }>) => {
      const done = pending.get(e.data.id);
      pending.delete(e.data.id);
      done?.(e.data.result ?? null);
    };
    worker.onerror = () => {
      // worker hỏng: các yêu cầu đang chờ chạy lại trên luồng chính
      for (const [, done] of pending) done(null);
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

/** Sách khai cuộc cho thế hiện tại (rỗng nếu không kết nối được server) */
export async function fetchBook(rule: CaroRule, moves: [number, number][]): Promise<BookMove[]> {
  if (moves.length >= 16) return [];
  try {
    const r = await API.post<{ moves: BookMove[] }>("/caro/book/query", { rule, moves }, { timeout: 1500 });
    return r.data.moves ?? [];
  } catch {
    return [];
  }
}

function runEngine(state: CaroGameState, book: BookMove[]): Promise<EngineResult | null> {
  const opts = { timeMs: MASTER_TIME_MS, book };
  const w = getWorker();
  if (!w) return Promise.resolve(engineMove(state, opts));
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, (r) => resolve(r ?? engineMove(state, opts)));
    w.postMessage({ id, state, opts });
  });
}

export async function masterMove(state: CaroGameState): Promise<EngineResult | null> {
  const book = await fetchBook(state.rule, state.moves);
  return runEngine(state, book);
}

/** Gửi ván vừa chơi lên server để bot học (bỏ qua nếu lỗi / chưa đăng nhập) */
export function submitGame(rule: CaroRule, moves: [number, number][]): void {
  if (moves.length < 7) return;
  void API.post("/caro/learn", { rule, moves }).catch(() => {});
}
