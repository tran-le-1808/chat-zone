/** Bảng màu "câu lạc bộ cờ vua": nỉ xanh rêu, giấy kem, chỉ vàng, bàn gỗ óc chó */
import { Noto_Serif } from "next/font/google";

export const serif = Noto_Serif({ weight: ["600", "800"], subsets: ["latin", "vietnamese"], display: "swap" });

export const CH = {
  bg: "#0d1712",
  cream: "#f6f1e4",
  creamDeep: "#ece3cc",
  ink: "#1c2a22",
  inkSoft: "#5c6b61",
  green: "#2f6b4f",
  greenDeep: "#1d4634",
  gold: "#c9a646",
  goldSoft: "#e6cf86",
  light: "#f0d9b5",
  dark: "#b58863",
};

export const PAGE_BG = { background: `radial-gradient(circle at 50% 0%, #1e3a2c, ${CH.bg} 62%)` } as const;

/** Thẻ giấy kem có hoạ tiết bàn cờ rất mờ */
export const CARD_BG = {
  backgroundColor: CH.cream,
  backgroundImage:
    "linear-gradient(45deg, rgba(28,42,34,.035) 25%, transparent 25%, transparent 75%, rgba(28,42,34,.035) 75%), linear-gradient(45deg, rgba(28,42,34,.035) 25%, transparent 25%, transparent 75%, rgba(28,42,34,.035) 75%)",
  backgroundSize: "28px 28px",
  backgroundPosition: "0 0, 14px 14px",
  border: `2px solid ${CH.greenDeep}`,
  boxShadow: `inset 0 0 0 3px ${CH.cream}, inset 0 0 0 4px ${CH.gold}, 0 12px 32px rgba(0,0,0,.45)`,
} as const;

export const PIECE_FONT = "'Apple Symbols','Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols 2','Noto Sans Symbols',serif";
