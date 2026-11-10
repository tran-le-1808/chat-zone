"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOARD_COLORS } from "./theme";

/** Mặt trên của đảo (thấp hơn mặt bàn cờ) */
const ISLAND_TOP = -0.9;
/** Nửa cạnh vòng đường xe buýt quanh bàn cờ */
const ROAD_R = 15.5;
const ROAD_W = 1.2;

// ---------------------------------------------------------------- Xe buýt chạy vòng quanh đảo
function Bus() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    // Đi hết 1 vòng (4 cạnh) trong 40 giây, ngược chiều kim đồng hồ nhìn từ trên
    const s = (((clock.elapsedTime / 10) % 4) + 4) % 4;
    const side = Math.floor(s);
    const f = s - side;
    const a = -ROAD_R + f * 2 * ROAD_R;
    const lane = ROAD_R;
    switch (side) {
      case 0:
        g.position.set(a, ISLAND_TOP, lane);
        g.rotation.y = 0;
        break;
      case 1:
        g.position.set(lane, ISLAND_TOP, -a);
        g.rotation.y = Math.PI / 2;
        break;
      case 2:
        g.position.set(-a, ISLAND_TOP, -lane);
        g.rotation.y = Math.PI;
        break;
      default:
        g.position.set(-lane, ISLAND_TOP, a);
        g.rotation.y = -Math.PI / 2;
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[1.5, 0.6, 0.62]} />
        <meshStandardMaterial color="#3fbf8f" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[1.42, 0.12, 0.56]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      {/* Dải cửa kính */}
      {[0.32, -0.32].map((z) => (
        <mesh key={z} position={[0, 0.55, z]}>
          <boxGeometry args={[1.3, 0.2, 0.02]} />
          <meshStandardMaterial color="#cdeeff" roughness={0.15} />
        </mesh>
      ))}
      <mesh position={[0.76, 0.5, 0]}>
        <boxGeometry args={[0.02, 0.32, 0.5]} />
        <meshStandardMaterial color="#cdeeff" roughness={0.15} />
      </mesh>
      {/* Bánh xe */}
      {[
        [0.48, 0.3],
        [-0.48, 0.3],
        [0.48, -0.3],
        [-0.48, -0.3],
      ].map(([x, z]) => (
        <mesh
          key={`${x}${z}`}
          position={[x, 0.14, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.13, 0.13, 0.08, 14]} />
          <meshStandardMaterial color="#2b2f3a" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- Cây dừa
function CoconutTree({
  position,
  lean = 0.25,
  rotY = 0,
}: {
  position: [number, number, number];
  lean?: number;
  rotY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotY, lean]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 2.2, 8]} />
        <meshStandardMaterial color="#a77b4f" roughness={0.9} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.45, 2.15, Math.sin(a) * 0.45]}
            rotation={[Math.sin(a) * 0.6, -a, Math.cos(a) * -0.6]}
            scale={[1, 0.15, 0.38]}
          >
            <sphereGeometry args={[0.6, 10, 8]} />
            <meshStandardMaterial color="#3fae4f" roughness={0.7} />
          </mesh>
        );
      })}
      <mesh position={[0.08, 2.0, 0.05]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- Mây trôi
function Cloud({
  position,
  speed,
  scale = 1,
}: {
  position: [number, number, number];
  speed: number;
  scale?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.position.x =
        position[0] + Math.sin(clock.elapsedTime * speed) * 3;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[
        [0, 0, 0, 1.2],
        [1.2, -0.2, 0.2, 0.9],
        [-1.1, -0.25, 0, 0.85],
        [0.4, 0.5, -0.1, 0.8],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 14, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- Sóng bọt quanh đảo
function Foam() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 1.2) * 0.015;
    ref.current.scale.set(s, s, 1);
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.45 + Math.sin(clock.elapsedTime * 1.2) * 0.15;
  });
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, Math.PI / 4]}
      position={[0, -2.14, 0]}
    >
      <ringGeometry args={[25.2, 26.6, 4, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
    </mesh>
  );
}

function IslandEnvironment() {
  const islandHalf = 17.4;

  return (
    <group>
      {/* Biển */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2.2, 0]}
        receiveShadow
      >
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={BOARD_COLORS.sea} roughness={0.35} />
      </mesh>
      <Foam />

      {/* Thân đảo: bãi cát + thảm cỏ */}
      <mesh position={[0, -1.55, 0]} receiveShadow>
        <boxGeometry args={[islandHalf * 2 + 1.2, 1.3, islandHalf * 2 + 1.2]} />
        <meshStandardMaterial color={BOARD_COLORS.sand} roughness={0.95} />
      </mesh>
      <mesh position={[0, ISLAND_TOP - 0.1, 0]} receiveShadow>
        <boxGeometry args={[islandHalf * 2, 0.2, islandHalf * 2]} />
        <meshStandardMaterial
          color={BOARD_COLORS.islandGrass}
          roughness={0.95}
        />
      </mesh>

      {/* Đường vòng quanh bàn cờ */}
      {[
        [0, ROAD_R, 2 * ROAD_R + ROAD_W, ROAD_W],
        [0, -ROAD_R, 2 * ROAD_R + ROAD_W, ROAD_W],
        [ROAD_R, 0, ROAD_W, 2 * ROAD_R + ROAD_W],
        [-ROAD_R, 0, ROAD_W, 2 * ROAD_R + ROAD_W],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, ISLAND_TOP + 0.01, z]} receiveShadow>
          <boxGeometry args={[w, 0.02, d]} />
          <meshStandardMaterial color={BOARD_COLORS.road} roughness={0.9} />
        </mesh>
      ))}
      <Bus />

      {/* Cây dừa ở các góc đảo */}
      {[
        [16.6, 16.6, 0.25, 0.4],
        [-16.6, 16.6, -0.25, 1.2],
        [16.6, -16.6, 0.2, 2.4],
        [-16.6, -16.6, -0.2, 3.6],
        [16.8, 4, 0.18, 0.8],
        [-16.8, -5, -0.2, 2.0],
      ].map(([x, z, lean, rot], i) => (
        <CoconutTree
          key={i}
          position={[x, ISLAND_TOP, z]}
          lean={lean}
          rotY={rot}
        />
      ))}

      {/* Mây */}
      <Cloud position={[-26, 4, -10]} speed={0.15} scale={1.4} />
      <Cloud position={[27, 5, -16]} speed={0.12} scale={1.6} />
      <Cloud position={[-24, 3, 14]} speed={0.1} scale={1.1} />
      <Cloud position={[26, 3.5, 10]} speed={0.14} scale={1.2} />
    </group>
  );
}

export default memo(IslandEnvironment);
