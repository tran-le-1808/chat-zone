/** Gương của login-system/src/xiangqi/xiangqi.types.ts (server là nguồn xác thực) */
import type { Side, XqMove } from "../../_lib/rules";

export interface XqRoomSettings {
  isPrivate: boolean;
  timeMinutes: number;
  quick: boolean;
}

export interface XqPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: XqRoomSettings;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean }[];
  createdAt: number;
}

export interface XqSnapshot {
  seq: number;
  board: number[];
  moves: XqMove[];
  captures: number[];
  checks: boolean[];
  turn: Side;
  redSeat: number;
  players: [string, string];
  names: [string, string];
  clocks: [number, number];
  turnStart: number;
  pausedAt: number | null;
  serverNow: number;
  drawOffer: number | null;
  winnerSeat: number | null;
  draw: boolean;
  endReason: string | null;
  score: [number, number];
  timeMinutes: number;
}

export const TIME_OPTIONS = [5, 10, 15, 20];
