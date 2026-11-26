/**
 * ENGINE CỜ TƯỚNG: negamax alpha-beta + đào sâu dần theo thời gian, bảng băm (Zobrist), tìm yên tĩnh
 * (chỉ xét nước ăn quân ở lá), sắp xếp nước (nước băm, MVV-LVA, killer, history).
 * Ở gốc dùng luật thật (applyMove) để biết nước nào thắng ngay, hoà do lặp, hay thua vì chiếu dai.
 */
import {
  ADVISOR, applyMove, CANNON, ELEPHANT, HORSE, inCheck, KING, PAWN, pseudoMoves, ROOK,
  type Side, type XqMove, type XqState,
} from "../rules";

export type XqBotLevel = "easy" | "medium" | "hard" | "master";
export const XQ_BOT_LEVELS: Record<XqBotLevel, string> = { easy: "Dễ", medium: "Vừa", hard: "Khó", master: "Cao thủ" };
const LEVEL: Record<XqBotLevel, { timeMs: number; maxDepth: number; noise: number }> = {
  easy: { timeMs: 80, maxDepth: 1, noise: 120 },
  medium: { timeMs: 300, maxDepth: 3, noise: 25 },
  hard: { timeMs: 1000, maxDepth: 8, noise: 0 },
  master: { timeMs: 2600, maxDepth: 30, noise: 0 },
};

export interface EngineOptions {
  level: XqBotLevel;
  /** Ghi đè thời gian nghĩ (ms) */
  timeMs?: number;
}
export interface EngineResult {
  move: XqMove;
  score: number;
  depth: number;
  nodes: number;
}

const MATE = 100000;
const VAL = [0, 0, 200, 200, 400, 900, 450, 100];

// ------------------------------------------------------------- bảng điểm vị trí (nhìn từ phía Đỏ, y = 0 là bên địch)
const PST: number[][] = [[], [], [], [], [], [], [], []];
for (let i = 0; i < 90; i++) {
  const x = i % 9;
  const y = (i / 9) | 0;
  const center = 4 - Math.abs(x - 4);
  PST[KING][i] = y === 9 ? 0 : y === 8 ? -8 : -18;
  PST[ADVISOR][i] = x === 4 && y === 8 ? 8 : 0;
  PST[ELEPHANT][i] = x === 4 && y === 7 ? 10 : y === 5 ? -5 : 0;
  PST[HORSE][i] = center * 5 + (y <= 4 ? 18 : 0) + (y <= 2 && x >= 2 && x <= 6 ? 12 : 0) - (x === 0 || x === 8 ? 12 : 0) - (y === 9 ? 10 : 0);
  PST[ROOK][i] = (y <= 4 ? 12 : 0) + (x === 3 || x === 5 ? 6 : 0) + (y === 9 && (x === 0 || x === 8) ? -12 : 0);
  PST[CANNON][i] = (x === 4 ? 18 : 0) + (y >= 7 ? 4 : 0) + (y <= 2 && x === 4 ? 10 : 0) + center * 2;
  const crossed = y <= 4;
  PST[PAWN][i] = crossed ? 70 + center * 10 + (y <= 2 ? 25 : 0) + (y === 0 ? -40 : 0) : y === 5 ? 10 + center * 2 : 0;
}
const pst = (t: number, i: number, side: Side) => PST[t][side === 1 ? i : 89 - i];

function evaluate(b: readonly number[], side: Side): number {
  let s = 0;
  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (!p) continue;
    if (p > 0) s += VAL[p] + pst(p, i, 1);
    else s -= VAL[-p] + pst(-p, i, -1);
  }
  return side === 1 ? s : -s;
}

// ------------------------------------------------------------- Zobrist
let rnd = 0x9e3779b9;
const rand32 = () => {
  rnd ^= rnd << 13;
  rnd ^= rnd >>> 17;
  rnd ^= rnd << 5;
  return rnd >>> 0;
};
const Z = Array.from({ length: 90 }, () => Array.from({ length: 15 }, () => rand32()));
const Z_SIDE = rand32();
const zp = (p: number) => p + 7;
function hashOf(b: readonly number[], side: Side): number {
  let h = 0;
  for (let i = 0; i < 90; i++) if (b[i]) h ^= Z[i][zp(b[i])];
  return (side === -1 ? h ^ Z_SIDE : h) >>> 0;
}

