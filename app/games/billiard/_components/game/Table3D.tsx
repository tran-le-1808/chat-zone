"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { DEFAULT_PHYSICS as C } from "../../_lib/physics";

/**
 * BÀN BIDA CAROM 3D (không lỗ): mặt vải, băng cao su, khung gỗ, điểm kim cương.
 * Kích thước hiển thị = kích thước vật lý (mét) để thao tác ngắm luôn chính xác.
 * Toạ độ: physics (x, y) -> three (x, -y) trên mặt phẳng XZ, trục Y hướng lên.
 */
const CUSHION_W = 0.05;
const RAIL_W = 0.14;
const RAIL_TOP = C.cushionHeight + 0.012;
const BED_THICK = 0.05;

export const CLOTH_COLOR = "#1f5fa8";

export default function Table3D() {
  const W = C.tableWidth;
  const H = C.tableHeight;
  const outerW = W + 2 * (CUSHION_W + RAIL_W);
  const outerH = H + 2 * (CUSHION_W + RAIL_W);

  // Điểm kim cương: 8 khoảng trên băng dài, 4 khoảng trên băng ngắn
  const diamonds = useMemo(() => {
    const list: [number, number][] = [];
    const off = CUSHION_W + RAIL_W / 2;
    for (let i = 0; i <= 8; i++) {
      const x = -W / 2 + (W * i) / 8;
      list.push([x, H / 2 + off], [x, -H / 2 - off]);
    }
    for (let i = 1; i < 4; i++) {
      const y = -H / 2 + (H * i) / 4;
      list.push([W / 2 + off, y], [-W / 2 - off, y]);
    }
    return list;
  }, [W, H]);

  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a2d12",
        roughness: 0.45,
        metalness: 0.05,
      }),
    [],
  );
  const cushionMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a5596", roughness: 0.9 }),
    [],
  );

  return (
    <group>
      {/* Mặt vải */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 2 * CUSHION_W, H + 2 * CUSHION_W]} />
        <meshStandardMaterial color={CLOTH_COLOR} roughness={0.95} />
      </mesh>

      {/* Băng cao su (mặt trong đúng mép vật lý) */}
      <mesh
        position={[0, C.cushionHeight / 2, -(H / 2 + CUSHION_W / 2)]}
        material={cushionMat}
        castShadow
      >
        <boxGeometry args={[W + 2 * CUSHION_W, C.cushionHeight, CUSHION_W]} />
      </mesh>
      <mesh
        position={[0, C.cushionHeight / 2, H / 2 + CUSHION_W / 2]}
        material={cushionMat}
        castShadow
      >
        <boxGeometry args={[W + 2 * CUSHION_W, C.cushionHeight, CUSHION_W]} />
      </mesh>
      <mesh
        position={[-(W / 2 + CUSHION_W / 2), C.cushionHeight / 2, 0]}
        material={cushionMat}
        castShadow
      >
        <boxGeometry args={[CUSHION_W, C.cushionHeight, H]} />
      </mesh>
      <mesh
        position={[W / 2 + CUSHION_W / 2, C.cushionHeight / 2, 0]}
        material={cushionMat}
        castShadow
      >
        <boxGeometry args={[CUSHION_W, C.cushionHeight, H]} />
      </mesh>

      {/* Khung gỗ */}
      {[1, -1].map((s) => (
        <mesh
          key={`h${s}`}
          position={[
            0,
            RAIL_TOP / 2 - 0.01,
            s * (H / 2 + CUSHION_W + RAIL_W / 2),
          ]}
          material={woodMat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[outerW, RAIL_TOP + 0.02, RAIL_W]} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh
          key={`v${s}`}
          position={[
            s * (W / 2 + CUSHION_W + RAIL_W / 2),
            RAIL_TOP / 2 - 0.01,
            0,
          ]}
          material={woodMat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[RAIL_W, RAIL_TOP + 0.02, H + 2 * CUSHION_W]} />
        </mesh>
      ))}

      {/* Điểm kim cương */}
      {diamonds.map(([x, y], i) => (
        <mesh
          key={i}
          position={[x, RAIL_TOP + 0.0015, -y]}
          rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        >
          <planeGeometry args={[0.014, 0.014]} />
          <meshStandardMaterial color="#f3ead7" roughness={0.3} />
        </mesh>
      ))}

      {/* Thân bàn */}
      <mesh position={[0, -BED_THICK / 2 - 0.001, 0]} receiveShadow>
        <boxGeometry args={[outerW, BED_THICK, outerH]} />
        <meshStandardMaterial color="#3b1d0c" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.32, 0]} castShadow>
        <boxGeometry args={[outerW - 0.4, 0.5, outerH - 0.4]} />
        <meshStandardMaterial color="#2a1408" roughness={0.7} />
      </mesh>

      {/* Sàn */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.8, 0]}
        receiveShadow
      >
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#20232f" roughness={1} />
      </mesh>
    </group>
  );
}

/** Kích thước ngoài của bàn (để đặt camera) */
export const TABLE_OUTER = {
  w: C.tableWidth + 2 * (CUSHION_W + RAIL_W),
  h: C.tableHeight + 2 * (CUSHION_W + RAIL_W),
};
