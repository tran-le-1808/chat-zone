import { applyAction, createOutbox, createWorld, playerSolid, PRISON_MAP, runTick, type ItemId, type MoveInput, type PlayerAction, type PlayerPassFlags, type Role, type WorldState } from "../_lib/engine";

export const out = () => createOutbox();

export function makeWorld(n: number, mode: "single" | "multi" = n > 1 ? "multi" : "single", seed = 42): WorldState {
  const roles: Role[] = ["HACKER", "FIGHTER", "MECHANIC", "SCOUT"];
  return createWorld({
    seed,
    difficulty: "NORMAL",
    mode,
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, role: roles[i % 4] })),
  });
}

export function ticks(world: WorldState, count: number, inputs?: Map<string, MoveInput[]>) {
  const o = out();
  for (let i = 0; i < count; i++) runTick(world, o, i === 0 && inputs ? inputs : new Map());
  return o;
}

export function seconds(world: WorldState, s: number) {
  return ticks(world, Math.round(s * 20));
}

let req = 0;
export function act(world: WorldState, pid: string, a: PlayerAction, requestId = `r${++req}`) {
  return applyAction(world, out(), pid, a, requestId);
}

export function place(world: WorldState, pid: string, x: number, y: number) {
  world.players[pid].x = x;
  world.players[pid].y = y;
}

/** Tắt lính gác để test luật không bị nhiễu */
export function noGuards(world: WorldState) {
  world.guards = [];
}

/** Lấy `qty` món `itemId` từ tủ (tìm đúng ô như modal lưới ô sẽ gửi) */
export function takeFrom(world: WorldState, pid: string, containerId: string, itemId: ItemId, qty = 1) {
  const index = world.containers[containerId].items.findIndex((i) => i.itemId === itemId);
  return act(world, pid, { type: "containerTake", containerId, index, itemId, quantity: qty });
}

/** Cất `qty` món `itemId` từ túi vào tủ */
export function putInto(world: WorldState, pid: string, containerId: string, itemId: ItemId, qty = 1) {
  const index = world.players[pid].inventory.findIndex((i) => i.itemId === itemId);
  return act(world, pid, { type: "containerPut", containerId, index, itemId, quantity: qty });
}

// ------------------------------------------------------------------ bản đồ Đá Xám: vị trí hay dùng trong test

/** Ô đứng được ở các khu (tâm ô) — đặt tên theo nghĩa để test không phụ thuộc toạ độ cứng */
export const SPOT = {
  /** tâm xà lim của người chơi thứ i (cellIndex 0..3 = A-3, A-2, A-4, A-5) */
  cell: (i: number) => ({ x: PRISON_MAP.cells[i].x, y: PRISON_MAP.cells[i].y }),
  /** hành lang trung tâm (y = 22.5) */
  hall: (x = 10.5) => ({ x, y: 22.5 }),
  yard: { x: 30.5, y: 8.5 },
  /** trong văn phòng cai ngục (khu cấm) */
  office: { x: 7.5, y: 26.5 },
  officeGuard: { x: 4.5, y: 26.5 },
  stash: { x: 24.5, y: 33.5 },
  shop: { x: 20.5, y: 14.5 },
  workshop: { x: 34.5, y: 16.5 },
  laundry: { x: 6.5, y: 15.5 },
  canteen: { x: 22.5, y: 16.5 },
  library: { x: 51.5, y: 27.5 },
  gym: { x: 38.5, y: 28.5 },
  shower: { x: 27.5, y: 27.5 },
  blockA: { x: 13.5, y: 34.5 },
  /** trước cửa biệt giam i */
  solitaryDoor: (i: number) => ({ x: [52.5, 56.5][i], y: 35.3 }),
} as const;

export function placeAt(world: WorldState, pid: string, s: { x: number; y: number }, dx = 0, dy = 0) {
  place(world, pid, s.x + dx, s.y + dy);
}

/** Cai ngục đầu tiên đi tuyến `routeId` (tuyến ca ngày: cells, work, yard) */
export function guardOn(world: WorldState, routeId: string) {
  const g = world.guards.find((x) => x.routeId === routeId);
  if (!g) throw new Error(`không có cai ngục tuyến ${routeId}`);
  return g;
}

/** Cờ va chạm dựng tay cho test */
export function flags(o: Partial<PlayerPassFlags> = {}): PlayerPassFlags {
  return { ventOpen: false, outsideOpen: false, openDoors: "", fenceGaps: [], doorsLocked: false, doorPass: false, ...o };
}

/** Ô sàn trống sát vật tương tác (trong tầm với) */
export function standNear(id: string): { x: number; y: number } {
  const it = PRISON_MAP.interactableById[id];
  if (!it) throw new Error(`không có ${id}`);
  const solid = playerSolid(flags({ openDoors: "LKc" }));
  for (const t of it.tiles)
    for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]])
      if (!solid(t.x + ox, t.y + oy)) return { x: t.x + ox + 0.5, y: t.y + oy + 0.5 };
  throw new Error(`không có chỗ đứng cạnh ${id}`);
}
