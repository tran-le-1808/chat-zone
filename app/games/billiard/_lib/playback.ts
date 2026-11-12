import type { BallPositions, TrajectoryFrame } from "./physics";

/**
 * PHÁT LẠI CÚ ĐÁNH do server mô phỏng: nội suy tuyến tính giữa các khung hình
 * (server gửi ~30 khung/giây) để hiển thị mượt ở mọi FPS. Không tự tính vật lý.
 */
export interface BallSample {
  x: number;
  y: number;
  wx: number;
  wy: number;
  wz: number;
}

export function sampleFrames(
  frames: TrajectoryFrame[],
  t: number,
): BallSample[] | null {
  if (frames.length === 0) return null;
  if (t <= frames[0].t) return toSamples(frames[0]);
  const last = frames[frames.length - 1];
  if (t >= last.t) return toSamples(last);
  // Tìm đoạn chứa t (tìm nhị phân)
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return a.balls.map((ba, i) => {
    const bb = b.balls[i];
    return {
      x: ba[0] + (bb[0] - ba[0]) * k,
      y: ba[1] + (bb[1] - ba[1]) * k,
      wx: ba[2] + (bb[2] - ba[2]) * k,
      wy: ba[3] + (bb[3] - ba[3]) * k,
      wz: ba[4] + (bb[4] - ba[4]) * k,
    };
  });
}

function toSamples(f: TrajectoryFrame): BallSample[] {
  return f.balls.map((b) => ({
    x: b[0],
    y: b[1],
    wx: b[2],
    wy: b[3],
    wz: b[4],
  }));
}

export const restSamples = (balls: BallPositions): BallSample[] =>
  balls.map(([x, y]) => ({ x, y, wx: 0, wy: 0, wz: 0 }));
