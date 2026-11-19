/**
 * TÌM CÚ ĐÁNH (AI Shot Search): sinh ứng viên theo kỹ thuật → mô phỏng bằng physics thật → loại cú không đạt
 * mục tiêu → chấm điểm → tinh chỉnh quanh cú tốt → đo độ ổn định (lặp lại với sai số nhỏ) → xếp hạng theo preset.
 * - Có giới hạn số mô phỏng, giới hạn thời gian, huỷ (AbortSignal), báo tiến độ; chạy theo lát nhỏ để không chặn render.
 * - Tất định theo seed: cùng thế bi + cùng seed = cùng kết quả.
 * - Không đụng trạng thái trận đang chơi: chỉ đọc mảng vị trí được truyền vào.
 */
import { DEFAULT_PHYSICS, sanitizeShot, validateShotInput, type BallId, type BallPositions, type PhysicsConfig, type ShotCommand, type Vec2 } from "../physics";
import { analyzeShot, TIP_INTENT, validateSetup } from "./analysis";
import type { ScoreBreakdown, ShotAnalysis, ShotCandidate, ShotDifficulty, ShotScenarioCategory, StylePreset } from "./types";

// ------------------------------------------------------------------ seed

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ mục tiêu theo loại cú

export const CATEGORY_INFO: Record<ShotScenarioCategory, { name: string; goal: string }> = {
  STRAIGHT: { name: "Đánh thẳng / dày", goal: "Chạm bi mục tiêu gần chính diện rồi tới bi thứ ba" },
  CUT: { name: "Cắt mỏng", goal: "Cắt mỏng bi mục tiêu (góc cắt ≥ 35°) và ghi điểm" },
  FOLLOW: { name: "Follow (đánh trên tâm)", goal: "Bi cái chạy tiến sau va chạm nhờ spin trên" },
  DRAW: { name: "Draw (đánh dưới tâm)", goal: "Bi cái lùi lại sau va chạm nhờ spin dưới" },
  STUN: { name: "Stun / stop", goal: "Bi cái gần như dừng hoặc đi đúng đường tiếp tuyến sau va chạm" },
  ENGLISH: { name: "English trái / phải", goal: "Dùng spin ngang để đổi góc bật băng" },
  CUSHION: { name: "Chạm băng", goal: "Bi cái chạm băng trước bi thứ hai" },
  POSITION: { name: "Gom bi / giữ thế", goal: "Ghi điểm và để 3 bi gần nhau cho lượt sau" },
  ARTISTIC: { name: "Trình diễn", goal: "Đường bi đẹp, nhiều băng, vẫn ghi điểm" },
  CHALLENGE: { name: "Thế bi khó", goal: "Tìm phương án ghi điểm tốt nhất ở thế bi khó" },
};

export const CUSHIONS_FOR_DIFFICULTY: Record<ShotDifficulty, number> = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 3 };

/** Cú đánh có đạt mục tiêu kịch bản không — kiểm tra trên SỐ ĐO mô phỏng */
export function goalCheck(category: ShotScenarioCategory, shot: ShotCommand, a: ShotAnalysis, difficulty: ShotDifficulty = "INTERMEDIATE"): string | null {
  if (!a.verdict.scored) return a.verdict.reason;
  const cut = a.cutAngleDeg ?? 0;
  switch (category) {
    case "STRAIGHT":
      return cut <= 12 ? null : `Góc cắt ${cut.toFixed(0)}° — chưa đủ dày`;
    case "CUT":
      return cut >= 35 ? null : `Góc cắt ${cut.toFixed(0)}° — chưa đủ mỏng`;
    case "FOLLOW":
      if (shot.tipY < TIP_INTENT.vertical) return "Không đánh trên tâm";
      return a.spinEffect === "FOLLOW" && a.spinStrength >= 0.3 ? null : "Mô phỏng không cho thấy follow rõ";
    case "DRAW":
      if (shot.tipY > -TIP_INTENT.vertical) return "Không đánh dưới tâm";
      return a.spinEffect === "DRAW" && a.spinStrength >= 0.3 ? null : "Mô phỏng không cho thấy bi cái lùi";
    case "STUN":
      return a.spinEffect === "STUN" ? null : "Bi cái không dừng / không đi tiếp tuyến";
    case "ENGLISH":
      if (a.english === "NONE") return "Không có spin ngang";
      return a.cueCushions >= 1 ? null : "Bi cái không chạm băng nên không thấy tác dụng english";
    case "CUSHION": {
      const need = CUSHIONS_FOR_DIFFICULTY[difficulty];
      return a.cushionsBeforeSecond >= need ? null : `Chỉ ${a.cushionsBeforeSecond}/${need} băng trước bi thứ hai`;
    }
    case "POSITION":
      return a.finalSpread <= 0.6 ? null : "3 bi kết thúc quá xa nhau";
    case "ARTISTIC":
      return a.cueCushions >= 3 ? null : "Chưa đủ 3 băng để trình diễn";
    case "CHALLENGE":
      return null;
  }
}

