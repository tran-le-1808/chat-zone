import {
  DEFAULT_PHYSICS as C,
  PhysicsWorld,
  type BallPositions,
  type ShotCommand,
} from "./physics";

/**
 * ĐƯỜNG BI CÁI ĐI TỚI — mô phỏng bằng CHÍNH physics engine của server (cùng lực,
 * góc cơ, điểm chạm) cho tới lần chạm đầu tiên (bi hoặc băng) hoặc tới khi bi dừng.
 * Đường có thể cong (swerve / masse) và ngắn lại khi lực yếu. Không vẽ đường dội.
 */
export interface AimPath {
  points: { x: number; y: number }[];
  /** Tâm bi cái lúc chạm ("bi ma") hoặc nơi bi dừng */
  end: { x: number; y: number };
  /** Bi bị chạm đầu tiên (null nếu chạm băng trước hoặc bi dừng) */
  hitBall: number | null;
  /** Kết thúc vì: chạm bi / chạm băng / bi dừng trước khi chạm gì */
  endReason: "ball" | "cushion" | "stopped";
}

const SAMPLE_EVERY = 1 / 120;

export function predictCuePath(
  balls: BallPositions,
  shot: ShotCommand,
): AimPath {
  const world = new PhysicsWorld(balls, C);
  world.strike(shot);
  const cue = world.balls[shot.cue];
  const points = [{ x: cue.p.x, y: cue.p.y }];
  let next = SAMPLE_EVERY;
  let seen = 0;

  while (world.isMoving() && world.time < C.maxSimTime) {
    world.step();
    // Sự kiện mới của bi cái trong bước này
    for (; seen < world.events.length; seen++) {
      const e = world.events[seen];
      if (e.type === "ball" && (e.a === shot.cue || e.b === shot.cue)) {
        const end = { x: cue.p.x, y: cue.p.y };
        points.push(end);
        return {
          points,
          end,
          hitBall: e.a === shot.cue ? e.b : e.a,
          endReason: "ball",
        };
      }
      if (e.type === "cushion" && e.ball === shot.cue) {
        const end = { x: cue.p.x, y: cue.p.y };
        points.push(end);
        return { points, end, hitBall: null, endReason: "cushion" };
      }
    }
    if (world.time >= next) {
      next += SAMPLE_EVERY;
      points.push({ x: cue.p.x, y: cue.p.y });
    }
  }
  const end = { x: cue.p.x, y: cue.p.y };
  points.push(end);
  return { points, end, hitBall: null, endReason: "stopped" };
}
