import { GameState, Player, BoardTile } from "@/types/game.types";
import { INITIAL_BOARD } from "./boardData";

export const GO_REWARD = 200;

export function createInitialState(): GameState {
  return {
    status: "PLAYING",
    players: [
      {
        id: "0",
        name: "Rồng Ngọc",
        type: "dragon",
        color: "#00f0ff",
        money: 1500,
        position: 0,
        properties: [],
        isBankrupt: false,
        inJail: false,
        jailTurns: 0,
      },
      {
        id: "1",
        name: "Thỏ Bông",
        type: "bunny",
        color: "#ff007f",
        money: 1500,
        position: 0,
        properties: [],
        isBankrupt: false,
        inJail: false,
        jailTurns: 0,
      },
      {
        id: "2",
        name: "Mèo Mộng",
        type: "cat",
        color: "#a855f7",
        money: 1500,
        position: 0,
        properties: [],
        isBankrupt: false,
        inJail: false,
        jailTurns: 0,
      },
      {
        id: "3",
        name: "Sư Tử Vàng",
        type: "lion",
        color: "#eab308",
        money: 1500,
        position: 0,
        properties: [],
        isBankrupt: false,
        inJail: false,
        jailTurns: 0,
      },
    ],
    currentPlayerIndex: 0,
    dice: { first: 1, second: 1, total: 2 },
    consecutiveDoubles: 0,
    board: INITIAL_BOARD,
    turn: 1,
    logs: ["Trò chơi bắt đầu!"],
  };
}

// Xử lý di chuyển & các ô đặc biệt
export function resolveTurn(
  state: GameState,
  dice1: number,
  dice2: number,
): GameState {
  const nextState = structuredClone(state);
  const player = nextState.players[nextState.currentPlayerIndex];
  const total = dice1 + dice2;
  const isDouble = dice1 === dice2;

  nextState.dice = { first: dice1, second: dice2, total };

  // 1. Kiểm tra vào tù do tung đôi 3 lần
  if (isDouble) {
    nextState.consecutiveDoubles += 1;
    if (nextState.consecutiveDoubles === 3) {
      player.inJail = true;
      player.position = 10; // JAIL
      nextState.consecutiveDoubles = 0;
      nextState.logs.unshift(
        `${player.name} tung đôi 3 lần liên tiếp -> VÀO TÙ!`,
      );
      return checkNextTurn(nextState, false);
    }
  } else {
    nextState.consecutiveDoubles = 0;
  }

  // 2. Tính vị trí mới & Thưởng GO
  const prevPos = player.position;
  const newPos = (prevPos + total) % 40;
  player.position = newPos;

  if (newPos < prevPos) {
    player.money += GO_REWARD;
    nextState.logs.unshift(
      `${player.name} đi qua ô BẮT ĐẦU -> Nhận $${GO_REWARD}`,
    );
  }

  // 3. Xử lý logic theo loại ô
  const tile = nextState.board[newPos];
  nextState.logs.unshift(`${player.name} đến ô ${tile.name}`);

  if (tile.type === "GO_TO_JAIL") {
    player.inJail = true;
    player.position = 10;
    nextState.logs.unshift(`${player.name} bị bắt VÀO TÙ!`);
  } else if (tile.type === "TAX") {
    const tax = 150;
    player.money -= tax;
    nextState.logs.unshift(`${player.name} nộp thuế $${tax}`);
    checkBankruptcy(nextState, player);
  } else if (
    (tile.type === "PROPERTY" || tile.type === "RAILROAD") &&
    tile.ownerId &&
    tile.ownerId !== player.id
  ) {
    // Trả tiền thuê
    const owner = nextState.players.find((p) => p.id === tile.ownerId);
    if (owner && !owner.isBankrupt) {
      const rent = tile.rent ? tile.rent[tile.houses || 0] : 50;
      player.money -= rent;
      owner.money += rent;
      nextState.logs.unshift(
        `${player.name} trả $${rent} tiền thuê cho ${owner.name}`,
      );
      checkBankruptcy(nextState, player);
    }
  }

  return checkNextTurn(nextState, isDouble);
}

// Mua bất động sản
export function buyProperty(state: GameState): GameState {
  const nextState = structuredClone(state);
  const player = nextState.players[nextState.currentPlayerIndex];
  const tile = nextState.board[player.position];

  if (
    (tile.type === "PROPERTY" || tile.type === "RAILROAD") &&
    !tile.ownerId &&
    tile.price &&
    player.money >= tile.price
  ) {
    player.money -= tile.price;
    tile.ownerId = player.id;
    player.properties.push(tile.id);
    nextState.logs.unshift(
      `${player.name} đã mua ô ${tile.name} với giá $${tile.price}`,
    );
  }
  return nextState;
}

// Xây nhà
export function buildHouse(state: GameState, tileId: number): GameState {
  const nextState = structuredClone(state);
  const player = nextState.players[nextState.currentPlayerIndex];
  const tile = nextState.board[tileId];

  if (
    tile &&
    tile.ownerId === player.id &&
    tile.housePrice &&
    player.money >= tile.housePrice &&
    (tile.houses || 0) < 5
  ) {
    player.money -= tile.housePrice;
    tile.houses = (tile.houses || 0) + 1;
    if (tile.houses === 5) tile.hasHotel = true;
    nextState.logs.unshift(`${player.name} xây nhà trên ô ${tile.name}`);
  }
  return nextState;
}

// Kiểm tra phá sản & Người thắng
function checkBankruptcy(state: GameState, player: Player) {
  if (player.money < 0) {
    player.isBankrupt = true;
    state.logs.unshift(`${player.name} ĐÃ PHÁ SẢN!`);

    // Thu hồi tài sản
    state.board.forEach((t) => {
      if (t.ownerId === player.id) {
        t.ownerId = undefined;
        t.houses = 0;
      }
    });

    const activePlayers = state.players.filter((p) => !p.isBankrupt);
    if (activePlayers.length === 1) {
      state.status = "FINISHED";
      state.winnerId = activePlayers[0].id;
      state.logs.unshift(
        `🏆 ${activePlayers[0].name} TRỞ THÀNH NGƯỜI CHIẾN THẮNG!`,
      );
    }
  }
}

// Chuyển lượt
function checkNextTurn(state: GameState, isDouble: boolean): GameState {
  if (!isDouble) {
    let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    while (state.players[nextIdx].isBankrupt) {
      nextIdx = (nextIdx + 1) % state.players.length;
    }
    state.currentPlayerIndex = nextIdx;
  }
  return state;
}
