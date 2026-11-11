/**
 * Kinh tế của ván chơi — mọi mức tiền đều tỉ lệ với TIỀN KHỞI ĐIỂM.
 *
 * Các số bên dưới là mức chuẩn cho ván bắt đầu với $10.000 (hệ số 1).
 * Ván $20.000 -> hệ số 2 -> mọi giá gấp đôi; $15.000 -> x1.5; $30.000 -> x3.
 * Muốn cân bằng lại game: chỉ cần sửa các số trong ECONOMY_BASE.
 */
export const ECONOMY_BASE_MONEY = 10000;

export const ECONOMY_BASE = {
  /** Qua / dừng ở ô Bắt đầu (đi bằng xúc xắc hoặc bay từ ô Du lịch) */
  goSalary: 1000,
  /** Tiền nộp để ra tù */
  jailBail: 500,
  /** Oẳn tù tì: thắng / thua mỗi đối thủ */
  rpsStake: 500,
  /** Chẵn lẻ: đoán đúng nhận / đoán sai mất */
  xocStake: 500,
  /** Giá mua 1 bến xe */
  stationPrice: 1000,
  /** Tiền thuê bến xe theo số bến xe chủ sở hữu đang có (0..4) — luôn lớn hơn giá mua */
  stationRents: [0, 1200, 1600, 2400, 3200],
  /** Giá đất = basePrice (boardConfig) x landFactor */
  landFactor: 4,
  /** Giá trọn gói (đất + n nhà) = giá đất x hệ số */
  house1Factor: 1.4,
  house2Factor: 1.8,
  house3Factor: 2.2,
  /** Chi phí nâng 3 nhà lên Khách sạn = giá đất x hệ số */
  villaFactor: 1.2,
  /**
   * Tiền thuê = số tiền đã đầu tư vào ô (đất / đất + n nhà / khách sạn) x rentRate.
   * > 1 -> tiền thuê luôn lớn hơn giá mua. Đủ bộ màu x2, Lễ hội x2 (nhân thêm).
   */
  rentRate: 1.2,
  /** Số tiền trên thẻ Cơ hội / Khí vận = giá trị gốc trên thẻ x hệ số */
  cardFactor: 2,
} as const;

export interface Economy {
  /** Hệ số so với ván $10.000 */
  scale: number;
  goSalary: number;
  jailBail: number;
  rpsStake: number;
  xocStake: number;
  stationPrice: number;
  stationRents: number[];
}

/** Làm tròn tới hàng chục cho số tiền gọn gàng */
export const roundMoney = (n: number) => Math.round(n / 10) * 10;

export const economyScale = (startingMoney?: number) =>
  startingMoney && startingMoney > 0 ? startingMoney / ECONOMY_BASE_MONEY : 1;

export function makeEconomy(startingMoney?: number): Economy {
  const scale = economyScale(startingMoney);
  const s = (n: number) => roundMoney(n * scale);
  return {
    scale,
    goSalary: s(ECONOMY_BASE.goSalary),
    jailBail: s(ECONOMY_BASE.jailBail),
    rpsStake: s(ECONOMY_BASE.rpsStake),
    xocStake: s(ECONOMY_BASE.xocStake),
    stationPrice: s(ECONOMY_BASE.stationPrice),
    stationRents: ECONOMY_BASE.stationRents.map(s),
  };
}

export const formatMoney = (n: number) => `$${n.toLocaleString("vi-VN")}`;
