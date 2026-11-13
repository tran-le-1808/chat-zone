import { POOL_PHYSICS, speedToPower as toPower, type PoolConfig } from "./physics/config";
import { tableFor, type TableGeometry } from "./physics/table";
import { simulateShot } from "./physics/simulator";
import type { BallSpot, ShotCommand } from "./physics/types";
import { pathClear, pocketAimPoint, pocketApproachOk } from "./aim";
import { legalTargets, other } from "./rules/common";
import { resolveShot } from "./rules/engine";
import { isValidCuePlacement, withCueAt } from "./rules/rack";
import type {
  AiLevel,
  DecisionChoice,
  PlayerIndex,
  RackState,
  ShotDeclaration,
} from "./rules/types";

let C: PoolConfig = POOL_PHYSICS;
let T: TableGeometry = tableFor(POOL_PHYSICS);
const R = POOL_PHYSICS.ballRadius;

export interface AiPlan {
  /** Vị trí đặt bi cái (khi có bi trong tay) */
  cue: { x: number; y: number } | null;
  shot: ShotCommand;
  decl: ShotDeclaration;
  label: string;
}

interface Candidate {
  cue: { x: number; y: number };
  target: number;
  pocket: number;
  /** Hướng bi cái -> bi ma */
  dir: { x: number; y: number };
  cut: number;
  dCue: number;
  dObj: number;
  score: number;
}

const LEVEL = {
  easy: { top: 3, spins: [0], powers: [1, 1.35], angleNoise: 1.6, powerNoise: 0.12, positionPlay: false, budget: 16 },
  medium: { top: 6, spins: [0, 0.35], powers: [1, 1.3], angleNoise: 0.55, powerNoise: 0.05, positionPlay: true, budget: 48 },
  hard: { top: 10, spins: [0, 0.45, -0.45], powers: [0.85, 1.1, 1.45], angleNoise: 0.15, powerNoise: 0.02, positionPlay: true, budget: 130 },
} as const;

/** Lực cần để đạt vận tốc bi cái ban đầu `speed` */
const speedToPower = (speed: number) => toPower(speed, C);

/** Ước lượng tốc độ đầu của bi cái để bi mục tiêu vừa tới lỗ còn ~0.45 m/s */
function estimateSpeed(c: Candidate): number {
  const g = C.gravity * C.muRoll;
  const vObj = Math.sqrt(0.45 ** 2 + 2 * g * c.dObj) / (5 / 7);
  const cos = Math.max(0.2, Math.cos((c.cut * Math.PI) / 180));
  const vHit = vObj / (cos * ((1 + C.ballRestitution) / 2));
  return Math.max(0.7, Math.min(8.5, Math.sqrt(vHit ** 2 + 2 * g * c.dCue) * 1.12));
}

