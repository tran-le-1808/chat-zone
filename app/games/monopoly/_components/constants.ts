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
  ["Trúng xổ số", "Bạn trúng xổ số và nhận $1,000.", "ADD_MONEY", 1000],
  [
    "Chuyến du lịch miễn phí",
    "Di chuyển theo chiều kim đồng hồ đến ô Du Lịch gần nhất.",
    "MOVE_TO_TRAVEL",
  ],
  ["Thưởng cuối năm", "Nhận tiền thưởng $500.", "ADD_MONEY", 500],
  ["Thừa kế", "Bạn được thừa kế $400.", "ADD_MONEY", 400],
  ["Lì xì may mắn", "Nhận $200 tiền lì xì.", "ADD_MONEY", 200],
  ["Thắng cuộc thi", "Bạn thắng cuộc thi và nhận $300.", "ADD_MONEY", 300],
  ["Hoàn thuế", "Bạn được hoàn thuế $250.", "ADD_MONEY", 250],
  //   ["Đi nhanh", "Tiến 5 ô theo chiều kim đồng hồ.", "MOVE_STEPS", 5],
  ["Nhặt được ví", "Bạn nhặt được chiếc ví có $150.", "ADD_MONEY", 150],
  //   ["Vé tàu hạng nhất", "Tiến 3 ô theo chiều kim đồng hồ.", "MOVE_STEPS", 3],
  ["Đầu tư thành công", "Khoản đầu tư sinh lời $600.", "ADD_MONEY", 600],
  ["Cổ tức", "Nhận $350 tiền cổ tức.", "ADD_MONEY", 350],
  ["Tăng lương", "Bạn được tăng lương và nhận $300.", "ADD_MONEY", 300],
  ["Thanh lý đồ cũ", "Bán đồ cũ và nhận $100.", "ADD_MONEY", 100],
  ["Thưởng thăng chức", "Nhận $250 tiền thưởng.", "ADD_MONEY", 250],
  ["Quà sinh nhật", "Bạn nhận được $200.", "ADD_MONEY", 200],
  ["Giải thưởng sáng tạo", "Nhận $450 tiền thưởng.", "ADD_MONEY", 450],
  [
    "Đáo hạn tiết kiệm",
    "Khoản tiết kiệm đáo hạn, nhận $500.",
    "ADD_MONEY",
    500,
  ],
  ["Phiếu mua hàng", "Bạn được tặng $100.", "ADD_MONEY", 100],
  ["Bồi thường hợp đồng", "Nhận $400 tiền bồi thường.", "ADD_MONEY", 400],
  ["Trúng thưởng phụ", "Bạn nhận thêm $150.", "ADD_MONEY", 150],
  ["Bán hàng đắt khách", "Lợi nhuận tăng thêm $250.", "ADD_MONEY", 250],
  ["Quà từ đối tác", "Đối tác tặng bạn $200.", "ADD_MONEY", 200],
  ["Khoản đầu tư nhỏ", "Bạn thu về $350 lợi nhuận.", "ADD_MONEY", 350],
  ["Truy thu thuế", "Bạn phải nộp thêm $200.", "PAY_MONEY", 200],
  ["Xe hỏng", "Sửa xe hết $150.", "PAY_MONEY", 150],
  ["Vi phạm giao thông", "Bạn nộp phạt $100.", "PAY_MONEY", 100],
  ["Mua sắm bị lừa", "Bạn mất $250.", "PAY_MONEY", 250],
  ["Sửa chữa nhà", "Bạn phải trả $300 tiền sửa nhà.", "PAY_MONEY", 300],
  ["Phạt thanh toán trễ", "Bạn bị phạt $100.", "PAY_MONEY", 100],
]);

// 6 thẻ có lợi, 24 thẻ bất lợi: 20% / 80%.
export const FATE_CARDS = makeDeck("FATE", [
  ["Kiểm tra thuế", "Bạn phải nộp $500.", "PAY_MONEY", 500],
  ["Vào tù", "Bạn bị đưa vào tù và mất lượt hiện tại.", "GO_TO_JAIL"],
  ["Thua xổ số", "Bạn mất $200.", "PAY_MONEY", 200],
  ["Bão làm hư hại tài sản", "Chi phí khắc phục là $400.", "PAY_MONEY", 400],
  [
    "Sửa nhà khẩn cấp",
    "Trả $100 cho mỗi căn nhà đang sở hữu.",
    "PAY_PER_HOUSE",
    100,
  ],
  ["Đầu tư thua lỗ", "Bạn mất $600.", "PAY_MONEY", 600],
  ["Xe hỏng nặng", "Sửa chữa tốn $250.", "PAY_MONEY", 250],
  ["Vi phạm hợp đồng", "Bạn phải trả $350.", "PAY_MONEY", 350],
  ["Thất lạc hàng hóa", "Bạn mất $300.", "PAY_MONEY", 300],
  ["Phí ngân hàng", "Ngân hàng thu phí $150.", "PAY_MONEY", 150],
  [
    "Bảo trì bất động sản",
    "Trả $100 cho mỗi bất động sản đang sở hữu.",
    "PAY_PER_PROPERTY",
    100,
  ],
  ["Phạt giao thông", "Bạn nộp phạt $200.", "PAY_MONEY", 200],
  ["Viện phí", "Bạn phải trả $300.", "PAY_MONEY", 300],
  ["Hỏng thiết bị", "Chi phí thay thế là $250.", "PAY_MONEY", 250],
  ["Bị lừa đảo", "Bạn mất $400.", "PAY_MONEY", 400],
  ["Thị trường chứng khoán giảm", "Khoản đầu tư giảm $500.", "PAY_MONEY", 500],
  ["Chi phí pháp lý", "Bạn phải trả $350.", "PAY_MONEY", 350],
  ["Mất tiền khi đi du lịch", "Bạn mất $200.", "PAY_MONEY", 200],
  ["Hủy hợp đồng", "Bạn chịu khoản phí $300.", "PAY_MONEY", 300],
  ["Phí dịch vụ", "Bạn phải trả $150.", "PAY_MONEY", 150],
  ["Thanh toán trễ hạn", "Bạn bị phạt $250.", "PAY_MONEY", 250],
  ["Vi phạm xây dựng", "Bạn phải nộp phạt $400.", "PAY_MONEY", 400],
  ["Thiệt hại do thời tiết", "Bạn phải trả $300.", "PAY_MONEY", 300],
  ["Khoản nợ bất ngờ", "Bạn phải trả $500.", "PAY_MONEY", 500],
  ["Mất đồ quý giá", "Bạn mất $200.", "PAY_MONEY", 200],
  ["Quà may mắn", "Bạn bất ngờ nhận được $100.", "ADD_MONEY", 100],
  ["Thưởng nhỏ", "Bạn nhận được $150.", "ADD_MONEY", 150],
  ["Giải an ủi", "Bạn nhận được $200.", "ADD_MONEY", 200],
  ["Nhặt được tiền", "Bạn nhặt được $50.", "ADD_MONEY", 50],
  ["Hoàn phí dịch vụ", "Bạn được hoàn lại $100.", "ADD_MONEY", 100],
]);

export function shuffleCards<T>(cards: T[]): T[] {
  const result = [...cards];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
