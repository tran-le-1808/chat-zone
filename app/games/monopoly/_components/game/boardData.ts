import { BoardTile } from "@/types/game.types";

const step = 2.1;

export const INITIAL_BOARD: BoardTile[] = Array.from({ length: 40 }, (_, i) => {
  let x = 0,
    z = 0;
  if (i <= 10) {
    x = 10.5 - i * step;
    z = 10.5;
  } else if (i <= 20) {
    x = -10.5;
    z = 10.5 - (i - 10) * step;
  } else if (i <= 30) {
    x = -10.5 + (i - 20) * step;
    z = -10.5;
  } else {
    x = 10.5;
    z = -10.5 + (i - 30) * step;
  }

  let type: BoardTile["type"] = "PROPERTY";
  let name = `Ô ${i}`;
  let price = 100 + i * 10;
  const rent = [10 + i * 2, 50, 150, 450, 625, 750];
  const housePrice = 50;
  const group = "BLUE";

  if (i === 0) {
    type = "GO";
    name = "BẮT ĐẦU";
  } else if (i === 10) {
    type = "JAIL";
    name = "NHÀ TÙ";
  } else if (i === 20) {
    type = "FREE_PARKING";
    name = "BÃI ĐỖ XE";
  } else if (i === 30) {
    type = "GO_TO_JAIL";
    name = "VÀO TÙ";
  } else if (i % 5 === 0) {
    type = "RAILROAD";
    name = `BẾN XE ${i}`;
    price = 200;
  } else if (i === 2 || i === 17 || i === 33) {
    type = "COMMUNITY_CHEST";
    name = "CƠ HỘI";
  } else if (i === 7 || i === 22 || i === 36) {
    type = "CHANCE";
    name = "KHÍ VẬN";
  } else if (i === 4 || i === 38) {
    type = "TAX";
    name = "THUẾ";
  }

  return {
    id: i,
    name,
    type,
    price: type === "PROPERTY" || type === "RAILROAD" ? price : undefined,
    rent: type === "PROPERTY" ? rent : undefined,
    housePrice: type === "PROPERTY" ? housePrice : undefined,
    houses: 0,
    hasHotel: false,
    group: type === "PROPERTY" ? group : undefined,
    color: i % 2 === 0 ? "#1e40af" : "#be185d",
    position: [x, 0.1, z],
  };
});
