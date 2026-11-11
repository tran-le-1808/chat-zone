"use client";

import { Suspense } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import type { Tile3DData } from "../Board3D";
import {
  BAND_DEPTH,
  BOARD_COLORS,
  BOARD_FONT,
  SPECIAL_TILES,
  TILE_GAP,
  TILE_HEIGHT,
  innerDirection,
} from "./theme";
import { BOARD_CHARACTERS, preloadBoardFont } from "./fontPreload";

// Nạp trước toàn bộ ký tự của bàn cờ (tránh lỗi chữ mất ký tự sau một thời gian)
preloadBoardFont();

/** Mặt trên của ô (toạ độ local, ô được đặt ở y = 0.1) */
export const TILE_TOP = 0.02;
/** Mặt trên dải màu — nơi đặt nhà / cờ */
export const BAND_TOP = TILE_TOP + 0.06;

export interface TileLayout {
  isCorner: boolean;
  /** Tâm dải màu (phía trong bàn cờ) */
  band: [number, number];
  /** Tâm vùng thân ô (ngoài dải màu) */
  body: [number, number];
  /** Kích thước thực sau khi trừ khe hở */
  w: number;
  d: number;
}

/**
 * Vị trí đặt nhà / cờ trên ô.
 * Dãy phía xa (cạnh Bắc) có dải màu ở phía gần camera -> nhà đứng đó sẽ che chữ,
 * nên đặt nhà ở mép SAU của ô (phía xa camera).
 */
export function getBuildingAnchor(tile: Tile3DData): {
  position: [number, number, number];
  alongZ: boolean;
} {
  const layout = getTileLayout(tile);
  const side = Math.floor(tile.id / 9);
  if (side === 2 && !layout.isCorner) {
    return { position: [0, TILE_TOP, -layout.d / 2 + 0.48], alongZ: false };
  }
  return {
    position: [layout.band[0], BAND_TOP, layout.band[1]],
    alongZ: layout.band[0] !== 0,
  };
}

/**
 * Cỡ chữ vừa khít bề ngang ô: giữ cỡ mong muốn nếu đủ chỗ, tự thu nhỏ khi chữ dài
 * (ước lượng bề rộng trung bình 1 ký tự của font Nunito ExtraBold ~0.6 cỡ chữ).
 */
function fitFontSize(text: string, desired: number, maxWidth: number) {
  const est = Math.max(1, text.length) * 0.6;
  return Math.min(desired, maxWidth / est);
}

/** Phóng to chữ ở các dãy xa camera để dễ đọc như dãy gần */
function textScaleForSide(tileId: number) {
  const side = Math.floor(tileId / 9);
  if (side === 2) return 1.45;
  if (side === 1 || side === 3) return 1.18;
  return 1;
}

export function getTileLayout(tile: Tile3DData): TileLayout {
  const isCorner = tile.id % 9 === 0;
  const w = tile.size[0] - TILE_GAP;
  const d = tile.size[2] - TILE_GAP;
  if (isCorner) return { isCorner, band: [0, 0], body: [0, 0], w, d };
  const [dx, dz] = innerDirection(tile.id);
  const half = BAND_DEPTH / 2;
  return {
    isCorner,
    w,
    d,
    band: [dx * (w / 2 - half), dz * (d / 2 - half)],
    body: [-dx * half, -dz * half],
  };
}

const textProps = {
  font: BOARD_FONT,
  characters: BOARD_CHARACTERS,
  anchorX: "center" as const,
  anchorY: "middle" as const,
  textAlign: "center" as const,
  rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
  // Viền trắng mảnh giúp chữ nổi trên mọi nền (kể cả khi ô đang có hiệu ứng)
  outlineWidth: "6%",
  outlineColor: "#ffffff",
  // Luôn vẽ chữ đè lên các lớp hiệu ứng phẳng trên mặt ô
  renderOrder: 10,
  depthOffset: -2,
  sdfGlyphSize: 64,
};

/** Độ cao chữ so với mặt ô (cao hơn các lớp phủ / viền) */
const TEXT_Y = TILE_TOP + 0.1;

