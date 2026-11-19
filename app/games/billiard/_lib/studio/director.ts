/**
 * ĐIỀU PHỐI VIDEO (thuần, không phụ thuộc trình duyệt): ở thời điểm t của video → cảnh nào, vị trí 3 bi
 * (lấy mẫu từ quỹ đạo physics đã chạy thật), sự kiện va chạm cần phát âm, phần đường bi đã đi.
 */
import type { BallPositions, PhysicsEvent } from "../physics";
import { restSamples, sampleFrames, type BallSample } from "../playback";
import { sceneAt } from "./sequence";
import type { SceneSpec, ShotAnalysis } from "./types";

export interface DirectorFrame {
  t: number;
  scene: SceneSpec | null;
  /** Thời gian physics đang hiển thị (giây) — null khi bi đứng yên (setup / kết quả) */
  physicsT: number | null;
  balls: BallSample[];
}

/** Thời gian physics tương ứng thời điểm t của video */
export function physicsTimeAt(scene: SceneSpec | null, t: number, duration: number): number | null {
  if (!scene) return null;
  if (scene.id === "shot") return Math.min(duration, t - scene.start);
  if (scene.id === "replay") return Math.min(duration, (t - scene.start) * (scene.playbackRate ?? 0.5));
  return null;
}

export function frameAt(scenes: SceneSpec[], actual: ShotAnalysis, t: number): DirectorFrame {
  const scene = sceneAt(scenes, t) ?? (t >= (scenes.at(-1)?.end ?? 0) ? (scenes.at(-1) ?? null) : null);
  const pt = physicsTimeAt(scene, t, actual.duration);
  let balls: BallSample[];
  if (pt !== null) balls = sampleFrames(actual.frames, pt) ?? restSamples(actual.start);
  else balls = restSamples(scene && scene.id === "result" ? actual.final : actual.start);
  return { t, scene, physicsT: pt, balls };
}

/** Các sự kiện va chạm nằm trong khoảng thời gian physics (t0, t1] — để phát âm thanh đúng lúc */
export function eventsBetween(events: PhysicsEvent[], t0: number, t1: number): PhysicsEvent[] {
  return events.filter((e) => e.t > t0 && e.t <= t1);
}

/** Đối chiếu kết quả thực hiện với kết quả lúc tìm kiếm (mismatch thì không được tuyên bố thành công) */
export function compareOutcome(predicted: ShotAnalysis, actual: ShotAnalysis, tol = 1e-4): { match: boolean; maxDeviation: number; reason?: string } {
  let maxDev = 0;
  const fin = (p: BallPositions, q: BallPositions) => p.forEach(([x, y], i) => (maxDev = Math.max(maxDev, Math.hypot(x - q[i][0], y - q[i][1]))));
  fin(predicted.final, actual.final);
  if (predicted.verdict.scored !== actual.verdict.scored) return { match: false, maxDeviation: maxDev, reason: "Kết quả ghi điểm khác với dự kiến" };
  if (maxDev > tol) return { match: false, maxDeviation: maxDev, reason: `Vị trí cuối lệch ${(maxDev * 1000).toFixed(1)} mm so với dự kiến` };
  return { match: true, maxDeviation: maxDev };
}

/** Điểm (x, y) trên quỹ đạo của bi `id` từ đầu tới thời điểm physics `upTo` (lấy theo khung hình thật) */
export function pathUntil(a: Pick<ShotAnalysis, "frames">, id: number, upTo: number): [number, number][] {
  const out: [number, number][] = [];
  for (const f of a.frames) {
    if (f.t > upTo) break;
    out.push([f.balls[id][0], f.balls[id][1]]);
  }
  const s = sampleFrames(a.frames, upTo);
  if (s && upTo > 0) out.push([s[id].x, s[id].y]);
  return out;
}
