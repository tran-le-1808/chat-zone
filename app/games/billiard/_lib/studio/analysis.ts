/**
 * Phân tích một cú đánh bằng physics engine hiện có: chạy simulateShot (tất định) rồi ĐO các đặc trưng
 * từ khung hình và chuỗi sự kiện — góc cắt, follow / draw / stun thực tế, số băng, gom bi.
 * Không suy diễn kỹ thuật chỉ từ thông số đầu vào: lời bình chỉ được nói điều đo được ở đây.
 */
import { DEFAULT_PHYSICS, judgeShot, simulateShot, type BallId, type BallPositions, type PhysicsConfig, type ShotCommand, type Vec2 } from "../physics";
import { sampleFrames } from "../playback";
import type { ContactMark, EnglishSide, ShotAnalysis, SpinEffect } from "./types";

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Vec2) => Math.hypot(a.x, a.y);
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const unit = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

/** Vị trí bi `id` tại thời điểm t (nội suy khung hình của physics) */
export function ballAt(frames: ShotAnalysis["frames"], id: BallId, t: number): Vec2 {
  const s = sampleFrames(frames, t);
  if (!s) return { x: 0, y: 0 };
  return { x: s[id].x, y: s[id].y };
}

/** Ngưỡng điểm chạm đầu cơ để coi là "có chủ đích" (đơn vị tip −1..1) */
export const TIP_INTENT = { vertical: 0.3, side: 0.35 };

export function englishOf(shot: ShotCommand): EnglishSide {
  return shot.tipX >= TIP_INTENT.side ? "RIGHT" : shot.tipX <= -TIP_INTENT.side ? "LEFT" : "NONE";
}

/** Hiệu ứng sau lần chạm bi đầu, đo từ dịch chuyển của bi cái */
function measureSpin(a: Pick<ShotAnalysis, "frames" | "events" | "duration">, cue: BallId, firstT: number, obj: BallId): { effect: SpinEffect; strength: number; cutAngleDeg: number; thickness: number } {
  const c1 = ballAt(a.frames, cue, firstT);
  const o1 = ballAt(a.frames, obj, firstT);
  const n = unit(sub(o1, c1)); // đường nối tâm lúc chạm
  const before = ballAt(a.frames, cue, Math.max(0, firstT - 0.06));
  const d0 = unit(sub(c1, before)); // hướng bi cái tới
  const cos = Math.max(-1, Math.min(1, dot(d0, n)));
  const cutAngleDeg = (Math.acos(cos) * 180) / Math.PI;
  const thickness = Math.max(0, 1 - Math.sin(Math.acos(cos)));
  // cửa sổ quan sát sau va chạm: tới sự kiện kế tiếp của bi cái (hoặc tối đa 0,35 s)
  const next = a.events.find((e) => e.t > firstT + 0.005 && ((e.type === "cushion" && e.ball === cue) || (e.type === "ball" && (e.a === cue || e.b === cue))));
  const until = Math.min(firstT + 0.35, next ? next.t - 0.005 : a.duration, a.duration);
  const c2 = ballAt(a.frames, cue, Math.max(firstT + 0.02, until));
  const D = sub(c2, c1);
  const moved = len(D);
  const tangent = sub(d0, { x: n.x * cos, y: n.y * cos });
  if (len(tangent) < 0.15) {
    // gần như đánh thẳng tâm: bi cái tiến (follow), lùi (draw) hay đứng (stun)
    if (moved < 0.03) return { effect: "STUN", strength: 1 - moved / 0.03, cutAngleDeg, thickness };
    const f = dot(unit(D), d0);
    return { effect: f > 0 ? "FOLLOW" : "DRAW", strength: Math.min(1, Math.abs(f) * Math.min(1, moved / 0.15)), cutAngleDeg, thickness };
  }
  if (moved < 0.01) return { effect: "STUN", strength: 0.5, cutAngleDeg, thickness };
  // đánh cắt: không spin thì bi cái đi theo đường tiếp tuyến; follow bẻ về phía bi mục tiêu, draw bẻ ngược lại
  const dev = dot(unit(D), n);
  if (dev > 0.15) return { effect: "FOLLOW", strength: Math.min(1, dev), cutAngleDeg, thickness };
  if (dev < -0.15) return { effect: "DRAW", strength: Math.min(1, -dev), cutAngleDeg, thickness };
  return { effect: "STUN", strength: 1 - Math.abs(dev) / 0.15, cutAngleDeg, thickness };
}

