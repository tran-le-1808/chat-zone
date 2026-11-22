/**
 * BOT CAROM: sinh ứng viên (ngắm trực tiếp, cắt, follow/draw, qua băng) → mô phỏng bằng physics thật →
 * chọn cú ghi điểm tốt nhất (cấp khó: ưu tiên cú ổn định + gom bi) → cộng "run tay" theo cấp độ rồi mới đánh.
 * Bot KHÔNG biết trước kết quả sau khi run tay — cú thật vẫn có thể hụt, giống người chơi.
 * Chạy theo lát nhỏ (nhường luồng) để không đứng màn hình; huỷ được bằng AbortSignal.
 */
import { checkCueClearance, DEFAULT_PHYSICS, judgeShot, sanitizeShot, simulateShot, type BallId, type BallPositions, type CaromMode, type ShotCommand } from "../physics";
import { generateCandidates, mulberry32 } from "../studio/search";
import type { ShotScenarioCategory } from "../studio/types";

export type BotLevel = "easy" | "medium" | "hard";

/**
 * budget: số cú mô phỏng khi tìm; aim/power/tipNoise: độ run tay; checkTop × checkSamples: số cú đứng đầu được thử lại
 * với chính độ run tay đó để ước lượng xác suất trúng; pickFrom: chọn ngẫu nhiên trong nhóm tốt nhất (cấp thấp không luôn chọn cú tốt nhất).
 */
export const BOT_LEVELS: Record<BotLevel, { name: string; budget: number; aimNoiseDeg: number; powerNoise: number; tipNoise: number; checkTop: number; checkSamples: number; pickFrom: number; thinkMs: number }> = {
  easy: { name: "Dễ", budget: 160, aimNoiseDeg: 0.45, powerNoise: 0.04, tipNoise: 0.06, checkTop: 10, checkSamples: 3, pickFrom: 3, thinkMs: 600 },
  medium: { name: "Vừa", budget: 360, aimNoiseDeg: 0.22, powerNoise: 0.02, tipNoise: 0.04, checkTop: 16, checkSamples: 4, pickFrom: 2, thinkMs: 800 },
  hard: { name: "Khó", budget: 800, aimNoiseDeg: 0.1, powerNoise: 0.008, tipNoise: 0.015, checkTop: 20, checkSamples: 6, pickFrom: 1, thinkMs: 900 },
};

const CATS: Record<CaromMode, ShotScenarioCategory[]> = {
  free: ["STRAIGHT", "CUT", "FOLLOW", "DRAW", "CUSHION"],
  three: ["CUSHION", "ARTISTIC", "CHALLENGE"],
};

interface Eval {
  shot: ShotCommand;
  scored: boolean;
  spread: number;
  /** Cú hụt: chạm được bi đầu thì tốt hơn (dùng khi không có cú ghi điểm) */
  near: number;
}

function evaluate(balls: BallPositions, shot: ShotCommand, mode: CaromMode): Eval | null {
  if (!checkCueClearance(balls, shot, DEFAULT_PHYSICS).ok) return null;
  const r = simulateShot(balls, shot, DEFAULT_PHYSICS);
  const v = judgeShot(r.events, shot.cue, { mode });
  const f = r.final;
  const spread = (Math.hypot(f[0][0] - f[1][0], f[0][1] - f[1][1]) + Math.hypot(f[0][0] - f[2][0], f[0][1] - f[2][1]) + Math.hypot(f[1][0] - f[2][0], f[1][1] - f[2][1])) / 3;
  return { shot, scored: v.scored, spread, near: v.firstBall !== null ? 1 + (mode === "three" ? Math.min(3, v.cushionsBeforeSecond) * 0.3 : 0) : 0 };
}