/** Ô đất / ô đặc biệt: khối nền, dải màu nhóm, viền chủ sở hữu & nhãn chữ */
export default function Tile3D({
  tile,
  isMonopoly = false,
}: {
  tile: Tile3DData;
  /** Chủ sở hữu đã có đủ cả nhóm màu -> tiền thuê x2 */
  isMonopoly?: boolean;
}) {
  const layout = getTileLayout(tile);
  const { isCorner, band, body, w, d } = layout;
  const isProperty = tile.type === "PROPERTY";
  const special = tile.type ? SPECIAL_TILES[tile.type] : undefined;
  const baseColor = isProperty
    ? BOARD_COLORS.tileBase
    : (special?.base ?? BOARD_COLORS.tileBase);
  const bandColor = isProperty ? tile.color : (special?.accent ?? tile.color);
  const [dx, dz] = isCorner ? [0, 0] : innerDirection(tile.id);
  const bandSize: [number, number, number] =
    dz !== 0 ? [w, 0.05, BAND_DEPTH] : [BAND_DEPTH, 0.05, d];

  const owned = tile.ownerId !== undefined;
  const label =
    isProperty || tile.type === "STATION"
      ? tile.name
      : (special?.label ?? tile.name);

  const isFarRow = Math.floor(tile.id / 9) === 2;
  // Dòng giá: đất trống hiện giá mua, đất có chủ hiện tiền thuê
  // (đủ bộ màu: không ghi x2 ở đây — đã có dấu ×2 nổi phía trên ô).
  // Dãy xa nhìn rất nhỏ -> bỏ chữ "Thuê" (đã có màu & viền chủ sở hữu) để số tiền to hơn
  const priceText =
    isProperty || tile.type === "STATION"
      ? owned
        ? `${isFarRow ? "" : "Thuê "}$${tile.currentRent ?? 0}`
        : `$${tile.landPrice ?? 0}`
      : null;

  const bodyW = dx !== 0 ? w - BAND_DEPTH : w;
  const k = textScaleForSide(tile.id);
  // Dãy xa: dồn chữ về phía gần camera, chừa mép sau cho nhà
  // Ô có biểu tượng (Cơ hội / Khí vận / Thuế): nhãn nằm DƯỚI biểu tượng (gần camera)
  // để biểu tượng cao không che chữ
  const nameZ = priceText
    ? isFarRow
      ? body[1] - 0.02
      : body[1] - 0.28
    : body[1] + (isFarRow ? 0.6 : 0.85);
  const priceZ = isFarRow ? body[1] + 0.72 : body[1] + 0.42;

  return (
    <group>
      {/* Khối nền ô bo góc mềm (như miếng nhựa đồ chơi) */}
      <RoundedBox
        args={[w, TILE_HEIGHT, d]}
        radius={0.08}
        smoothness={3}
        position={[0, TILE_TOP - TILE_HEIGHT / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={baseColor} roughness={0.5} />
      </RoundedBox>

      {/* Dải màu nhóm (phía trong bàn cờ), nổi nhẹ & bo tròn */}
      {!isCorner && (
        <RoundedBox
          args={[bandSize[0] - 0.12, 0.08, bandSize[2] - 0.12]}
          radius={0.035}
          smoothness={2}
          position={[band[0], TILE_TOP + 0.02, band[1]]}
          receiveShadow
        >
          <meshStandardMaterial color={bandColor} roughness={0.4} />
        </RoundedBox>
      )}

      {/* Ô góc: viền dày màu nhấn để nổi bật hơn ô thường */}
      {isCorner && special && (
        <OwnerFrame w={w} d={d} color={special.accent} thickness={0.2} />
      )}

      {/* Viền màu chủ sở hữu */}
      {owned && <OwnerFrame w={w} d={d} color={tile.ownerColor ?? "#ffffff"} />}

      {/* Nhãn chữ (tải font riêng, không chặn hiển thị bàn cờ) */}
      <Suspense fallback={null}>
        {isCorner ? (
          <Text
            {...textProps}
            position={[0, TEXT_Y + 0.05, d / 2 - 0.42]}
            fontSize={0.42 * Math.min(k, 1.15)}
            color={BOARD_COLORS.tileText}
            outlineWidth="10%"
          >
            {label}
          </Text>
        ) : (
          <>
            <Text
              {...textProps}
              position={[body[0], TEXT_Y, nameZ]}
              fontSize={fitFontSize(label, 0.32 * k, bodyW * 0.9)}
              maxWidth={bodyW * 0.92}
              lineHeight={1}
              color={BOARD_COLORS.tileText}
            >
              {label}
            </Text>
            {priceText && (
              <Text
                {...textProps}
                position={[body[0], TEXT_Y, priceZ]}
                // Dãy xa: số tiền to gần gấp đôi để nhìn rõ từ camera
                fontSize={fitFontSize(
                  priceText,
                  isFarRow ? 0.62 : 0.3 * k,
                  bodyW * 0.94,
                )}
                color={
                  isMonopoly
                    ? "#c2410c"
                    : owned
                      ? "#0f766e"
                      : BOARD_COLORS.tileSubText
                }
              >
                {priceText}
              </Text>
            )}
          </>
        )}
      </Suspense>
    </group>
  );
}

function OwnerFrame({
  w,
  d,
  color,
  thickness = 0.12,
}: {
  w: number;
  d: number;
  color: string;
  thickness?: number;
}) {
  const t = thickness;
  const h = 0.07;
  const y = TILE_TOP + h / 2;
  return (
    <group>
      <mesh position={[0, y, -d / 2 + t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[0, y, d / 2 - t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[-w / 2 + t / 2, y, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[w / 2 - t / 2, y, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  );
}