// ------------------------------------------------------------------ chấm điểm

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function scoreBreakdown(shot: ShotCommand, a: ShotAnalysis, repeatability: number): ScoreBreakdown {
  const path = a.cuePathLength;
  const beautyPath = path < 1 ? path : path <= 6 ? 1 : Math.max(0, 1 - (path - 6) / 6);
  const beautyCush = a.cueCushions === 0 ? 0.3 : a.cueCushions <= 4 ? 0.6 + a.cueCushions * 0.1 : 0.8;
  const beautyDur = a.duration < 2 ? 0.5 : a.duration <= 10 ? 1 : 0.6;
  const tip = Math.hypot(shot.tipX, shot.tipY);
  return {
    successScore: a.verdict.scored ? 1 : 0,
    trajectoryBeauty: clamp01(beautyPath * 0.45 + beautyCush * 0.35 + beautyDur * 0.2),
    technicalComplexity: clamp01((tip + a.cushionsBeforeSecond * 0.3 + ((a.cutAngleDeg ?? 0) / 90) * 0.6) / 2),
    cushionCount: clamp01(a.cushionsBeforeSecond / 3),
    spinVisibility: a.spinEffect === "FOLLOW" || a.spinEffect === "DRAW" ? clamp01(a.spinStrength) : a.english !== "NONE" && a.cueCushions > 0 ? 0.6 : a.spinEffect === "STUN" ? 0.4 : 0,
    positionPlay: clamp01(1 - a.finalSpread / 1.2 - a.frozenOnRail * 0.15),
    shotClarity: clamp01(1 - Math.max(0, a.contacts.length - 3) / 10 - (a.duration > 9 ? 0.2 : 0)),
    repeatability,
  };
}

export const PRESET_WEIGHTS: Record<Exclude<StylePreset, "RANDOM_DISCOVERY">, ScoreBreakdown> = {
  EASY_AND_CLEAR: { successScore: 3, trajectoryBeauty: 0.6, technicalComplexity: 0.2, cushionCount: 0.2, spinVisibility: 0.6, positionPlay: 0.6, shotClarity: 2, repeatability: 2 },
  TECHNICAL: { successScore: 3, trajectoryBeauty: 0.6, technicalComplexity: 1.6, cushionCount: 0.6, spinVisibility: 1.6, positionPlay: 0.5, shotClarity: 0.8, repeatability: 1.2 },
  ARTISTIC: { successScore: 3, trajectoryBeauty: 2, technicalComplexity: 0.8, cushionCount: 1.4, spinVisibility: 0.8, positionPlay: 0.4, shotClarity: 0.5, repeatability: 0.8 },
  POSITION_PLAY: { successScore: 3, trajectoryBeauty: 0.4, technicalComplexity: 0.4, cushionCount: 0.2, spinVisibility: 0.4, positionPlay: 2.4, shotClarity: 0.8, repeatability: 1.4 },
  CHALLENGE: { successScore: 3, trajectoryBeauty: 0.8, technicalComplexity: 1.4, cushionCount: 1, spinVisibility: 0.8, positionPlay: 0.4, shotClarity: 0.4, repeatability: 1.2 },
};

export function weightedTotal(b: ScoreBreakdown, preset: StylePreset): number {
  const w = PRESET_WEIGHTS[preset === "RANDOM_DISCOVERY" ? "TECHNICAL" : preset];
  let s = 0;
  let sw = 0;
  for (const k of Object.keys(w) as (keyof ScoreBreakdown)[]) {
    s += w[k] * b[k];
    sw += w[k];
  }
  // không chọn cú quá khó tới mức khó lặp lại (độ ổn định thấp bị trừ mạnh)
  return (s / sw) * (0.55 + 0.45 * b.repeatability);
}

