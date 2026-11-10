/** Bảng màu & cấu hình chung cho bàn cờ "Đảo Tỷ Phú" */

/** Font chữ cục bộ (hỗ trợ tiếng Việt) — không phụ thuộc CDN khi tải */
export const BOARD_FONT = "/fonts/Nunito-ExtraBold.ttf";

export const BOARD_COLORS = {
  sky: "#9bdcff",
  sea: "#29b6c6",
  seaDeep: "#1a8fa3",
  sand: "#f6dfa4",
  islandGrass: "#7fd36b",
  slab: "#26386f",
  slabSide: "#1b2a57",
  trim: "#ffc93c",
  tileBase: "#fff6e2",
  tileText: "#1f2a44",
  tileSubText: "#5b6785",
  road: "#7a8396",
  roadLine: "#fef3c7",
  cityGround: "#8ad66f",
  sidewalk: "#e8e2d0",
} as const;

/** Màu nền & nhãn của các ô đặc biệt */
export const SPECIAL_TILES: Record<
  string,
  { base: string; label: string; accent: string }
> = {
  GO: { base: "#ffe58a", label: "BẮT ĐẦU", accent: "#e8a20c" },
  JAIL: { base: "#ffd0cc", label: "NHÀ TÙ", accent: "#d64545" },
  FESTIVAL: { base: "#ffd6ec", label: "LỄ HỘI", accent: "#e0438f" },
  TRAVEL: { base: "#c6ebff", label: "DU LỊCH", accent: "#1c8fd1" },
  CHANCE: { base: "#ffe1c2", label: "CƠ HỘI", accent: "#ea7a1c" },
  FATE: { base: "#e4dcff", label: "KHÍ VẬN", accent: "#7357e0" },
  TAX: { base: "#dff5c4", label: "THUẾ", accent: "#4f9a2c" },
  STATION: { base: "#e3e9f2", label: "BẾN XE", accent: "#4a5a78" },
  MINIGAME: { base: "#ffe0f0", label: "OẲN TÙ TÌ", accent: "#ff5c9a" },
  XOCDIA: { base: "#ffe3dc", label: "CHẴN LẺ", accent: "#dc2626" },
};

/** Chiều rộng dải màu nhóm đất (phía trong bàn cờ) */
export const BAND_DEPTH = 0.85;
/** Khe hở giữa các ô */
export const TILE_GAP = 0.08;
/** Độ dày ô đất */
export const TILE_HEIGHT = 0.18;

/**
 * Hướng "phía trong bàn cờ" của từng cạnh (tính theo toạ độ local của ô)
 * cạnh 0 (Nam) -> -z, cạnh 1 (Tây) -> +x, cạnh 2 (Bắc) -> +z, cạnh 3 (Đông) -> -x
 */
export function innerDirection(tileId: number): [number, number] {
  const side = Math.floor(tileId / 9);
  switch (side) {
    case 0:
      return [0, -1];
    case 1:
      return [1, 0];
    case 2:
      return [0, 1];
    default:
      return [-1, 0];
  }
}
