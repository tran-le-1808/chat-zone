/// <reference lib="webworker" />
/** Chạy engine trong Web Worker để giao diện không bị đứng khi bot nghĩ */
import { engineMove, type EngineOptions } from "./search";
import type { CaroGameState } from "../rules";

self.onmessage = (e: MessageEvent<{ id: number; state: CaroGameState; opts: EngineOptions }>) => {
  const { id, state, opts } = e.data;
  try {
    const r = engineMove(state, opts);
    (self as unknown as Worker).postMessage({ id, result: r });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