export function difficultyOf(b: ScoreBreakdown): ShotDifficulty {
  const d = b.technicalComplexity * 0.6 + (1 - b.repeatability) * 0.6;
  return d < 0.3 ? "BEGINNER" : d < 0.5 ? "INTERMEDIATE" : d < 0.7 ? "ADVANCED" : "EXPERT";
}

export function tagsOf(shot: ShotCommand, a: ShotAnalysis): string[] {
  const t: string[] = [];
  if (a.cutAngleDeg !== null) t.push(a.cutAngleDeg <= 12 ? "đánh dày" : a.cutAngleDeg >= 50 ? "cắt rất mỏng" : a.cutAngleDeg >= 35 ? "cắt mỏng" : "cắt vừa");
  if (a.spinEffect === "FOLLOW" && shot.tipY >= TIP_INTENT.vertical) t.push("follow");
  if (a.spinEffect === "DRAW" && shot.tipY <= -TIP_INTENT.vertical) t.push("draw");
  if (a.spinEffect === "STUN") t.push("stun");
  if (a.english !== "NONE") t.push(a.english === "LEFT" ? "english trái" : "english phải");
  if (a.cushionsBeforeSecond > 0) t.push(`${a.cushionsBeforeSecond} băng`);
  if (a.finalSpread <= 0.6) t.push("gom bi");
  t.push(shot.power >= 0.7 ? "lực mạnh" : shot.power <= 0.35 ? "lực nhẹ" : "lực vừa");
  return t;
}

// ------------------------------------------------------------------ sinh ứng viên

interface Gen {
  aims: Vec2[];
  powers: number[];
  tips: [number, number][];
}

function others(cue: BallId): [BallId, BallId] {
  const o = ([0, 1, 2] as BallId[]).filter((b) => b !== cue);
  return [o[0], o[1]];
}

/** Hướng ngắm trực tiếp tới bi `o` với độ lệch s (−1..1 × 2R) sang trái / phải */
function directAims(c: Vec2, o: Vec2, offsets: number[], R: number): Vec2[] {
  const d = { x: o.x - c.x, y: o.y - c.y };
  const L = Math.hypot(d.x, d.y) || 1;
  const perp = { x: -d.y / L, y: d.x / L };
  return offsets.map((s) => ({ x: o.x + perp.x * s * 2 * R - c.x, y: o.y + perp.y * s * 2 * R - c.y }));
}

/** Ngắm qua băng: soi gương bi `o` qua 1 hoặc 2 băng (điểm khởi đầu, physics tự quyết đường thật) */
function bankAims(c: Vec2, o: Vec2, cfg: PhysicsConfig, spread: number[]): Vec2[] {
  const hx = cfg.tableWidth / 2 - cfg.ballRadius;
  const hy = cfg.tableHeight / 2 - cfg.ballRadius;
  const mirrors: Vec2[] = [];
  const mx = [2 * hx - o.x, -2 * hx - o.x];
  const my = [2 * hy - o.y, -2 * hy - o.y];
  for (const x of mx) mirrors.push({ x, y: o.y });
  for (const y of my) mirrors.push({ x: o.x, y });
  for (const x of mx) for (const y of my) mirrors.push({ x, y });
  const out: Vec2[] = [];
  for (const m of mirrors) {
    const base = Math.atan2(m.y - c.y, m.x - c.x);
    for (const s of spread) out.push({ x: Math.cos(base + (s * Math.PI) / 180), y: Math.sin(base + (s * Math.PI) / 180) });
  }
  return out;
}