interface TTEntry {
  depth: number;
  score: number;
  flag: 0 | 1 | 2; // 0 chính xác, 1 cận dưới, 2 cận trên
  move: number;
}

class Aborted extends Error {}

class Searcher {
  b: number[];
  nodes = 0;
  deadline: number;
  tt = new Map<number, TTEntry>();
  killers: number[][] = Array.from({ length: 64 }, () => [0, 0]);
  hist = new Int32Array(256 * 90);

  constructor(board: readonly number[], deadline: number) {
    this.b = board.slice();
    this.deadline = deadline;
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new Aborted();
  }

  order(moves: number[], ttMove: number, ply: number) {
    const b = this.b;
    const k = this.killers[ply] ?? [0, 0];
    const score = (m: number) => {
      if (m === ttMove) return 1e9;
      const cap = b[m & 255];
      if (cap) return 1e8 + VAL[Math.abs(cap)] * 16 - VAL[Math.abs(b[m >> 8])];
      if (m === k[0]) return 9e7;
      if (m === k[1]) return 8e7;
      return this.hist[m] ?? 0;
    };
    const sc = moves.map(score);
    const idxs = moves.map((_, i) => i).sort((a, c) => sc[c] - sc[a]);
    return idxs.map((i) => moves[i]);
  }

  quiesce(alpha: number, beta: number, side: Side, qd: number): number {
    this.tick();
    const stand = evaluate(this.b, side);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6) return stand;
    const b = this.b;
    const caps = pseudoMoves(b, side).filter((m) => b[m & 255] !== 0);
    for (const m of this.order(caps, 0, 63)) {
      const f = m >> 8;
      const t = m & 255;
      const cap = b[t];
      if (Math.abs(cap) === KING) return MATE; // bắt được tướng: thế trước đó là nước không hợp lệ của đối phương
      b[t] = b[f];
      b[f] = 0;
      if (inCheck(b, side)) {
        b[f] = b[t];
        b[t] = cap;
        continue;
      }
      const v = -this.quiesce(-beta, -alpha, (-side) as Side, qd + 1);
      b[f] = b[t];
      b[t] = cap;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  negamax(depth: number, alpha: number, beta: number, side: Side, ply: number, hash: number): number {
    this.tick();
    const b = this.b;
    const checked = inCheck(b, side);
    if (checked) depth += 1; // bị chiếu: xét sâu thêm
    if (depth <= 0) return this.quiesce(alpha, beta, side, 0);
    const alpha0 = alpha;
    const e = this.tt.get(hash);
    let ttMove = 0;
    if (e) {
      ttMove = e.move;
      if (e.depth >= depth && ply > 0) {
        if (e.flag === 0) return e.score;
        if (e.flag === 1 && e.score >= beta) return e.score;
        if (e.flag === 2 && e.score <= alpha) return e.score;
      }
    }
    let best = -MATE - 1;
    let bestMove = 0;
    let legal = 0;
    for (const m of this.order(pseudoMoves(b, side), ttMove, ply)) {
      const f = m >> 8;
      const t = m & 255;
      const p = b[f];
      const cap = b[t];
      b[t] = p;
      b[f] = 0;
      if (inCheck(b, side)) {
        b[f] = p;
        b[t] = cap;
        continue;
      }
      legal++;
      let h = hash ^ Z[f][zp(p)] ^ Z[t][zp(p)] ^ Z_SIDE;
      if (cap) h ^= Z[t][zp(cap)];
      const v = -this.negamax(depth - 1, -beta, -alpha, (-side) as Side, ply + 1, h >>> 0);
      b[f] = p;
      b[t] = cap;
      if (v > best) {
        best = v;
        bestMove = m;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (!cap) {
          const k = this.killers[ply];
          if (k && k[0] !== m) {
            k[1] = k[0];
            k[0] = m;
          }
          this.hist[m] += depth * depth;
        }
        break;
      }
    }
    // không còn nước hợp lệ: thua (chiếu bí hoặc hết nước đều thua trong cờ tướng)
    if (legal === 0) return -MATE + ply;
    if (this.tt.size > 400000) this.tt.clear();
    this.tt.set(hash, { depth, score: best, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0, move: bestMove });
    return best;
  }
}

/** Chọn nước cho bot ở thế hiện tại (null nếu không còn nước) */
export function engineMove(state: XqState, opts: EngineOptions): EngineResult | null {
  if (state.winner !== null || state.draw) return null;
  const lv = LEVEL[opts.level];
  const side = state.turn;
  const start = Date.now();

  // Gốc: dùng luật thật để phân loại từng nước
  type Root = { m: number; fixed: number | null };
  const roots: Root[] = [];
  for (const m of pseudoMoves(state.board, side)) {
    const r = applyMove(state, m >> 8, m & 255);
    if (!r.ok) continue;
    const s = r.state;
    if (s.winner === side) return { move: [m >> 8, m & 255], score: MATE, depth: 1, nodes: 0 };
    if (s.winner !== null) roots.push({ m, fixed: -MATE + 1 }); // thua vì chiếu dai
    else if (s.draw) roots.push({ m, fixed: 0 });
    else roots.push({ m, fixed: null });
  }
  if (!roots.length) return null;
  if (roots.length === 1) return { move: [roots[0].m >> 8, roots[0].m & 255], score: 0, depth: 0, nodes: 0 };

  // Dễ: thỉnh thoảng đi một nước bất kỳ (không tự sát ngay)
  if (opts.level === "easy" && Math.random() < 0.35) {
    const pool = roots.filter((r) => r.fixed === null || r.fixed >= 0);
    const pick = (pool.length ? pool : roots)[Math.floor(Math.random() * (pool.length || roots.length))];
    return { move: [pick.m >> 8, pick.m & 255], score: 0, depth: 0, nodes: 0 };
  }

  const timeMs = opts.timeMs ?? lv.timeMs;
  const s = new Searcher(state.board, start + timeMs);
  const b = s.b;
  const h0 = hashOf(b, side);
  let bestMove = roots[0].m;
  let bestScore = -MATE - 1;
  let doneDepth = 0;
  let order = roots.slice();
  // lặp sâu dần
  for (let depth = 1; depth <= lv.maxDepth; depth++) {
    const scores = new Map<number, number>();
    let alpha = -MATE - 1;
    let curBest = order[0].m;
    let curScore = -MATE - 1;
    try {
      for (const r of order) {
        let v: number;
        if (r.fixed !== null) v = r.fixed;
        else {
          const f = r.m >> 8;
          const t = r.m & 255;
          const p = b[f];
          const cap = b[t];
          b[t] = p;
          b[f] = 0;
          let h = h0 ^ Z[f][zp(p)] ^ Z[t][zp(p)] ^ Z_SIDE;
          if (cap) h ^= Z[t][zp(cap)];
          try {
            v = -s.negamax(depth - 1, -MATE - 1, -alpha, (-side) as Side, 1, h >>> 0);
          } finally {
            b[f] = p;
            b[t] = cap;
          }
        }
        if (lv.noise) v += Math.round((Math.random() * 2 - 1) * lv.noise);
        scores.set(r.m, v);
        if (v > curScore) {
          curScore = v;
          curBest = r.m;
        }
        if (v > alpha) alpha = v;
      }
    } catch (e) {
      if (e instanceof Aborted) break;
      throw e;
    }
    bestMove = curBest;
    bestScore = curScore;
    doneDepth = depth;
    if (Math.abs(bestScore) > MATE - 100) break; // đã thấy chiếu bí
    order = order.slice().sort((a, c) => (scores.get(c.m) ?? 0) - (scores.get(a.m) ?? 0));
    if (Date.now() - start > timeMs * 0.55) break; // không đủ thời gian cho tầng sau
  }
  return { move: [bestMove >> 8, bestMove & 255], score: bestScore, depth: doneDepth, nodes: s.nodes };
}