export function analyzeShot(start: BallPositions, shot: ShotCommand, config: PhysicsConfig = DEFAULT_PHYSICS): ShotAnalysis {
  const sim = simulateShot(start, shot, config, { recordFrames: true });
  const cue = shot.cue;
  const verdict = judgeShot(sim.events, cue, { mode: "free" });
  const base = { frames: sim.frames, events: sim.events, duration: sim.duration };
  const contacts: ContactMark[] = [];
  let cushionIdx = 0;
  for (const e of sim.events) {
    if (e.type === "ball") {
      const ball = e.a === cue || e.b === cue ? cue : e.a;
      const other = (ball === e.a ? e.b : e.a) as BallId;
      contacts.push({ t: e.t, kind: "ball", ball, other, at: ballAt(sim.frames, ball, e.t), speed: e.speed });
    } else if (e.type === "cushion") {
      const isCue = e.ball === cue;
      if (isCue) cushionIdx++;
      contacts.push({ t: e.t, kind: "cushion", ball: e.ball, rail: e.rail, at: ballAt(sim.frames, e.ball, e.t), speed: e.speed, ...(isCue ? { cushionIndex: cushionIdx } : {}) });
    }
  }
  const first = sim.events.find((e) => e.type === "ball" && (e.a === cue || e.b === cue));
  let spin = { effect: "NONE" as SpinEffect, strength: 0, cutAngleDeg: null as number | null, thickness: null as number | null };
  if (first && first.type === "ball") {
    const m = measureSpin(base, cue, first.t, (first.a === cue ? first.b : first.a) as BallId);
    spin = { effect: m.effect, strength: m.strength, cutAngleDeg: m.cutAngleDeg, thickness: m.thickness };
  }
  let path = 0;
  for (let i = 1; i < sim.frames.length; i++) {
    const a = sim.frames[i - 1].balls[cue];
    const b = sim.frames[i].balls[cue];
    path += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const f = sim.final;
  const spread = (Math.hypot(f[0][0] - f[1][0], f[0][1] - f[1][1]) + Math.hypot(f[0][0] - f[2][0], f[0][1] - f[2][1]) + Math.hypot(f[1][0] - f[2][0], f[1][1] - f[2][1])) / 3;
  const hx = config.tableWidth / 2 - config.ballRadius * 1.6;
  const hy = config.tableHeight / 2 - config.ballRadius * 1.6;
  const frozen = f.filter(([x, y]) => Math.abs(x) > hx || Math.abs(y) > hy).length;
  return {
    verdict,
    ...base,
    start,
    final: sim.final,
    cutAngleDeg: spin.cutAngleDeg,
    thickness: spin.thickness,
    spinEffect: spin.effect,
    spinStrength: spin.strength,
    english: englishOf(shot),
    cushionsBeforeSecond: verdict.cushionsBeforeSecond,
    cueCushions: verdict.cueCushions,
    contacts,
    cuePathLength: path,
    finalSpread: spread,
    frozenOnRail: frozen,
  };
}

/** Kiểm tra thế bi hợp lệ: trong mặt thi đấu, không chồng nhau */
export function validateSetup(pos: BallPositions, config: PhysicsConfig = DEFAULT_PHYSICS): string | null {
  if (pos.length !== 3) return "Cần đúng 3 bi";
  const R = config.ballRadius;
  for (const [x, y] of pos) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "Toạ độ bi không hợp lệ";
    if (Math.abs(x) > config.tableWidth / 2 - R || Math.abs(y) > config.tableHeight / 2 - R) return "Bi nằm ngoài mặt thi đấu";
  }
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) if (Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]) < 2 * R + 1e-4) return "Hai bi chồng lên nhau";
  return null;
}
