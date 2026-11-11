import { PawnType, PawnState } from "@/app/games/monopoly/_components/Pawn3D";

export type { PawnState, PawnType };

export interface Player {
  id: number;
  name: string;
  type: PawnType;
  color: string;
  tileIndex: number;
  money: number;
  avatarBg: string;
  isBankrupt: boolean;
  inJail: boolean;
  jailTurns: number;
  canTeleport: boolean;
  doublesCount: number;
  /** Tài khoản điều khiển quân cờ này (chơi online) */
  userId?: string;
  /** Ảnh đại diện của tài khoản */
  avatar?: string;
}

export type TileType =
  | "PROPERTY"
  | "STATION"
  | "CHANCE"
  | "FATE"
  | "TAX"
  | "GO"
  | "JAIL"
  | "FESTIVAL"
  | "TRAVEL"
  | "MINIGAME"
  | "XOCDIA";

export interface TileData {
  id: number;
  name: string;
  type: TileType;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  groupCode?: string;
  landPrice: number;
  house1Price: number;
  house2Price: number;
  house3Price: number;
  villaPrice: number;
  rent: number;
  ownerId?: number;
  ownerColor?: string;
  houses: number;
  hasVilla: boolean;
  isFestival?: boolean;
}

export const INITIAL_PLAYERS: Player[] = [
  {
    id: 0,
    name: "Rồng Ngọc",
    type: "dragon",
    color: "#00f0ff",
    tileIndex: 0,
    money: 1000,
    avatarBg: "from-cyan-500/20 to-blue-500/20 border-cyan-400",
    isBankrupt: false,
    inJail: false,
    jailTurns: 0,
    canTeleport: false,
    doublesCount: 0,
  },
  {
    id: 1,
    name: "Thỏ Bông",
    type: "bunny",
    color: "#ff007f",
    tileIndex: 0,
    money: 1000,
    avatarBg: "from-pink-500/20 to-rose-500/20 border-pink-400",
    isBankrupt: false,
    inJail: false,
    jailTurns: 0,
    canTeleport: false,
    doublesCount: 0,
  },
  {
    id: 2,
    name: "Mèo Mộng",
    type: "cat",
    color: "#a855f7",
    tileIndex: 0,
    money: 1000,
    avatarBg: "from-purple-500/20 to-indigo-500/20 border-purple-400",
    isBankrupt: false,
    inJail: false,
    jailTurns: 0,
    canTeleport: false,
    doublesCount: 0,
  },
  {
    id: 3,
    name: "Sư Tử Vàng",
    type: "lion",
    color: "#eab308",
    tileIndex: 0,
    money: 1000,
    avatarBg: "from-amber-500/20 to-yellow-500/20 border-amber-400",
    isBankrupt: false,
    inJail: false,
    jailTurns: 0,
    canTeleport: false,
    doublesCount: 0,
  },
];

export type CardDeckType = "CHANCE" | "FATE";

export type CardEffectType =
  "ADD_MONEY" | "PAY_MONEY" | "MOVE_STEPS" | "MOVE_TO_TYPE" | "GO_TO_JAIL";

export interface GameCard {
  id: string;
  deck: CardDeckType;
  title: string;
  description: string;
  effect: CardEffectType;
  value?: number;
  targetTileType?: string;
}

// =====================================================================
// Kiểu dữ liệu cho bộ engine cũ (_components/game/boardData.ts & gameEngine.ts)
// Bàn cờ 40 ô kiểu cổ điển, tách biệt với mô hình đang dùng ở GameContext.
// =====================================================================

export type BoardTileType =
  | "GO"
  | "PROPERTY"
  | "RAILROAD"
  | "JAIL"
  | "FREE_PARKING"
  | "GO_TO_JAIL"
  | "CHANCE"
  | "COMMUNITY_CHEST"
  | "TAX";

export interface BoardTile {
  id: number;
  name: string;
  type: BoardTileType;
  price?: number;
  /** Tiền thuê theo số nhà: [0 nhà, 1 nhà, ..., khách sạn] */
  rent?: number[];
  housePrice?: number;
  houses?: number;
  hasHotel?: boolean;
  group?: string;
  color: string;
  position: [number, number, number];
  ownerId?: string;
}

export interface EnginePlayer {
  id: string;
  name: string;
  type: PawnType;
  color: string;
  money: number;
  /** Chỉ số ô đang đứng (0 - 39) */
  position: number;
  /** id các ô đang sở hữu */
  properties: number[];
  isBankrupt: boolean;
  inJail: boolean;
  jailTurns: number;
}

export interface GameState {
  status: "WAITING" | "PLAYING" | "FINISHED";
  players: EnginePlayer[];
  currentPlayerIndex: number;
  dice: { first: number; second: number; total: number };
  consecutiveDoubles: number;
  board: BoardTile[];
  turn: number;
  logs: string[];
  winnerId?: string;
}
