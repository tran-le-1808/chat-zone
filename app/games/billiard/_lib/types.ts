/**
 * Kiểu dữ liệu trận bida — khớp với login-system/src/billiard/billiard.types.ts
 * (server là nguồn xác thực; client chỉ đọc).
 */
import type {
  BallPositions,
  CaromMode,
  ShotCommand,
  ShotVerdict,
  TrajectoryFrame,
} from "./physics";

export const BILLIARD_MAX_PLAYERS = 2;
export const BILLIARD_TURN_SECONDS = 45;

export const ALLOWED_TARGETS: Record<CaromMode, number[]> = {
  free: [10, 15, 20, 30],
  three: [3, 5, 10, 15],
};

export const MODE_LABEL: Record<CaromMode, string> = {
  free: "Phăng (chạm 2 bi)",
  three: "3 băng",
};

export interface BilliardSettings {
  isPrivate: boolean;
  mode: CaromMode;
  target: number;
  guideline: boolean;
}

export interface CompactEvent {
  t: number;
  type: "ball" | "cushion" | "cue";
  speed: number;
  ball?: number;
}

export interface ShotRecord {
  seq: number;
  shotId: string;
  by: number;
  shot: ShotCommand;
  start: BallPositions;
  final: BallPositions;
  frames: TrajectoryFrame[];
  events: CompactEvent[];
  verdict: ShotVerdict;
  duration: number;
  at: number;
}

export interface PlayerStats {
  shots: number;
  points: number;
  bestRun: number;
  currentRun: number;
  innings: number;
}

export interface BilliardMatch {
  seq: number;
  mode: CaromMode;
  target: number;
  guideline: boolean;
  balls: BallPositions;
  players: string[];
  scores: number[];
  stats: PlayerStats[];
  turn: number;
  busyUntil: number;
  turnDeadline: number;
  lastShot: ShotRecord | null;
  winner: number | null;
  endReason?: string;
  startedAt: number;
  endedAt?: number;
  serverNow?: number;
}

/** Màu bi theo chỉ số: 0 trắng, 1 vàng, 2 đỏ */
export const BALL_COLORS = ["#f8f8f2", "#f5c518", "#d62828"] as const;
export const BALL_NAMES = ["Bi trắng", "Bi vàng", "Bi đỏ"] as const;
