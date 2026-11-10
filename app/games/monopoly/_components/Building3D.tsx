"use client";

import React, { useRef, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type HouseType = "1_floor" | "2_floors" | "3_floors" | "villa";

interface Building3DProps {
  type: HouseType;
  position?: [number, number, number];
  scale?: number;
  roofColor?: string; // Màu mái nhà theo màu người chơi
  isFestival?: boolean; // Cho phép bật/tắt cắm cờ (mặc định true)
}

const COLORS = {
  wall: "#f2ab3e",
  door: "#22a6b3",
  windowGlass: "#22a6b3",
  frame: "#ffffff",
  base: "#d97736",
  defaultRoof: "#d93829", // Màu mặc định nếu chưa truyền màu người chơi
};

// Thuật toán pseudo-random thuần khiết dựa trên seed để lệch pha vẫy cờ
function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function FestiveFlag3D({
  position,
  id = 0,
}: {
  position: [number, number, number];
  id?: number;
}) {
  const flagPivotRef = useRef<THREE.Group>(null);

  // Phase cố định ngẫu nhiên cho từng lá cờ
  const phase = useMemo(() => pseudoRandom(id) * Math.PI * 2, [id]);

  // Tạo Geometry Ngôi Sao Vàng Ngũ Giác 3D chuẩn xác
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.22; // Bán kính cánh sao
    const innerRadius = 0.088; // Bán kính góc lõm

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      // Góc bắt đầu từ đỉnh trên cùng (Math.PI / 2)
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = -Math.sin(angle) * radius;

      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    // Khối 3D ngôi sao mỏng
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
  }, []);

  useFrame(({ clock }) => {
    if (flagPivotRef.current) {
      const t = clock.elapsedTime;
      // Hiệu ứng sóng gió kết hợp tần số nhanh & chậm
      const windWave =
        Math.sin(t * 8 + phase) * 0.15 + Math.sin(t * 14 + phase) * 0.08;

      flagPivotRef.current.rotation.y = 0.1 + windWave;
    }
  });

  return (
    <group position={position}>
      {/* Cột cờ Inox */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.6, 12]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Quả cầu đỉnh cột cờ */}
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#facc15"
          emissive="#eab308"
          emissiveIntensity={0.4}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* PIVOT GROUP: Bản lề xoay đúng trục cột cờ [0, 1.15, 0] */}
      <group ref={flagPivotRef} position={[0, 1.15, 0]}>
        {/* Lá cờ đỏ kích thước 1.2 x 0.8 (Tâm nằm ở X = 0.6) */}
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[1.2, 0.8, 0.012]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={0.3}
            roughness={0.3}
          />
        </mesh>

        {/* Ngôi sao vàng Mặt Trước (Tâm lá cờ X = 0.6, Z = 0.008) */}
        <mesh geometry={starGeometry} position={[0.6, 0, 0.008]}>
          <meshStandardMaterial
            color="#facc15"
            emissive="#eab308"
            emissiveIntensity={0.5}
            metalness={0.6}
            roughness={0.2}
          />
        </mesh>

        {/* Ngôi sao vàng Mặt Sau (Tâm lá cờ X = 0.6, Z = -0.008) */}
        <mesh
          geometry={starGeometry}
          position={[0.6, 0, -0.008]}
          rotation={[0, Math.PI, 0]}
        >
          <meshStandardMaterial
            color="#facc15"
            emissive="#eab308"
            emissiveIntensity={0.5}
            metalness={0.6}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Màu tường pastel xen kẽ cho từng căn nhà */
const WALLS = ["#fff1d6", "#ffe0e9", "#e3f4ff", "#e9ffe0"];

function Toy({ c, r = 0.45, m = 0 }: { c: string; r?: number; m?: number }) {
  return <meshStandardMaterial color={c} roughness={r} metalness={m} />;
}

/** Cửa sổ tròn có viền trắng */
function RoundWindow({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.03, 18]} />
        <Toy c="#7fd3ff" r={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <torusGeometry args={[0.11, 0.025, 8, 20]} />
        <Toy c={COLORS.frame} />
      </mesh>
    </group>
  );
}

