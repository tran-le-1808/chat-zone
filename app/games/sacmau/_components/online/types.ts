/** Gương của login-system/src/sacmau/sacmau.types.ts (server là nguồn xác thực) */
import type { SMEvent } from "../../_lib/cards";

export interface SMRoomSettings {
  isPrivate: boolean;
  turnSeconds: number;
  quick: boolean;
  stack: boolean;
}

export interface SMPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: SMRoomSettings;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean; botLevel?: string | null }[];
  createdAt: number;
}

export interface SMSnapshot {
  seq: number;
  n: number;
  mySeat: number;
  players: string[];
  names: string[];
  bots: boolean[];
  connected: boolean[];
  counts: number[];
  hand: number[];
  top: number;
  color: number;
  dir: 1 | -1;
  turn: number;
  pending: number;
  drawn: number | null;
  playable: number[];
  pileCount: number;
  called: boolean[];
  stack: boolean;
  over: boolean;
  winner: number | null;
  events: SMEvent[];
  deadline: number;
  serverNow: number;
  turnSeconds: number;
  scores: number[];
  lastScores: number[] | null;
  revealed: number[][] | null;
  games: number;
}

export const TURN_OPTIONS = [15, 20, 30];