/** Liệt kê cú đưa bi thẳng / cắt khả thi theo hình học (bi ma), chấm điểm dễ – khó */
function geometricCandidates(balls: BallSpot[], cue: { x: number; y: number }, targets: number[]): Candidate[] {
  const out: Candidate[] = [];
  for (const t of targets) {
    const ball = balls.find((b) => b.n === t);
    if (!ball) continue;
    for (const p of T.pockets) {
      const aim = pocketAimPoint(p);
      const ox = aim.x - ball.x;
      const oy = aim.y - ball.y;
      const dObj = Math.hypot(ox, oy);
      const odx = ox / dObj;
      const ody = oy / dObj;
      if (!pocketApproachOk(p, odx, ody)) continue;
      const gx = ball.x - odx * 2 * R;
      const gy = ball.y - ody * 2 * R;
      const cx = gx - cue.x;
      const cy = gy - cue.y;
      const dCue = Math.hypot(cx, cy);
      if (dCue < 1e-4) continue;
      const dx = cx / dCue;
      const dy = cy / dCue;
      const cut = (Math.acos(Math.max(-1, Math.min(1, dx * odx + dy * ody))) * 180) / Math.PI;
      if (cut > 72) continue;
      if (!pathClear(balls, cue.x, cue.y, gx, gy, [0, t])) continue;
      if (!pathClear(balls, ball.x, ball.y, aim.x, aim.y, [0, t])) continue;
      const cos = Math.cos((cut * Math.PI) / 180);
      const score = (cos * cos) / (1 + 0.55 * dCue + 0.9 * dObj) * (p.kind === "side" ? 0.85 : 1);
      out.push({ cue, target: t, pocket: p.id, dir: { x: dx, y: dy }, cut, dCue, dObj, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Điểm cú dễ nhất người chơi `p` có ở thế bàn này (0 = không có cú nào) */
export function bestShotScore(rack: RackState, p: PlayerIndex): number {
  const cue = rack.balls.find((b) => b.n === 0);
  const targets = legalTargets({ ...rack, turn: p }, p);
  if (rack.ballInHand) return 1; // bi trong tay gần như luôn có cú tốt
  if (!cue) return 1;
  const c = geometricCandidates(rack.balls, cue, targets);
  return c.length ? c[0].score : 0;
}

/** Các vị trí đặt bi cái hợp lý khi có bi trong tay: thẳng hàng sau bi ma của từng cú */
function placementOptions(rack: RackState, targets: number[]): { x: number; y: number }[] {
  const kitchen = rack.ballInHand === "kitchen";
  const others = rack.balls.filter((b) => b.n !== 0);
  const out: { x: number; y: number }[] = [];
  for (const t of targets) {
    const ball = others.find((b) => b.n === t);
    if (!ball) continue;
    for (const p of T.pockets) {
      const aim = pocketAimPoint(p);
      const ox = aim.x - ball.x;
      const oy = aim.y - ball.y;
      const l = Math.hypot(ox, oy);
      if (!pocketApproachOk(p, ox / l, oy / l)) continue;
      for (const back of [0.22, 0.4]) {
        // Lệch nhẹ để có góc cắt nhỏ, giúp đi bi cái
        for (const side of [0, 0.06]) {
          const x = ball.x - (ox / l) * (2 * R + back) - (oy / l) * side;
          const y = ball.y - (oy / l) * (2 * R + back) + (ox / l) * side;
          if (isValidCuePlacement(others, x, y, kitchen)) out.push({ x, y });
        }
      }
    }
  }
  if (kitchen) {
    for (const x of [-0.75, -0.95, -1.1])
      for (const y of [-0.4, -0.2, 0, 0.2, 0.4])
        if (isValidCuePlacement(others, x, y, true)) out.push({ x, y });
  }
  const cur = rack.balls.find((b) => b.n === 0);
  if (cur && isValidCuePlacement(others, cur.x, cur.y, kitchen)) out.push({ x: cur.x, y: cur.y });
  return out;
}

const gauss = () => {
  const u = Math.random() || 1e-9;
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function addNoise(shot: ShotCommand, level: AiLevel): ShotCommand {
  const L = LEVEL[level];
  const a = (gauss() * L.angleNoise * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return {
    ...shot,
    dirX: shot.dirX * ca - shot.dirY * sa,
    dirY: shot.dirX * sa + shot.dirY * ca,
    power: Math.max(0.02, Math.min(1, shot.power * (1 + gauss() * L.powerNoise))),
    tipX: Math.max(-0.5, Math.min(0.5, shot.tipX + gauss() * L.powerNoise * 0.5)),
    tipY: Math.max(-0.8, Math.min(0.8, shot.tipY + gauss() * L.powerNoise * 0.5)),
  };
}

const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * AI dùng CHÍNH engine vật lý + trọng tài để thử các cú đánh, chọn cú tốt nhất:
 * thắng ván > đánh tiếp với vị trí đẹp > phòng thủ để đối thủ khó đánh > phạm lỗi.
 * Cấp thấp thử ít phương án và thêm nhiễu lớn vào góc / lực khi thực hiện.
 */
export async function planShot(
  rack: RackState,
  level: AiLevel,
  names: [string, string],
  config: PoolConfig = POOL_PHYSICS,
): Promise<AiPlan> {
  // Hình học lỗ theo preset của bàn đang chơi
  C = config;
  T = tableFor(config);
  const L = LEVEL[level];
  const me = rack.turn;
  const opp = other(me);

  // ----- Cú phá -----
  if (rack.isBreak) {
    const apex = rack.type === "nine" ? rack.balls.find((b) => b.n === 1)! : rack.balls.filter((b) => b.n !== 0).sort((a, b) => a.x - b.x)[0];
    const cue = { x: T.headStringX - 0.02, y: rack.type === "nine" ? 0.18 : 0.05 };
    const shot: ShotCommand = {
      dirX: apex.x - cue.x,
      dirY: apex.y - cue.y,
      power: level === "easy" ? 0.8 : 0.93,
      tipX: 0,
      tipY: -0.12,
      elevation: 3,
    };
    return { cue, shot: addNoise(shot, level), decl: {}, label: "Phá bi" };
  }

  const targets = legalTargets(rack, me);
  const cues = rack.ballInHand
    ? placementOptions(rack, targets)
    : [rack.balls.find((b) => b.n === 0)!];

  let cands: Candidate[] = [];
  for (const cue of cues) cands.push(...geometricCandidates(rack.balls, cue, targets).slice(0, 4));
  cands = cands.sort((a, b) => b.score - a.score).slice(0, L.top);

  let sims = 0;
  let best: { plan: AiPlan; score: number } | null = null;

  const evaluate = (cue: { x: number; y: number }, shot: ShotCommand, decl: ShotDeclaration) => {
    const start = withCueAt(rack.balls, cue.x, cue.y);
    const res = simulateShot(start, shot, { config: C }).result;
    sims++;
    const v = resolveShot({ ...rack, balls: start }, decl, res, names);
    if (v.rack.winner === me) return 1e5;
    if (v.rack.winner === opp) return -1e5;
    if (v.rack.decision) return 0;
    if (v.foul) return -2000;
    if (v.continues)
      return 1000 + (L.positionPlay ? 600 * bestShotScore(v.rack, me) : 0);
    return -50 - 600 * bestShotScore(v.rack, opp);
  };

  // ----- Đưa bi vào lỗ -----
  outer: for (const cd of cands) {
    const base = speedToPower(estimateSpeed(cd));
    for (const pk of L.powers) {
      for (const spin of L.spins) {
        if (sims >= L.budget) break outer;
        const shot: ShotCommand = {
          dirX: cd.dir.x,
          dirY: cd.dir.y,
          power: Math.min(1, base * pk),
          tipX: 0,
          tipY: spin,
          elevation: 2,
        };
        const decl: ShotDeclaration = rack.type === "eight" ? { call: { ball: cd.target, pocket: cd.pocket } } : {};
        const s = evaluate(cd.cue, shot, decl) + cd.score * 50;
        if (!best || s > best.score)
          best = { score: s, plan: { cue: rack.ballInHand ? cd.cue : null, shot, decl, label: `Bi ${cd.target} → ${T.pockets[cd.pocket].name.toLowerCase()}` } };
        if (sims % 3 === 0) await yieldUI();
        if (s >= 1e5) break outer;
      }
    }
  }

  // ----- Phòng thủ: không có cú tốt -> chạm bi hợp lệ nhẹ, để đối thủ khó đánh -----
  if (!best || best.score < 900) {
    const cue = cues[0] ?? rack.balls.find((b) => b.n === 0)!;
    const safetyBudget = sims + (level === "easy" ? 6 : level === "medium" ? 16 : 30);
    outer2: for (const t of targets) {
      const ball = rack.balls.find((b) => b.n === t);
      if (!ball) continue;
      const bx = ball.x - cue.x;
      const by = ball.y - cue.y;
      const base = Math.atan2(by, bx);
      const thin = Math.asin(Math.min(1, (1.6 * R) / Math.hypot(bx, by)));
      for (const off of [0, thin, -thin]) {
        for (const power of [0.2, 0.32, 0.45]) {
          if (sims >= safetyBudget) break outer2;
          const shot: ShotCommand = { dirX: Math.cos(base + off), dirY: Math.sin(base + off), power, tipX: 0, tipY: -0.2, elevation: 2 };
          const decl: ShotDeclaration = rack.type === "eight" ? { safety: true } : {};
          const s = evaluate(cue, shot, decl);
          if (!best || s > best.score)
            best = { score: s, plan: { cue: rack.ballInHand ? cue : null, shot, decl, label: `Phòng thủ (bi ${t})` } };
          if (sims % 3 === 0) await yieldUI();
        }
      }
    }
  }

  if (!best) {
    // Không còn gì: đánh thẳng vào bi hợp lệ đầu tiên
    const cue = cues[0] ?? rack.balls.find((b) => b.n === 0)!;
    const t = rack.balls.find((b) => targets.includes(b.n)) ?? rack.balls.find((b) => b.n !== 0)!;
    best = {
      score: 0,
      plan: {
        cue: rack.ballInHand ? cue : null,
        shot: { dirX: t.x - cue.x, dirY: t.y - cue.y, power: 0.35, tipX: 0, tipY: 0, elevation: 2 },
        decl: rack.type === "eight" ? { safety: true } : {},
        label: "Đánh an toàn",
      },
    };
  }
  return { ...best.plan, shot: addNoise(best.plan.shot, level) };
}

/** AI chọn khi luật cho quyền lựa chọn */
export function aiDecision(rack: RackState): DecisionChoice {
  switch (rack.decision?.kind) {
    case "illegalBreak":
      return "rerackSelfBreak";
    case "eightOnBreak":
      return "spotAndContinue";
    case "eightOnBreakScratch":
      return "spotWithBallInHand";
    case "pushOutResponse": {
      // Có cú dễ thì đánh, không thì nhường lại
      return bestShotScore({ ...rack, decision: null }, rack.decision.by) > 0.25 ? "shoot" : "passBack";
    }
    default:
      return "acceptTable";
  }
}
