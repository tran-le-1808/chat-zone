/**
 * Hiển thị xúc xắc của người khác (bot, người chơi online, tự lắc khi hết giờ).
 * Chỉ là hiệu ứng: kết quả thật vẫn do thao tác "roll" gửi tới host quyết định.
 */
export interface DiceShow {
  id: number;
  name: string;
  d1: number;
  d2: number;
}

/** Thời gian xúc xắc xoay (~1.35s) + hiện số nút (1s): khớp với DiceRoller3D */
export const DICE_SHOW_MS = 2400;

const subs = new Set<(d: DiceShow) => void>();
let seq = 0;

export const showDice = (d: Omit<DiceShow, "id">) => {
  const s = { ...d, id: ++seq };
  subs.forEach((f) => f(s));
};

export const onDiceShow = (f: (d: DiceShow) => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
