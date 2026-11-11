import { ECONOMY_BASE, formatMoney, roundMoney } from "../_context/economy";

export type CardDeckType = "CHANCE" | "FATE";

export type CardEffectType =
  | "ADD_MONEY"
  | "PAY_MONEY"
  //   | "MOVE_STEPS"
  | "MOVE_TO_TRAVEL"
  | "GO_TO_JAIL"
  | "PAY_PER_HOUSE"
  | "PAY_PER_PROPERTY";

export interface GameCard {
  id: string;
  deck: CardDeckType;
  title: string;
  description: string;
  effect: CardEffectType;
  value?: number;
}

type CardDefinition = [
  title: string,
  description: string,
  effect: CardEffectType,
  value?: number,
];

const makeDeck = (
  deck: CardDeckType,
  definitions: CardDefinition[],
): GameCard[] =>
  definitions.map(([title, description, effect, value], index) => ({
    id: `${deck.toLowerCase()}-${index + 1}`,
    deck,
    title,
    description,
    effect,
    ...(value === undefined ? {} : { value }),
  }));

// 24 thẻ có lợi, 6 thẻ bất lợi: 80% / 20%.
export const CHANCE_CARDS = makeDeck("CHANCE", [
  ["Trúng xổ số", "Bạn trúng xổ số và nhận {amount}.", "ADD_MONEY", 1000],
  [
    "Chuyến du lịch miễn phí",
    "Di chuyển theo chiều kim đồng hồ đến ô Du Lịch gần nhất.",
    "MOVE_TO_TRAVEL",
  ],
  ["Thưởng cuối năm", "Nhận tiền thưởng {amount}.", "ADD_MONEY", 500],
  ["Thừa kế", "Bạn được thừa kế {amount}.", "ADD_MONEY", 400],
  ["Lì xì may mắn", "Nhận {amount} tiền lì xì.", "ADD_MONEY", 200],
  ["Thắng cuộc thi", "Bạn thắng cuộc thi và nhận {amount}.", "ADD_MONEY", 300],
  ["Hoàn thuế", "Bạn được hoàn thuế {amount}.", "ADD_MONEY", 250],
  //   ["Đi nhanh", "Tiến 5 ô theo chiều kim đồng hồ.", "MOVE_STEPS", 5],
  ["Nhặt được ví", "Bạn nhặt được chiếc ví có {amount}.", "ADD_MONEY", 150],
  //   ["Vé tàu hạng nhất", "Tiến 3 ô theo chiều kim đồng hồ.", "MOVE_STEPS", 3],
  ["Đầu tư thành công", "Khoản đầu tư sinh lời {amount}.", "ADD_MONEY", 600],
  ["Cổ tức", "Nhận {amount} tiền cổ tức.", "ADD_MONEY", 350],
  ["Tăng lương", "Bạn được tăng lương và nhận {amount}.", "ADD_MONEY", 300],
  ["Thanh lý đồ cũ", "Bán đồ cũ và nhận {amount}.", "ADD_MONEY", 100],
  ["Thưởng thăng chức", "Nhận {amount} tiền thưởng.", "ADD_MONEY", 250],
  ["Quà sinh nhật", "Bạn nhận được {amount}.", "ADD_MONEY", 200],
  ["Giải thưởng sáng tạo", "Nhận {amount} tiền thưởng.", "ADD_MONEY", 450],
  [
    "Đáo hạn tiết kiệm",
    "Khoản tiết kiệm đáo hạn, nhận {amount}.",
    "ADD_MONEY",
    500,
  ],
  ["Phiếu mua hàng", "Bạn được tặng {amount}.", "ADD_MONEY", 100],
  ["Bồi thường hợp đồng", "Nhận {amount} tiền bồi thường.", "ADD_MONEY", 400],
  ["Trúng thưởng phụ", "Bạn nhận thêm {amount}.", "ADD_MONEY", 150],
  ["Bán hàng đắt khách", "Lợi nhuận tăng thêm {amount}.", "ADD_MONEY", 250],
  ["Quà từ đối tác", "Đối tác tặng bạn {amount}.", "ADD_MONEY", 200],
  ["Khoản đầu tư nhỏ", "Bạn thu về {amount} lợi nhuận.", "ADD_MONEY", 350],
  ["Truy thu thuế", "Bạn phải nộp thêm {amount}.", "PAY_MONEY", 200],
  ["Xe hỏng", "Sửa xe hết {amount}.", "PAY_MONEY", 150],
  ["Vi phạm giao thông", "Bạn nộp phạt {amount}.", "PAY_MONEY", 100],
  ["Mua sắm bị lừa", "Bạn mất {amount}.", "PAY_MONEY", 250],
  ["Sửa chữa nhà", "Bạn phải trả {amount} tiền sửa nhà.", "PAY_MONEY", 300],
  ["Phạt thanh toán trễ", "Bạn bị phạt {amount}.", "PAY_MONEY", 100],
]);

