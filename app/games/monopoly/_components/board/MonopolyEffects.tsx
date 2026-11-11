"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Player3D, Tile3DData } from "../Board3D";
import type { PawnState } from "../Pawn3D";
import { BAND_TOP, getTileLayout } from "./Tile3D";
import { BAND_DEPTH, BOARD_FONT } from "./theme";
import { BOARD_CHARACTERS } from "./fontPreload";

/**
 * Hiệu ứng "đủ bộ màu" (độc quyền nhóm đất): tiền thuê đã được nhân đôi trong luật chơi
 * (calculateTileRent). Các component ở đây CHỈ hiển thị điều đó, không đổi logic.
 */

/** Trả về các groupCode mà mọi ô trong nhóm đều thuộc cùng 1 người chơi */
export function getMonopolyGroups(tiles: Tile3DData[]): Set<string> {
  const owners = new Map<string, Set<number | undefined>>();
  tiles.forEach((t) => {
    if (t.type !== "PROPERTY" || !t.groupCode) return;
    if (!owners.has(t.groupCode)) owners.set(t.groupCode, new Set());
    owners.get(t.groupCode)!.add(t.ownerId);
  });
  const result = new Set<string>();
  owners.forEach((set, code) => {
    if (set.size === 1 && !set.has(undefined)) result.add(code);
  });
  return result;
}

const textBase = {
  font: BOARD_FONT,
  characters: BOARD_CHARACTERS,
  anchorX: "center" as const,
  anchorY: "middle" as const,
};

/** Huy hiệu "×2" vàng lơ lửng + viền dải màu phát sáng trên ô thuộc bộ màu đủ */
export function MonopolyMarker({ tile }: { tile: Tile3DData }) {
  const layout = getTileLayout(tile);
  const badgeRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const alongZ = layout.band[0] !== 0;

  // Huy hiệu ở đầu dải màu (tránh chỗ đặt nhà ở giữa dải)
  const end = alongZ ? layout.d / 2 - 0.42 : layout.w / 2 - 0.42;
  const badgePos: [number, number, number] = alongZ
    ? [layout.band[0], BAND_TOP, end]
    : [end, BAND_TOP, layout.band[1]];
  const glowSize: [number, number, number] = alongZ
    ? [BAND_DEPTH, 0.04, layout.d]
    : [layout.w, 0.04, BAND_DEPTH];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (badgeRef.current) {
      badgeRef.current.position.y = BAND_TOP + 0.45 + Math.sin(t * 2.5) * 0.06;
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.35 + Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <group>
      {/* Viền dải màu phát sáng vàng */}
      <mesh
        ref={glowRef}
        position={[layout.band[0], BAND_TOP + 0.01, layout.band[1]]}
      >
        <boxGeometry args={glowSize} />
        <meshBasicMaterial
          color="#ffe066"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Huy hiệu ×2 */}
      <group ref={badgeRef} position={badgePos}>
        <RoundedBox
          args={[0.62, 0.36, 0.1]}
          radius={0.08}
          smoothness={3}
          castShadow
        >
          <meshStandardMaterial
            color="#ffc93c"
            roughness={0.3}
            metalness={0.3}
            emissive="#ff9f1c"
            emissiveIntensity={0.35}
          />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            {...textBase}
            position={[0, 0, 0.06]}
            fontSize={0.26}
            color="#7a2e00"
          >
            ×2
          </Text>
        </Suspense>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hiệu ứng khi người chơi khác dừng ở ô thuộc bộ màu đủ: chữ ×2 bật lên + mưa xu
// ---------------------------------------------------------------------------

const COINS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return {
    vx: Math.cos(a) * 1.1,
    vz: Math.sin(a) * 1.1,
    vy: 2.6 + (i % 3) * 0.5,
  };
});

