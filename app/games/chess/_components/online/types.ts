/** Gương của login-system/src/chess/chess.types.ts (server là nguồn xác thực) */
import type { ChessMove, Side } from "../../_lib/rules";

export interface ChessRoomSettings {
  isPrivate: boolean;
  timeMinutes: number;
  quick: boolean;
}

export interface ChessPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: ChessRoomSettings;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean }[];
  createdAt: number;
}

export interface ChessSnapshot {
  seq: number;
  b: number[];
  castle: number;
  ep: number;
  half: number;
  moves: ChessMove[];
  san: string[];
  captures: number[];
  checks: boolean[];
  turn: Side;
  whiteSeat: number;
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

export const TIME_OPTIONS = [3, 5, 10, 15];
