"use client";

import { Suspense } from "react";
import * as THREE from "three";
import { RoundedBox, Text } from "@react-three/drei";
import type { Tile3DData } from "../Board3D";
import {
  BAND_DEPTH,
  BOARD_COLORS,
  BOARD_FONT,
  SPECIAL_TILES,
  TILE_GAP,
  CORNER_LABEL_YAW,
  innerDirection,
  labelYawBySide,
  sideOfTile,
} from "./theme";
import { BOARD_CHARACTERS, preloadBoardFont } from "./fontPreload";

// Nạp trước toàn bộ ký tự của bàn cờ (tránh lỗi chữ mất ký tự sau một thời gian)
preloadBoardFont();

/** Cỡ chữ tên / giá (đơn vị thế giới) — đủ lớn để đọc được khi bàn phóng đầy màn hình */
const NAME_FONT = 0.55;
const PRICE_FONT = 0.72;

/** Cỡ chữ để từ DÀI NHẤT trong nhãn vừa bề ngang (nhãn dài tự xuống dòng) */
function longestWordFit(text: string, maxWidth: number) {
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  return maxWidth / (longest * 0.62);
}

/** Độ dày lớp mặt trên (phần sáng) của ô */
const LIP_H = 0.14;

/** Làm tối màu hex theo hệ số f (0..1) */
function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

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
  const side = Math.floor(tile.id / 8);
  if (side === 2 && !layout.isCorner) {
    return { position: [0, TILE_TOP, -layout.d / 2 + 0.48], alongZ: false };
  }
  return {
    position: [layout.band[0], BAND_TOP, layout.band[1]],
    alongZ: layout.band[0] !== 0,
  };
}

export function getTileLayout(tile: Tile3DData): TileLayout {
  const isCorner = tile.id % 8 === 0;
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
  const [, dz] = isCorner ? [0, 0] : innerDirection(tile.id);
  const bandSize: [number, number, number] =
    dz !== 0 ? [w, 0.05, BAND_DEPTH] : [BAND_DEPTH, 0.05, d];

  // Độ dày khối: đáy ô chạm mặt đế bàn (y ≈ -0.08 trong toạ độ thế giới)
  const thick = tile.position[1] + TILE_TOP + 0.08;
  const sideColor = shade(bandColor, 0.55);
  const owned = tile.ownerId !== undefined;
  const label =
    isProperty || tile.type === "STATION"
      ? tile.name
      : (special?.label ?? tile.name);

  const isFarRow = false;
  // Dòng giá: đất trống hiện giá mua, đất có chủ hiện tiền thuê
  // (đủ bộ màu: không ghi x2 ở đây — đã có dấu ×2 nổi phía trên ô).
  // Dãy xa nhìn rất nhỏ -> bỏ chữ "Thuê" (đã có màu & viền chủ sở hữu) để số tiền to hơn
  const priceText =
    isProperty || tile.type === "STATION"
      ? owned
        ? `${isFarRow ? "" : "Thuê "}$${tile.currentRent ?? 0}`
        : `$${tile.landPrice ?? 0}`
      : null;

  // Khung nhãn: (u, v) = (dọc theo hướng đọc, hướng xuống của chữ). Cả khối nhãn
  // (tên + giá) xoay chung theo `labelYawBySide` nên không bao giờ lệch nhau / lộn ngược.
  const side = sideOfTile(tile.id);
  const labelYaw = isCorner ? CORNER_LABEL_YAW : labelYawBySide[side];
  // Độ dài đọc được: dọc cạnh ô (sau khi xoay nhãn)
  const readW = (side === 1 || side === 3 ? d : w) - 0.1;
  const nameSize = Math.min(NAME_FONT, longestWordFit(label, readW));
  const priceSize = priceText ? Math.min(PRICE_FONT, readW / (priceText.length * 0.62)) : 0;
  // Ô có giá: tên ở trên, giá ở dưới. Ô đặc biệt: tên nằm DƯỚI biểu tượng.
  const nameV = priceText ? -0.5 : 1.0;
  const priceV = 0.72;

  return (
    <group>
      {/* THÂN KHỐI: 2 mặt bên tối hơn (màu nhóm đã làm tối) + mặt trên sáng có cạnh vát */}
      <RoundedBox
        args={[w, thick - LIP_H, d]}
        radius={0.05}
        smoothness={2}
        position={[0, TILE_TOP - LIP_H - (thick - LIP_H) / 2, 0]}
      >
        <meshStandardMaterial color={sideColor} roughness={0.7} />
      </RoundedBox>
      <RoundedBox
        args={[w, LIP_H, d]}
        radius={0.06}
        smoothness={3}
        position={[0, TILE_TOP - LIP_H / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={baseColor} roughness={0.45} />
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
          <group position={[0, TEXT_Y + 0.05, 0]} rotation={[0, labelYaw, 0]}>
            <Text
              {...textProps}
              position={[0, 0, d / 2 - 0.5]}
              fontSize={Math.min(0.5, longestWordFit(label, 2.4))}
              maxWidth={2.5}
              color={BOARD_COLORS.tileText}
              outlineWidth="10%"
            >
              {label}
            </Text>
          </group>
        ) : (
          <group
            position={[body[0], TEXT_Y, body[1]]}
            rotation={[0, labelYaw, 0]}
          >
            <Text
              {...textProps}
              position={[0, 0, nameV]}
              fontSize={nameSize}
              maxWidth={readW}
              lineHeight={1}
              color={BOARD_COLORS.tileText}
            >
              {label}
            </Text>
            {priceText && (
              <Text
                {...textProps}
                position={[0, 0, priceV]}
                fontSize={priceSize}
                outlineWidth="12%"
                outlineColor="#ffffff"
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
          </group>
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
