/** Gương của login-system/src/masoi/masoi.types.ts (server là nguồn xác thực) */
import type { MSView } from "../../_lib/game";

export interface MSRoomSettings {
  isPrivate: boolean;
  /** Thời gian thảo luận ban ngày (giây) */
  discussSeconds: number;
  quick: boolean;
  /** Lộ vai khi chết */
  reveal: boolean;
}

export interface MSPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: MSRoomSettings;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean; botLevel?: string | null }[];
  createdAt: number;
}

export interface MSSnapshot extends MSView {
  seq: number;
  players: string[];
  names: string[];
  bots: boolean[];
  connected: boolean[];
  deadline: number;
  serverNow: number;
  games: number;
  /** Giờ server lúc bắt đầu ván (lọc chat cũ) */
  startedAt: number;
}

export interface MSChatMessage {
  id: string;
  userId: string;
  name: string;
  seat: number;
  text: string;
  createdAt: number;
  channel?: "all" | "wolf" | "dead";
}

export const DISCUSS_OPTIONS = [60, 90, 120, 180];
export const MS_ROOM_MAX = 12;
