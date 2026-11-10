export const MONOPOLY_MAX_PLAYERS = 4;
export const MONOPOLY_MIN_PLAYERS = 2;

export const STARTING_MONEY_OPTIONS = [10000, 15000, 20000, 30000];
/** Mỗi lượt tối đa 20 giây, hết giờ hệ thống tự đi thay */
export const TURN_SECONDS = 20;

export type RoomStatus = "lobby" | "playing" | "finished";

export interface RoomSettings {
  isPrivate: boolean;
  startingMoney: number;
}

export interface RoomPlayer {
  userId: string;
  name: string;
  avatar?: string;
  seat: number;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: RoomPlayer[];
  createdAt: number;
}

export interface RoomChatMessage {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  seat: number;
  text: string;
  createdAt: number;
}

export interface AckResponse<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface JoinResult<TSnapshot = unknown> {
  room: RoomInfo;
  snapshot: TSnapshot | null;
  chat: RoomChatMessage[];
}

/** Thao tác của người chơi gửi tới host */
export type GameActionType =
  | "roll"
  | "buy"
  | "skipBuy"
  | "festivalSelect"
  | "festivalSkip"
  | "payBail"
  | "travel"
  | "sellTile"
  | "autoSell"
  | "rpsChoose"
  | "xocGuess";

export interface GameActionMessage {
  userId: string;
  type: GameActionType;
  payload?: unknown;
}
