import { POOL_PHYSICS as C } from "./physics/config";
import { POOL_TABLE as T, type Pocket, type TableGeometry } from "./physics/table";
import type { BallSpot } from "./physics/types";
import type { CallShot } from "./rules/types";

const R = C.ballRadius;

export interface AimCast {
  /** Tâm bi cái lúc chạm (bi ma) hoặc lúc chạm băng */
  end: { x: number; y: number };
  hitBall: number | null;
  /** Hướng bi mục tiêu đi (đường nối tâm) & hướng bi cái sau va chạm (tiếp tuyến, cú stun) */
  objectDir: { x: number; y: number } | null;
  cueDir: { x: number; y: number } | null;
  /** Góc cắt (độ) */
  cut: number;
}

/** Khoảng cách từ p theo hướng d tới mặt băng (bảng chữ nhật thu vào R) */
export function rayToRail(px: number, py: number, dx: number, dy: number, margin = R): number {
  const hx = T.L / 2 - margin;
  const hy = T.W / 2 - margin;
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (hx - px) / dx);
  if (dx < -1e-9) t = Math.min(t, (-hx - px) / dx);
  if (dy > 1e-9) t = Math.min(t, (hy - py) / dy);
  if (dy < -1e-9) t = Math.min(t, (-hy - py) / dy);
  return Math.max(0, t);
}

/**
 * Đường ngắm thẳng (bỏ qua xoáy / squirt): bi cái đi theo hướng cơ tới bi đầu tiên hoặc băng.
 * Dùng cho bi ma, đường bi mục tiêu và quy tắc tiếp tuyến 90°.
 */
