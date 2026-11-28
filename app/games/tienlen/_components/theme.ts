/** Bảng màu "Tết": đỏ son, vàng kim, kem; bàn chơi nỉ xanh */
import { Be_Vietnam_Pro } from "next/font/google";

export const display = Be_Vietnam_Pro({ weight: ["700", "800", "900"], subsets: ["latin", "vietnamese"], display: "swap" });

export const TL = {
  bg: "#1a0606",
  red: "#c0201f",
  redDeep: "#7d0f0f",
  gold: "#f2c14e",
  goldDeep: "#b8860b",
  cream: "#fff6e3",
  ink: "#3a1210",
  inkSoft: "#7a4a3e",
  felt1: "#0f6a45",
  felt2: "#06402a",
};

export const PAGE_BG = { background: `radial-gradient(circle at 50% -10%, #4a0d0b, ${TL.bg} 60%)` } as const;
export const FELT_BG = {
  background: `radial-gradient(ellipse at 50% 45%, ${TL.felt1} 0%, ${TL.felt2} 75%)`,
} as const;

/** Thẻ kem viền vàng có hoạ tiết mây nhẹ */
export const CARD_BG = {
  backgroundColor: TL.cream,
  backgroundImage: "radial-gradient(rgba(192,32,31,.06) 1.2px, transparent 1.4px)",
  backgroundSize: "16px 16px",
  border: `2px solid ${TL.goldDeep}`,
  boxShadow: `inset 0 0 0 3px ${TL.cream}, inset 0 0 0 4px ${TL.gold}, 0 12px 32px rgba(0,0,0,.45)`,
} as const;
