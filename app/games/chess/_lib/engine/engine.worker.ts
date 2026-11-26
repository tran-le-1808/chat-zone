/// <reference lib="webworker" />
/** Chạy engine trong Web Worker để giao diện không bị đứng khi bot nghĩ */
import { engineMove, type EngineOptions } from "./search";
import type { ChessState } from "../rules";

self.onmessage = (e: MessageEvent<{ id: number; state: ChessState; opts: EngineOptions }>) => {
  const { id, state, opts } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, result: engineMove(state, opts) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
