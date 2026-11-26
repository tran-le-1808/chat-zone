/** Bảng màu "cờ tướng truyền thống": bàn gỗ, quân ngà, sơn mài đỏ, mực tàu, chỉ vàng */
import { Noto_Serif } from "next/font/google";

export const serif = Noto_Serif({ weight: ["600", "800"], subsets: ["latin", "vietnamese"], display: "swap" });

export const XQ = {
  bg: "#1a0f0c",
  bgSoft: "#24150f",
  paper: "#f4e7c9",
  paperDeep: "#ead7ae",
  ink: "#2a1a12",
  inkSoft: "#6b5444",
  red: "#b3261e",
  redDeep: "#7f1610",
  gold: "#c99a2e",
  goldSoft: "#e9c86b",
  wood1: "#e9c27b",
  wood2: "#d6a55a",
  line: "#5a3417",
  ivory: "#fbf1d6",
  black: "#1f1b18",
};

/** Nền giấy dó có vân nhẹ */
export const PAPER_BG = {
  backgroundColor: XQ.paper,
  backgroundImage:
    "radial-gradient(rgba(122,80,40,.07) 1px, transparent 1.2px), radial-gradient(rgba(122,80,40,.05) 1px, transparent 1.2px)",
  backgroundSize: "14px 14px, 23px 23px",
  backgroundPosition: "0 0, 7px 11px",
} as const;

/** Khung sơn mài: viền đỏ + chỉ vàng */
export const LACQUER_FRAME = {
  border: `3px solid ${XQ.redDeep}`,
  boxShadow: `inset 0 0 0 2px ${XQ.goldSoft}, 0 10px 30px rgba(0,0,0,.45)`,
} as const;

export const CJK_FONT = "'Kaiti SC','STKaiti','KaiTi','Noto Serif SC','Noto Serif CJK SC','Songti SC','SimSun',serif";