export function castAim(balls: BallSpot[], dirX: number, dirY: number): AimCast | null {
  const cue = balls.find((b) => b.n === 0);
  if (!cue) return null;
  const l = Math.hypot(dirX, dirY) || 1;
  const dx = dirX / l;
  const dy = dirY / l;
  let best = rayToRail(cue.x, cue.y, dx, dy);
  let hit: BallSpot | null = null;
  for (const b of balls) {
    if (b.n === 0) continue;
    const ox = b.x - cue.x;
    const oy = b.y - cue.y;
    const proj = ox * dx + oy * dy;
    if (proj <= 0) continue;
    const perp2 = ox * ox + oy * oy - proj * proj;
    const r2 = 4 * R * R;
    if (perp2 >= r2) continue;
    const t = proj - Math.sqrt(r2 - perp2);
    if (t >= 0 && t < best) {
      best = t;
      hit = b;
    }
  }
  const end = { x: cue.x + dx * best, y: cue.y + dy * best };
  if (!hit) return { end, hitBall: null, objectDir: null, cueDir: null, cut: 0 };
  const nx = (hit.x - end.x) / (2 * R);
  const ny = (hit.y - end.y) / (2 * R);
  const dot = dx * nx + dy * ny;
  const tx = dx - dot * nx;
  const ty = dy - dot * ny;
  const tl = Math.hypot(tx, ty);
  return {
    end,
    hitBall: hit.n,
    objectDir: { x: nx, y: ny },
    cueDir: tl > 1e-6 ? { x: tx / tl, y: ty / tl } : null,
    cut: (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI,
  };
}

/** Điểm nhắm vào lỗ (hơi vào trong miệng lỗ) */
export function pocketAimPoint(p: Pocket) {
  const k = p.kind === "corner" ? 0.012 : 0.006;
  return { x: p.mouthX + p.axisX * k, y: p.mouthY + p.axisY * k };
}

/** Bi có thể đi vào lỗ theo hướng này không (góc tới so với trục lỗ) */
export function pocketApproachOk(p: Pocket, dirX: number, dirY: number): boolean {
  const cos = dirX * p.axisX + dirY * p.axisY;
  return cos > (p.kind === "corner" ? 0.55 : 0.62);
}

/** Lỗ khớp nhất với hướng bi mục tiêu đang đi (góc lệch nhỏ nhất) */
export function bestPocketFor(
  ball: BallSpot,
  dir: { x: number; y: number },
  table: TableGeometry = T,
): { pocket: number; error: number } {
  let pocket = 0;
  let error = Infinity;
  for (const p of table.pockets) {
    const a = pocketAimPoint(p);
    const vx = a.x - ball.x;
    const vy = a.y - ball.y;
    const l = Math.hypot(vx, vy);
    const ang = Math.acos(Math.max(-1, Math.min(1, (vx * dir.x + vy * dir.y) / l)));
    if (ang < error) {
      error = ang;
      pocket = p.id;
    }
  }
  return { pocket, error: (error * 180) / Math.PI };
}

/**
 * Tự gọi "cú hiển nhiên" (8 bi): bi mục tiêu theo đường ngắm + lỗ mà bi đang hướng tới.
 * Chỉ là gợi ý mặc định — người chơi có thể đổi.
 */
export function autoCall(
  balls: BallSpot[],
  dirX: number,
  dirY: number,
  legal: number[],
  table: TableGeometry = T,
): CallShot | null {
  const cast = castAim(balls, dirX, dirY);
  if (!cast || cast.hitBall === null || !cast.objectDir || !legal.includes(cast.hitBall)) return null;
  const ball = balls.find((b) => b.n === cast.hitBall)!;
  return { ball: ball.n, pocket: bestPocketFor(ball, cast.objectDir, table).pocket };
}

/** Khoảng cách từ điểm tới đoạn thẳng */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Đường từ A tới B có bi nào chắn không (bỏ qua các bi trong `ignore`) */
export function pathClear(
  balls: BallSpot[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ignore: number[],
  clearance = 2 * R,
) {
  for (const b of balls) {
    if (ignore.includes(b.n)) continue;
    if (distToSegment(b.x, b.y, ax, ay, bx, by) < clearance - 1e-6) return false;
  }
  return true;
}

export interface TargetPath {
  /** Điểm cuối của đường đi: tâm miệng lỗ (nếu vào được) hoặc chỗ chạm bi khác / băng đầu tiên */
  end: { x: number; y: number };
  /** Bi chắn đường (null nếu không có) */
  blocker: number | null;
  /** Lỗ mà bi mục tiêu đi vào được theo hướng này (null nếu không) */
  pocket: number | null;
}

/**
 * Đường đi dự kiến của BI MỤC TIÊU sau va chạm (chỉ là dự đoán, không can thiệp vật lý):
 * đi thẳng theo `dir` tới bi khác / băng đầu tiên; nếu đường đi lọt qua miệng lỗ (đủ rộng cho bi,
 * góc vào hợp lý) thì báo lỗ đó = khả năng vào lỗ.
 */
export function targetPath(
  balls: BallSpot[],
  target: BallSpot,
  dir: { x: number; y: number },
  table: TableGeometry = T,
): TargetPath {
  const l = Math.hypot(dir.x, dir.y) || 1;
  const dx = dir.x / l;
  const dy = dir.y / l;
  // Bi chắn: tâm bi khác cách đường đi < 2R
  let tBlock = Infinity;
  let blocker: number | null = null;
  for (const b of balls) {
    if (b.n === target.n || b.n === 0) continue;
    const ox = b.x - target.x;
    const oy = b.y - target.y;
    const proj = ox * dx + oy * dy;
    if (proj <= 0) continue;
    const perp2 = ox * ox + oy * oy - proj * proj;
    if (perp2 >= 4 * R * R) continue;
    const t = proj - Math.sqrt(4 * R * R - perp2);
    if (t > 0 && t < tBlock) {
      tBlock = t;
      blocker = b.n;
    }
  }
  const tRail = rayToRail(target.x, target.y, dx, dy);
  // Lỗ: đường đi lọt qua miệng lỗ
  let pocket: number | null = null;
  let tPocket = Infinity;
  for (const p of table.pockets) {
    if (!pocketApproachOk(p, dx, dy)) continue;
    const a = pocketAimPoint(p);
    const vx = a.x - target.x;
    const vy = a.y - target.y;
    const tp = vx * dx + vy * dy;
    if (tp <= 0) continue;
    const lateral = Math.abs(vx * dy - vy * dx);
    // Tâm bi phải lọt qua miệng lỗ với dư ~0.8R mỗi bên (mũi lỗ bo tròn)
    if (lateral > p.mouth / 2 - 0.8 * R) continue;
    if (tp > tBlock) continue; // bị bi khác chắn trước khi tới lỗ
    if (tp < tPocket) {
      tPocket = tp;
      pocket = p.id;
    }
  }
  if (pocket !== null) {
    const p = table.pockets[pocket];
    return { end: pocketAimPoint(p), blocker: null, pocket };
  }
  const t = Math.min(tBlock, tRail);
  return { end: { x: target.x + dx * t, y: target.y + dy * t }, blocker: tBlock < tRail ? blocker : null, pocket: null };
}
