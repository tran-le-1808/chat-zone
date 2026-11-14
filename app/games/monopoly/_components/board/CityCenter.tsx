"use client";

import { memo } from "react";
import { Text } from "@react-three/drei";
import { BOARD_COLORS, BOARD_FONT } from "./theme";

/**
 * Khu vực giữa bàn cờ (phong cách đồ chơi isometric):
 * thảm cỏ xanh + logo MONOPOLY lớn, hai bán nguyệt cát (toà nhà mái xanh phía xa,
 * bộ bài "?" cam phía gần), vài cây xanh. Hoàn toàn tĩnh — không có chuyển động.
 */
const GROUND_TOP = 0.06;

function Mat({ c, r = 0.7 }: { c: string; r?: number }) {
  return <meshStandardMaterial color={c} roughness={r} />;
}

function Tree({
  position,
  scale = 1,
  tone = 0,
}: {
  position: [number, number, number];
  scale?: number;
  tone?: number;
}) {
  const greens = ["#3fae4f", "#57c25a", "#2f9a55"];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.5, 8]} />
        <Mat c="#8a5a3b" />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.38, 10, 8]} />
        <Mat c={greens[tone % 3]} />
      </mesh>
      <mesh position={[0.12, 1.02, 0.05]}>
        <sphereGeometry args={[0.26, 8, 6]} />
        <Mat c={greens[(tone + 1) % 3]} />
      </mesh>
    </group>
  );
}

/** Bán nguyệt cát; `bulge` = +1 phình về +z, -1 phình về -z */
function SandHalf({
  position,
  bulge,
}: {
  position: [number, number, number];
  bulge: 1 | -1;
}) {
  return (
    <mesh position={position}>
      <cylinderGeometry
        args={[4.6, 4.6, 0.1, 32, 1, false, bulge === 1 ? -Math.PI / 2 : Math.PI / 2, Math.PI]}
      />
      <Mat c={BOARD_COLORS.sand} r={0.95} />
    </mesh>
  );
}

/** Toà nhà đá mái xanh dương (phía xa) */
function BlueBuilding() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[3.2, 1.1, 1.8]} />
        <Mat c="#f1e6cc" />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[3.5, 0.18, 2.1]} />
        <Mat c="#3a78d8" />
      </mesh>
      {[-1.2, 0, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.5, 0.92]}>
          <boxGeometry args={[0.5, 0.7, 0.04]} />
          <Mat c="#8fc5ff" r={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]}>
        <coneGeometry args={[1.0, 0.9, 4]} />
        <Mat c="#2f66c0" />
      </mesh>
    </group>
  );
}

/** Bộ bài "?" màu cam (phía gần) */
function CardDeck() {
  return (
    <group rotation={[0, -0.3, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.08 + i * 0.12, 0]}>
          <boxGeometry args={[2.0, 0.1, 2.8]} />
          <Mat c={i === 2 ? "#ff9a3c" : "#e8731a"} r={0.5} />
        </mesh>
      ))}
      <Text
        position={[0, 0.42, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={2.0}
        font={BOARD_FONT}
        color="#fff6e2"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#b84f0c"
      >
        ?
      </Text>
    </group>
  );
}

function CityCenter() {
  return (
    <group>
      {/* Viền đá & nền cỏ */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[19.8, 0.2, 19.8]} />
        <Mat c="#d9d2bd" />
      </mesh>
      <mesh position={[0, GROUND_TOP - 0.1, 0]} receiveShadow>
        <boxGeometry args={[19.0, 0.2, 19.0]} />
        <Mat c={BOARD_COLORS.cityGround} r={0.9} />
      </mesh>

      {/* Hai bán nguyệt cát */}
      <SandHalf position={[0, GROUND_TOP + 0.02, -9.5]} bulge={1} />
      <SandHalf position={[0, GROUND_TOP + 0.02, 9.5]} bulge={-1} />
      <group position={[0, GROUND_TOP + 0.05, -8.3]}>
        <BlueBuilding />
      </group>
      <group position={[0, GROUND_TOP + 0.05, 7.9]}>
        <CardDeck />
      </group>

      {/* Logo MONOPOLY */}
      <group rotation={[0, Math.PI / 4, 0]}>
      <Text
        position={[0, GROUND_TOP + 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={2.7}
        font={BOARD_FONT}
        color="#e63946"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.14}
        outlineColor="#ffffff"
      >
        MONOPOLY
      </Text>
      </group>

      {/* Cây xanh */}
      {[
        [-7.2, -4.2, 0],
        [7.2, -4.2, 1],
        [-7.2, 4.2, 2],
        [7.2, 4.2, 0],
        [-7.6, 0, 1],
        [7.6, 0, 2],
        [-3.8, -2.8, 0],
        [3.8, 2.8, 1],
      ].map(([x, z, t], i) => (
        <Tree key={i} position={[x, GROUND_TOP, z]} tone={t} scale={0.9} />
      ))}
    </group>
  );
}

export default memo(CityCenter);
