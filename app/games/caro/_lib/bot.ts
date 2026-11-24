/**
 * BOT CỜ CARO: chấm điểm từng ô trống (gần quân đã đánh) theo thế công + thế thủ, tôn trọng luật chặn.
 * - Dễ: hay bỏ sót, chọn ngẫu nhiên trong nhóm tốt.
 * - Vừa: luôn thắng ngay / chặn nước thắng của đối thủ, còn lại đi nước điểm cao nhất.
 * - Khó: như Vừa + tính trước nước đáp trả tốt nhất của đối thủ (2 lớp), tránh để đối thủ có 2 đường thắng.
 */
import { applyMove, checkWin, DIRS, idx, inside, other, type CaroGameState, type CaroRule, type Cell, type Stone } from "./rules";

export type CaroBotLevel = "easy" | "medium" | "hard" | "master";
export const CARO_BOT_LEVELS: Record<CaroBotLevel, string> = { easy: "Dễ", medium: "Vừa", hard: "Khó", master: "Cao thủ" };

const WIN = 1_000_000;

/** Phân tích một hướng khi giả sử đặt quân s tại (x, y): độ dài chuỗi liền + số đầu còn trống + điểm theo cửa sổ 5 ô */
function lineScore(board: readonly Cell[], size: number, x: number, y: number, dx: number, dy: number, s: Stone): number {
  const opp = other(s);
  const at = (k: number): number => {
    const cx = x + dx * k;
    const cy = y + dy * k;
    if (!inside(cx, cy, size)) return 3; // tường
    return k === 0 ? s : board[idx(cx, cy, size)];
  };
  // chuỗi liền
  let l = 1;
  let a = 1;
  while (at(a) === s) {
    l++;
    a++;
  }
  let b = 1;
  while (at(-b) === s) {
    l++;
    b++;
  }
  const openA = at(a) === 0;
  const openB = at(-b) === 0;
  const open = (openA ? 1 : 0) + (openB ? 1 : 0);
  let run = 0;
  if (l >= 4) run = open === 2 ? 60_000 : open === 1 ? 7_000 : 0;
  else if (l === 3) run = open === 2 ? 4_000 : open === 1 ? 450 : 0;
  else if (l === 2) run = open === 2 ? 160 : open === 1 ? 30 : 0;
  else run = open === 2 ? 12 : 3;
  // cửa sổ 5 ô chứa ô đang xét, không có quân đối thủ / tường: bắt được thế có khoảng trống (X_XXX)
  let win = 0;
  for (let st = -4; st <= 0; st++) {
    let cnt = 0;
    let bad = false;
    for (let k = st; k < st + 5; k++) {
      const v = at(k);
      if (v === opp || v === 3) {
        bad = true;
        break;
      }
      if (v === s) cnt++;
    }
    if (!bad) win += cnt >= 4 ? 2_500 : cnt === 3 ? 260 : cnt === 2 ? 40 : 4;
  }
  return run + win * 0.5;
}

/** Điểm của ô (x, y) cho quân s (không tính thắng ngay — xử lý riêng bằng checkWin) */
export function cellScore(board: readonly Cell[], size: number, x: number, y: number, s: Stone): number {
  let t = 0;
  let strong = 0;
  for (const [dx, dy] of DIRS) {
    const v = lineScore(board, size, x, y, dx, dy, s);
    if (v >= 3_500) strong++;
    t += v;
  }
  // hai hướng cùng mạnh (vd. 4 + 3 mở, 3 mở + 3 mở) gần như chắc thắng
  if (strong >= 2) t += 40_000;
  return t;
}

/** Thắng ngay nếu đặt s tại (x, y)? (theo luật chặn) */
export function winsAt(board: readonly Cell[], size: number, x: number, y: number, s: Stone, rule: CaroRule): boolean {
  const i = idx(x, y, size);
  if (board[i] !== 0) return false;
  const b = board as Cell[];
  b[i] = s;
  const w = checkWin(b, x, y, rule, size);
  b[i] = 0;
  return !!w;
}

