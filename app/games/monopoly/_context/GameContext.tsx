/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  INITIAL_PLAYERS,
  PawnState,
  Player,
  TileData,
} from "@/types/game.types";
import {
  GameActionMessage,
  GameActionType,
  RoomPlayer,
  RoomSettings,
  TURN_SECONDS,
} from "@/types/monopoly-room";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { toast } from "sonner";
import { generateInitialBoard } from "../_components/boardConfig";
import { ECONOMY_BASE, Economy, makeEconomy, roundMoney } from "./economy";
import {
  CHANCE_CARDS,
  scaleCards,
  FATE_CARDS,
  GameCard,
  shuffleCards,
} from "../_components/constants";
import { getTileSellValue } from "../_components/SellPropertyModal";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GameContextType {
  /** Các mức tiền của ván (tỉ lệ với tiền khởi điểm) */
  economy: Economy;
  board: TileData[];
  players: Player[];
  activePlayerIndex: number;
  currPlayer: Player;
  currentTile: TileData;
  pawnStates: Record<number, PawnState>;
  showBuyModal: boolean;
  setShowBuyModal: (show: boolean) => void;
  showFestivalModal: boolean;
  setShowFestivalModal: (show: boolean) => void;
  showJailModal: boolean;
  setShowJailModal: (show: boolean) => void;
  drawnCard: GameCard | null;
  setDrawnCard: (card: GameCard | null) => void;
  taxNotification: { message: string; amount?: number } | null;
  setTaxNotification: React.Dispatch<
    React.SetStateAction<{ message: string; amount?: number } | null>
  >;
  calculateTileRent: (tile: TileData) => number;
  handleTravelToTile: (targetTileIdx: number) => Promise<void>;
  handleRollComplete: (
    total: number,
    d1?: number,
    d2?: number,
  ) => Promise<void>;
  handleBuyProperty: (
    targetLevel: "land" | "house1" | "house2" | "house3" | "villa",
  ) => void;
  handleFestivalSelect: (tileId: number) => void;
  handleFestivalSkip: () => void;
  handlePayJailBail: () => void;
  finishActionOrContinue: (
    playerId: number,
    isDoubleThisTurn?: boolean,
    forceEndTurn?: boolean,
    latestPlayers?: Player[],
  ) => void;
  showSellModal: boolean;
  isSettlingTurn: boolean;
  bankruptNotice: BankruptNotice | null;
  rentNotice: RentNotice | null;
  winner: Player | null;
  handleSellTile: (tileId: number) => void;
  handleAutoSellAll: () => void;
  handleSkipBuy: () => void;
  // ---- Online ----
  isOnline: boolean;
  isHost: boolean;
  /** Người đang xem có phải người tới lượt không */
  isMyTurn: boolean;
  myPlayer: Player | null;
  lastRoll: LastRoll | null;
  turnPhase: TurnPhase;
  rpsGame: RpsGame | null;
  xocGame: XocGame | null;
  handleXocGuess: (guess: XocGuess | "skip") => void;
  /** Lựa chọn của mình trong ván Oẳn tù tì hiện tại (chỉ máy mình biết) */
  myRpsChoice: RpsChoice | null;
  handleRpsChoose: (choice: RpsChoice) => void;
}

/** Thông báo trả tiền thuê (mọi người đều thấy, tự ẩn sau RENT_NOTICE_MS) */
export interface RentNotice {
  seq: number;
  payerId: number;
  ownerId: number;
  amount: number;
  tileName: string;
  tileColor?: string;
  /** Chủ sở hữu đủ bộ màu -> tiền thuê x2 */
  monopoly: boolean;
  /** Ô đang tổ chức Lễ hội -> tiền thuê x2 */
  festival: boolean;
}
export const RENT_NOTICE_MS = 3200;

export interface BankruptNotice {
  player: Player;
  debt: number;
  remainingPlayers: number;
  reason?: "debt" | "left";
}

export interface LastRoll {
  playerId: number;
  d1: number;
  d2: number;
  seq: number;
}

export type TurnPhase =
  "none" | "roll" | "buy" | "festival" | "sell" | "travel";

// ===== Mini game Oẳn tù tì =====
export type RpsChoice = "rock" | "paper" | "scissors";
export const RPS_CHOOSE_MS = 15000;
export const RPS_REVEAL_MS = 5000;

export interface RpsResult {
  opponentId: number;
  /** Theo góc nhìn người đi vào ô */
  outcome: "win" | "lose" | "draw";
  /** Số tiền thực tế được chuyển (>= 0) */
  amount: number;
}

/** Ván Oẳn tù tì (đồng bộ cho mọi người, KHÔNG chứa lựa chọn khi đang chọn) */
export interface RpsGame {
  id: number;
  challengerId: number;
  /** Người đi vào ô đứng đầu, sau đó là các đối thủ còn trong trận */
  participants: number[];
  /** Những người đã chọn (chưa lộ lựa chọn) */
  chosen: number[];
  deadline: number;
  phase: "choosing" | "reveal";
  /** Chỉ có khi đã lật bài */
  choices?: Record<number, RpsChoice>;
  results?: RpsResult[];
  isDouble: boolean;
}

// ===== Mini game Xóc đĩa (chẵn / lẻ) =====
export type XocGuess = "even" | "odd";
export const XOC_GUESS_MS = 15000;
export const XOC_SHAKE_MS = 2600;
export const XOC_REVEAL_MS = 5500;

export interface XocResult {
  playerId: number;
  guess: XocGuess | null;
  /** skip = không đoán / bỏ qua */
  outcome: "win" | "lose" | "skip";
  amount: number;
}

/** Ván xóc đĩa (công khai: ai đoán gì mọi người đều thấy) */
export interface XocGame {
  id: number;
  starterId: number;
  participants: number[];
  guesses: Record<number, XocGuess | "skip">;
  deadline: number;
  phase: "guessing" | "shaking" | "reveal";
  /** 4 đồng: true = mặt trắng (chỉ có khi mở bát) */
  coins?: boolean[];
  results?: XocResult[];
  isDouble: boolean;
}

const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];
const isRpsChoice = (v: unknown): v is RpsChoice =>
  v === "rock" || v === "paper" || v === "scissors";
/** 1 = a thắng, -1 = a thua, 0 = hoà */
export const rpsCompare = (a: RpsChoice, b: RpsChoice) =>
  a === b
    ? 0
    : (a === "rock" && b === "scissors") ||
        (a === "paper" && b === "rock") ||
        (a === "scissors" && b === "paper")
      ? 1
      : -1;

export const BANKRUPT_NOTICE_MS = 4000;
/** Thời gian nhảy qua mỗi ô khi đi theo xúc xắc */
const PAWN_STEP_MS = 200;
/** Chờ cú nhảy cuối đáp xong rồi mới xử lý ô */
const PAWN_LAND_MS = 380;
/** Du lịch: bay nhanh hơn đi bộ (có thể vượt nhiều ô) */
/** Đi Du lịch: thời gian lên máy bay & thời gian bay (khớp FLIGHT_S trong Board3D) */
const FLIGHT_BOARD_MS = 450;
const FLIGHT_MS = 1900;

interface PendingFinish {
  playerId: number;
  isDouble: boolean;
  forceEndTurn: boolean;
}

type TaxNotice = { message: string; amount?: number } | null;

/** Bản cập nhật host gửi đi: chỉ chứa các trường đã thay đổi */
type SnapshotPatch = Partial<GameSnapshot> & { v: 1 };

/** Toàn bộ trạng thái game được host đồng bộ cho mọi người */
export interface GameSnapshot {
  v: 1;
  board: TileData[];
  players: Player[];
  activePlayerIndex: number;
  pawnStates: Record<number, PawnState>;
  showBuyModal: boolean;
  showFestivalModal: boolean;
  showJailModal: boolean;
  showSellModal: boolean;
  lastRollWasDouble: boolean;
  chanceDeck: GameCard[];
  fateDeck: GameCard[];
  chanceIndex: number;
  fateIndex: number;
  drawnCard: GameCard | null;
  cardSeq: number;
  taxNotification: TaxNotice;
  pendingFinish: PendingFinish | null;
  winnerId: number | null;
  bankruptNotice: BankruptNotice | null;
  rentNotice: RentNotice | null;
  lastRoll: LastRoll | null;
  rpsGame: RpsGame | null;
  xocGame: XocGame | null;
  /** Số thứ tự bản cập nhật (để phát hiện bị lỡ bản cập nhật) */
  rev?: number;
  /** true = bản đầy đủ (không phải chỉ phần thay đổi) */
  full?: boolean;
}

export interface OnlineConfig {
  isHost: boolean;
  myUserId: string | null;
  roomPlayers: RoomPlayer[];
  settings: RoomSettings;
  initialSnapshot: GameSnapshot | null;
  onFinish: () => void;
}

