/**
 * Vẽ bản đồ pixel art 16 px/ô (bảng màu giới hạn) rồi phóng nguyên lần ×2 cho sắc nét;
 * nhãn khu vực vẽ ở độ phân giải cao. Chỉ vẽ lại khi lối thoát thay đổi.
 */
import { PALETTE as P } from "../_lib/art/palette";
import { PRISON_MAP } from "../_lib/engine/map";

export const TILE_PX = 32;
const S = 16;

const ZONE_TINT: Record<string, string> = {
  guardroom: "rgba(200,40,40,0.16)",
  solitary: "rgba(200,40,40,0.2)",
  solitary_0: "rgba(200,40,40,0.24)",
  solitary_1: "rgba(200,40,40,0.24)",
  canteen: "rgba(244,185,66,0.06)",
  workshop: "rgba(120,120,255,0.06)",
  library: "rgba(170,120,60,0.1)",
  laundry: "rgba(80,180,255,0.06)",
  infirmary: "rgba(255,255,255,0.06)",
  dorm: "rgba(170,120,60,0.08)",
  gym: "rgba(99,102,241,0.08)",
  shower: "rgba(56,189,248,0.1)",
};

export interface MapRoutes {
  ventOpen: boolean;
  fenceGaps: string[];
}

function drawPixelTiles(routes: MapRoutes): HTMLCanvasElement {
  const { width: W, height: H, tiles } = PRISON_MAP;
  const cv = document.createElement("canvas");
  cv.width = W * S;
  cv.height = H * S;
  const g = cv.getContext("2d")!;
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) {
      const ch = tiles[ty][tx];
      const x = tx * S;
      const y = ty * S;
      const zone = PRISON_MAP.zoneGrid[ty * W + tx];
      const chk = (tx + ty) % 2 === 0;
      const wood = zone === "library" || zone === "dorm";
      if (ch === "o") {
        r(x, y, S, S, chk ? P.outsideLight : P.outside);
        if ((tx * 7 + ty * 3) % 5 === 0) r(x + 4, y + 9, 1, 2, P.grass);
      } else if (ch === "," || ch === "x") {
        r(x, y, S, S, chk ? P.grassLight : P.grass);
        if ((tx * 5 + ty * 11) % 4 === 0) r(x + 3 + ((tx * 3) % 9), y + 5, 1, 2, P.bush);
      } else if (ch !== "#") {
        const base = zone?.startsWith("cell_") ? (chk ? P.cellFloorLight : P.cellFloor) : wood ? (chk ? P.wood : P.woodDark) : chk ? P.stoneLight : P.stone;
        r(x, y, S, S, base);
        if (wood) r(x, y + 7, S, 1, P.woodDark);
        else r(x, y, 1, 1, P.wallDark);
      }
      if (zone && ZONE_TINT[zone] && ch !== "#") r(x, y, S, S, ZONE_TINT[zone]);
      switch (ch) {
        case "#":
          r(x, y, S, S, P.wall);
          r(x, y, S, 3, P.wallTop);
          r(x, y + S - 2, S, 2, P.wallDark);
          if ((tx + ty) % 3 === 0) r(x + 4, y + 7, 6, 1, P.wallDark);
          break;
        case "d":
          r(x + 1, y + 6, S - 2, 4, P.woodDark);
          r(x + 2, y + 7, S - 4, 2, P.wood);
          break;
        case "L":
          r(x, y, S, S, P.rust);
          r(x + 1, y + 1, S - 2, S - 2, P.amber);
          r(x + 7, y + 5, 2, 5, P.ink);
          break;
        case "R":
          r(x, y, S, S, P.blood);
          for (let i = 2; i < S; i += 4) r(x + i, y + 1, 2, S - 2, P.steel);
          break;
        case "G":
          r(x, y, S, S, P.slate);
          for (let i = 1; i < S; i += 3) r(x + 1, y + i, S - 2, 1, P.steel);
          r(x + 6, y + 6, 4, 4, P.red);
          break;
        case "V":
          if (routes.ventOpen) {
            r(x, y, S, S, P.ink);
            r(x + 2, y + 2, S - 4, S - 4, P.night);
          } else {
            r(x, y, S, S, P.slate);
            for (let i = 3; i < S - 2; i += 3) r(x + 2, y + i, S - 4, 1, P.wallDark);
          }
          break;
        case "W":
          r(x, y, S, S, P.wall);
          r(x, y, S, 3, P.wallTop);
          for (let i = 4; i < S; i += 4) r(x + 1, y + i, S - 2, 1, P.wallTop);
          break;
        case "F": {
          // hàng rào thép gai: lưới mắt cáo + cuộn dây gai; ô đã cắt / buộc dây vẽ lỗ hổng
          const open = routes.fenceGaps.includes(`${tx},${ty}`);
          r(x, y + 1, S, 1, P.steel);
          r(x, y + S - 2, S, 1, P.steel);
          if (open) {
            r(x + 5, y + 2, 6, S - 4, P.ink);
            r(x + 7, y - 2, 2, S + 4, P.amber);
          } else {
            for (let i = 0; i < S; i += 4) {
              r(x + i, y + 2, 1, S - 4, P.silver);
              r(x + ((i + 2) % S), y + 4, 1, S - 8, P.steel);
            }
            for (let i = 1; i < S; i += 5) r(x + i, y, 2, 2, P.silver);
          }
          break;
        }
        case "K":
          r(x, y, S, S, P.rust);
          r(x + 1, y + 1, S - 2, S - 2, P.woodDark);
          r(x + 6, y + 6, 4, 4, P.gold);
          break;
        case "c":
          // cửa song sắt xà lim
          r(x, y + 5, S, 6, P.wallDark);
          for (let i = 1; i < S; i += 3) r(x + i, y + 2, 1, S - 4, P.silver);
          break;
        case "u":
          if (routes.ventOpen) {
            r(x, y, S, S, P.ink);
            r(x + 3, y, S - 6, S, P.night);
          } else {
            r(x, y, S, S, P.wall);
            r(x + 3, y, S - 6, S, P.wallDark);
          }
          break;
        case "T":
          r(x, y, S, S, P.woodDark);
          r(x + 2, y + 2, S - 4, S - 4, P.wood);
          r(x + 5, y + 5, 6, 6, P.amber);
          break;
        case "X":
          r(x, y + 1, S, S - 2, P.silver);
          r(x, y + 1, S, 2, P.white);
          if ((tx + ty) % 2 === 0) r(x + 3, y + 6, S - 6, 4, P.steel);
          break;
        case "b":
          // chỉ vẽ tấm nệm — gối, chăn, hình nộm vẽ theo trạng thái giường trong scene
          r(x + 1, y + 1, S - 2, S - 2, P.steel);
          r(x + 2, y + 2, S - 4, S - 4, P.silver);
          break;
        case "t":
          r(x + 4, y + 3, 8, 10, P.silver);
          r(x + 5, y + 5, 6, 6, P.white);
          r(x + 6, y + 6, 4, 4, P.sky);
          break;
        case "=":
          r(x, y + 3, S, S - 6, P.wood);
          r(x, y + 3, S, 2, P.woodLight);
          break;
        case "k":
          r(x + 1, y + 1, S - 2, S - 2, P.woodDark);
          r(x + 1, y + 1, S - 2, 3, P.wood);
          r(x + 6, y + 7, 4, 2, P.gold);
          break;
        case "B":
          r(x, y + 2, S, S - 4, P.wood);
          r(x + 2, y + 4, 4, 2, P.silver);
          r(x + 9, y + 6, 5, 2, P.red);
          break;
        case "J":
          r(x + 1, y + 1, S - 2, S - 2, P.slate);
          r(x + 3, y + 3, S - 6, 5, P.steel);
          r(x + 4, y + 10, 3, 3, P.amber);
          r(x + 9, y + 10, 3, 3, P.green);
          break;
        case "P":
          r(x + 1, y + 1, S - 2, S - 2, P.wallDark);
          r(x + 3, y + 3, S - 6, 6, P.teal);
          for (let i = 0; i < 3; i++) r(x + 3 + i * 4, y + 11, 2, 2, [P.red, P.green, P.amber][i]);
          break;
        case "S":
          r(x + 2, y + 2, S - 4, S - 4, P.slate);
          r(x + 3, y + 3, S - 6, 1, P.gold);
          r(x + 3, y + S - 4, S - 6, 1, P.gold);
          break;
        case "$":
          r(x, y + 2, S, S - 4, P.wood);
          r(x + 6, y + 4, 4, 8, P.gold);
          break;
        case "g":
          r(x + 2, y + 6, S - 4, 3, P.slate);
          r(x + 1, y + 4, 3, 7, P.wallDark);
          r(x + S - 4, y + 4, 3, 7, P.wallDark);
          break;
        case "s":
          r(x + 2, y + 2, S - 4, S - 4, P.sky);
          r(x + 6, y + 1, 4, 3, P.steel);
          for (let i = 4; i < S - 2; i += 3) r(x + 4 + (i % 6), y + i, 1, 2, P.white);
          break;
        case "x":
          r(x + 1, y + 3, S - 2, S - 4, P.bush);
          r(x + 3, y + 1, S - 6, 6, P.grassLight);
          break;
      }
    }
  // vạch điểm danh
  const rc = PRISON_MAP.areas.rollcall;
  if (rc) {
    g.fillStyle = P.gold;
    const [x0, y0, x1, y1] = rc;
    for (let x = x0 * S; x < (x1 + 1) * S; x += 4) {
      g.fillRect(x, y0 * S, 2, 1);
      g.fillRect(x, (y1 + 1) * S - 1, 2, 1);
    }
    for (let y = y0 * S; y < (y1 + 1) * S; y += 4) {
      g.fillRect(x0 * S, y, 1, 2);
      g.fillRect((x1 + 1) * S - 1, y, 1, 2);
    }
  }
  return cv;
}