// 6 thẻ có lợi, 24 thẻ bất lợi: 20% / 80%.
export const FATE_CARDS = makeDeck("FATE", [
  ["Kiểm tra thuế", "Bạn phải nộp {amount}.", "PAY_MONEY", 500],
  ["Vào tù", "Bạn bị đưa vào tù và mất lượt hiện tại.", "GO_TO_JAIL"],
  ["Thua xổ số", "Bạn mất {amount}.", "PAY_MONEY", 200],
  [
    "Bão làm hư hại tài sản",
    "Chi phí khắc phục là {amount}.",
    "PAY_MONEY",
    400,
  ],
  [
    "Sửa nhà khẩn cấp",
    "Trả {amount} cho mỗi căn nhà đang sở hữu.",
    "PAY_PER_HOUSE",
    100,
  ],
  ["Đầu tư thua lỗ", "Bạn mất {amount}.", "PAY_MONEY", 600],
  ["Xe hỏng nặng", "Sửa chữa tốn {amount}.", "PAY_MONEY", 250],
  ["Vi phạm hợp đồng", "Bạn phải trả {amount}.", "PAY_MONEY", 350],
  ["Thất lạc hàng hóa", "Bạn mất {amount}.", "PAY_MONEY", 300],
  ["Phí ngân hàng", "Ngân hàng thu phí {amount}.", "PAY_MONEY", 150],
  [
    "Bảo trì bất động sản",
    "Trả {amount} cho mỗi bất động sản đang sở hữu.",
    "PAY_PER_PROPERTY",
    100,
  ],
  ["Phạt giao thông", "Bạn nộp phạt {amount}.", "PAY_MONEY", 200],
  ["Viện phí", "Bạn phải trả {amount}.", "PAY_MONEY", 300],
  ["Hỏng thiết bị", "Chi phí thay thế là {amount}.", "PAY_MONEY", 250],
  ["Bị lừa đảo", "Bạn mất {amount}.", "PAY_MONEY", 400],
  [
    "Thị trường chứng khoán giảm",
    "Khoản đầu tư giảm {amount}.",
    "PAY_MONEY",
    500,
  ],
  ["Chi phí pháp lý", "Bạn phải trả {amount}.", "PAY_MONEY", 350],
  ["Mất tiền khi đi du lịch", "Bạn mất {amount}.", "PAY_MONEY", 200],
  ["Hủy hợp đồng", "Bạn chịu khoản phí {amount}.", "PAY_MONEY", 300],
  ["Phí dịch vụ", "Bạn phải trả {amount}.", "PAY_MONEY", 150],
  ["Thanh toán trễ hạn", "Bạn bị phạt {amount}.", "PAY_MONEY", 250],
  ["Vi phạm xây dựng", "Bạn phải nộp phạt {amount}.", "PAY_MONEY", 400],
  ["Thiệt hại do thời tiết", "Bạn phải trả {amount}.", "PAY_MONEY", 300],
  ["Khoản nợ bất ngờ", "Bạn phải trả {amount}.", "PAY_MONEY", 500],
  ["Mất đồ quý giá", "Bạn mất {amount}.", "PAY_MONEY", 200],
  ["Quà may mắn", "Bạn bất ngờ nhận được {amount}.", "ADD_MONEY", 100],
  ["Thưởng nhỏ", "Bạn nhận được {amount}.", "ADD_MONEY", 150],
  ["Giải an ủi", "Bạn nhận được {amount}.", "ADD_MONEY", 200],
  ["Nhặt được tiền", "Bạn nhặt được {amount}.", "ADD_MONEY", 50],
  ["Hoàn phí dịch vụ", "Bạn được hoàn lại {amount}.", "ADD_MONEY", 100],
]);

/**
 * Áp kinh tế của ván vào bộ thẻ: số tiền = giá trị gốc x cardFactor x hệ số tiền khởi điểm,
 * và điền số tiền vào mô tả ("{amount}").
 */
export function scaleCards(cards: GameCard[], economyScale = 1): GameCard[] {
  return cards.map((card) => {
    if (card.value === undefined) return card;
    const value = roundMoney(
      card.value * ECONOMY_BASE.cardFactor * economyScale,
    );
    return {
      ...card,
      value,
      description: card.description.replace("{amount}", formatMoney(value)),
    };
  });
}

export function shuffleCards<T>(cards: T[]): T[] {
  const result = [...cards];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