function RentDoubleBurst({
  position,
  onDone,
}: {
  position: [number, number, number];
  onDone: () => void;
}) {
  const textRef = useRef<THREE.Group>(null);
  const coinsRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), 1800);
    return () => clearTimeout(timer);
  }, []);

  useFrame((_, delta) => {
    t.current += Math.min(delta, 1 / 30);
    const p = Math.min(t.current / 1.6, 1);
    if (textRef.current) {
      // Bật lên (nảy) rồi bay cao dần
      const pop = p < 0.2 ? p / 0.2 : 1;
      const s = 0.4 + pop * 1.1 + Math.sin(Math.min(p, 0.3) * 20) * 0.08;
      textRef.current.scale.setScalar(s * (1 - Math.max(0, p - 0.8) * 5));
      textRef.current.position.y = 0.9 + p * 1.2;
    }
    coinsRef.current?.children.forEach((c, i) => {
      const k = COINS[i];
      const tt = t.current;
      c.position.set(k.vx * tt, 0.3 + k.vy * tt - 4.5 * tt * tt, k.vz * tt);
      c.rotation.x = tt * 10;
      c.visible = c.position.y > 0;
    });
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.4 + p * 2.6);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.8 * (1 - p);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.15, 0]}
      >
        <ringGeometry args={[0.55, 0.75, 40]} />
        <meshBasicMaterial
          color="#ff4d4d"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <group ref={coinsRef}>
        {COINS.map((_, i) => (
          <mesh key={i}>
            <cylinderGeometry args={[0.12, 0.12, 0.035, 16]} />
            <meshStandardMaterial
              color="#ffd23f"
              metalness={0.4}
              roughness={0.3}
              emissive="#d99a00"
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
      </group>
      <group ref={textRef} position={[0, 0.9, 0]}>
        <Suspense fallback={null}>
          <Text
            {...textBase}
            fontSize={0.7}
            color="#ff3b3b"
            outlineWidth="12%"
            outlineColor="#ffffff"
            renderOrder={20}
          >
            ×2
          </Text>
        </Suspense>
      </group>
    </group>
  );
}

/**
 * Theo dõi quân cờ vừa dừng lại (moving -> idle). Nếu ô dừng là đất thuộc bộ màu đủ
 * của người khác -> phát hiệu ứng ×2 tại ô đó. Chạy trên mọi máy vì pawnStates được đồng bộ.
 */
export function RentDoubleEffects({
  players,
  tiles,
  pawnStates,
  monopolyGroups,
}: {
  players: Player3D[];
  tiles: Tile3DData[];
  pawnStates: Record<number, PawnState>;
  monopolyGroups: Set<string>;
}) {
  const prevStates = useRef<Record<number, PawnState>>({});
  const [bursts, setBursts] = useState<{ key: number; tileId: number }[]>([]);

  useEffect(() => {
    const landed: number[] = [];
    players.forEach((p) => {
      const was = prevStates.current[p.id];
      const now = pawnStates[p.id] ?? "idle";
      const travelled = (s: PawnState) => s === "moving" || s === "flying";
      if (travelled(was) && !travelled(now)) {
        const tile = tiles[p.tileIndex];
        if (
          tile &&
          tile.type === "PROPERTY" &&
          tile.ownerId !== undefined &&
          tile.ownerId !== p.id &&
          tile.groupCode &&
          monopolyGroups.has(tile.groupCode)
        ) {
          landed.push(tile.id);
        }
      }
    });
    prevStates.current = { ...pawnStates };
    if (landed.length) {
      setBursts((b) => [
        ...b,
        ...landed.map((tileId, i) => ({ key: Date.now() + i, tileId })),
      ]);
    }
    // Chỉ phản ứng khi trạng thái di chuyển thay đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pawnStates]);

  return (
    <>
      {bursts.map((b) => {
        const tile = tiles[b.tileId];
        if (!tile) return null;
        return (
          <RentDoubleBurst
            key={b.key}
            position={tile.position}
            onDone={() =>
              setBursts((list) => list.filter((x) => x.key !== b.key))
            }
          />
        );
      })}
    </>
  );
}
