/**
 * ENGINE CỜ CARO: thắng ngay / chặn ngay → ép thắng bằng chuỗi "4" (VCF) → sách khai cuộc (đã học) →
 * tìm kiếm alpha-beta sâu dần theo thời gian (bảng nhớ thế cờ Zobrist), thứ tự nước = điểm thủ công + hình cờ học được.
 * Phòng thủ: nếu đối thủ đang có chuỗi ép thắng thì chỉ xét các nước phá được chuỗi đó.
 * Tôn trọng luật chặn (thắng / không thắng do checkWin quyết định).
 */
import { checkWin, idx, inside, other, type CaroGameState, type CaroRule, type Cell, type Stone } from "../rules";
import { cellScore } from "../bot";
import type { BookMove, Move } from "./book";
import type { PatternPrior } from "./patterns";

const WIN = 10_000_000;

export interface EngineOptions {
  /** Thời gian tối đa (ms) */
  timeMs: number;
  maxDepth?: number;
  /** Số nước xét ở gốc / ở các tầng trong */
  rootWidth?: number;
  width?: number;
  prior?: PatternPrior | null;
  /** Trọng số điểm hình cờ học được (so với điểm thủ công) */
  priorWeight?: number;
  /** Nước trong sách khai cuộc cho thế hiện tại */
  book?: BookMove[];
  /** Số ván tối thiểu & điểm tối thiểu để tin sách */
  bookMinGames?: number;
  bookMinScore?: number;
  vcfDepth?: number;
  now?: () => number;
}

export type MoveSource = "win" | "block" | "vcf" | "defend" | "book" | "search" | "only";

export interface EngineResult {
  move: Move;
  source: MoveSource;
  score: number;
  depth: number;
  nodes: number;
  ms: number;
}

class Timeout extends Error {}

/** Bảng số ngẫu nhiên cho băm Zobrist (tất định) */
function zobristTable(n: number): [Uint32Array, Uint32Array] {
  let s = 0x9e3779b9;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  const a = new Uint32Array(n * 3);
  const b = new Uint32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    a[i] = rnd();
    b[i] = rnd();
  }
  return [a, b];
}
const ZCACHE = new Map<number, [Uint32Array, Uint32Array]>();

interface TTEntry {
  depth: number;
  value: number;
  flag: 0 | 1 | 2; // 0 chính xác, 1 cận dưới, 2 cận trên
  best: number;
}

export class CaroEngine {
  readonly size: number;
  readonly rule: CaroRule;
  readonly board: Cell[];
  private stones: number[] = [];
  private stamp: Uint32Array;
  private stampId = 1;
  private z: [Uint32Array, Uint32Array];
  private h1 = 0;
  private h2 = 0;
  private tt = new Map<number, TTEntry>();
  private deadline = Infinity;
  private now: () => number;
  nodes = 0;
  private prior: PatternPrior | null;
  private priorWeight: number;

  constructor(g: CaroGameState, opts: Pick<EngineOptions, "prior" | "priorWeight" | "now"> = {}) {
    this.size = g.size;
    this.rule = g.rule;
    this.board = g.board.slice();
    this.stamp = new Uint32Array(g.size * g.size);
    if (!ZCACHE.has(g.size)) ZCACHE.set(g.size, zobristTable(g.size * g.size));
    this.z = ZCACHE.get(g.size)!;
    this.prior = opts.prior ?? null;
    this.priorWeight = opts.priorWeight ?? 900;
    this.now = opts.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    for (let i = 0; i < this.board.length; i++)
      if (this.board[i] !== 0) {
        this.stones.push(i);
        this.hashToggle(i, this.board[i] as Stone);
      }
  }

  private hashToggle(i: number, s: Stone) {
    this.h1 ^= this.z[0][i * 3 + s];
    this.h2 ^= this.z[1][i * 3 + s];
  }
  private key(me: Stone): number {
    return ((this.h1 >>> 1) ^ (me === 1 ? 0x55555555 : 0)) * 2097152 + (this.h2 & 0x1fffff);
  }

  private place(i: number, s: Stone) {
    this.board[i] = s;
    this.stones.push(i);
    this.hashToggle(i, s);
  }
  private undo(i: number) {
    const s = this.board[i] as Stone;
    this.board[i] = 0;
    this.stones.pop();
    this.hashToggle(i, s);
  }

