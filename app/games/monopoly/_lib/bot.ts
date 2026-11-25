/**
 * BOT CỜ TỶ PHÚ — hàm thuần (không React), chạy ở máy chủ phòng (host).
 * Mỗi hàm nhận trạng thái hiện tại và trả về thao tác bot sẽ gửi (đi qua đúng
 * `performAction` như người chơi thật, nên mọi kiểm tra luật vẫn được áp dụng).
 */
import type { Player, TileData } from "@/types/game.types";

export type BotLevel = "easy" | "normal" | "hard";
export const BOT_LEVELS: Record<BotLevel, string> = {
  easy: "Dễ",
  normal: "Thường",
  hard: "Khó",
};
export const isBotLevel = (v: unknown): v is BotLevel =>
  v === "easy" || v === "normal" || v === "hard";

export type BuyLevel = "land" | "house1" | "house2" | "house3" | "villa";

export interface BotView {
  board: TileData[];
  players: Player[];
  me: Player;
  /** Tiền thuê hiện tại của 1 ô (đã tính đủ bộ, lễ hội) */
  rentOf: (tile: TileData) => number;
  /** Tiền khởi điểm của ván (để quy đổi các ngưỡng) */
  startingMoney: number;
  level: BotLevel;
  rnd?: () => number;
}

const BUY_LEVELS: BuyLevel[] = ["land", "house1", "house2", "house3", "villa"];
const LEVEL_HOUSES: Record<BuyLevel, number> = {
  land: 0,
  house1: 1,
  house2: 2,
  house3: 3,
  villa: 3,
};

/** Giá trọn gói của ô theo số nhà hiện có (giá mua lại từ đối thủ) */
export function buyoutBase(tile: TileData): number {
  return (
    [tile.landPrice, tile.house1Price, tile.house2Price, tile.house3Price][
      tile.houses
    ] ?? tile.landPrice
  );
}

/**
 * Chi phí của 1 lựa chọn trong cửa sổ mua đất (khớp với handleBuyProperty).
 * null = lựa chọn không có trong cửa sổ.
 */
export function buyCost(
  tile: TileData,
  meId: number,
  level: BuyLevel,
): number | null {
  if (tile.type === "STATION") {
    return tile.ownerId === undefined && level === "land"
      ? tile.landPrice
      : null;
  }
  if (tile.type !== "PROPERTY" || tile.hasVilla) return null;
  if (tile.ownerId === undefined) {
    if (level === "villa") return null;
    return [
      tile.landPrice,
      tile.house1Price,
      tile.house2Price,
      tile.house3Price,
    ][LEVEL_HOUSES[level]];
  }
  if (tile.ownerId === meId) {
    // Nâng cấp: chỉ đúng 1 bậc kế tiếp
    const next: BuyLevel | null =
      tile.houses === 0
        ? "house1"
        : tile.houses === 1
          ? "house2"
          : tile.houses === 2
            ? "house3"
            : "villa";
    if (level !== next) return null;
    if (level === "house1") return tile.house1Price - tile.landPrice;
    if (level === "house2") return tile.house2Price - tile.house1Price;
    if (level === "house3") return tile.house3Price - tile.house2Price;
    return tile.villaPrice;
  }
  // Mua lại của đối thủ (+ xây thêm)
  const base = buyoutBase(tile);
  if (level === "land") return base;
  if (level === "villa")
    return tile.houses === 3 ? base + tile.villaPrice : null;
  const want = LEVEL_HOUSES[level];
  if (want <= tile.houses) return null;
  return [tile.landPrice, tile.house1Price, tile.house2Price, tile.house3Price][
    want
  ];
}

/** Tiền thuê lớn nhất mình có thể phải trả ở các ô của đối thủ (đo mức rủi ro) */
function maxOpponentRent(v: BotView): number {
  let max = 0;
  for (const t of v.board) {
    if (t.ownerId === undefined || t.ownerId === v.me.id) continue;
    const owner = v.players.find((p) => p.id === t.ownerId);
    if (!owner || owner.isBankrupt) continue;
    max = Math.max(max, v.rentOf(t));
  }
  return max;
}

/** Số tiền bot muốn giữ lại sau khi mua (để không phá sản vì tiền thuê) */
export function cashReserve(v: BotView): number {
  const base = v.startingMoney;
  const risk = maxOpponentRent(v);
  if (v.level === "easy") return base * 0.05;
  if (v.level === "normal") return Math.max(base * 0.1, risk * 0.4);
  return Math.max(base * 0.12, risk * 0.6);
}

/** Mình đang có bao nhiêu ô trong cùng nhóm màu / tổng số ô của nhóm */
function groupProgress(v: BotView, tile: TileData) {
  if (!tile.groupCode) return { mine: 0, total: 0, others: 0 };
  const group = v.board.filter((t) => t.groupCode === tile.groupCode);
  return {
    mine: group.filter((t) => t.ownerId === v.me.id).length,
    others: group.filter(
      (t) => t.ownerId !== undefined && t.ownerId !== v.me.id,
    ).length,
    total: group.length,
  };
}

