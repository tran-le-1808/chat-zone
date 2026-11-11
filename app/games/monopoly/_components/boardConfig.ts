import { TileData, TileType } from "@/types/game.types";
import { ECONOMY_BASE, roundMoney } from "../_context/economy";

export const BOARD_TILES_CONFIG: {
  name: string;
  type: TileType;
  color: string;
  groupCode?: string;
  basePrice?: number;
}[] = [
  // CẠNH 1 (Index 0 - 8): Phía Nam / Xuất Phát (9 ô)
  { name: "START", type: "GO", color: "#16a34a" },
  {
    name: "Lạng Sơn",
    type: "PROPERTY",
    color: "#8b5cf6",
    groupCode: "G1",
    basePrice: 100,
  },
  { name: "", type: "CHANCE", color: "#ea580c" },
  {
    name: "Cao Bằng",
    type: "PROPERTY",
    color: "#8b5cf6",
    groupCode: "G1",
    basePrice: 120,
  },
  { name: "", type: "TAX", color: "#15803d" },
  { name: "BẾN XE BẮC", type: "STATION", color: "#64748b", basePrice: 200 },
  {
    name: "Hạ Long",
    type: "PROPERTY",
    color: "#06b6d4",
    groupCode: "G2",
    basePrice: 140,
  },
  // Ô chơi game: Oẳn tù tì với tất cả người chơi còn lại
  { name: "OẲN TÙ TÌ", type: "MINIGAME", color: "#ec4899" },
  {
    name: "Hà Nội",
    type: "PROPERTY",
    color: "#06b6d4",
    groupCode: "G2",
    basePrice: 180,
  },

  // CẠNH 2 (Index 9 - 17): Phía Tây (9 ô)
  { name: "NHÀ TÙ", type: "JAIL", color: "#334155" },
  {
    name: "Ninh Bình",
    type: "PROPERTY",
    color: "#ec4899",
    groupCode: "G3",
    basePrice: 200,
  },
  {
    name: "Thanh Hóa",
    type: "PROPERTY",
    color: "#ec4899",
    groupCode: "G3",
    basePrice: 220,
  },
  { name: "", type: "CHANCE", color: "#ea580c" },
  { name: "BẾN XE ĐÔNG", type: "STATION", color: "#64748b", basePrice: 200 },
  {
    name: "Nghệ An",
    type: "PROPERTY",
    color: "#f59e0b",
    groupCode: "G4",
    basePrice: 240,
  },
  {
    name: "Huế",
    type: "PROPERTY",
    color: "#f59e0b",
    groupCode: "G4",
    basePrice: 260,
  },
  { name: "", type: "FATE", color: "#6366f1" },
  {
    name: "Đà Nẵng",
    type: "PROPERTY",
    color: "#f59e0b",
    groupCode: "G4",
    basePrice: 280,
  },

  // CẠNH 3 (Index 18 - 26): Phía Bắc (9 ô)
  { name: "LỄ HỘI", type: "FESTIVAL", color: "#eab308" },
  {
    name: "Quy Nhơn",
    type: "PROPERTY",
    color: "#10b981",
    groupCode: "G5",
    basePrice: 320,
  },
  { name: "", type: "CHANCE", color: "#ea580c" },
  {
    name: "Nha Trang",
    type: "PROPERTY",
    color: "#10b981",
    groupCode: "G5",
    basePrice: 340,
  },
  { name: "BẾN XE TÂY", type: "STATION", color: "#64748b", basePrice: 200 },
  { name: "", type: "TAX", color: "#15803d" },
  {
    name: "Phan Thiết",
    type: "PROPERTY",
    color: "#3b82f6",
    groupCode: "G6",
    basePrice: 380,
  },
  // Ô chơi game: Xóc đĩa đoán chẵn / lẻ cho tất cả người chơi
  { name: "XÓC ĐĨA", type: "XOCDIA", color: "#dc2626" },
  {
    name: "TP.HCM",
    type: "PROPERTY",
    color: "#3b82f6",
    groupCode: "G6",
    basePrice: 450,
  },

  // CẠNH 4 (Index 27 - 35): Phía Đông (9 ô)
  { name: "DU LỊCH", type: "TRAVEL", color: "#0284c7" },
  {
    name: "Cần Thơ",
    type: "PROPERTY",
    color: "#ef4444",
    groupCode: "G7",
    basePrice: 480,
  },
  { name: "", type: "FATE", color: "#6366f1" },
  {
    name: "Phú Quốc",
    type: "PROPERTY",
    color: "#ef4444",
    groupCode: "G7",
    basePrice: 550,
  },
  { name: "BẾN XE NAM", type: "STATION", color: "#64748b", basePrice: 200 },
  {
    name: "Cà Mau",
    type: "PROPERTY",
    color: "#14b8a6",
    groupCode: "G8",
    basePrice: 580,
  },
  { name: "", type: "CHANCE", color: "#ea580c" },
  {
    name: "An Giang",
    type: "PROPERTY",
    color: "#14b8a6",
    groupCode: "G8",
    basePrice: 620,
  },
  {
    name: "Vũng Tàu",
    type: "PROPERTY",
    color: "#14b8a6",
    groupCode: "G8",
    basePrice: 650,
  },
];

