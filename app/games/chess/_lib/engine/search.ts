/**
 * ENGINE CỜ VUA: negamax alpha-beta + đào sâu dần theo thời gian, bảng băm Zobrist, tìm yên tĩnh
 * (ăn quân + phong cấp), mở rộng khi bị chiếu, sắp xếp nước (băm, MVV-LVA, killer, history).
 * Gốc dùng luật thật (applyMove) để nhận ra chiếu hết ngay / nước dẫn tới hoà.
 */
import {
  applyMove, BISHOP, enc, inCheck, KING, KNIGHT, makeMove, mFrom, mPromo, mTo, PAWN, pseudoMoves, QUEEN, ROOK,
  type ChessMove, type ChessState, type Pos, type Side,
} from "../rules";

export type ChessBotLevel = "easy" | "medium" | "hard" | "master";
export const CHESS_BOT_LEVELS: Record<ChessBotLevel, string> = { easy: "Dễ", medium: "Vừa", hard: "Khó", master: "Cao thủ" };
const LEVEL: Record<ChessBotLevel, { timeMs: number; maxDepth: number; noise: number }> = {
  easy: { timeMs: 80, maxDepth: 1, noise: 90 },
  medium: { timeMs: 300, maxDepth: 3, noise: 20 },
  hard: { timeMs: 1000, maxDepth: 10, noise: 0 },
  master: { timeMs: 2600, maxDepth: 30, noise: 0 },
};

export interface EngineOptions {
  level: ChessBotLevel;
  timeMs?: number;
}
export interface EngineResult {
  move: ChessMove;
  score: number;
  depth: number;
  nodes: number;
}

const MATE = 100000;
const VAL = [0, 20000, 900, 500, 330, 320, 100];

// Bảng điểm vị trí (nhìn từ phía Trắng, chỉ số 0 = a8)
const T = {
  [PAWN]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [KNIGHT]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [BISHOP]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [ROOK]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [QUEEN]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [KING]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
} as Record<number, number[]>;
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

function evaluate(b: readonly number[], side: Side): number {
  // tàn cuộc: không còn hậu hoặc ít quân nhẹ -> vua ra giữa bàn
  let minor = 0;
  let queens = 0;
  for (const v of b) {
    const t = Math.abs(v);
    if (t === QUEEN) queens++;
    else if (t === ROOK) minor += 2;
    else if (t === BISHOP || t === KNIGHT) minor++;
  }
  const endgame = queens === 0 || (queens <= 2 && minor <= 2);
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (!v) continue;
    const t = Math.abs(v);
    const idx = v > 0 ? i : i ^ 56;
    const ps = t === KING && endgame ? KING_END[idx] : T[t][idx];
    s += v > 0 ? VAL[t] + ps : -(VAL[t] + ps);
  }
  return side === 1 ? s : -s;
}

// Zobrist
let rnd = 0x2545f491;
const rand32 = () => {
  rnd ^= rnd << 13;
  rnd ^= rnd >>> 17;
  rnd ^= rnd << 5;
  return rnd >>> 0;
};
const Z = Array.from({ length: 64 }, () => Array.from({ length: 13 }, () => rand32()));
const Z_SIDE = rand32();
const Z_CASTLE = Array.from({ length: 16 }, () => rand32());
const Z_EP = Array.from({ length: 64 }, () => rand32());
function hashOf(p: Pos): number {
  let h = Z_CASTLE[p.castle];
  for (let i = 0; i < 64; i++) if (p.b[i]) h ^= Z[i][p.b[i] + 6];
  if (p.ep >= 0) h ^= Z_EP[p.ep];
  return (p.turn === -1 ? h ^ Z_SIDE : h) >>> 0;
}

interface TTEntry {
  depth: number;
  score: number;
  flag: 0 | 1 | 2;
  move: number;
}
class Aborted extends Error {}

class Searcher {
  nodes = 0;
  tt = new Map<number, TTEntry>();
  killers: number[][] = Array.from({ length: 64 }, () => [0, 0]);
  hist = new Int32Array(64 * 64);
  deadline: number;
  constructor(deadline: number) {
    this.deadline = deadline;
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new Aborted();
  }

  order(p: Pos, moves: number[], ttMove: number, ply: number) {
    const k = this.killers[ply] ?? [0, 0];
    const sc = moves.map((m) => {
      if (m === ttMove) return 1e9;
      const cap = p.b[mTo(m)];
      const promo = mPromo(m);
      if (cap || promo) return 1e8 + (cap ? VAL[Math.abs(cap)] * 16 : 0) + (promo ? VAL[promo] : 0) - VAL[Math.abs(p.b[mFrom(m)])] / 10;
      if (m === k[0]) return 9e7;
      if (m === k[1]) return 8e7;
      return this.hist[(m & 4095) % 4096];
    });
    return moves.map((_, i) => i).sort((a, c) => sc[c] - sc[a]).map((i) => moves[i]);
  }

