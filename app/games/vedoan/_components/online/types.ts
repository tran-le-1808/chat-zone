/** Gương của login-system/src/vedoan/vedoan.types.ts (server là nguồn xác thực) */
export interface VDRoomSettingsPublic {
  isPrivate: boolean;
  quick: boolean;
  rounds: number;
  drawSeconds: number;
  hints: boolean;
  onlyCustom: boolean;
  customCount: number;
}

export interface VDPublicRoom {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  settings: VDRoomSettingsPublic;
  players: { userId: string; name: string; avatar?: string; seat: number; ready: boolean; connected: boolean }[];
  createdAt: number;
}

export interface VDSnapshotPlayer {
  userId: string;
  name: string;
  score: number;
  gain: number;
  connected: boolean;
  guessed: boolean;
}

export interface VDSnapshot {
  games: number;
  round: number;
  rounds: number;
  phase: "choose" | "draw" | "reveal" | "over";
  turnId: number;
  drawer: string;
  isDrawer: boolean;
  choices: string[];
  word: string | null;
  mask: string;
  deadline: number;
  serverNow: number;
  drawSeconds: number;
  players: VDSnapshotPlayer[];
  upcoming: string[];
  startedAt: number;
}

export interface VDChatMessage {
  id: string;
  userId: string;
  name: string;
  seat: number;
  text: string;
  createdAt: number;
  kind?: "chat" | "correct" | "close" | "guessed" | "system";
}

export const ROUND_OPTIONS = [2, 3, 4, 5];
export const DRAW_OPTIONS = [60, 80, 100, 120];
export const VD_MAX_PLAYERS = 10;