/** Các ô trống trong phạm vi 2 ô quanh quân đã đánh */
export function candidates(g: CaroGameState): [number, number][] {
  const { size, board } = g;
  if (!g.moves.length) return [[size >> 1, size >> 1]];
  const seen = new Uint8Array(size * size);
  const out: [number, number][] = [];
  for (const [mx, my] of g.moves)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = mx + dx;
        const y = my + dy;
        if (!inside(x, y, size)) continue;
        const i = idx(x, y, size);
        if (board[i] !== 0 || seen[i]) continue;
        seen[i] = 1;
        out.push([x, y]);
      }
  return out;
}

interface Scored {
  x: number;
  y: number;
  score: number;
  attack: number;
  defense: number;
}

function scoreAll(g: CaroGameState, me: Stone, defW: number): Scored[] {
  const opp = other(me);
  return candidates(g).map(([x, y]) => {
    const attack = winsAt(g.board, g.size, x, y, me, g.rule) ? WIN : cellScore(g.board, g.size, x, y, me);
    const defense = winsAt(g.board, g.size, x, y, opp, g.rule) ? WIN * 0.9 : cellScore(g.board, g.size, x, y, opp);
    return { x, y, attack, defense, score: attack + defense * defW };
  });
}

/** Số ô mà quân s thắng ngay */
function winningSpots(g: CaroGameState, s: Stone): number {
  let n = 0;
  for (const [x, y] of candidates(g)) if (winsAt(g.board, g.size, x, y, s, g.rule)) n++;
  return n;
}

export function chooseCaroMove(g: CaroGameState, level: CaroBotLevel, rnd: () => number = Math.random): [number, number] | null {
  if (g.winner !== null || g.draw) return null;
  const me = g.turn;
  const list = scoreAll(g, me, level === "easy" ? 0.7 : 0.95);
  if (!list.length) return null;
  list.sort((a, b) => b.score - a.score);
  const win = list.find((c) => c.attack >= WIN);
  // cấp dễ thỉnh thoảng không thấy nước thắng / không chặn
  if (win && (level !== "easy" || rnd() < 0.8)) return [win.x, win.y];
  const block = list.filter((c) => c.defense >= WIN * 0.9).sort((a, b) => b.attack - a.attack)[0];
  if (block && (level !== "easy" || rnd() < 0.7)) return [block.x, block.y];
  if (level === "easy") {
    const top = list.slice(0, Math.min(5, list.length));
    const c = top[Math.floor(rnd() * top.length)];
    return [c.x, c.y];
  }
  if (level === "medium") {
    const best = list[0].score;
    const near = list.filter((c) => c.score >= best * 0.97);
    const c = near[Math.floor(rnd() * near.length)];
    return [c.x, c.y];
  }
  // khó: xét trước nước đáp trả tốt nhất của đối thủ cho các nước đứng đầu
  const opp = other(me);
  let best: { c: Scored; v: number } | null = null;
  for (const c of list.slice(0, 10)) {
    const r = applyMove(g, c.x, c.y);
    if (!r.ok) continue;
    const next = r.state;
    if (winningSpots(next, opp) > 0) continue; // để đối thủ thắng ngay -> bỏ
    const replies = scoreAll(next, opp, 0.9);
    let oppBest = 0;
    for (const rr of replies) oppBest = Math.max(oppBest, rr.attack);
    // nước tạo được 2 ô thắng (đối thủ không chặn kịp) rất mạnh
    const myThreats = winningSpots(next, me);
    const v = c.score + (myThreats >= 2 ? 200_000 : myThreats * 8_000) - oppBest * 0.6;
    if (!best || v > best.v) best = { c, v };
  }
  const pick = best?.c ?? list[0];
  return [pick.x, pick.y];
}
