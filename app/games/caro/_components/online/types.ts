/** Gương của login-system/src/caro/caro.types.ts (server là nguồn xác thực) */
import type { CaroRule, Stone } from "../../_lib/rules";

export interface CaroRoomSettings {
  isPrivate: boolean;
  rule: CaroRule;
  turnSeconds: number;
  quick: boolean;
}

export interface CaroPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: CaroRoomSettings;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean }[];
  createdAt: number;
}

export interface CaroSnapshot {
  seq: number;
  rule: CaroRule;
  size: number;
  board: number[];
  moves: [number, number][];
  turn: Stone;
  xSeat: number;
  players: [string, string];
  names: [string, string];
  deadline: number;
  pausedAt: number | null;
  serverNow: number;
  winnerSeat: number | null;
  winLine: [number, number][] | null;
  draw: boolean;
  endReason: string | null;
  score: [number, number];
  turnSeconds: number;
}
