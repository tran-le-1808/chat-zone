import type { BallSpot, SimEvent } from "../../_lib/physics/types";
import type { MatchState } from "../../_lib/rules/engine";
import type { CallShot, RuleMessage } from "../../_lib/rules/types";
import type { PoolRoomSettingsUI } from "./PoolWaitingRoom";

/** SHOT_RESULT từ server (gương của login-system/src/pool/pool.types.ts) */
export interface ShotRecord {
  seq: number;
  shotId: string;
  by: number;
  input: { aimAngle: number; power: number; tipX: number; tipY: number; elevation: number; call: CallShot | null; safety: boolean; pushOut: boolean };
  start: BallSpot[];
  events: SimEvent[];
  final: BallSpot[];
  pocketed: { ball: number; pocket: number }[];
  hash: string;
  foul: string | null;
  messages: RuleMessage[];
  duration: number;
  at: number;
}

/** ROOM_STATE từ server */
export interface PoolSnapshot {
  v: number;
  seq: number;
  match: MatchState;
  players: [string, string];
  names: [string, string];
  clock: { deadline: number; pausedAt: number | null; extensions: [number, number]; serverNow: number };
  busyUntil: number;
  lastShot: ShotRecord | null;
  rackOver: { winner: number; reason: string; rackNo: number } | null;
  stats: { shots: number; pots: number; fouls: number; breakAndRuns: number }[];
  settings: PoolRoomSettingsUI;
  endReason?: string;
  eloChange?: [number, number];
}