/** Tạo danh sách người chơi từ những người trong phòng (sắp theo ghế) */
export const buildOnlinePlayers = (
  roomPlayers: RoomPlayer[],
  startingMoney: number,
): Player[] =>
  roomPlayers
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((rp, idx) => ({
      ...(INITIAL_PLAYERS[rp.seat] ?? INITIAL_PLAYERS[idx]),
      id: idx,
      name: rp.name,
      userId: rp.userId,
      avatar: rp.avatar,
      money: startingMoney,
    }));

/** Thời điểm hiện tại (tách ra hàm riêng để dùng trong các hàm xử lý sự kiện) */
const nowMs = () => Date.now();
const randomDie = () => Math.floor(Math.random() * 6) + 1;
const pickRandom = <T,>(list: T[]): T | undefined =>
  list[Math.floor(Math.random() * list.length)];
const isDie = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 6;

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({
  children,
  online,
}: {
  children: React.ReactNode;
  online?: OnlineConfig;
}) {
  const snap = online?.initialSnapshot ?? null;
  const isOnline = !!online;
  const isHost = online ? online.isHost : true;
  // Mọi mức tiền tỉ lệ với tiền khởi điểm của phòng (xem economy.ts)
  const startingMoney = online?.settings.startingMoney;
  const economy = useMemo(() => makeEconomy(startingMoney), [startingMoney]);

  const [board, setBoard] = useState<TileData[]>(
    () => snap?.board ?? generateInitialBoard(economy.scale),
  );
  // Ô Nhà Tù lấy theo dữ liệu bàn cờ (32 ô: ô 8) — không viết cứng số ô
  const jailIndex = useMemo(
    () => Math.max(0, board.findIndex((t) => t.type === "JAIL")),
    [board],
  );
  const [players, setPlayers] = useState<Player[]>(
    () =>
      snap?.players ??
      (online
        ? buildOnlinePlayers(online.roomPlayers, online.settings.startingMoney)
        : INITIAL_PLAYERS),
  );
  const [activePlayerIndex, setActivePlayerIndex] = useState(
    snap?.activePlayerIndex ?? 0,
  );
  const [pawnStates, setPawnStates] = useState<Record<number, PawnState>>(
    () => snap?.pawnStates ?? { 0: "idle", 1: "idle", 2: "idle", 3: "idle" },
  );
  const [showBuyModal, setShowBuyModal] = useState(snap?.showBuyModal ?? false);
  const [showFestivalModal, setShowFestivalModal] = useState(
    snap?.showFestivalModal ?? false,
  );
  const [showJailModal, setShowJailModal] = useState(
    snap?.showJailModal ?? false,
  );
  const [lastRollWasDouble, setLastRollWasDouble] = useState(
    snap?.lastRollWasDouble ?? false,
  );
  const [chanceDeck, setChanceDeck] = useState(
    () =>
      snap?.chanceDeck ?? shuffleCards(scaleCards(CHANCE_CARDS, economy.scale)),
  );
  const [fateDeck, setFateDeck] = useState(
    () => snap?.fateDeck ?? shuffleCards(scaleCards(FATE_CARDS, economy.scale)),
  );

  const [chanceIndex, setChanceIndex] = useState(snap?.chanceIndex ?? 0);
  const [fateIndex, setFateIndex] = useState(snap?.fateIndex ?? 0);
  const [drawnCard, setDrawnCard] = useState<GameCard | null>(null);
  const [cardSeq, setCardSeq] = useState(snap?.cardSeq ?? 0);
  const [taxNotification, setTaxNotification] = useState<TaxNotice>(
    snap?.taxNotification ?? null,
  );

  // Việc kết thúc lượt được hoãn lại cho tới khi người chơi hết nợ (tiền >= 0)
  const [pendingFinish, setPendingFinish] = useState<PendingFinish | null>(
    snap?.pendingFinish ?? null,
  );
  const [showSellModal, setShowSellModal] = useState(
    snap?.showSellModal ?? false,
  );
  const [winnerId, setWinnerId] = useState<number | null>(
    snap?.winnerId ?? null,
  );
  const [rentNotice, setRentNotice] = useState<RentNotice | null>(
    snap?.rentNotice ?? null,
  );
  const [bankruptNotice, setBankruptNotice] = useState<BankruptNotice | null>(
    snap?.bankruptNotice ?? null,
  );
  const [lastRoll, setLastRoll] = useState<LastRoll | null>(
    snap?.lastRoll ?? null,
  );
  // Ván Oẳn tù tì đang diễn ra (đồng bộ)
  const [rpsGame, setRpsGame] = useState<RpsGame | null>(snap?.rpsGame ?? null);
  // Ván xóc đĩa đang diễn ra (đồng bộ)
  const [xocGame, setXocGame] = useState<XocGame | null>(snap?.xocGame ?? null);
  // Lựa chọn bí mật: chỉ host giữ, KHÔNG gửi cho ai cho tới khi lật bài
  const rpsChoicesRef = useRef<Record<number, RpsChoice>>({});
  // Lựa chọn của chính mình (để hiển thị trên máy mình)
  const [myRpsPick, setMyRpsPick] = useState<{
    id: number;
    choice: RpsChoice;
  } | null>(null);

  const currPlayer = players[activePlayerIndex] ?? players[0];
  const currentTile = board[currPlayer.tileIndex];

  const myPlayer = online
    ? (players.find((p) => p.userId === online.myUserId) ?? null)
    : null;
  const isMyTurn = !online || currPlayer.userId === online.myUserId;

  useEffect(() => {
    if (!isHost) return;
    if (
      currPlayer.inJail &&
      currPlayer.jailTurns > 0 &&
      !currPlayer.isBankrupt
    ) {
      setShowJailModal(true);
    } else {
      setShowJailModal(false);
    }
  }, [
    isHost,
    currPlayer.id,
    currPlayer.inJail,
    currPlayer.jailTurns,
    currPlayer.isBankrupt,
  ]);

  const calculateTileRent = (tile: TileData) => {
    if (tile.ownerId === undefined) return 0;
    if (tile.type === "STATION") {
      const ownedStations = board.filter(
        (t) => t.type === "STATION" && t.ownerId === tile.ownerId,
      ).length;
      return economy.stationRents[ownedStations] ?? 0;
    }

    // Tiền thuê LUÔN lớn hơn số tiền đã bỏ ra để mua mức hiện tại:
    // tiền thuê = giá trị đầu tư (đất / đất + n nhà / khách sạn) x rentRate (> 1).
    // Tính ở mức chuẩn $10.000 rồi nhân hệ số -> ván $20.000 gấp đôi chính xác.
    const invested = tile.hasVilla
      ? tile.house3Price + tile.villaPrice
      : ([tile.landPrice, tile.house1Price, tile.house2Price, tile.house3Price][
          tile.houses
        ] ?? tile.landPrice);
    let baseRent = roundMoney(
      roundMoney((invested / economy.scale) * ECONOMY_BASE.rentRate) *
        economy.scale,
    );

    if (tile.groupCode) {
      const sameGroupTiles = board.filter(
        (t) => t.groupCode === tile.groupCode,
      );
      const isMonopoly = sameGroupTiles.every(
        (t) => t.ownerId === tile.ownerId,
      );
      if (isMonopoly) baseRent *= 2;
    }

    if (tile.isFestival) baseRent *= 2;
    return baseRent;
  };

  const nextTurn = (latestPlayers?: Player[]) => {
    setShowBuyModal(false);
    setShowFestivalModal(false);
    setShowJailModal(false);
    setLastRollWasDouble(false);

    const playersList = latestPlayers || players;
    const currentPlayerId = currPlayer.id;

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === currentPlayerId ? { ...p, doublesCount: 0 } : p,
      ),
    );

    let nextIdx = (activePlayerIndex + 1) % playersList.length;

    let guard = 0;
    while (playersList[nextIdx].isBankrupt && guard < playersList.length) {
      nextIdx = (nextIdx + 1) % playersList.length;
      guard++;
    }

    setActivePlayerIndex(nextIdx);
  };

  // Ghi nhận yêu cầu kết thúc hành động. Việc kết thúc thực sự diễn ra trong
  // useEffect bên dưới (sau khi state tiền đã cập nhật) để kiểm tra nợ trước.
  const finishActionOrContinue = (
    playerId: number,
    isDoubleThisTurn?: boolean,
    forceEndTurn = false,
    latestPlayers?: Player[],
  ) => {
    if (latestPlayers) setPlayers(latestPlayers);
    setPendingFinish({
      playerId,
      isDouble: isDoubleThisTurn ?? lastRollWasDouble,
      forceEndTurn,
    });
  };

  const completeFinish = (
    playerId: number,
    isDouble: boolean,
    forceEndTurn: boolean,
    playersList: Player[],
  ) => {
    const player = playersList.find((p) => p.id === playerId);

    if (forceEndTurn || (player && player.inJail)) {
      setLastRollWasDouble(false);
      nextTurn(playersList);
      return;
    }

    if (player && isDouble) {
      setLastRollWasDouble(false);
    } else {
      setLastRollWasDouble(false);
      nextTurn(playersList);
    }
  };

  const releaseTile = (t: TileData): TileData => ({
    ...t,
    ownerId: undefined,
    ownerColor: undefined,
    houses: 0,
    hasVilla: false,
    isFestival: false,
  });

  const declareBankrupt = (playerId: number) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    const updatedPlayers = players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            money: 0,
            isBankrupt: true,
            inJail: false,
            jailTurns: 0,
            canTeleport: false,
            doublesCount: 0,
          }
        : p,
    );
    setPlayers(updatedPlayers);
    setBoard((prev) =>
      prev.map((t) => (t.ownerId === playerId ? releaseTile(t) : t)),
    );
    setShowSellModal(false);
    setPendingFinish(null);

    const alive = updatedPlayers.filter((p) => !p.isBankrupt);

    // Thông báo phá sản cho tất cả người chơi, sau đó mới chuyển lượt / công bố người thắng
    setBankruptNotice({
      player,
      debt: Math.abs(Math.min(player.money, 0)),
      remainingPlayers: alive.length,
    });

    setTimeout(() => {
      setBankruptNotice(null);
      if (alive.length <= 1) {
        if (alive[0]) {
          setWinnerId(alive[0].id);
        }
        return;
      }
      nextTurn(updatedPlayers);
    }, BANKRUPT_NOTICE_MS);
  };

  // Kiểm tra nợ trước khi kết thúc hành động / chuyển lượt
  useEffect(() => {
    if (!isHost || !pendingFinish) return;
    const { playerId, isDouble, forceEndTurn } = pendingFinish;
    const player = players.find((p) => p.id === playerId);
    if (!player) {
      setPendingFinish(null);
      return;
    }

    if (player.money < 0 && !player.isBankrupt) {
      const hasTiles = board.some((t) => t.ownerId === playerId);
      if (hasTiles) {
        // Còn nhà -> bắt buộc bán nhà để trả nợ
        setShowSellModal(true);
      } else {
        // Hết nhà mà vẫn âm tiền -> phá sản
        declareBankrupt(playerId);
      }
      return;
    }

    setShowSellModal(false);
    setPendingFinish(null);
    completeFinish(playerId, isDouble, forceEndTurn, players);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, pendingFinish, players, board]);

  const handleSellTile = (tileId: number) => {
    if (!pendingFinish) return;
    const playerId = pendingFinish.playerId;
    const tile = board.find((t) => t.id === tileId);
    if (!tile || tile.ownerId !== playerId) return;

    const value = getTileSellValue(tile);
    setBoard((prev) => prev.map((t) => (t.id === tileId ? releaseTile(t) : t)));
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, money: p.money + value } : p,
      ),
    );
  };

  const handleAutoSellAll = () => {
    if (!pendingFinish) return;
    const playerId = pendingFinish.playerId;
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    // Bán lần lượt từ ô rẻ nhất cho tới khi hết nợ (hoặc hết nhà)
    const owned = board
      .filter((t) => t.ownerId === playerId)
      .sort((a, b) => getTileSellValue(a) - getTileSellValue(b));

    let money = player.money;
    const soldIds = new Set<number>();
    for (const t of owned) {
      if (money >= 0) break;
      const value = getTileSellValue(t);
      money += value;
      soldIds.add(t.id);
    }

    setBoard((prev) =>
      prev.map((t) => (soldIds.has(t.id) ? releaseTile(t) : t)),
    );
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, money } : p)),
    );
  };

  const movePlayerSteps = async (
    playerId: number,
    steps: number,
    isDouble = false,
  ) => {
    let currentPos = players.find((p) => p.id === playerId)?.tileIndex ?? 0;
    setPawnStates((prev) => ({ ...prev, [playerId]: "moving" }));

    for (let i = 1; i <= steps; i++) {
      // Mỗi ô 1 cú nhảy (hiệu ứng ở Board3D) -> chậm vừa phải để kịp nhìn
      await sleep(PAWN_STEP_MS);
      currentPos = (currentPos + 1) % board.length;

      if (currentPos === 0) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, money: p.money + economy.goSalary } : p,
          ),
        );
      }

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, tileIndex: currentPos } : p,
        ),
      );
    }

    await sleep(PAWN_LAND_MS);
    setPawnStates((prev) => ({ ...prev, [playerId]: "idle" }));
    resolveTileAction(playerId, currentPos, isDouble);
  };

  const drawGameCard = async (
    playerId: number,
    deckType: "CHANCE" | "FATE",
    isDouble = false,
  ) => {
    const deck = deckType === "CHANCE" ? chanceDeck : fateDeck;
    const index = deckType === "CHANCE" ? chanceIndex : fateIndex;
    const card = deck[index];

    if (!card) return;

    if (deckType === "CHANCE") {
      setChanceIndex((prev) => (prev + 1 >= deck.length ? 0 : prev + 1));
    } else {
      setFateIndex((prev) => (prev + 1 >= deck.length ? 0 : prev + 1));
    }

    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    setDrawnCard(card);
    setCardSeq((s) => s + 1);

    const finish = () => finishActionOrContinue(playerId, isDouble);

    switch (card.effect) {
      case "ADD_MONEY": {
        const amount = card.value ?? 0;
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, money: p.money + amount } : p,
          ),
        );
        finish();
        return;
      }
      case "PAY_MONEY": {
        const amount = card.value ?? 0;
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, money: p.money - amount } : p,
          ),
        );
        finish();
        return;
      }
      case "PAY_PER_HOUSE": {
        const houseCount = board
          .filter((tile) => tile.ownerId === playerId)
          .reduce((sum, tile) => sum + tile.houses, 0);
        const amount = houseCount * (card.value ?? 0);
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, money: p.money - amount } : p,
          ),
        );
        finish();
        return;
      }
      case "PAY_PER_PROPERTY": {
        const propertyCount = board.filter(
          (tile) =>
            tile.ownerId === playerId &&
            (tile.type === "PROPERTY" || tile.type === "STATION"),
        ).length;
        const amount = propertyCount * (card.value ?? 0);
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, money: p.money - amount } : p,
          ),
        );
        finish();
        return;
      }
      case "MOVE_TO_TRAVEL": {
        const travelTiles = board.filter((tile) => tile.type === "TRAVEL");
        if (travelTiles.length === 0) {
          finish();
          return;
        }
        const target = travelTiles
          .map((tile) => ({
            tile,
            steps: (tile.id - player.tileIndex + board.length) % board.length,
          }))
          .filter((item) => item.steps > 0)
          .sort((a, b) => a.steps - b.steps)[0];

        if (!target) {
          finish();
          return;
        }
        await movePlayerSteps(playerId, target.steps, isDouble);
        return;
      }
      case "GO_TO_JAIL": {
        const updatedPlayers = players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                tileIndex: jailIndex,
                inJail: true,
                jailTurns: 2,
                doublesCount: 0,
                canTeleport: false,
              }
            : p,
        );
        setPlayers(updatedPlayers);
        setShowJailModal(true);
        finishActionOrContinue(playerId, false, true, updatedPlayers);
        return;
      }
    }
  };

  const resolveTileAction = (
    playerId: number,
    tileIdx: number,
    isDouble = false,
  ) => {
    // Hàm này chạy sau khi quân cờ đi xong (sau các lần await), nên `players` trong
    // closure đã cũ (chưa có tiền thưởng qua ô Bắt đầu...). Dùng bản mới nhất.
    const players = latestRef.current.players;
    const tile = board[tileIdx];
    const player = players.find((p) => p.id === playerId)!;

    if (tile.type === "JAIL") {
      const updatedPlayers = players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              tileIndex: jailIndex,
              inJail: true,
              jailTurns: 2,
              doublesCount: 0,
              canTeleport: false,
            }
          : p,
      );
      setPlayers(updatedPlayers);
      finishActionOrContinue(playerId, false, true, updatedPlayers);
      return;
    }

    if (tile.type === "PROPERTY" || tile.type === "STATION") {
      // Ô chưa có chủ
      if (tile.ownerId === undefined) {
        setShowBuyModal(true);
        return;
      }

      // Ô thuộc sở hữu của chính mình
      if (tile.ownerId === playerId) {
        if (tile.type === "STATION") {
          finishActionOrContinue(playerId, isDouble);
          return;
        }
        if (!tile.hasVilla) {
          setShowBuyModal(true);
        } else {
          finishActionOrContinue(playerId, isDouble);
        }
        return;
      }

      // ====================================================
      // BƯỚC 1: XỬ LÝ KHI VÀO Ô CỦA NGƯỜI CHƠI KHÁC (NGƯỜI CHƠI B)
      // ====================================================
      const rentAmount = calculateTileRent(tile);

      // Tính số tiền còn lại của A sau khi trừ tiền thuê
      const updatedPlayerAMoney = player.money - rentAmount;

      // Thông báo trả tiền thuê cho cả phòng
      const isMonopolyGroup =
        !!tile.groupCode &&
        board
          .filter((t) => t.groupCode === tile.groupCode)
          .every((t) => t.ownerId === tile.ownerId);
      const rentSeq = nowMs();
      setRentNotice({
        seq: rentSeq,
        payerId: playerId,
        ownerId: tile.ownerId,
        amount: rentAmount,
        tileName: tile.name,
        tileColor: tile.color,
        monopoly: tile.type !== "STATION" && isMonopolyGroup,
        festival: !!tile.isFestival,
      });
      setTimeout(
        () => setRentNotice((prev) => (prev?.seq === rentSeq ? null : prev)),
        RENT_NOTICE_MS,
      );

      // Cập nhật trừ tiền A và cộng tiền thuê cho B ngay lập tức
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === playerId) return { ...p, money: updatedPlayerAMoney };
          if (p.id === tile.ownerId)
            return { ...p, money: p.money + rentAmount };
          return p;
        }),
      );

      // Nếu là biệt thự hoặc Bến xe thì không được mua lại
      if (tile.hasVilla || tile.type === "STATION") {
        finishActionOrContinue(playerId, isDouble);
        return;
      }

      // ====================================================
      // BƯỚC 2: KIỂM TRA ĐỦ TIỀN MUA LẠI BẤT ĐỘNG SẢN CỦA B HAY KHÔNG
      // (Tính theo đúng giá trị B đã mua ban đầu)
      // ====================================================
      let buyoutPrice = tile.landPrice;
      if (tile.houses === 1) buyoutPrice = tile.house1Price;
      else if (tile.houses === 2) buyoutPrice = tile.house2Price;
      else if (tile.houses === 3) buyoutPrice = tile.house3Price;

      // So sánh tiền còn lại của A với giá mua lại
      if (updatedPlayerAMoney >= buyoutPrice) {
        setShowBuyModal(true); // Đủ tiền -> Hiện modal mua lại
      } else {
        finishActionOrContinue(playerId, isDouble);
      }
      return;
    }

    if (tile.type === "TAX") {
      const playerProperties = board.filter(
        (t) =>
          t.ownerId === playerId &&
          (t.type === "PROPERTY" || t.type === "STATION"),
      );

      if (playerProperties.length === 0) {
        const msg = "Bạn chưa có nhà để đóng thuế";
        setTaxNotification({ message: msg });
        setTimeout(() => {
          setTaxNotification(null);
          finishActionOrContinue(playerId, isDouble);
        }, 2000);
      } else {
        const assetVal = board.reduce(
          (sum, t) => (t.ownerId === playerId ? sum + t.landPrice : sum),
          0,
        );
        const taxFee = Math.round(assetVal * 0.1);
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, money: p.money - taxFee } : p,
          ),
        );
        const msg = `Bạn đã nộp $${taxFee} tiền thuế (10% giá trị bất động sản)`;
        setTaxNotification({ message: msg, amount: taxFee });
        setTimeout(() => {
          setTaxNotification(null);
          finishActionOrContinue(playerId, isDouble);
        }, 3000);
      }
      return;
    }

    if (tile.type === "FESTIVAL") {
      const owned = board.filter(
        (t) => t.ownerId === playerId && t.type === "PROPERTY",
      );
      if (owned.length > 0) {
        setShowFestivalModal(true);
      } else {
        finishActionOrContinue(playerId, isDouble);
      }
      return;
    }

    if (tile.type === "TRAVEL") {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, tileIndex: tileIdx, canTeleport: true, doublesCount: 0 }
            : p,
        ),
      );
      nextTurn(players);
      return;
    }

    if (tile.type === "XOCDIA") {
      startXoc(playerId, isDouble);
      return;
    }

    if (tile.type === "MINIGAME") {
      startRps(playerId, isDouble);
      return;
    }

    if (tile.type === "CHANCE") {
      void drawGameCard(playerId, "CHANCE", isDouble);
      return;
    }

    if (tile.type === "FATE") {
      void drawGameCard(playerId, "FATE", isDouble);
      return;
    }

    finishActionOrContinue(playerId, isDouble);
  };

  const handleTravelToTile = async (targetTileIdx: number) => {
    const playerId = currPlayer.id;
    const player = players.find((p) => p.id === playerId);

    if (!player || !player.canTeleport || player.inJail) return;
    if (targetTileIdx < 0 || targetTileIdx >= board.length) return;
    if (targetTileIdx === player.tileIndex) return;

    const targetTile = board[targetTileIdx];
    if (!targetTile) return;

    // Bay thẳng tới ô đích (không đi từng ô). Bay vòng qua ô Bắt đầu
    // (kể cả khi bay vào Nhà tù) vẫn nhận tiền qua ô Bắt đầu.
    const passesGo = targetTileIdx < player.tileIndex;

    // Lên máy bay
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, canTeleport: false } : p)),
    );
    setPawnStates((prev) => ({ ...prev, [playerId]: "flying" }));
    await sleep(FLIGHT_BOARD_MS);

    // Cất cánh: đổi ô đích -> Board3D cho máy bay bay theo đường vòng cung
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId
          ? {
              ...p,
              tileIndex: targetTileIdx,
              money: passesGo ? p.money + economy.goSalary : p.money,
              canTeleport: false,
              doublesCount: 0,
            }
          : p,
      ),
    );
    await sleep(FLIGHT_MS);

    // Hạ cánh: nhân vật bước ra khỏi máy bay rồi mới xử lý ô đích
    setPawnStates((prev) => ({ ...prev, [playerId]: "idle" }));
    await sleep(450);
    resolveTileAction(playerId, targetTileIdx, false);
  };

  const handleRollComplete = async (
    total: number,
    d1?: number,
    d2?: number,
  ) => {
    const isDouble = d1 !== undefined && d2 !== undefined && d1 === d2;

    if (d1 !== undefined && d2 !== undefined) {
      setLastRoll((prev) => ({
        playerId: currPlayer.id,
        d1,
        d2,
        seq: (prev?.seq ?? 0) + 1,
      }));
    }

    if (currPlayer.inJail && currPlayer.jailTurns > 0) {
      if (isDouble) {
        const updatedPlayers = players.map((p) =>
          p.id === currPlayer.id
            ? { ...p, inJail: false, jailTurns: 0, doublesCount: 0 }
            : p,
        );
        setPlayers(updatedPlayers);
        setShowJailModal(false);
        await movePlayerSteps(currPlayer.id, total, false);
        return;
      }

      const nextJailTurns = Math.max(currPlayer.jailTurns - 1, 0);
      const released = nextJailTurns === 0;

      const updatedPlayers = players.map((p) =>
        p.id === currPlayer.id
          ? {
              ...p,
              jailTurns: nextJailTurns,
              inJail: !released,
              doublesCount: 0,
            }
          : p,
      );

      setPlayers(updatedPlayers);
      setShowJailModal(false);

      finishActionOrContinue(currPlayer.id, false, true, updatedPlayers);
      return;
    }

    setLastRollWasDouble(isDouble);

    if (isDouble) {
      const newDoublesCount = currPlayer.doublesCount + 1;
      if (newDoublesCount === 3) {
        const updatedPlayers = players.map((p) =>
          p.id === currPlayer.id
            ? {
                ...p,
                tileIndex: jailIndex,
                inJail: true,
                jailTurns: 2,
                doublesCount: 0,
              }
            : p,
        );
        setPlayers(updatedPlayers);
        finishActionOrContinue(currPlayer.id, false, true, updatedPlayers);
        return;
      }

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === currPlayer.id ? { ...p, doublesCount: newDoublesCount } : p,
        ),
      );
      await movePlayerSteps(currPlayer.id, total, true);
    } else {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === currPlayer.id ? { ...p, doublesCount: 0 } : p,
        ),
      );
      await movePlayerSteps(currPlayer.id, total, false);
    }
  };

  /** Trả về false nếu giao dịch không thực hiện được (vd. không đủ tiền) */
  const handleBuyProperty = (
    targetLevel: "land" | "house1" | "house2" | "house3" | "villa",
  ): boolean => {
    let cost = 0;
    let moneyToPreviousOwner = 0;
    let newHouses = currentTile.houses;
    let isVilla = false;
    const previousOwnerId = currentTile.ownerId;
    const isOpponentProperty =
      previousOwnerId !== undefined && previousOwnerId !== currPlayer.id;

    if (currentTile.type === "STATION") {
      cost = currentTile.landPrice;
    } else if (previousOwnerId === undefined) {
      // 1. MUA ĐẤT TRỐNG CỦA NGÂN HÀNG
      if (targetLevel === "land") cost = currentTile.landPrice;
      else if (targetLevel === "house1") {
        cost = currentTile.house1Price;
        newHouses = 1;
      } else if (targetLevel === "house2") {
        cost = currentTile.house2Price;
        newHouses = 2;
      } else if (targetLevel === "house3") {
        cost = currentTile.house3Price;
        newHouses = 3;
      }
    } else if (!isOpponentProperty) {
      // 2. NÂNG CẤP NHÀ CỦA CHÍNH MÌNH
      if (targetLevel === "house1") {
        cost = currentTile.house1Price - currentTile.landPrice;
        newHouses = 1;
      } else if (targetLevel === "house2") {
        cost = currentTile.house2Price - currentTile.house1Price;
        newHouses = 2;
      } else if (targetLevel === "house3") {
        cost = currentTile.house3Price - currentTile.house2Price;
        newHouses = 3;
      } else if (targetLevel === "villa") {
        cost = currentTile.villaPrice;
        isVilla = true;
      }
    } else {
      // 3. MUA LẠI BẤT ĐỘNG SẢN CỦA ĐỐI THỦ (B)
      let propertyBaseCost = currentTile.landPrice;
      if (currentTile.houses === 1) propertyBaseCost = currentTile.house1Price;
      else if (currentTile.houses === 2)
        propertyBaseCost = currentTile.house2Price;
      else if (currentTile.houses === 3)
        propertyBaseCost = currentTile.house3Price;

      moneyToPreviousOwner = propertyBaseCost;

      // Giá trọn gói theo số nhà (đất + n nhà)
      const levelPrice = [
        currentTile.landPrice,
        currentTile.house1Price,
        currentTile.house2Price,
        currentTile.house3Price,
      ];
      const wantHouses =
        targetLevel === "house1"
          ? 1
          : targetLevel === "house2"
            ? 2
            : targetLevel === "house3"
              ? 3
              : 0;

      if (targetLevel === "villa") {
        // Khách sạn chỉ xây được trên ô đã có đủ 3 nhà
        if (currentTile.houses !== 3) return false;
        cost = propertyBaseCost + currentTile.villaPrice;
        isVilla = true;
        newHouses = 0;
      } else if (wantHouses > currentTile.houses) {
        // Mua lại rồi xây thêm nhà ngay: trả đối thủ giá hiện tại
        // + trả ngân hàng phần chênh lệch để lên số nhà mong muốn
        cost = propertyBaseCost + (levelPrice[wantHouses] - propertyBaseCost);
        newHouses = wantHouses;
      } else {
        cost = propertyBaseCost;
      }
    }

    // Kiểm tra số dư người mua (A)
    if (currPlayer.money < cost) {
      return false;
    }

    // Cập nhật tài chính
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === currPlayer.id) return { ...p, money: p.money - cost };
        if (isOpponentProperty && p.id === previousOwnerId) {
          return { ...p, money: p.money + moneyToPreviousOwner };
        }
        return p;
      }),
    );

    // Cập nhật bàn cờ
    setBoard((prev) =>
      prev.map((t) =>
        t.id === currentTile.id
          ? {
              ...t,
              ownerId: currPlayer.id,
              ownerColor: currPlayer.color,
              houses: isVilla ? 0 : newHouses,
              hasVilla: isVilla,
              // Giữ nguyên Lễ Hội của ô cả khi đối thủ mua lại (lễ hội gắn với ô đất, không gắn với chủ)
              isFestival: t.isFestival,
            }
          : t,
      ),
    );

    setShowBuyModal(false);
    finishActionOrContinue(currPlayer.id);
    return true;
  };

  const handleFestivalSelect = (tileId: number) => {
    const festivalTile = board.find((tile) => tile.id === tileId);
    if (!festivalTile || festivalTile.type !== "PROPERTY") return;
    if (festivalTile.ownerId !== currPlayer.id) return;

    // Reset toàn bộ bàn cờ về isFestival = false, chỉ bật isFestival = true cho ô mới chọn
    setBoard((prev) =>
      prev.map((tile) => ({
        ...tile,
        isFestival: tile.id === tileId,
      })),
    );

    setShowFestivalModal(false);
    finishActionOrContinue(currPlayer.id);
  };

  const handleFestivalSkip = () => {
    setShowFestivalModal(false);
    finishActionOrContinue(currPlayer.id);
  };

  const handlePayJailBail = () => {
    const BAIL_COST = economy.jailBail;
    if (currPlayer.money < BAIL_COST) {
      return;
    }

    const updatedPlayers = players.map((p) =>
      p.id === currPlayer.id
        ? {
            ...p,
            money: p.money - BAIL_COST,
            inJail: false,
            jailTurns: 0,
            doublesCount: 0,
          }
        : p,
    );

    setPlayers(updatedPlayers);
    setShowJailModal(false);
  };

  const handleSkipBuy = () => {
    setShowBuyModal(false);
    finishActionOrContinue(currPlayer.id);
  };

  // =====================================================================
  // ONLINE: host chạy luật chơi, người khác gửi thao tác & nhận trạng thái
  // =====================================================================

  /** Người chơi rời trận (thoát / bị kick / mất kết nối quá lâu) -> xử thua */
  const forfeitPlayer = (userId: string) => {
    const target = players.find((p) => p.userId === userId);
    if (!target || target.isBankrupt || winnerId !== null) return;

    const wasActive = currPlayer.id === target.id;
    const updatedPlayers = players.map((p) =>
      p.id === target.id
        ? {
            ...p,
            money: 0,
            isBankrupt: true,
            inJail: false,
            jailTurns: 0,
            canTeleport: false,
            doublesCount: 0,
          }
        : p,
    );
    setPlayers(updatedPlayers);
    setBoard((prev) =>
      prev.map((t) => (t.ownerId === target.id ? releaseTile(t) : t)),
    );
    if (wasActive) {
      setShowBuyModal(false);
      setShowFestivalModal(false);
      setShowJailModal(false);
      setShowSellModal(false);
      setPendingFinish(null);
      setPawnStates((prev) => ({ ...prev, [target.id]: "idle" }));
    }

    const alive = updatedPlayers.filter((p) => !p.isBankrupt);
    setBankruptNotice({
      player: target,
      debt: 0,
      remainingPlayers: alive.length,
      reason: "left",
    });

    setTimeout(() => {
      setBankruptNotice(null);
      if (alive.length <= 1) {
        if (alive[0]) {
          setWinnerId(alive[0].id);
        }
        return;
      }
      if (wasActive) nextTurn(updatedPlayers);
    }, BANKRUPT_NOTICE_MS);
  };

  /** Pha hiện tại của lượt chơi (để tính giờ & tự động đi khi AFK) */
  const turnPhase: TurnPhase = (() => {
    // Đang chơi Oẳn tù tì: ván có đồng hồ riêng, không tính giờ lượt
    if (rpsGame || xocGame) return "none";
    if (winnerId !== null || bankruptNotice || currPlayer.isBankrupt)
      return "none";
    if (pawnStates[currPlayer.id] === "moving") return "none";
    if (showSellModal) return "sell";
    if (pendingFinish || taxNotification) return "none";
    if (showBuyModal) return "buy";
    if (showFestivalModal) return "festival";
    if (currPlayer.canTeleport && !currPlayer.inJail) return "travel";
    return "roll";
  })();

  // ---------------------------------------------------------------------
  // KHOÁ THAO TÁC (host): mỗi "bước" của lượt chơi chỉ nhận đúng 1 thao tác.
  // Bước được xác định bởi người chơi + pha + trạng thái tù. Khoá được đặt ngay
  // (đồng bộ) khi nhận thao tác, nên thao tác trùng tới trước khi React kịp
  // render lại (lắc 2 lần, bấm Mua 2 lần, hết giờ đúng lúc người chơi vừa lắc...)
  // đều bị bỏ qua. Khoá tự mở khi bước thay đổi.
  // ---------------------------------------------------------------------
  const actionLockRef = useRef(false);
  const lockKey = `${activePlayerIndex}:${turnPhase}:${currPlayer.inJail}`;
  useEffect(() => {
    actionLockRef.current = false;
  }, [lockKey]);

  /** Đặt khoá; tự mở sau 8s phòng trường hợp thao tác không làm đổi bước */
  const acquireLock = () => {
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setTimeout(() => {
      actionLockRef.current = false;
    }, 8000);
    return true;
  };

  /** Tự động đi thay khi hết giờ (đi qua cùng cơ chế kiểm tra như người chơi) */
  const autoAct = (phase: TurnPhase) => {
    // Pha đã đổi (người chơi vừa thao tác kịp) -> không làm gì
    if (phase === "none" || phase !== turnPhase) return;
    switch (phase) {
      case "roll": {
        performAction("roll", { d1: randomDie(), d2: randomDie() });
        return;
      }
      case "buy":
        performAction("skipBuy");
        return;
      case "festival":
        performAction("festivalSkip");
        return;
      case "sell":
        performAction("autoSell");
        return;
      case "travel": {
        const options = board
          .map((t) => t.id)
          .filter((id) => id !== currPlayer.tileIndex);
        const target = pickRandom(options);
        if (target !== undefined) performAction("travel", { tileId: target });
        return;
      }
    }
  };

  // =====================================================================
  // MINI GAME OẲN TÙ TÌ (host điều khiển)
  // =====================================================================

  /** Bắt đầu ván: người đi vào ô đấu với mọi người còn trong trận */
  const startRps = (challengerId: number, isDouble: boolean) => {
    const opponents = players
      .filter((p) => !p.isBankrupt && p.id !== challengerId)
      .map((p) => p.id);
    if (opponents.length === 0) {
      finishActionOrContinue(challengerId, isDouble);
      return;
    }
    rpsChoicesRef.current = {};
    const game: RpsGame = {
      id: nowMs(),
      challengerId,
      participants: [challengerId, ...opponents],
      chosen: [],
      deadline: nowMs() + RPS_CHOOSE_MS,
      phase: "choosing",
      isDouble,
    };
    // Chơi offline (1 máy): các đối thủ chọn ngẫu nhiên
    if (!online) {
      opponents.forEach((id) => {
        rpsChoicesRef.current[id] = pickRandom(RPS_CHOICES)!;
      });
      game.chosen = [...opponents];
    }
    setRpsGame(game);
  };

  /** Ghi nhận lựa chọn bí mật của 1 người chơi */
  const chooseRps = (playerId: number, choice: RpsChoice) => {
    if (!rpsGame || rpsGame.phase !== "choosing") return;
    if (!rpsGame.participants.includes(playerId)) return;
    if (rpsChoicesRef.current[playerId]) return; // đã chọn rồi
    rpsChoicesRef.current[playerId] = choice;
    const gameId = rpsGame.id;
    setRpsGame((g) =>
      g && g.id === gameId && !g.chosen.includes(playerId)
        ? { ...g, chosen: [...g.chosen, playerId] }
        : g,
    );
  };

  /** Lật bài & chuyển tiền: thắng nhận economy.rpsStake từ mỗi đối thủ, thua trả lại bấy nhiêu */
  const resolveRps = (gameId: number) => {
    if (!rpsGame || rpsGame.id !== gameId || rpsGame.phase !== "choosing")
      return;
    const cid = rpsGame.challengerId;
    const challenger = players.find((p) => p.id === cid);
    if (!challenger || challenger.isBankrupt) {
      setRpsGame(null);
      return;
    }
    // Ai chưa chọn (AFK / mất kết nối) -> chọn ngẫu nhiên
    const choices: Record<number, RpsChoice> = {};
    rpsGame.participants.forEach((pid) => {
      choices[pid] = rpsChoicesRef.current[pid] ?? pickRandom(RPS_CHOICES)!;
    });

    const delta: Record<number, number> = {};
    const add = (pid: number, v: number) =>
      (delta[pid] = (delta[pid] ?? 0) + v);
    const results: RpsResult[] = [];
    rpsGame.participants.slice(1).forEach((oid) => {
      const opp = players.find((p) => p.id === oid);
      if (!opp || opp.isBankrupt) return; // đã rời trận
      const r = rpsCompare(choices[cid], choices[oid]);
      if (r === 1) {
        // Đối thủ không bị âm tiền vì mini game: trả tối đa số tiền đang có
        const amount = Math.min(
          economy.rpsStake,
          Math.max(0, opp.money + (delta[oid] ?? 0)),
        );
        add(oid, -amount);
        add(cid, amount);
        results.push({ opponentId: oid, outcome: "win", amount });
      } else if (r === -1) {
        // Người đi vào ô trả đủ (nếu âm tiền -> quy trình bán nhà / phá sản như thường)
        add(cid, -economy.rpsStake);
        add(oid, economy.rpsStake);
        results.push({
          opponentId: oid,
          outcome: "lose",
          amount: economy.rpsStake,
        });
      } else {
        results.push({ opponentId: oid, outcome: "draw", amount: 0 });
      }
    });

    setPlayers((prev) =>
      prev.map((p) =>
        delta[p.id] ? { ...p, money: p.money + delta[p.id] } : p,
      ),
    );
    setRpsGame({
      ...rpsGame,
      phase: "reveal",
      choices,
      results,
      chosen: rpsGame.participants,
      deadline: nowMs() + RPS_REVEAL_MS,
    });
  };

  /** Kết thúc ván, tiếp tục lượt như bình thường (kiểm tra nợ, đổ đôi...) */
  const endRps = (gameId: number) => {
    if (!rpsGame || rpsGame.id !== gameId) return;
    const { challengerId, isDouble } = rpsGame;
    rpsChoicesRef.current = {};
    setRpsGame(null);
    finishActionOrContinue(challengerId, isDouble);
  };

  // =====================================================================
  // MINI GAME XÓC ĐĨA (host điều khiển)
  // =====================================================================

  const startXoc = (starterId: number, isDouble: boolean) => {
    const participants = [
      starterId,
      ...players
        .filter((p) => !p.isBankrupt && p.id !== starterId)
        .map((p) => p.id),
    ];
    const guesses: XocGame["guesses"] = {};
    // Chơi offline (1 máy): người khác không tham gia
    if (!online) participants.slice(1).forEach((id) => (guesses[id] = "skip"));
    setXocGame({
      id: nowMs(),
      starterId,
      participants,
      guesses,
      deadline: nowMs() + XOC_GUESS_MS,
      phase: "guessing",
      isDouble,
    });
  };

  const guessXoc = (playerId: number, guess: XocGuess | "skip") => {
    if (!xocGame || xocGame.phase !== "guessing") return;
    if (!xocGame.participants.includes(playerId)) return;
    if (xocGame.guesses[playerId]) return; // đã đoán rồi
    const gameId = xocGame.id;
    setXocGame((g) =>
      g && g.id === gameId && g.phase === "guessing" && !g.guesses[playerId]
        ? { ...g, guesses: { ...g.guesses, [playerId]: guess } }
        : g,
    );
  };

  /** Hết giờ đoán -> xóc đĩa */
  const shakeXoc = (gameId: number) => {
    if (!xocGame || xocGame.id !== gameId || xocGame.phase !== "guessing")
      return;
    setXocGame({
      ...xocGame,
      phase: "shaking",
      deadline: nowMs() + XOC_SHAKE_MS,
    });
  };

  /** Mở bát: 4 đồng ngẫu nhiên, số mặt trắng lẻ = LẺ, chẵn = CHẴN */
  const revealXoc = (gameId: number) => {
    if (!xocGame || xocGame.id !== gameId || xocGame.phase !== "shaking")
      return;
    const coins = Array.from({ length: 4 }, () => pickRandom([true, false])!);
    const whites = coins.filter(Boolean).length;
    const answer: XocGuess = whites % 2 === 1 ? "odd" : "even";

    const delta: Record<number, number> = {};
    const results: XocResult[] = xocGame.participants.map((pid) => {
      const p = players.find((x) => x.id === pid);
      const g = xocGame.guesses[pid];
      if (!p || p.isBankrupt || !g || g === "skip")
        return { playerId: pid, guess: null, outcome: "skip", amount: 0 };
      if (g === answer) {
        delta[pid] = economy.xocStake; // ngân hàng trả thưởng
        return {
          playerId: pid,
          guess: g,
          outcome: "win",
          amount: economy.xocStake,
        };
      }
      // Đoán sai: người đi vào ô trả đủ; người khác trả tối đa số tiền đang có
      const amount =
        pid === xocGame.starterId
          ? economy.xocStake
          : Math.min(economy.xocStake, Math.max(0, p.money));
      delta[pid] = -amount;
      return { playerId: pid, guess: g, outcome: "lose", amount };
    });

    setPlayers((prev) =>
      prev.map((p) =>
        delta[p.id] ? { ...p, money: p.money + delta[p.id] } : p,
      ),
    );
    setXocGame({
      ...xocGame,
      phase: "reveal",
      coins,
      results,
      deadline: nowMs() + XOC_REVEAL_MS,
    });
  };

  const endXoc = (gameId: number) => {
    if (!xocGame || xocGame.id !== gameId) return;
    const { starterId, isDouble } = xocGame;
    setXocGame(null);
    finishActionOrContinue(starterId, isDouble);
  };

  /** Thực hiện 1 thao tác (chỉ chạy ở host) */
  const performAction = (
    type: GameActionType,
    payload?: unknown,
    actorId?: number,
  ) => {
    const data = (payload ?? {}) as Record<string, unknown>;
    switch (type) {
      case "xocGuess":
        // Mọi người tham gia đều được đoán (không cần tới lượt)
        if (
          data.guess === "even" ||
          data.guess === "odd" ||
          data.guess === "skip"
        )
          guessXoc(actorId ?? currPlayer.id, data.guess);
        return;
      case "rpsChoose":
        // Mọi người tham gia đều được chọn (không cần tới lượt)
        if (isRpsChoice(data.choice))
          chooseRps(actorId ?? currPlayer.id, data.choice);
        return;
      case "roll": {
        if (turnPhase !== "roll") return;
        if (!isDie(data.d1) || !isDie(data.d2)) return;
        if (!acquireLock()) return;
        void handleRollComplete(data.d1 + data.d2, data.d1, data.d2);
        return;
      }
      case "buy": {
        const level = data.level;
        if (
          (level === "land" ||
            level === "house1" ||
            level === "house2" ||
            level === "house3" ||
            level === "villa") &&
          turnPhase === "buy" &&
          acquireLock()
        ) {
          // Không đủ tiền -> mở khoá để người chơi chọn lựa chọn khác
          if (!handleBuyProperty(level)) actionLockRef.current = false;
        }
        return;
      }
      case "skipBuy":
        if (turnPhase === "buy" && acquireLock()) handleSkipBuy();
        return;
      case "festivalSelect":
        if (
          turnPhase === "festival" &&
          typeof data.tileId === "number" &&
          board[data.tileId]?.ownerId === currPlayer.id &&
          acquireLock()
        )
          handleFestivalSelect(data.tileId);
        return;
      case "festivalSkip":
        if (turnPhase === "festival" && acquireLock()) handleFestivalSkip();
        return;
      case "payBail":
        if (
          turnPhase === "roll" &&
          currPlayer.inJail &&
          currPlayer.money >= economy.jailBail &&
          acquireLock()
        )
          handlePayJailBail();
        return;
      case "travel": {
        const tileId = data.tileId;
        if (
          turnPhase === "travel" &&
          typeof tileId === "number" &&
          tileId >= 0 &&
          tileId < board.length &&
          tileId !== currPlayer.tileIndex &&
          acquireLock()
        )
          void handleTravelToTile(tileId);
        return;
      }
      case "sellTile":
        // Bán từng ô: được bán nhiều lần trong cùng bước, không dùng khoá
        if (turnPhase === "sell" && typeof data.tileId === "number")
          handleSellTile(data.tileId);
        return;
      case "autoSell":
        if (turnPhase === "sell" && acquireLock()) handleAutoSellAll();
        return;
    }
  };

  /** Gửi thao tác của người chơi hiện tại: host tự xử lý, người khác gửi lên host */
  const sendAction = (type: GameActionType, payload?: unknown) => {
    if (type === "rpsChoose" || type === "xocGuess") {
      const me = online ? myPlayer : currPlayer;
      if (!me) return;
      if (!online || isHost) {
        performAction(type, payload, me.id);
        return;
      }
      void monoEmit("mono:action", { type, payload }).then((res) => {
        if (!res.ok && res.error) toast.error(res.error);
      });
      return;
    }
    if (!online) {
      performAction(type, payload);
      return;
    }
    if (!isMyTurn) {
      toast.error("Chưa tới lượt của bạn");
      return;
    }
    if (isHost) {
      performAction(type, payload);
      return;
    }
    void monoEmit("mono:action", { type, payload }).then((res) => {
      if (!res.ok && res.error) toast.error(res.error);
    });
  };

  // Giữ tham chiếu tới dữ liệu & hàm mới nhất cho các listener socket
  const latestRef = useRef({
    isHost,
    currPlayer,
    players,
    resolveRps,
    endRps,
    shakeXoc,
    revealXoc,
    endXoc,
    performAction,
    forfeitPlayer,
    autoAct,
    cardSeq,
  });
  useEffect(() => {
    latestRef.current = {
      isHost,
      currPlayer,
      players,
      resolveRps,
      endRps,
      shakeXoc,
      revealXoc,
      endXoc,
      performAction,
      forfeitPlayer,
      autoAct,
      cardSeq,
    };
  });

  /** Áp dụng bản cập nhật từ host: chỉ những trường có trong patch mới đổi */
  const revRef = useRef(snap?.rev ?? 0);

  const applySnapshot = (s: SnapshotPatch) => {
    if (s.board !== undefined) setBoard(s.board);
    if (s.players !== undefined) setPlayers(s.players);
    if (s.activePlayerIndex !== undefined)
      setActivePlayerIndex(s.activePlayerIndex);
    if (s.pawnStates !== undefined) setPawnStates(s.pawnStates);
    if (s.showBuyModal !== undefined) setShowBuyModal(s.showBuyModal);
    if (s.showFestivalModal !== undefined)
      setShowFestivalModal(s.showFestivalModal);
    if (s.showJailModal !== undefined) setShowJailModal(s.showJailModal);
    if (s.showSellModal !== undefined) setShowSellModal(s.showSellModal);
    if (s.lastRollWasDouble !== undefined)
      setLastRollWasDouble(s.lastRollWasDouble);
    if (s.chanceDeck !== undefined) setChanceDeck(s.chanceDeck);
    if (s.fateDeck !== undefined) setFateDeck(s.fateDeck);
    if (s.chanceIndex !== undefined) setChanceIndex(s.chanceIndex);
    if (s.fateIndex !== undefined) setFateIndex(s.fateIndex);
    if ("taxNotification" in s) setTaxNotification(s.taxNotification ?? null);
    if ("pendingFinish" in s) setPendingFinish(s.pendingFinish ?? null);
    if ("winnerId" in s) setWinnerId(s.winnerId ?? null);
    if ("bankruptNotice" in s) setBankruptNotice(s.bankruptNotice ?? null);
    if ("rentNotice" in s) setRentNotice(s.rentNotice ?? null);
    if ("lastRoll" in s) setLastRoll(s.lastRoll ?? null);
    if ("rpsGame" in s) setRpsGame(s.rpsGame ?? null);
    if ("xocGame" in s) setXocGame(s.xocGame ?? null);
    // Thẻ mới được rút -> hiện cho mọi người (mỗi người tự đóng thẻ của mình)
    if (s.cardSeq !== undefined && s.cardSeq !== latestRef.current.cardSeq) {
      setCardSeq(s.cardSeq);
      setDrawnCard(s.drawnCard ?? null);
    }
  };

  // Socket listeners
  useEffect(() => {
    if (!isOnline) return;

    // Lấy toàn bộ trạng thái mới nhất từ server (đã gộp mọi bản cập nhật)
    let resyncing = false;
    const resync = () => {
      if (resyncing) return;
      resyncing = true;
      void monoEmit<SnapshotPatch | null>("mono:sync").then((res) => {
        resyncing = false;
        if (latestRef.current.isHost || !res.ok || !res.data) return;
        applySnapshot(res.data);
        revRef.current = res.data.rev ?? revRef.current;
      });
    };

    const onState = (s: SnapshotPatch) => {
      if (latestRef.current.isHost || s?.v !== 1) return;
      const expected = revRef.current + 1;
      // Bản đầy đủ hoặc đúng thứ tự -> áp dụng; bị lỡ bản nào đó -> đồng bộ lại
      if (s.full || s.rev === undefined || s.rev === expected) {
        applySnapshot(s);
        if (s.rev !== undefined) revRef.current = s.rev;
      } else if (s.rev > expected) {
        resync();
      }
    };
    // Mất kết nối rồi kết nối lại -> có thể đã lỡ bản cập nhật
    const onReconnect = () => {
      if (!latestRef.current.isHost) resync();
    };
    const onAction = (msg: GameActionMessage) => {
      const l = latestRef.current;
      if (!l.isHost) return;
      // Oẳn tù tì: ai cũng được chọn, xác định người chọn theo tài khoản gửi
      if (msg.type === "rpsChoose" || msg.type === "xocGuess") {
        const actor = l.players.find((p) => p.userId === msg.userId);
        if (actor) l.performAction(msg.type, msg.payload, actor.id);
        return;
      }
      // Chỉ người đang tới lượt mới được điều khiển quân cờ
      if (l.currPlayer.userId !== msg.userId) return;
      l.performAction(msg.type, msg.payload);
    };
    const onPlayerLeft = (data: { userId: string }) => {
      if (latestRef.current.isHost)
        latestRef.current.forfeitPlayer(data.userId);
    };

    socket.on("mono:state", onState);
    socket.on("connect", onReconnect);
    socket.on("mono:action", onAction);
    socket.on("mono:playerLeft", onPlayerLeft);

    // Vừa vào bàn cờ -> lấy trạng thái mới nhất từ server
    resync();
    return () => {
      socket.off("mono:state", onState);
      socket.off("connect", onReconnect);
      socket.off("mono:action", onAction);
      socket.off("mono:playerLeft", onPlayerLeft);
    };
  }, [isOnline]);

  // Host phát cho mọi người những trường vừa thay đổi (lần đầu gửi toàn bộ)
  const lastSentRef = useRef<Omit<GameSnapshot, "v"> | null>(null);
  useEffect(() => {
    if (!isOnline || !isHost) {
      lastSentRef.current = null;
      return;
    }
    const current: Omit<GameSnapshot, "v"> = {
      board,
      players,
      activePlayerIndex,
      pawnStates,
      showBuyModal,
      showFestivalModal,
      showJailModal,
      showSellModal,
      lastRollWasDouble,
      chanceDeck,
      fateDeck,
      chanceIndex,
      fateIndex,
      drawnCard,
      cardSeq,
      taxNotification,
      pendingFinish,
      winnerId,
      bankruptNotice,
      rentNotice,
      lastRoll,
      rpsGame,
      xocGame,
    };
    const prev = lastSentRef.current;
    // Gửi bản ĐẦY ĐỦ ở lần đầu và mỗi khi đổi lượt (điểm đồng bộ lại cho mọi người)
    const full = !prev || prev.activePlayerIndex !== activePlayerIndex;
    const patch: Record<string, unknown> = { v: 1 };
    let changed = false;
    for (const key of Object.keys(current) as (keyof typeof current)[]) {
      if (full || prev[key] !== current[key]) {
        patch[key] = current[key];
        changed = true;
      }
    }
    lastSentRef.current = current;
    if (!changed) return;
    revRef.current += 1;
    patch.rev = revRef.current;
    patch.full = full;
    socket.emit("mono:state", patch);
  }, [
    isOnline,
    isHost,
    board,
    players,
    activePlayerIndex,
    pawnStates,
    showBuyModal,
    showFestivalModal,
    showJailModal,
    showSellModal,
    lastRollWasDouble,
    chanceDeck,
    fateDeck,
    chanceIndex,
    fateIndex,
    drawnCard,
    cardSeq,
    taxNotification,
    pendingFinish,
    winnerId,
    bankruptNotice,
    rentNotice,
    lastRoll,
    rpsGame,
    xocGame,
  ]);

  // Đồng hồ ván Oẳn tù tì (host)
  const rpsChosenCount = rpsGame?.chosen.length ?? 0;
  useEffect(() => {
    if (!isHost || !rpsGame) return;
    const id = rpsGame.id;
    if (rpsGame.phase === "choosing") {
      const allChosen = rpsGame.participants.every((p) =>
        rpsGame.chosen.includes(p),
      );
      const delay = allChosen
        ? 700
        : Math.max(0, rpsGame.deadline - Date.now());
      const t = setTimeout(() => latestRef.current.resolveRps(id), delay);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => latestRef.current.endRps(id), RPS_REVEAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, rpsGame?.id, rpsGame?.phase, rpsChosenCount]);

  // Đồng hồ ván Xóc đĩa (host): đủ người đoán / hết giờ -> xóc -> mở bát -> kết thúc
  const xocGuessCount = xocGame ? Object.keys(xocGame.guesses).length : 0;
  useEffect(() => {
    if (!isHost || !xocGame) return;
    const id = xocGame.id;
    if (xocGame.phase === "guessing") {
      const allGuessed = xocGame.participants.every((p) => xocGame.guesses[p]);
      const delay = allGuessed
        ? 600
        : Math.max(0, xocGame.deadline - Date.now());
      const t = setTimeout(() => latestRef.current.shakeXoc(id), delay);
      return () => clearTimeout(t);
    }
    if (xocGame.phase === "shaking") {
      const t = setTimeout(() => latestRef.current.revealXoc(id), XOC_SHAKE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => latestRef.current.endXoc(id), XOC_REVEAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, xocGame?.id, xocGame?.phase, xocGuessCount]);

  // Giới hạn lượt (host): mỗi bước tối đa 20 giây, hết giờ thì tự động đi thay
  // (đang chờ lắc -> tự lắc xúc xắc; đang chọn mua/lễ hội/du lịch/bán nhà -> tự xử lý)
  const phaseKey = `${activePlayerIndex}:${turnPhase}`;

  useEffect(() => {
    if (!isOnline || !isHost || turnPhase === "none") return;
    const timer = setTimeout(
      () => latestRef.current.autoAct(turnPhase),
      TURN_SECONDS * 1000,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isHost, phaseKey]);

  // Vừa được nhận quyền host giữa trận -> gỡ các trạng thái đang dở dang
  const wasHostRef = useRef(isHost);
  useEffect(() => {
    const becameHost = isHost && !wasHostRef.current;
    wasHostRef.current = isHost;
    if (!isOnline || !becameHost) return;

    if (rpsGame?.phase === "choosing") {
      rpsChoicesRef.current = {};
      setRpsGame({
        ...rpsGame,
        chosen: [],
        deadline: Date.now() + RPS_CHOOSE_MS,
      });
    }

    const timer = setTimeout(() => {
      setBankruptNotice(null);
      setTaxNotification(null);
      setPawnStates((prev) =>
        Object.fromEntries(
          Object.keys(prev).map((k) => [k, "idle" as PawnState]),
        ),
      );
      const alive = players.filter((p) => !p.isBankrupt);
      if (alive.length <= 1 && alive[0]) {
        setWinnerId(alive[0].id);
        return;
      }
      if (currPlayer.isBankrupt) nextTurn(players);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isHost]);

  // Có người thắng -> host báo server kết thúc trận
  useEffect(() => {
    if (isOnline && isHost && winnerId !== null) online?.onFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isHost, winnerId]);

  return (
    <GameContext.Provider
      value={{
        board,
        players,
        activePlayerIndex,
        currPlayer,
        currentTile,
        pawnStates,
        showBuyModal,
        setShowBuyModal,
        showFestivalModal,
        setShowFestivalModal,
        showJailModal,
        setShowJailModal,
        drawnCard,
        setDrawnCard,
        taxNotification,
        setTaxNotification,
        economy,
        calculateTileRent,
        // Mọi thao tác của người chơi đều đi qua sendAction
        handleTravelToTile: async (tileId) => sendAction("travel", { tileId }),
        handleRollComplete: async (_total, d1, d2) =>
          sendAction("roll", { d1, d2 }),
        handleBuyProperty: (level) => sendAction("buy", { level }),
        handleFestivalSelect: (tileId) =>
          sendAction("festivalSelect", { tileId }),
        handleFestivalSkip: () => sendAction("festivalSkip"),
        handlePayJailBail: () => sendAction("payBail"),
        handleSkipBuy: () => sendAction("skipBuy"),
        handleSellTile: (tileId) => sendAction("sellTile", { tileId }),
        handleAutoSellAll: () => sendAction("autoSell"),
        finishActionOrContinue,
        showSellModal,
        isSettlingTurn: pendingFinish !== null,
        bankruptNotice,
        rentNotice,
        winner:
          winnerId !== null
            ? (players.find((p) => p.id === winnerId) ?? null)
            : null,
        isOnline,
        isHost,
        isMyTurn,
        myPlayer,
        lastRoll,
        turnPhase,
        rpsGame,
        xocGame,
        handleXocGuess: (guess: XocGuess | "skip") => {
          if (!xocGame || xocGame.phase !== "guessing") return;
          sendAction("xocGuess", { guess });
        },
        myRpsChoice:
          rpsGame &&
          myRpsPick?.id === rpsGame.id &&
          myPlayer &&
          rpsGame.chosen.includes(myPlayer.id)
            ? myRpsPick.choice
            : rpsGame && !online && myRpsPick?.id === rpsGame.id
              ? myRpsPick.choice
              : null,
        handleRpsChoose: (choice: RpsChoice) => {
          if (!rpsGame || rpsGame.phase !== "choosing") return;
          setMyRpsPick({ id: rpsGame.id, choice });
          sendAction("rpsChoose", { choice });
        },
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