/** Lựa chọn trong cửa sổ mua đất: trả về mức mua, hoặc null = bỏ qua */
export function chooseBuy(v: BotView, tile: TileData): BuyLevel | null {
  const rnd = v.rnd ?? Math.random;
  const money = v.me.money;
  const reserve = cashReserve(v);
  const options = BUY_LEVELS.map((level) => ({
    level,
    cost: buyCost(tile, v.me.id, level),
  })).filter(
    (o): o is { level: BuyLevel; cost: number } =>
      o.cost !== null && o.cost <= money,
  );
  if (!options.length) return null;

  const isBuyout = tile.ownerId !== undefined && tile.ownerId !== v.me.id;
  const safe = options.filter((o) => money - o.cost >= reserve);

  if (v.level === "easy") {
    // Mua đất là chính, thỉnh thoảng bỏ qua
    const land = safe.find((o) => o.level === "land") ?? safe[0];
    if (!land || rnd() < 0.25) return null;
    return isBuyout && rnd() < 0.5 ? null : land.level;
  }

  if (!safe.length) return null;
  const g = groupProgress(v, tile);
  // Mua lại của đối thủ: đáng khi giành lại ô phá bộ màu của họ / sắp đủ bộ mình
  if (isBuyout) {
    const worth =
      v.level === "hard"
        ? g.mine > 0 || g.others === g.total || v.rentOf(tile) > money * 0.15
        : rnd() < 0.5;
    if (!worth) return null;
  }
  // Nhóm đã có người khác giữ phần lớn -> chỉ mua đất (đầu tư nhà ít lời hơn)
  const blocked = g.total > 0 && g.others > 0 && g.mine + 1 < g.total;
  if (blocked && v.level === "hard") {
    const cheapest = safe[0];
    return cheapest.level;
  }
  // Còn lại: xây cao nhất mà vẫn giữ được tiền dự phòng
  return safe[safe.length - 1].level;
}

/** Ô Lễ hội: chọn ô của mình có tiền thuê cao nhất (nhân đôi) */
export function chooseFestival(v: BotView): number | null {
  const mine = v.board.filter(
    (t) => t.type === "PROPERTY" && t.ownerId === v.me.id,
  );
  if (!mine.length) return null;
  if (v.level === "easy") {
    const rnd = v.rnd ?? Math.random;
    return mine[Math.floor(rnd() * mine.length)].id;
  }
  // Ô đang có lễ hội thì tiền thuê đã x2 -> so sánh trên mức chưa nhân
  const score = (t: TileData) => v.rentOf(t) / (t.isFestival ? 2 : 1);
  return mine.reduce((a, b) => (score(b) > score(a) ? b : a)).id;
}

/** Ô Du lịch: bay tới ô có lợi nhất (đất trống mua được, nhà mình để nâng cấp, ô Bắt đầu) */
export function chooseTravel(v: BotView): number {
  const rnd = v.rnd ?? Math.random;
  const here = v.me.tileIndex;
  const candidates = v.board.filter((t) => t.id !== here);
  const go = v.board.find((t) => t.type === "GO");
  if (v.level === "easy") {
    const safe = candidates.filter(
      (t) => t.ownerId === undefined || t.ownerId === v.me.id,
    );
    const pool = safe.length ? safe : candidates;
    return pool[Math.floor(rnd() * pool.length)].id;
  }
  const reserve = cashReserve(v);
  let best: { id: number; score: number } = {
    id: go && go.id !== here ? go.id : candidates[0].id,
    score: 1,
  };
  for (const t of candidates) {
    let score = 0;
    if (t.type === "GO") score = 1;
    else if (t.type === "PROPERTY" || t.type === "STATION") {
      if (t.ownerId === undefined) {
        if (v.me.money - t.landPrice < reserve) continue;
        const g = groupProgress(v, t);
        score = 2 + t.landPrice / v.startingMoney + (g.mine ? 2 * g.mine : 0);
      } else if (
        t.ownerId === v.me.id &&
        t.type === "PROPERTY" &&
        !t.hasVilla
      ) {
        const lv: BuyLevel = (["house1", "house2", "house3", "villa"] as const)[
          Math.min(t.houses, 3)
        ];
        const cost = buyCost(t, v.me.id, lv) ?? Infinity;
        if (v.me.money - cost < reserve) continue;
        score = 1.5 + t.houses * 0.5;
      } else continue; // ô của đối thủ -> mất tiền thuê
    } else continue;
    if (score > best.score) best = { id: t.id, score };
  }
  return best.id;
}

/** Ở tù: nộp tiền ra ngay nếu dư dả (đầu ván cần đi mua đất), cuối ván ngồi tù cho an toàn */
export function shouldPayBail(v: BotView, bail: number): boolean {
  if (v.me.money < bail) return false;
  if (v.level === "easy") return v.me.money > bail * 3;
  const unowned = v.board.filter(
    (t) =>
      (t.type === "PROPERTY" || t.type === "STATION") &&
      t.ownerId === undefined,
  ).length;
  const reserve = cashReserve(v);
  return unowned >= 4 && v.me.money - bail >= reserve;
}

export type RpsPick = "rock" | "paper" | "scissors";
export function chooseRps(rnd: () => number = Math.random): RpsPick {
  return (["rock", "paper", "scissors"] as const)[Math.floor(rnd() * 3)];
}

/** Chẵn lẻ: đoán ngẫu nhiên (50/50), bỏ qua khi tiền ít */
export function chooseXoc(
  money: number,
  stake: number,
  rnd: () => number = Math.random,
): "even" | "odd" | "skip" {
  if (money < stake * 3) return "skip";
  return rnd() < 0.5 ? "even" : "odd";
}

/** Tên hiển thị của bot */
export const BOT_NAMES = ["Bot Tí", "Bot Sửu", "Bot Dần", "Bot Mão"];
export const isBotUserId = (id?: string | null) =>
  !!id && id.startsWith("bot:");