/** Nhà đồ chơi: thân bo tròn, mái dốc màu chủ sở hữu, ống khói, cửa & cửa sổ tròn */
function ToyHouse({
  position,
  roofColor,
  wall,
  flagId,
  isFestival,
}: {
  position: [number, number, number];
  roofColor: string;
  wall: string;
  flagId: number;
  isFestival: boolean;
}) {
  return (
    <group position={position}>
      {/* Thân nhà */}
      <RoundedBox
        args={[0.9, 0.78, 0.85]}
        radius={0.1}
        smoothness={3}
        position={[0, 0.39, 0]}
        castShadow
        receiveShadow
      >
        <Toy c={wall} />
      </RoundedBox>
      {/* Mái dốc 2 mảnh */}
      {[-1, 1].map((s) => (
        <RoundedBox
          key={s}
          args={[0.62, 0.11, 1.0]}
          radius={0.05}
          smoothness={2}
          position={[s * 0.24, 0.98, 0]}
          rotation={[0, 0, -s * 0.62]}
          castShadow
        >
          <Toy c={roofColor} r={0.4} />
        </RoundedBox>
      ))}
      {/* Ống khói */}
      <RoundedBox
        args={[0.14, 0.3, 0.14]}
        radius={0.04}
        smoothness={2}
        position={[0.25, 1.12, -0.18]}
        castShadow
      >
        <Toy c="#b8655a" />
      </RoundedBox>
      {/* Cửa */}
      <RoundedBox
        args={[0.24, 0.38, 0.06]}
        radius={0.05}
        smoothness={2}
        position={[-0.17, 0.22, 0.42]}
      >
        <Toy c="#9b5b3a" />
      </RoundedBox>
      <mesh position={[-0.11, 0.22, 0.46]}>
        <sphereGeometry args={[0.025, 8, 6]} />
        <Toy c="#ffd23f" m={0.4} />
      </mesh>
      <RoundWindow position={[0.2, 0.45, 0.43]} />

      {isFestival && <FestiveFlag3D position={[0, 1.2, 0]} id={flagId} />}
    </group>
  );
}

/** Khách sạn (biệt thự): toà nhà bo tròn, sọc màu chủ sở hữu, mái vòm vàng & biển hiệu */
function ToyHotel({
  roofColor,
  isFestival,
}: {
  roofColor: string;
  isFestival: boolean;
}) {
  const H = 2.0;
  return (
    <group>
      <RoundedBox
        args={[2.0, H, 1.3]}
        radius={0.14}
        smoothness={3}
        position={[0, H / 2, 0]}
        castShadow
        receiveShadow
      >
        <Toy c="#fff4e0" />
      </RoundedBox>
      {/* Dải màu chủ sở hữu ở mỗi tầng */}
      {[0.55, 1.15, 1.75].map((y) => (
        <RoundedBox
          key={y}
          args={[2.06, 0.1, 1.36]}
          radius={0.04}
          smoothness={2}
          position={[0, y, 0]}
        >
          <Toy c={roofColor} />
        </RoundedBox>
      ))}
      {/* Cửa sổ lưới 3 x 3 */}
      {[0.32, 0.9, 1.5].flatMap((y) =>
        [-0.6, 0, 0.6].map((x) => (
          <RoundedBox
            key={`${x}${y}`}
            args={[0.34, 0.26, 0.05]}
            radius={0.05}
            smoothness={2}
            position={[x, y + 0.04, 0.66]}
          >
            <Toy c="#7fd3ff" r={0.15} />
          </RoundedBox>
        )),
      )}
      {/* Mái hiên cửa chính */}
      <RoundedBox
        args={[0.8, 0.08, 0.35]}
        radius={0.04}
        smoothness={2}
        position={[0, 0.52, 0.8]}
        castShadow
      >
        <Toy c={roofColor} />
      </RoundedBox>
      {/* Mái vòm vàng + chóp */}
      <mesh position={[0, H, 0]} castShadow>
        <sphereGeometry args={[0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toy c="#ffd23f" r={0.3} m={0.4} />
      </mesh>
      <mesh position={[0, H + 0.62, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <Toy c="#fff3b0" r={0.2} m={0.3} />
      </mesh>
      {/* Biển hiệu ngôi sao */}
      <RoundedBox
        args={[0.9, 0.3, 0.08]}
        radius={0.06}
        smoothness={2}
        position={[0, H + 0.08, 0.66]}
      >
        <Toy c="#ff5a7a" />
      </RoundedBox>
      {[-0.25, 0, 0.25].map((x) => (
        <mesh key={x} position={[x, H + 0.08, 0.71]}>
          <octahedronGeometry args={[0.07, 0]} />
          <Toy c="#ffd23f" m={0.3} />
        </mesh>
      ))}

      {isFestival && (
        <>
          <FestiveFlag3D position={[-0.8, H + 0.05, 0]} id={10} />
          <FestiveFlag3D position={[0.8, H + 0.05, 0]} id={11} />
        </>
      )}
    </group>
  );
}

export default function Building3D({
  type,
  position = [0, 0, 0],
  scale = 1,
  roofColor = COLORS.defaultRoof,
  isFestival = false,
}: Building3DProps) {
  const count = type === "1_floor" ? 1 : type === "2_floors" ? 2 : 3;
  const spacing = 1.05;

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {type === "villa" ? (
        <ToyHotel roofColor={roofColor} isFestival={isFestival} />
      ) : (
        Array.from({ length: count }, (_, i) => (
          <ToyHouse
            key={i}
            position={[(i - (count - 1) / 2) * spacing, 0, 0]}
            roofColor={roofColor}
            wall={WALLS[i % WALLS.length]}
            flagId={i + 1}
            isFestival={isFestival}
          />
        ))
      )}
    </group>
  );
}