export function drawMap(routes: MapRoutes): HTMLCanvasElement {
  const { width: W, height: H } = PRISON_MAP;
  const T = TILE_PX;
  const cv = document.createElement("canvas");
  cv.width = W * T;
  cv.height = H * T;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(drawPixelTiles(routes), 0, 0, W * T, H * T);
  g.font = `600 ${T * 0.42}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const z of PRISON_MAP.zones) {
    if (z.id === "outside" || z.id.startsWith("solitary_")) continue;
    const [x0, y0, x1, y1] = z.rects[0];
    const cx = ((x0 + x1 + 1) / 2) * T;
    const cy = z.id.startsWith("cell_") ? (y1 + 0.75) * T : ((y0 + y1 + 1) / 2) * T;
    g.fillStyle = z.restricted ? "rgba(255,120,110,0.55)" : "rgba(255,255,255,0.24)";
    g.fillText(z.id.startsWith("cell_") ? z.name.replace("Xà lim ", "") : z.name.toUpperCase(), cx, cy);
  }
  const rc = PRISON_MAP.areas.rollcall;
  if (rc) {
    g.fillStyle = "rgba(255,209,102,0.45)";
    g.fillText("ĐIỂM DANH", ((rc[0] + rc[2] + 1) / 2) * T, (rc[1] + 0.5) * T);
  }
  return cv;
}

/** Mặt nạ bóng tối ban đêm: tối toàn bản đồ, đục lỗ sáng quanh đèn */
export function drawNightMask(darkness: number, cellLightsOn: boolean, alarm: boolean, blackout = false): HTMLCanvasElement {
  const { width: W, height: H } = PRISON_MAP;
  const K = 8;
  const cv = document.createElement("canvas");
  cv.width = W * K;
  cv.height = H * K;
  const g = cv.getContext("2d")!;
  g.fillStyle = alarm ? `rgba(40,0,0,${darkness})` : `rgba(2,4,20,${darkness})`;
  g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = "destination-out";
  for (const l of blackout ? [] : PRISON_MAP.lights) {
    if (l.cell && !cellLightsOn) continue;
    const grad = g.createRadialGradient(l.x * K, l.y * K, 0, l.x * K, l.y * K, l.radius * K);
    grad.addColorStop(0, "rgba(0,0,0,0.95)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(l.x * K, l.y * K, l.radius * K, 0, Math.PI * 2);
    g.fill();
  }
  return cv;
}

export function drawMinimap(scale = 4): HTMLCanvasElement {
  const { width: W, height: H, tiles } = PRISON_MAP;
  const cv = document.createElement("canvas");
  cv.width = W * scale;
  cv.height = H * scale;
  const g = cv.getContext("2d")!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = tiles[y][x];
      g.fillStyle = ch === "#" || ch === "W" || ch === "V" || ch === "G" || ch === "u" ? P.wallTop : ch === "F" ? P.silver : ch === "o" ? P.outside : ch === "," ? P.grass : P.slate;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  return cv;
}
