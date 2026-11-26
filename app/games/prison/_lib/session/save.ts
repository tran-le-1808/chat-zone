/**
 * Lưu ván chơi đơn bằng IndexedDB: 1 ô tự động (nửa đêm trong game, khi tạm dừng / thoát) + 3 ô thủ công.
 * Có version + thời điểm; bản cũ hơn (cùng ván) không ghi đè bản mới hơn. Lỗi lưu trữ không làm hỏng game.
 */
import { WORLD_SCHEMA_VERSION, type WorldState } from "../engine/types";
import { migrateWorld } from "../engine/migrate";

const DB = "prison-break";
const STORE = "saves";
export type SlotId = "auto" | "slot1" | "slot2" | "slot3";
export const SLOTS: SlotId[] = ["auto", "slot1", "slot2", "slot3"];

export interface SaveMeta {
  slot: SlotId;
  savedAt: number;
  day: number;
  hour: number;
  difficulty: string;
  role: string;
  name: string;
}

interface SaveFile {
  version: 2;
  slot: SlotId;
  savedAt: number;
  world: WorldState;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/** Bản lưu hợp lệ; bản cấu trúc cũ được nâng cấp tại chỗ (migrateWorld) nếu được */
function valid(f: unknown): f is SaveFile {
  const s = f as SaveFile | null;
  if (!s || s.version !== 2 || !s.world) return false;
  if (s.world.schemaVersion !== WORLD_SCHEMA_VERSION) {
    const up = migrateWorld(s.world);
    if (!up) return false;
    s.world = up;
  }
  return !!s.world.players?.me;
}

function metaOf(f: SaveFile): SaveMeta {
  const t = Math.floor(f.world.totalGameMinutes);
  const me = f.world.players.me;
  return { slot: f.slot, savedAt: f.savedAt, day: Math.floor(t / 1440) + 1, hour: Math.floor((t % 1440) / 60), difficulty: f.world.difficulty, role: me.role, name: me.name };
}

export async function writeSave(slot: SlotId, world: WorldState): Promise<boolean> {
  if (world.outcome) return false;
  const prev = await tx<unknown>("readonly", (s) => s.get(slot));
  if (valid(prev) && prev.world.seed === world.seed && prev.world.tick > world.tick) return false;
  const file: SaveFile = { version: 2, slot, savedAt: Date.now(), world: JSON.parse(JSON.stringify(world)) as WorldState };
  return (await tx("readwrite", (s) => s.put(file, slot))) !== null;
}

export async function readSave(slot: SlotId): Promise<{ world: WorldState; meta: SaveMeta } | null> {
  const f = await tx<unknown>("readonly", (s) => s.get(slot));
  return valid(f) ? { world: f.world, meta: metaOf(f) } : null;
}

export async function listSaves(): Promise<SaveMeta[]> {
  const out: SaveMeta[] = [];
  for (const slot of SLOTS) {
    const f = await tx<unknown>("readonly", (s) => s.get(slot));
    if (valid(f)) out.push(metaOf(f));
  }
  return out;
}

export async function deleteSave(slot: SlotId): Promise<void> {
  await tx("readwrite", (s) => s.delete(slot));
}
