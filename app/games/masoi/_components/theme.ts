/** Bảng màu Ma Sói: đêm xanh thẫm ánh trăng, ngày vàng nắng làng quê */
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import { Crosshair, Eye, FlaskConical, Home, PawPrint, Shield, type LucideIcon } from "lucide-react";
import type { Role } from "../_lib/game";

export const font = Be_Vietnam_Pro({ weight: ["400", "600", "700", "800"], subsets: ["latin", "vietnamese"], display: "swap" });
export const title = Playfair_Display({ weight: ["700", "800", "900"], subsets: ["latin", "vietnamese"], display: "swap" });

export const MS = {
  night: "#0b1026",
  night2: "#18214a",
  moon: "#f4e7bf",
  blood: "#c0392b",
  bloodDark: "#7d1d14",
  day: "#f6e7c8",
  day2: "#e9c98b",
  sun: "#f2a93b",
  ink: "#2b2118",
  parchment: "#fbf3e1",
  gold: "#d9a441",
};

export const NIGHT_BG = {
  backgroundColor: MS.night,
  backgroundImage: [
    "radial-gradient(circle at 78% 12%, rgba(244,231,191,.22), transparent 18%)",
    "radial-gradient(1px 1px at 12% 22%, #fff, transparent)",
    "radial-gradient(1px 1px at 32% 8%, #fff, transparent)",
    "radial-gradient(1.5px 1.5px at 58% 28%, #fff, transparent)",
    "radial-gradient(1px 1px at 88% 40%, #fff, transparent)",
    "radial-gradient(1px 1px at 22% 62%, rgba(255,255,255,.7), transparent)",
    "radial-gradient(1.2px 1.2px at 70% 70%, rgba(255,255,255,.6), transparent)",
    `linear-gradient(180deg, ${MS.night} 0%, ${MS.night2} 70%, #0e1a1a 100%)`,
  ].join(","),
} as const;

export const DAY_BG = {
  backgroundColor: MS.day,
  backgroundImage: [
    "radial-gradient(circle at 80% 8%, rgba(255,214,120,.75), transparent 22%)",
    `linear-gradient(180deg, #f9d98f 0%, ${MS.day} 45%, #d9c08a 100%)`,
  ].join(","),
} as const;

export const PAPER = {
  backgroundColor: MS.parchment,
  backgroundImage: "radial-gradient(rgba(120,80,30,.07) 1px, transparent 1.2px)",
  backgroundSize: "14px 14px",
  border: `2px solid ${MS.ink}`,
  boxShadow: `inset 0 0 0 3px ${MS.parchment}, inset 0 0 0 4.5px ${MS.gold}, 0 12px 32px rgba(0,0,0,.4)`,
} as const;

export interface RoleMeta {
  name: string;
  color: string;
  Icon: LucideIcon;
  team: "Sói" | "Dân";
  desc: string;
}

export const ROLE: Record<Role, RoleMeta> = {
  wolf: { name: "Ma Sói", color: "#c0392b", Icon: PawPrint, team: "Sói", desc: "Mỗi đêm cùng bầy chọn một người để cắn. Ban ngày giả làm dân lành. Thắng khi số Sói bằng số người còn lại." },
  villager: { name: "Dân Làng", color: "#6b8f4e", Icon: Home, team: "Dân", desc: "Không có phép gì — chỉ có lá phiếu và cái đầu tỉnh táo. Tìm ra và treo cổ hết Sói." },
  seer: { name: "Tiên Tri", color: "#7c5cff", Icon: Eye, team: "Dân", desc: "Mỗi đêm soi một người để biết người đó có phải Sói không. Ban ngày có thể công bố kết quả — nhưng Sói sẽ săn bạn." },
  guard: { name: "Bảo Vệ", color: "#2f7fd8", Icon: Shield, team: "Dân", desc: "Mỗi đêm che chở một người (kể cả mình) khỏi nanh Sói. Không được che một người hai đêm liền." },
  witch: { name: "Phù Thuỷ", color: "#25a06a", Icon: FlaskConical, team: "Dân", desc: "Có 1 bình cứu và 1 bình độc cho cả ván. Mỗi đêm biết ai bị cắn, được dùng tối đa một bình." },
  hunter: { name: "Thợ Săn", color: "#c97a2e", Icon: Crosshair, team: "Dân", desc: "Khi chết (bị cắn hoặc bị treo cổ) được bắn chết ngay một người. Bị đầu độc thì không kịp bắn." },
};

export const PHASE_VI = { night: "Đêm", witch: "Đêm", day: "Ngày", vote: "Bỏ phiếu", hunter: "Thợ Săn", over: "Kết thúc" } as const;