  quiesce(p: Pos, alpha: number, beta: number, qd: number): number {
    this.tick();
    const stand = evaluate(p.b, p.turn);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 8) return stand;
    for (const m of this.order(p, pseudoMoves(p, [], true), 0, 63)) {
      const { pos } = makeMove(p, m);
      if (inCheck(pos.b, p.turn)) continue;
      const v = -this.quiesce(pos, -beta, -alpha, qd + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  negamax(p: Pos, depth: number, alpha: number, beta: number, ply: number): number {
    this.tick();
    const checked = inCheck(p.b, p.turn);
    if (checked) depth += 1;
    if (depth <= 0) return this.quiesce(p, alpha, beta, 0);
    if (p.half >= 100) return 0;
    const hash = hashOf(p);
    const alpha0 = alpha;
    const e = this.tt.get(hash);
    let ttMove = 0;
    if (e) {
      ttMove = e.move;
      if (e.depth >= depth) {
        if (e.flag === 0) return e.score;
        if (e.flag === 1 && e.score >= beta) return e.score;
        if (e.flag === 2 && e.score <= alpha) return e.score;
      }
    }
    let best = -MATE - 1;
    let bestMove = 0;
    let legal = 0;
    for (const m of this.order(p, pseudoMoves(p), ttMove, ply)) {
      const { pos, captured } = makeMove(p, m);
      if (inCheck(pos.b, p.turn)) continue;
      legal++;
      const v = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1);
      if (v > best) {
        best = v;
        bestMove = m;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (!captured && !mPromo(m)) {
          const k = this.killers[ply];
          if (k && k[0] !== m) {
            k[1] = k[0];
            k[0] = m;
          }
          this.hist[m & 4095] += depth * depth;
        }
        break;
      }
    }
    if (legal === 0) return checked ? -MATE + ply : 0;
    if (this.tt.size > 400000) this.tt.clear();
    this.tt.set(hash, { depth, score: best, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0, move: bestMove });
    return best;
  }
}

export function engineMove(state: ChessState, opts: EngineOptions): EngineResult | null {
  if (state.winner !== null || state.draw) return null;
  const lv = LEVEL[opts.level];
  const side = state.turn;
  const start = Date.now();
  type Root = { m: number; fixed: number | null; pos: Pos };
  const roots: Root[] = [];
  for (const m of pseudoMoves(state)) {
    const r = applyMove(state, mFrom(m), mTo(m), mPromo(m));
    if (!r.ok) continue;
    // applyMove tự chọn Hậu khi thiếu promo: bỏ nước trùng
    const key = enc(mFrom(m), mTo(m), r.state.moves.at(-1)![2]);
    if (key !== m) continue;
    if (r.state.winner === side) return { move: [mFrom(m), mTo(m), mPromo(m)], score: MATE, depth: 1, nodes: 0 };
    roots.push({ m, fixed: r.state.draw ? 0 : null, pos: makeMove(state, m).pos });
  }
  if (!roots.length) return null;
  const toMove = (m: number): ChessMove => [mFrom(m), mTo(m), mPromo(m)];
  if (roots.length === 1) return { move: toMove(roots[0].m), score: 0, depth: 0, nodes: 0 };
  if (opts.level === "easy" && Math.random() < 0.3) {
    const pick = roots[Math.floor(Math.random() * roots.length)];
    return { move: toMove(pick.m), score: 0, depth: 0, nodes: 0 };
  }
  const timeMs = opts.timeMs ?? lv.timeMs;
  const s = new Searcher(start + timeMs);
  let bestMove = roots[0].m;
  let bestScore = -MATE - 1;
  let doneDepth = 0;
  let order = roots.slice();
  for (let depth = 1; depth <= lv.maxDepth; depth++) {
    const scores = new Map<number, number>();
    let alpha = -MATE - 1;
    let curBest = order[0].m;
    let curScore = -MATE - 1;
    try {
      for (const r of order) {
        let v = r.fixed !== null ? r.fixed : -s.negamax(r.pos, depth - 1, -MATE - 1, -alpha, 1);
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
    if (Math.abs(bestScore) > MATE - 100) break;
    order = order.slice().sort((a, c) => (scores.get(c.m) ?? 0) - (scores.get(a.m) ?? 0));
    if (Date.now() - start > timeMs * 0.55) break;
  }
  return { move: toMove(bestMove), score: bestScore, depth: doneDepth, nodes: s.nodes };
}