  /** Ô trống trong phạm vi 2 ô quanh quân đã có */
  candidates(): number[] {
    const n = this.size;
    if (!this.stones.length) return [idx(n >> 1, n >> 1, n)];
    const id = ++this.stampId;
    const out: number[] = [];
    for (const s of this.stones) {
      const sx = s % n;
      const sy = (s / n) | 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = sx + dx;
          const y = sy + dy;
          if (!inside(x, y, n)) continue;
          const i = y * n + x;
          if (this.board[i] !== 0 || this.stamp[i] === id) continue;
          this.stamp[i] = id;
          out.push(i);
        }
    }
    return out;
  }

  winsAt(i: number, s: Stone): boolean {
    if (this.board[i] !== 0) return false;
    this.board[i] = s;
    const w = checkWin(this.board, i % this.size, (i / this.size) | 0, this.rule, this.size);
    this.board[i] = 0;
    return !!w;
  }

  winningSpots(s: Stone, cands = this.candidates()): number[] {
    return cands.filter((i) => this.winsAt(i, s));
  }

  private attack(i: number, s: Stone): number {
    return cellScore(this.board, this.size, i % this.size, (i / this.size) | 0, s);
  }

  /** Sắp xếp nước theo điểm công + thủ (+ hình cờ học được) */
  ordered(me: Stone, cands: number[]): { i: number; a: number; d: number; v: number }[] {
    const opp = other(me);
    const list = cands.map((i) => {
      const a = this.attack(i, me);
      const d = this.attack(i, opp);
      const p = this.prior ? this.prior.score(this.board, this.size, i % this.size, (i / this.size) | 0, me) * this.priorWeight : 0;
      return { i, a, d, v: a + d * 0.95 + p };
    });
    list.sort((x, y) => y.v - x.v);
    return list;
  }

  private tick() {
    this.nodes++;
    if ((this.nodes & 255) === 0 && this.now() > this.deadline) throw new Timeout();
  }

  /** Đánh giá tĩnh cho bên đến lượt `me` */
  private evaluate(me: Stone, cands: number[]): number {
    const opp = other(me);
    let m1 = 0, m2 = 0, m3 = 0, o1 = 0, o2 = 0, o3 = 0;
    for (const i of cands) {
      const a = this.attack(i, me);
      if (a > m1) [m1, m2, m3] = [a, m1, m2];
      else if (a > m2) [m2, m3] = [a, m2];
      else if (a > m3) m3 = a;
      const d = this.attack(i, opp);
      if (d > o1) [o1, o2, o3] = [d, o1, o2];
      else if (d > o2) [o2, o3] = [d, o2];
      else if (d > o3) o3 = d;
    }
    // bên đến lượt được đi trước nên thế công của mình có giá trị hơn
    return m1 * 1.2 + m2 * 0.5 + m3 * 0.2 - (o1 * 0.9 + o2 * 0.45 + o3 * 0.2);
  }

  private negamax(depth: number, alpha: number, beta: number, me: Stone, ply: number, width: number): number {
    this.tick();
    const opp = other(me);
    const cands = this.candidates();
    if (!cands.length) return 0;
    for (const i of cands) if (this.winsAt(i, me)) return WIN - ply;
    const threats = this.winningSpots(opp, cands);
    if (threats.length >= 2) return -(WIN - ply - 1);
    if (depth <= 0) return this.evaluate(me, cands);
    const key = this.key(me);
    const hit = this.tt.get(key);
    if (hit && hit.depth >= depth) {
      if (hit.flag === 0) return hit.value;
      if (hit.flag === 1 && hit.value >= beta) return hit.value;
      if (hit.flag === 2 && hit.value <= alpha) return hit.value;
    }
    let moves: number[];
    if (threats.length === 1) moves = threats;
    else {
      moves = this.ordered(me, cands).slice(0, width).map((m) => m.i);
      if (hit && moves.includes(hit.best)) moves = [hit.best, ...moves.filter((m) => m !== hit.best)];
    }
    const a0 = alpha;
    let best = -Infinity;
    let bestMove = moves[0];
    for (const m of moves) {
      this.place(m, me);
      let v: number;
      try {
        v = -this.negamax(depth - 1, -beta, -alpha, opp, ply + 1, width);
      } finally {
        this.undo(m);
      }
      if (v > best) {
        best = v;
        bestMove = m;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    this.tt.set(key, { depth, value: best, flag: best <= a0 ? 2 : best >= beta ? 1 : 0, best: bestMove });
    return best;
  }

  /** Chuỗi ép thắng bằng "4" liên tiếp cho `me` (đi trước). Trả về nước đầu tiên hoặc -1. */
  vcf(me: Stone, depth: number): number {
    this.tick();
    if (depth <= 0) return -1;
    const opp = other(me);
    const cands = this.candidates();
    for (const i of cands) if (this.winsAt(i, me)) return i;
    // đối thủ đang có nước thắng ngay thì mình phải chặn -> không còn là chuỗi ép
    if (cands.some((i) => this.winsAt(i, opp))) return -1;
    const fours = cands.filter((i) => this.attack(i, me) >= 6_000);
    for (const i of fours) {
      this.place(i, me);
      try {
        const spots = this.winningSpots(me);
        if (spots.length >= 2) return i;
        if (spots.length === 1) {
          const blk = spots[0];
          // đối thủ chặn; nếu nước chặn lại thắng cho đối thủ thì nhánh này hỏng
          if (!this.winsAt(blk, opp)) {
            this.place(blk, opp);
            try {
              if (this.vcf(me, depth - 1) >= 0) return i;
            } finally {
              this.undo(blk);
            }
          }
        }
      } finally {
        this.undo(i);
      }
    }
    return -1;
  }

  /** Tìm nước cho bên `me` (bên đến lượt) */
  bestMove(me: Stone, o: EngineOptions): EngineResult {
    const t0 = this.now();
    this.deadline = t0 + o.timeMs;
    this.nodes = 0;
    const opp = other(me);
    const n = this.size;
    const toMove = (i: number): Move => [i % n, (i / n) | 0];
    const done = (i: number, source: MoveSource, score = 0, depth = 0): EngineResult => ({ move: toMove(i), source, score, depth, nodes: this.nodes, ms: Math.round(this.now() - t0) });
    const cands = this.candidates();
    if (cands.length === 1) return done(cands[0], "only");
    const win = cands.find((i) => this.winsAt(i, me));
    if (win !== undefined) return done(win, "win", WIN);
    const threats = this.winningSpots(opp, cands);
    if (threats.length) {
      // chặn; nhiều chỗ thì chọn chỗ có thế công tốt nhất
      const b = threats.map((i) => ({ i, a: this.attack(i, me) })).sort((x, y) => y.a - x.a)[0];
      return done(b.i, "block");
    }
    try {
      const v = this.vcf(me, o.vcfDepth ?? 10);
      if (v >= 0) return done(v, "vcf", WIN);
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
    }
    // sách khai cuộc (đã học từ các ván trước)
    const bk = (o.book ?? [])
      .filter((b) => b.n >= (o.bookMinGames ?? 3) && b.score >= (o.bookMinScore ?? 0.55) && inside(b.x, b.y, n) && this.board[idx(b.x, b.y, n)] === 0)
      .sort((x, y) => y.score - x.score || y.n - x.n)[0];
    if (bk) return done(idx(bk.x, bk.y, n), "book", bk.score);

    let root = this.ordered(me, cands).slice(0, o.rootWidth ?? 14).map((m) => m.i);
    // nước sách bị thua nhiều -> bỏ khỏi danh sách nếu còn lựa chọn khác
    const bad = new Set((o.book ?? []).filter((b) => b.n >= 3 && b.score < 0.3).map((b) => idx(b.x, b.y, n)));
    if (root.filter((i) => !bad.has(i)).length >= 3) root = root.filter((i) => !bad.has(i));
    // đối thủ có chuỗi ép thắng: chỉ giữ các nước phá được chuỗi đó
    let defended = false;
    try {
      if (this.vcf(opp, 8) >= 0) {
        const safe = root.filter((i) => {
          this.place(i, me);
          try {
            return this.vcf(opp, 8) < 0;
          } finally {
            this.undo(i);
          }
        });
        if (safe.length) {
          root = safe;
          defended = true;
        }
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
    }
    let best = root[0];
    let bestScore = -Infinity;
    let reached = 0;

    const maxDepth = o.maxDepth ?? 10;
    const width = o.width ?? 9;
    for (let d = 1; d <= maxDepth; d++) {
      try {
        let alpha = -Infinity;
        let iterBest = root[0];
        let iterScore = -Infinity;
        for (const m of root) {
          this.place(m, me);
          let v: number;
          try {
            v = -this.negamax(d - 1, -Infinity, -alpha, opp, 1, width);
          } finally {
            this.undo(m);
          }
          if (v > iterScore) {
            iterScore = v;
            iterBest = m;
          }
          if (v > alpha) alpha = v;
        }
        best = iterBest;
        bestScore = iterScore;
        reached = d;
        // đưa nước tốt nhất lên đầu cho vòng sâu hơn
        root = [best, ...root.filter((i) => i !== best)];
        if (Math.abs(bestScore) >= WIN - 100) break;
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
    }
    return done(best, defended ? "defend" : "search", bestScore, reached);
  }
}

/** Tiện ích: nước của engine cho ván hiện tại */
export function engineMove(g: CaroGameState, o: EngineOptions): EngineResult | null {
  if (g.winner !== null || g.draw) return null;
  const e = new CaroEngine(g, { prior: o.prior, priorWeight: o.priorWeight, now: o.now });
  return e.bestMove(g.turn, o);
}