function gauss(rnd: () => number): number {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Cộng sai số tay theo cấp độ (noise = 0 để test) */
export function humanize(s: ShotCommand, level: BotLevel, rnd: () => number, scale = 1): ShotCommand {
  const L = BOT_LEVELS[level];
  const a = Math.atan2(s.dirY, s.dirX) + ((gauss(rnd) * L.aimNoiseDeg * scale) * Math.PI) / 180;
  return sanitizeShot({ dirX: Math.cos(a), dirY: Math.sin(a), power: s.power + gauss(rnd) * L.powerNoise * scale, tipX: s.tipX + gauss(rnd) * L.tipNoise * scale, tipY: s.tipY + gauss(rnd) * L.tipNoise * scale, elevation: s.elevation }, s.cue);
}

export interface BotChoice {
  /** Cú bot dự định (chưa run tay) */
  planned: ShotCommand;
  /** Cú thật sự đánh (đã run tay) */
  shot: ShotCommand;
  /** Bot có tìm được cú ghi điểm trong mô phỏng không */
  foundScoring: boolean;
  evaluated: number;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export async function chooseBotShot(balls: BallPositions, cue: BallId, mode: CaromMode, level: BotLevel, seed: number, opts: { signal?: AbortSignal; noise?: number; sliceMs?: number } = {}): Promise<BotChoice | null> {
  const L = BOT_LEVELS[level];
  const rnd = mulberry32(seed);
  const table: BallPositions = balls.map(([x, y]) => [x, y]);
  // gộp ứng viên của nhiều kỹ thuật, trộn tất định rồi lấy theo ngân sách
  const pool: ShotCommand[] = [];
  CATS[mode].forEach((c, i) => pool.push(...generateCandidates(c, table, cue, seed + i * 7919)));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const list = pool.slice(0, L.budget).map((s) => ({ ...s, elevation: 5 }));
  let slice = Date.now();
  const evals: Eval[] = [];
  for (const s of list) {
    if (opts.signal?.aborted) return null;
    const e = evaluate(table, s, mode);
    if (e) evals.push(e);
    if (Date.now() - slice > (opts.sliceMs ?? 12)) {
      await yieldToUi();
      slice = Date.now();
    }
  }
  const scoring = evals.filter((e) => e.scored);
  let planned: ShotCommand;
  if (scoring.length) {
    // thử lại các cú đứng đầu với chính độ run tay của cấp này: ước lượng xác suất trúng thật
    scoring.sort((a, b) => a.spread - b.spread);
    const top = scoring.slice(0, L.checkTop);
    const ranked: { e: Eval; score: number }[] = [];
    for (const e of top) {
      if (opts.signal?.aborted) return null;
      let ok = 0;
      for (let k = 0; k < L.checkSamples; k++) if (evaluate(table, humanize(e.shot, level, rnd), mode)?.scored) ok++;
      // cấp khó còn ưu tiên gom bi cho cú sau
      ranked.push({ e, score: ok / L.checkSamples + (level === "hard" ? 0.15 * (1 - Math.min(1, e.spread / 1.4)) : 0) });
      await yieldToUi();
    }
    ranked.sort((a, b) => b.score - a.score);
    planned = ranked[Math.floor(rnd() * Math.min(L.pickFrom, ranked.length))].e.shot;
  } else if (evals.length) {
    evals.sort((a, b) => b.near - a.near || a.spread - b.spread);
    planned = evals[0].shot;
  } else {
    // không cú nào hợp lệ về hình học: đánh nhẹ thẳng vào bi gần nhất, nâng cơ cao
    const others = ([0, 1, 2] as BallId[]).filter((b) => b !== cue);
    const [c] = [table[cue]];
    const o = others.map((b) => table[b]).sort((p, q) => Math.hypot(p[0] - c[0], p[1] - c[1]) - Math.hypot(q[0] - c[0], q[1] - c[1]))[0];
    planned = sanitizeShot({ dirX: o[0] - c[0], dirY: o[1] - c[1], power: 0.4, tipX: 0, tipY: 0, elevation: 25 }, cue);
  }
  const noise = opts.noise ?? 1;
  const shot = noise > 0 ? humanize(planned, level, rnd, noise) : planned;
  return { planned, shot, foundScoring: scoring.length > 0, evaluated: evals.length };
}
