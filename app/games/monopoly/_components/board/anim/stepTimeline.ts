/**
 * Timeline & tư thế của quân cờ khi đi (THUẦN toán học — không phụ thuộc React/Three,
 * nên test được và cho cùng kết quả ở mọi tốc độ khung hình / mọi máy).
 *
 * Mỗi bước nhảy gồm: chuẩn bị (nén) -> bay (parabol, kéo dãn) -> chạm đất (nén mạnh)
 * -> hồi phục bằng lò xo tắt dần (có thể chồng lên bước kế).
 */

/** Thời gian chuẩn của một bước (giây) */
export const T_STEP = 0.18;
/** Tổng thời gian di chuyển tối đa (giây) và sàn thời gian mỗi bước */
export const MAX_TOTAL_S = 3.2;
export const MIN_STEP_S = 0.13;

/** Tỉ lệ pha trong một bước (chuẩn bị : bay : chạm đất = 0.06 : 0.20 : 0.06 trên 0.32 (giữ tỉ lệ khi rút ngắn T_STEP)) */
const PREP = 0.06 / 0.32;
const AIR = 0.2 / 0.32;

/** Lò xo hồi phục sau chạm đất: ζ ≈ 0.45, ~9 Hz */
const ZETA = 0.45;
const OMEGA = 2 * Math.PI * 9;
const OMEGA_D = OMEGA * Math.sqrt(1 - ZETA * ZETA);

export type MoveSpeed = "slow" | "normal" | "fast" | "instant";
export const SPEED_FACTOR: Record<MoveSpeed, number> = {
  slow: 1.3,
  normal: 1,
  fast: 0.7,
  instant: 0.12,
};

/** Hash có hạt giống -> [0,1): mọi máy diễn giống nhau cho cùng playerId + moveId + bước */
export function hash01(seed: number): number {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Dao động ngẫu nhiên có hạt giống trong [-1, 1] */
export function jitter(
  playerId: number,
  moveId: number,
  step: number,
): [number, number] {
  const base = playerId * 7919 + moveId * 104729 + step * 1299709;
  return [hash01(base) * 2 - 1, hash01(base + 1) * 2 - 1];
}

/** Hệ số thời gian / độ cao của một bước (đầu chậm hơn 15%, cuối chậm 25% & cao hơn 10%) */
export function stepShape(step: number, steps: number) {
  const first = step === 0;
  const last = step === steps - 1;
  let time = 1;
  let height = 1;
  if (first) time = 1.15;
  if (last) {
    time = 1.25;
    height = 1.1;
  }
  return { first, last, time, height };
}

/**
 * Thời lượng (giây) của từng bước khi đi `steps` ô.
 * Có seed, bước đầu/cuối chậm hơn, nén đều nếu tổng > 3.2 s (k ∈ [0.6, 1], ≥ 0.18 s/bước).
 */
export function buildStepDurations(
  steps: number,
  playerId: number,
  moveId: number,
  speed: MoveSpeed = "normal",
): number[] {
  const raw: number[] = [];
  for (let i = 0; i < steps; i++) {
    const [jt] = jitter(playerId, moveId, i);
    raw.push(T_STEP * stepShape(i, steps).time * (1 + 0.04 * jt));
  }
  const total = raw.reduce((a, b) => a + b, 0);
  const k =
    total > MAX_TOTAL_S ? Math.min(1, Math.max(0.6, MAX_TOTAL_S / total)) : 1;
  const sp = SPEED_FACTOR[speed];
  const floor = speed === "instant" ? 0.04 : MIN_STEP_S;
  return raw.map((d) => Math.max(floor, d * k * sp));
}

/** Độ cao cung theo bước (tỉ lệ so với độ cao chuẩn), có dao động ±5% */
export function stepHeightFactor(
  step: number,
  steps: number,
  playerId: number,
  moveId: number,
) {
  const [, jh] = jitter(playerId, moveId, step);
  return stepShape(step, steps).height * (1 + 0.05 * jh);
}

const ease = (p: number) =>
  p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

export interface HopPose {
  /** Tiến trình ngang 0..1 (chỉ tiến trong pha bay, ease-in-out nhẹ) */
  u: number;
  /** Độ cao so với mặt ô (đơn vị thế giới) = 4·H·t·(1−t) trong pha bay */
  lift: number;
  /** Hệ số co giãn dọc (giữ thể tích: scaleXZ = 1/√scaleY) */
  sy: number;
  /** Nghiêng quanh trục ngang: âm = ngả ra sau (chuẩn bị), dương = chúi về trước (đang bay), rad */
  pitch: number;
  /** Hạ trọng tâm khi nén (đơn vị thế giới) */
  sink: number;
  /** Đã chạm đất chưa */
  landed: boolean;
}

/**
 * Tư thế tại thời điểm `t` (giây) kể từ lúc bắt đầu bước, bước kéo dài `dur` giây,
 * cung cao `H`. Hàm thuần của t -> cùng kết quả ở 30/60/120 FPS.
 */
export function hopPose(t: number, dur: number, H: number, charH = 1): HopPose {
  const p = Math.min(1, Math.max(0, t / dur));
  const rad = (d: number) => (d * Math.PI) / 180;
  if (p < PREP) {
    // Chuẩn bị: nén, hạ trọng tâm ~8%, ngả ra sau 4°
    const q = Math.sin((p / PREP) * (Math.PI / 2));
    return {
      u: 0,
      lift: 0,
      sy: 1 - 0.15 * q,
      pitch: -rad(4) * q,
      sink: 0.08 * charH * q,
      landed: false,
    };
  }
  if (p < PREP + AIR) {
    const q = (p - PREP) / AIR;
    // Kéo dãn: 0.85 -> 1.10 giữa cung -> 1.0 ; nghiêng chúi tới 10°
    const stretch =
      q < 0.5
        ? 0.85 + (1.1 - 0.85) * Math.sin(q * Math.PI)
        : 1 + 0.1 * Math.sin(q * Math.PI);
    return {
      u: ease(q),
      lift: 4 * H * q * (1 - q),
      sy: stretch,
      pitch:
        -rad(4) * (1 - Math.min(1, q * 4)) + rad(10) * Math.sin(q * Math.PI),
      sink: 0.08 * charH * Math.max(0, 1 - q * 3),
      landed: false,
    };
  }
  // Chạm đất: lò xo tắt dần từ scaleY = 0.80
  return {
    u: 1,
    lift: 0,
    sy: landSpring(t - dur * (PREP + AIR)),
    pitch: 0,
    sink: 0,
    landed: true,
  };
}

/** Hệ số scaleY sau khi chạm đất `tl` giây: 0.80 -> nhún 1-2 nhịp -> 1 */
export function landSpring(tl: number) {
  if (tl < 0) return 1;
  const x =
    Math.exp(-ZETA * OMEGA * tl) *
    (Math.cos(OMEGA_D * tl) +
      ((ZETA * OMEGA) / OMEGA_D) * Math.sin(OMEGA_D * tl));
  return 1 - 0.2 * x;
}

/** scaleXZ để giữ thể tích khi scaleY = sy */
export const volumeXZ = (sy: number) => 1 / Math.sqrt(sy);

/** Khe đứng khi nhiều quân cùng ô — (ngang, sâu) theo đơn vị chiều rộng ô, (+sâu = xa camera) */
export const SLOTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.22, 0],
    [0.22, 0],
  ],
  3: [
    [-0.25, 0.1],
    [0.25, 0.1],
    [0, -0.18],
  ],
  4: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
};
