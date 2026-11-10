import { preloadFont } from "troika-three-text";
import { BOARD_TILES_CONFIG } from "../boardConfig";
import { BOARD_FONT, SPECIAL_TILES } from "./theme";

/**
 * Tạo sẵn TẤT CẢ ký tự sẽ xuất hiện trên bàn cờ ngay khi tải trang.
 *
 * Thư viện chữ 3D (troika) gom các ký tự vào một texture dùng chung và
 * phóng to texture đó mỗi khi gặp ký tự mới (vd. số tiền thuê thay đổi giữa trận).
 * Việc phóng to giữa chừng khiến một số chữ đang hiển thị bị mất ký tự.
 * Nạp trước toàn bộ ký tự -> texture không phải đổi kích thước trong lúc chơi.
 */
const names = BOARD_TILES_CONFIG.map((t) => t.name).join("");
const labels = Object.values(SPECIAL_TILES)
  .map((s) => s.label)
  .join("");
export const BOARD_CHARACTERS = Array.from(
  new Set(
    names +
      labels +
      "Thuê $×x0123456789.,-+ " +
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  ),
).join("");

let started = false;
export function preloadBoardFont() {
  if (started || typeof window === "undefined") return;
  started = true;
  // troika bắt buộc phải có callback (thiếu sẽ ném lỗi giữa chừng khi nạp font)
  preloadFont(
    { font: BOARD_FONT, characters: BOARD_CHARACTERS, sdfGlyphSize: 64 },
    () => {},
  );
}