function gens(category: ShotScenarioCategory, start: BallPositions, cue: BallId, cfg: PhysicsConfig, rnd: () => number): Gen[] {
  const R = cfg.ballRadius;
  const c = { x: start[cue][0], y: start[cue][1] };
  const objs = others(cue).map((b) => ({ x: start[b][0], y: start[b][1] }));
  const direct = (offs: number[]) => objs.flatMap((o) => directAims(c, o, offs, R));
  const bank = (spread: number[]) => objs.flatMap((o) => bankAims(c, o, cfg, spread));
  const random = (n: number) => Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
  const fine = [-0.9, -0.75, -0.6, -0.45, -0.3, -0.15, -0.07, 0, 0.07, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
  switch (category) {
    case "STRAIGHT":
      return [{ aims: direct([-0.12, -0.06, 0, 0.06, 0.12]), powers: [0.3, 0.4, 0.5, 0.6, 0.7], tips: [[0, 0], [0, 0.2], [0, -0.2], [0.2, 0], [-0.2, 0]] }];
    case "CUT":
      return [{ aims: direct([-0.92, -0.85, -0.75, -0.65, -0.55, 0.55, 0.65, 0.75, 0.85, 0.92]), powers: [0.35, 0.45, 0.55, 0.7], tips: [[0, 0], [0, 0.3], [0.3, 0.2], [-0.3, 0.2]] }];
    case "FOLLOW":
      return [{ aims: direct(fine), powers: [0.3, 0.4, 0.5, 0.65], tips: [[0, 0.55], [0, 0.75], [0, 0.95], [0.25, 0.7], [-0.25, 0.7]] }];
    case "DRAW":
      return [{ aims: direct(fine), powers: [0.45, 0.55, 0.65, 0.8], tips: [[0, -0.6], [0, -0.8], [0, -0.95], [0.25, -0.8], [-0.25, -0.8]] }];
    case "STUN":
      return [{ aims: direct(fine), powers: [0.4, 0.55, 0.7, 0.85], tips: [[0, -0.1], [0, -0.25], [0, -0.4], [0, -0.55]] }];
    case "ENGLISH":
      return [
        { aims: direct(fine), powers: [0.45, 0.6, 0.75], tips: [[0.6, 0], [-0.6, 0], [0.8, 0.3], [-0.8, 0.3], [0.7, -0.3], [-0.7, -0.3]] },
        { aims: bank([-3, 0, 3]), powers: [0.5, 0.65, 0.8], tips: [[0.6, 0.2], [-0.6, 0.2], [0.85, 0], [-0.85, 0]] },
      ];
    case "CUSHION":
      return [
        { aims: bank([-6, -3, 0, 3, 6]), powers: [0.45, 0.6, 0.75, 0.9], tips: [[0, 0.3], [0.5, 0.2], [-0.5, 0.2], [0, 0]] },
        { aims: direct(fine), powers: [0.6, 0.8, 0.95], tips: [[0.5, 0.3], [-0.5, 0.3], [0, 0.4]] },
      ];
    case "POSITION":
      return [{ aims: direct(fine), powers: [0.18, 0.24, 0.3, 0.38, 0.45], tips: [[0, 0], [0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]] }];
    case "ARTISTIC":
      return [
        { aims: bank([-8, -4, 0, 4, 8]), powers: [0.7, 0.85, 1], tips: [[0, 0.4], [0.6, 0.3], [-0.6, 0.3], [0.7, -0.2], [-0.7, -0.2]] },
        { aims: random(60), powers: [0.75, 0.9], tips: [[0.5, 0.4], [-0.5, 0.4]] },
      ];
    case "CHALLENGE":
      return [
        { aims: direct(fine), powers: [0.35, 0.55, 0.75], tips: [[0, 0.4], [0, -0.6], [0.5, 0], [-0.5, 0]] },
        { aims: bank([-5, 0, 5]), powers: [0.5, 0.7, 0.9], tips: [[0, 0.3], [0.5, 0.2], [-0.5, 0.2]] },
      ];
  }
}

/** Danh sách lệnh đánh thô (đã chuẩn hoá & kiểm tra như server) — trộn tất định theo seed */
export function generateCandidates(category: ShotScenarioCategory, start: BallPositions, cue: BallId, seed: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): ShotCommand[] {
  const rnd = mulberry32(seed);
  const out: ShotCommand[] = [];
  for (const g of gens(category, start, cue, cfg, rnd))
    for (const aim of g.aims)
      for (const power of g.powers)
        for (const [tipX, tipY] of g.tips) {
          const raw = { dirX: aim.x, dirY: aim.y, power, tipX, tipY, elevation: 3 };
          if (validateShotInput(raw)) continue;
          out.push(sanitizeShot(raw, cue));
        }
  // trộn Fisher–Yates tất định
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function perturb(s: ShotCommand, dAngDeg: number, dPow: number, dTipX: number, dTipY: number): ShotCommand {
  const a = Math.atan2(s.dirY, s.dirX) + (dAngDeg * Math.PI) / 180;
  return sanitizeShot({ dirX: Math.cos(a), dirY: Math.sin(a), power: s.power + dPow, tipX: s.tipX + dTipX, tipY: s.tipY + dTipY, elevation: s.elevation }, s.cue);
}

const REPEAT_SET: [number, number, number, number][] = [
  [0.25, 0, 0, 0],
  [-0.25, 0, 0, 0],
  [0, 0.03, 0, 0],
  [0, -0.03, 0, 0],
  [0, 0, 0.06, 0],
  [0, 0, -0.06, 0],
  [0, 0, 0, 0.06],
  [0, 0, 0, -0.06],
];
const REFINE_SET: [number, number, number, number][] = [
  [0.4, 0, 0, 0],
  [-0.4, 0, 0, 0],
  [0.9, 0, 0, 0],
  [-0.9, 0, 0, 0],
  [0, 0.06, 0, 0],
  [0, -0.06, 0, 0],
  [0, 0, 0.15, 0],
  [0, 0, -0.15, 0],
  [0, 0, 0, 0.15],
  [0, 0, 0, -0.15],
];

// ------------------------------------------------------------------ tìm kiếm

export type SearchStage = "analyzing" | "searching" | "refining" | "repeatability" | "selecting" | "done";

export interface SearchOptions {
  category: ShotScenarioCategory;
  difficulty?: ShotDifficulty;
  preset: StylePreset;
  seed: number;
  /** Số ứng viên muốn trả về (gallery) */
  count?: number;
  /** Tối đa số lần mô phỏng (gồm cả tinh chỉnh + kiểm tra ổn định) */
  maxSimulations?: number;
  /** Giới hạn thời gian (ms) */
  timeBudgetMs?: number;
  /** Lát thời gian trước khi nhường luồng cho render (ms) */
  sliceMs?: number;
  signal?: AbortSignal;
  onProgress?: (p: { stage: SearchStage; done: number; total: number; valid: number }) => void;
  config?: PhysicsConfig;
}

export interface SearchResult {
  candidates: ShotCandidate[];
  evaluated: number;
  valid: number;
  rejected: number;
  timedOut: boolean;
  cancelled: boolean;
  elapsedMs: number;
  /** Có lỗi thế bi (bi chồng nhau / ngoài bàn) */
  error?: string;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

function sameShot(a: ShotCommand, b: ShotCommand): boolean {
  const da = Math.abs(Math.atan2(a.dirY, a.dirX) - Math.atan2(b.dirY, b.dirX));
  const ang = Math.min(da, Math.PI * 2 - da);
  return ang < (1.2 * Math.PI) / 180 && Math.abs(a.power - b.power) < 0.08 && Math.abs(a.tipX - b.tipX) < 0.12 && Math.abs(a.tipY - b.tipY) < 0.12;
}

export async function searchShots(start: BallPositions, cue: BallId, opts: SearchOptions): Promise<SearchResult> {
  const cfg = opts.config ?? DEFAULT_PHYSICS;
  const t0 = Date.now();
  const maxSim = opts.maxSimulations ?? 900;
  const budget = opts.timeBudgetMs ?? 12000;
  const slice = opts.sliceMs ?? 14;
  const count = opts.count ?? 6;
  const difficulty = opts.difficulty ?? "INTERMEDIATE";
  const res: SearchResult = { candidates: [], evaluated: 0, valid: 0, rejected: 0, timedOut: false, cancelled: false, elapsedMs: 0 };
  const setupErr = validateSetup(start, cfg);
  if (setupErr) return { ...res, error: setupErr };
  opts.onProgress?.({ stage: "analyzing", done: 0, total: maxSim, valid: 0 });
  // sao chép thế bi: tìm kiếm không bao giờ sửa mảng gốc (trạng thái trận)
  const table: BallPositions = start.map(([x, y]) => [x, y]);
  let sliceStart = Date.now();
  let sims = 0;
  const stop = () => {
    if (opts.signal?.aborted) res.cancelled = true;
    else if (Date.now() - t0 > budget) res.timedOut = true;
    return res.cancelled || res.timedOut || sims >= maxSim;
  };
  const tick = async (stage: SearchStage) => {
    if (Date.now() - sliceStart >= slice) {
      opts.onProgress?.({ stage, done: sims, total: maxSim, valid: res.valid });
      await yieldToUi();
      sliceStart = Date.now();
    }
  };
  const evaluate = (shot: ShotCommand) => {
    sims++;
    const a = analyzeShot(table, shot, cfg);
    const why = goalCheck(opts.category, shot, a, difficulty);
    return { a, why };
  };

  // 1. Tìm thô
  const coarseCap = Math.floor(maxSim * 0.65);
  const raw = generateCandidates(opts.category, table, cue, opts.seed, cfg).slice(0, coarseCap);
  const pool: { shot: ShotCommand; a: ShotAnalysis; prelim: number }[] = [];
  for (const shot of raw) {
    if (stop()) break;
    const { a, why } = evaluate(shot);
    res.evaluated++;
    if (why) res.rejected++;
    else {
      res.valid++;
      pool.push({ shot, a, prelim: weightedTotal(scoreBreakdown(shot, a, 0.5), opts.preset) });
    }
    await tick("searching");
  }
  // 2. Tinh chỉnh quanh các cú tốt
  pool.sort((x, y) => y.prelim - x.prelim);
  const seeds = pool.slice(0, 6).map((p) => p.shot);
  for (const s of seeds) {
    for (const [da, dp, dx, dy] of REFINE_SET) {
      if (stop()) break;
      const shot = perturb(s, da, dp, dx, dy);
      const { a, why } = evaluate(shot);
      res.evaluated++;
      if (why) res.rejected++;
      else {
        res.valid++;
        pool.push({ shot, a, prelim: weightedTotal(scoreBreakdown(shot, a, 0.5), opts.preset) });
      }
      await tick("refining");
    }
  }
  // 3. Bỏ cú gần trùng, đo độ ổn định cho nhóm đầu
  pool.sort((x, y) => y.prelim - x.prelim);
  const distinct: typeof pool = [];
  for (const p of pool) if (!distinct.some((d) => sameShot(d.shot, p.shot))) distinct.push(p);
  const top = distinct.slice(0, Math.max(count * 2, 8));
  const cands: ShotCandidate[] = [];
  let idx = 0;
  for (const p of top) {
    let ok = 0;
    let n = 0;
    for (const [da, dp, dx, dy] of REPEAT_SET) {
      if (opts.signal?.aborted) {
        res.cancelled = true;
        break;
      }
      n++;
      sims++;
      const shot = perturb(p.shot, da, dp, dx, dy);
      const a = analyzeShot(table, shot, cfg);
      if (!goalCheck(opts.category, shot, a, difficulty)) ok++;
      await tick("repeatability");
    }
    if (res.cancelled) break;
    const rep = n ? ok / n : 0;
    const breakdown = scoreBreakdown(p.shot, p.a, rep);
    cands.push({
      id: `${opts.category.toLowerCase()}-${opts.seed}-${idx++}`,
      shot: p.shot,
      analysis: p.a,
      meetsGoal: true,
      breakdown,
      total: weightedTotal(breakdown, opts.preset),
      difficulty: difficultyOf(breakdown),
      tags: tagsOf(p.shot, p.a),
    });
  }
  opts.onProgress?.({ stage: "selecting", done: sims, total: maxSim, valid: res.valid });
  // 4. Xếp hạng: ưu tiên đúng độ khó yêu cầu, rồi điểm tổng
  const order = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  const gap = (c: ShotCandidate) => Math.abs(order.indexOf(c.difficulty) - order.indexOf(difficulty));
  cands.sort((x, y) => gap(x) - gap(y) || y.total - x.total);
  if (opts.preset === "RANDOM_DISCOVERY" && cands.length > 1) {
    // ngẫu nhiên có kiểm soát: chọn 1 cú trong nhóm tốt (theo seed) đưa lên đầu
    const rnd = mulberry32(opts.seed ^ 0x9e3779b9);
    const k = Math.floor(rnd() * Math.min(cands.length, 5));
    const [pick] = cands.splice(k, 1);
    cands.unshift(pick);
  }
  res.candidates = cands.slice(0, count);
  res.elapsedMs = Date.now() - t0;
  opts.onProgress?.({ stage: "done", done: sims, total: maxSim, valid: res.valid });
  return res;
}
