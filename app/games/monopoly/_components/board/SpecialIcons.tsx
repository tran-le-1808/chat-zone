"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Ô BẮT ĐẦU: mũi tên chỉ hướng đi + chồng xu vàng xoay */
export function GoIcon3D() {
  const coinsRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (coinsRef.current) {
      coinsRef.current.rotation.y = clock.elapsedTime * 1.2;
      coinsRef.current.position.y =
        0.1 + Math.sin(clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group>
      {/* Mũi tên lớn chỉ sang trái (hướng đi của quân cờ) */}
      <group position={[0.15, 0.06, 0.15]}>
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[1.5, 0.1, 0.55]} />
          <meshStandardMaterial color="#e8a20c" roughness={0.4} />
        </mesh>
        <mesh
          position={[-0.75, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[1, 1, 0.18]}
        >
          <coneGeometry args={[0.6, 0.75, 3]} />
          <meshStandardMaterial color="#e8a20c" roughness={0.4} />
        </mesh>
      </group>

      {/* Chồng xu vàng */}
      <group ref={coinsRef} position={[0.9, 0.1, -0.9]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, i * 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.09, 24]} />
            <meshStandardMaterial
              color="#ffd23f"
              metalness={0.6}
              roughness={0.25}
              emissive="#d99a00"
              emissiveIntensity={0.25}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Ô BẾN XE: biển báo trạm xe buýt + xe buýt mini (màu chủ sở hữu nếu có) */
export function StationIcon3D({ color }: { color?: string }) {
  const busColor = color ?? "#3fbf8f";
  return (
    <group>
      {/* Biển trạm */}
      <mesh position={[-0.55, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} />
      </mesh>
      <mesh position={[-0.55, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.04, 20]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>

      {/* Xe buýt mini */}
      <group position={[0.2, 0.02, 0]} scale={0.7}>
        <mesh position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[1.3, 0.55, 0.6]} />
          <meshStandardMaterial color={busColor} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.5, 0.31]}>
          <boxGeometry args={[1.1, 0.18, 0.02]} />
          <meshStandardMaterial color="#d6f1ff" roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.69, 0]}>
          <boxGeometry args={[1.22, 0.08, 0.52]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {[
          [0.4, 0.3],
          [-0.4, 0.3],
          [0.4, -0.3],
          [-0.4, -0.3],
        ].map(([x, z]) => (
          <mesh
            key={`${x}${z}`}
            position={[x, 0.12, z]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.12, 0.12, 0.08, 14]} />
            <meshStandardMaterial color="#2b2f3a" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
