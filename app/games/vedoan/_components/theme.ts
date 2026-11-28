/** Bảng màu Vẽ Đoán: lớp học vẽ — nền xanh trời có nét vẽ nguệch ngoạc, giấy trắng, bút sáp nhiều màu */
import { Itim, Nunito } from "next/font/google";

export const font = Nunito({ weight: ["600", "700", "800", "900"], subsets: ["latin", "vietnamese"], display: "swap" });
export const hand = Itim({ weight: "400", subsets: ["latin", "vietnamese"], display: "swap" });

export const VD = {
  sky: "#4f86f7",
  sky2: "#2f5fd0",
  paper: "#fffdf7",
  ink: "#1f2a44",
  red: "#ff5d5d",
  yellow: "#ffd23f",
  green: "#2fb36d",
  blue: "#3a86ff",
  purple: "#8f5cf7",
  orange: "#ff9f1c",
};

const doodle = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' fill='none' stroke='white' stroke-opacity='.13' stroke-width='3' stroke-linecap='round'><path d='M14 30c10-12 20 12 30 0s20 12 30 0'/><circle cx='120' cy='34' r='12'/><path d='M30 110l14-24 14 24z'/><path d='M104 118c6-10 22-10 28 0s-22 18-28 0z'/><path d='M80 70l4 9 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z'/></svg>`,
);

export const PAGE_BG = {
  backgroundColor: VD.sky,
  backgroundImage: `url("data:image/svg+xml,${doodle}"), linear-gradient(180deg, ${VD.sky} 0%, ${VD.sky2} 100%)`,
} as const;

export const CARD = {
  background: VD.paper,
  border: `3px solid ${VD.ink}`,
  boxShadow: `5px 5px 0 ${VD.ink}`,
  color: VD.ink,
} as const;

/** Màu cho từng người chơi (theo thứ tự) */
export const PLAYER_COLORS = ["#ff5d5d", "#3a86ff", "#2fb36d", "#ff9f1c", "#8f5cf7", "#ff70a6", "#00b4d8", "#8d6e63", "#f4b400", "#6c757d"];
