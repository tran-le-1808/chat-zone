/** Gương của login-system/src/tienlen/tienlen.types.ts (server là nguồn xác thực) */
import type { TablePlay, TLEvent } from "../../_lib/cards";

export interface TLRoomSettings {
  isPrivate: boolean;
  turnSeconds: number;
  quick: boolean;
}

export interface TLPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: TLRoomSettings;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean; botLevel?: string | null }[];
  createdAt: number;
}

export interface TLSnapshot {
  seq: number;
  n: number;
  mySeat: number;
  players: string[];
  names: string[];
  bots: boolean[];
  connected: boolean[];
  counts: number[];
  hand: number[];
  turn: number;
  table: TablePlay | null;
  passed: boolean[];
  finished: number[];
  mustPlay: number;
  over: boolean;
  instant: { seat: number; reason: string } | null;
  events: TLEvent[];
  deadline: number;
  serverNow: number;
  turnSeconds: number;
  scores: number[];
  lastScores: number[] | null;
  revealed: number[][] | null;
  games: number;
}

export const TURN_OPTIONS = [15, 20, 30];
