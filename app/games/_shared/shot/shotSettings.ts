"use client";

import { useSyncExternalStore } from "react";

export interface ShotSettings {
  /** Tay thuận: thanh kéo cơ ở bên đối diện, bi cái nhỏ ở bên thuận tay */
  hand: "right" | "left";
  /** Độ nhạy kéo cơ (0.5–2×) */
  pullSensitivity: number;
  /** Độ nhạy ngắm (0.5–2×) */
  aimSensitivity: number;
  haptics: boolean;
  /** Tự đưa điểm chạm và góc cơ về mặc định sau mỗi cú đánh */
  resetAfterShot: boolean;
  /** Kéo cơ trực tiếp trên bàn (kéo đuôi cơ lùi ra sau) */
  pullOnTable: boolean;
}

export const DEFAULT_SHOT_SETTINGS: ShotSettings = {
  hand: "right",
  pullSensitivity: 1,
  aimSensitivity: 1,
  haptics: true,
  resetAfterShot: true,
  pullOnTable: false,
};

const KEY = "shot-settings";
let current = DEFAULT_SHOT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_SHOT_SETTINGS, ...(JSON.parse(raw) as Partial<ShotSettings>) };
  } catch {
    /* dữ liệu hỏng -> dùng mặc định */
  }
}

export function getShotSettings(): ShotSettings {
  load();
  return current;
}

export function setShotSettings(patch: Partial<ShotSettings>) {
  load();
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* chế độ riêng tư */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useShotSettings(): ShotSettings {
  return useSyncExternalStore(subscribe, getShotSettings, () => DEFAULT_SHOT_SETTINGS);
}
