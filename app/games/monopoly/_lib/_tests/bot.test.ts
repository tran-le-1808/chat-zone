import { test } from "node:test";
import assert from "node:assert/strict";
import type { Player, TileData } from "../../../../../types/game.types";
import {
  buyCost,
  chooseBuy,
  chooseFestival,
  chooseTravel,
  chooseXoc,
  shouldPayBail,
  type BotLevel,
  type BotView,
} from "../bot";

const tile = (id: number, p: Partial<TileData> = {}): TileData => ({
  id,
  name: `T${id}`,
  type: "PROPERTY",
  color: "#f00",
  position: [0, 0, 0],
  size: [1, 1, 1],
  groupCode: `G${Math.floor(id / 2)}`,
  landPrice: 1000,
  house1Price: 1200,
  house2Price: 1400,
  house3Price: 1600,
  villaPrice: 600,
  rent: 0,
  houses: 0,
  hasVilla: false,
  ...p,
});
const player = (id: number, p: Partial<Player> = {}): Player => ({
  id,
  name: `P${id}`,
  type: "dragon",
  color: "#fff",
  tileIndex: 0,
  money: 10000,
  avatarBg: "",
  isBankrupt: false,
  inJail: false,
  jailTurns: 0,
  canTeleport: false,
  doublesCount: 0,
  ...p,
});
const board = () => [
  tile(0, { type: "GO", landPrice: 0 }),
  ...Array.from({ length: 9 }, (_, i) => tile(i + 1)),
];
const view = (
  b: TileData[],
  me: Player,
  level: BotLevel = "hard",
  others: Player[] = [player(1)],
): BotView => ({
  board: b,
  players: [me, ...others],
  me,
  rentOf: (t) =>
    t.ownerId === undefined
      ? 0
      : (t.hasVilla ? 3000 : 1200 + t.houses * 400) * (t.isFestival ? 2 : 1),
  startingMoney: 10000,
  level,
  rnd: () => 0.9,
});

test("buyCost matches the buy modal options", () => {
  const t = tile(1);
  assert.equal(buyCost(t, 0, "house2"), 1400);
  assert.equal(buyCost(t, 0, "villa"), null);
  const mine = tile(1, { ownerId: 0, houses: 1 });
  assert.equal(buyCost(mine, 0, "house2"), 200);
  assert.equal(buyCost(mine, 0, "house3"), null);
  const theirs = tile(1, { ownerId: 1, houses: 3 });
  assert.equal(buyCost(theirs, 0, "land"), 1600);
  assert.equal(buyCost(theirs, 0, "villa"), 2200);
  assert.equal(
    buyCost(tile(1, { ownerId: 1, hasVilla: true }), 0, "land"),
    null,
  );
});

test("rich bot builds high, poor bot keeps a cash reserve", () => {
  const b = board();
  assert.equal(chooseBuy(view(b, player(0)), b[1]), "house3");
  assert.equal(chooseBuy(view(b, player(0, { money: 1500 })), b[1]), null);
  assert.equal(chooseBuy(view(b, player(0, { money: 2300 })), b[1]), "land");
});

test("hard bot buys back an opponent tile in its own colour group", () => {
  const b = board();
  b[2] = tile(2, { ownerId: 0 });
  b[3] = tile(3, { ownerId: 1, groupCode: b[2].groupCode });
  assert.notEqual(chooseBuy(view(b, player(0)), b[3]), null);
});

test("festival goes on the highest-rent own tile", () => {
  const b = board();
  b[1] = tile(1, { ownerId: 0, houses: 1 });
  b[4] = tile(4, { ownerId: 0, houses: 3 });
  assert.equal(chooseFestival(view(b, player(0))), 4);
  assert.equal(chooseFestival(view(board(), player(0))), null);
});

test("travel avoids opponent tiles and prefers completing a group", () => {
  const b = board().map((t) => (t.id > 0 ? { ...t, ownerId: 1 } : t));
  b[5] = tile(5);
  b[6] = tile(6, { ownerId: 0, groupCode: b[5].groupCode });
  b[6].groupCode = b[5].groupCode;
  const me = player(0, { tileIndex: 6 });
  assert.equal(chooseTravel(view(b, me)), 5);
  const broke = player(0, { tileIndex: 6, money: 500 });
  assert.equal(chooseTravel(view(b, broke)), 0); // về ô Bắt đầu nhận lương
});

test("bail and mini game choices", () => {
  const b = board();
  assert.equal(shouldPayBail(view(b, player(0, { money: 8000 })), 500), true);
  assert.equal(shouldPayBail(view(b, player(0, { money: 400 })), 500), false);
  assert.equal(chooseXoc(1000, 500), "skip");
  assert.ok(["even", "odd"].includes(chooseXoc(9000, 500)));
});
