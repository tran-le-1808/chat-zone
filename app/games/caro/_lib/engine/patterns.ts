/**
 * HÌNH CỜ HỌC ĐƯỢC: với một ô trống, mỗi hướng lấy 4 ô mỗi phía (8 ô) mã hoá theo góc nhìn bên đến lượt
 * (0 trống, 1 quân mình, 2 quân đối thủ, 3 ngoài bàn) -> số 0..65535; lật đối xứng cho cùng một mã.
 * Bảng học (từ ván của các bot mạnh) cho mỗi mã: log-odds "bên thắng chọn ô có hình này" so với trung bình.
 */
import { DIRS, idx, inside, type Cell, type Stone } from "../rules";

export const HALF = 4;

/** Bảng hình đã học: mã -> log-odds (đã làm tròn) */
export interface PatternTable {
  rule: string;
  /** Số ván / nước dùng để học (thông tin) */
  games: number;
  samples: number;
  /** [mã, log-odds] — chỉ giữ mã gặp đủ nhiều */
  w: [number, number][];
}

/** Mã một hướng quanh ô (x, y) theo góc nhìn quân `me` */
export function lineKey(board: readonly Cell[], size: number, x: number, y: number, dx: number, dy: number, me: Stone): number {
  let a = 0;
  let b = 0;
  // a: đọc từ -4 -> +4; b: đọc ngược (+4 -> -4) để chuẩn hoá đối xứng
  for (let k = -HALF; k <= HALF; k++) {
    if (k === 0) continue;
    const cx = x + dx * k;
    const cy = y + dy * k;
    const v = !inside(cx, cy, size) ? 3 : board[idx(cx, cy, size)] === 0 ? 0 : board[idx(cx, cy, size)] === me ? 1 : 2;
    a = a * 4 + v;
  }
  for (let k = HALF; k >= -HALF; k--) {
    if (k === 0) continue;
    const cx = x + dx * k;
    const cy = y + dy * k;
    const v = !inside(cx, cy, size) ? 3 : board[idx(cx, cy, size)] === 0 ? 0 : board[idx(cx, cy, size)] === me ? 1 : 2;
    b = b * 4 + v;
  }
  return Math.min(a, b);
}

/** 4 mã của ô (mỗi hướng một mã) */
export function cellKeys(board: readonly Cell[], size: number, x: number, y: number, me: Stone): number[] {
  return DIRS.map(([dx, dy]) => lineKey(board, size, x, y, dx, dy, me));
}

export class PatternPrior {
  private map = new Map<number, number>();
  constructor(table: PatternTable | null) {
    if (table) for (const [k, v] of table.w) this.map.set(k, v);
  }
  get size(): number {
    return this.map.size;
  }
  /** Điểm học được của ô: tổng log-odds 4 hướng (0 nếu chưa gặp) */
  score(board: readonly Cell[], size: number, x: number, y: number, me: Stone): number {
    let s = 0;
    for (const k of cellKeys(board, size, x, y, me)) s += this.map.get(k) ?? 0;
    return s;
  }
}
