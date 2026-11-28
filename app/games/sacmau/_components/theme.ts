/** Bảng màu Sắc Màu: nền chàm đêm, 4 hệ Lửa / Nước / Lá / Gió */
import { Baloo_2 } from "next/font/google";
import { Droplet, Flame, Leaf, Wind, type LucideIcon } from "lucide-react";

export const font = Baloo_2({ weight: ["600", "700", "800"], subsets: ["latin", "vietnamese"], display: "swap" });

export const SM = {
  bg: "#120f2b",
  panel: "#1d1842",
  ink: "#1f1a3d",
  cream: "#fdf8ee",
  gold: "#ffd166",
  table1: "#2a2468",
  table2: "#120f2b",
};

export const HE: { name: string; main: string; dark: string; soft: string; Icon: LucideIcon }[] = [
  { name: "Lửa", main: "#f26a2e", dark: "#b8400f", soft: "#ffd9c4", Icon: Flame },
  { name: "Nước", main: "#2f86eb", dark: "#1a56a6", soft: "#cfe4ff", Icon: Droplet },
  { name: "Lá", main: "#2fb062", dark: "#1b7a40", soft: "#c9f0d6", Icon: Leaf },
  { name: "Gió", main: "#9a5cf0", dark: "#6430b5", soft: "#e6d6ff", Icon: Wind },
];

export const PAGE_BG = { background: `radial-gradient(circle at 50% -10%, #3a2a8a, ${SM.bg} 62%)` } as const;
export const TABLE_BG = { background: `radial-gradient(ellipse at 50% 45%, ${SM.table1} 0%, ${SM.table2} 78%)` } as const;
export const CARD_BG = {
  backgroundColor: SM.cream,
  backgroundImage: "radial-gradient(rgba(154,92,240,.08) 1.2px, transparent 1.4px)",
  backgroundSize: "16px 16px",
  border: "2px solid #2a2468",
  boxShadow: `inset 0 0 0 3px ${SM.cream}, inset 0 0 0 4.5px ${SM.gold}, 0 12px 32px rgba(0,0,0,.45)`,
} as const;