/**
 * Tạo bàn cờ. `economyScale` = tiền khởi điểm / 10.000 (xem _context/economy.ts):
 * ván $20.000 -> giá đất / nhà / tiền thuê gấp đôi.
 */
export function generateInitialBoard(economyScale = 1): TileData[] {
  const SCALE = 1.25;

  const normalW = 2.0 * SCALE; // Chiều rộng ô thường (2.5)
  const cornerW = 2.8 * SCALE; // Chiều rộng ô góc (3.5)

  // Bàn cờ 36 ô = 4 ô góc + 32 ô thường (mỗi cạnh 8 ô thường ở giữa)
  const innerTotalW = 8 * normalW; // Tổng chiều dài phần ô thường
  const halfBoard = innerTotalW / 2 + cornerW; // Nửa chiều dài toàn bàn cờ

  // Tâm của ô góc
  const cornerCenter = halfBoard - cornerW / 2;

  // Méptrai/phải bên trong của ô góc (nơi bắt đầu xếp ô thường)
  const innerCornerEdge = innerTotalW / 2;

  return BOARD_TILES_CONFIG.map((cfg, i) => {
    const isCorner = i % 9 === 0;
    const side = Math.floor(i / 9);
    const indexInSide = i % 9; // 1 -> 8 (các ô thường)

    let size: [number, number, number];

    if (isCorner) {
      size = [cornerW, 0.2, cornerW];
    } else if (side === 1 || side === 3) {
      size = [cornerW, 0.2, normalW];
    } else {
      size = [normalW, 0.2, cornerW];
    }

    let x = 0;
    let z = 0;

    if (isCorner) {
      if (i === 0) {
        // Góc START (Đông Nam)
        x = cornerCenter;
        z = cornerCenter;
      } else if (i === 9) {
        // Góc NHÀ TÙ (Tây Nam)
        x = -cornerCenter;
        z = cornerCenter;
      } else if (i === 18) {
        // Góc LỄ HỘI (Tây Bắc)
        x = -cornerCenter;
        z = -cornerCenter;
      } else if (i === 27) {
        // Góc DU LỊCH (Đông Bắc)
        x = cornerCenter;
        z = -cornerCenter;
      }
    } else {
      // Vị trí tâm của từng ô thường tính từ mép trong của góc
      const offset = (indexInSide - 1) * normalW + normalW / 2;

      if (side === 0) {
        // Cạnh Nam: Từ Đông Nam -> Tây Nam (X giảm)
        x = innerCornerEdge - offset;
        z = cornerCenter;
      } else if (side === 1) {
        // Cạnh Tây: Từ Tây Nam -> Tây Bắc (Z giảm)
        x = -cornerCenter;
        z = innerCornerEdge - offset;
      } else if (side === 2) {
        // Cạnh Bắc: Từ Tây Bắc -> Đông Bắc (X tăng)
        x = -innerCornerEdge + offset;
        z = -cornerCenter;
      } else if (side === 3) {
        // Cạnh Đông: Từ Đông Bắc -> Đông Nam (Z tăng)
        x = cornerCenter;
        z = -innerCornerEdge + offset;
      }
    }

    // Giá đất theo kinh tế của ván (bến xe có giá riêng)
    // Giá ở mức chuẩn $10.000 (làm tròn), rồi mới nhân hệ số tiền khởi điểm
    // -> ván $20.000 gấp đôi CHÍNH XÁC từng con số
    const E = ECONOMY_BASE;
    const land1x =
      cfg.type === "STATION"
        ? E.stationPrice
        : roundMoney((cfg.basePrice || 100) * E.landFactor);
    const price = (factor: number) =>
      roundMoney(roundMoney(land1x * factor) * economyScale);
    const base = price(1);

    return {
      id: i,
      name: cfg.name,
      type: cfg.type,
      color: cfg.color,
      groupCode: cfg.groupCode,

      position: [x, 0.1, z],
      size,

      landPrice: base,
      house1Price: price(E.house1Factor),
      house2Price: price(E.house2Factor),
      house3Price: price(E.house3Factor),
      villaPrice: price(E.villaFactor),

      rent: price(E.rentRate),

      houses: 0,
      hasVilla: false,
    };
  });
}
