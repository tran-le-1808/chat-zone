import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Flag3DProps {
  color?: string;
  position?: [number, number, number];
  scale?: number;
}

/** Cờ đuôi nheo đồ chơi đánh dấu ô đất đã có chủ (chưa xây nhà) */
export function Flag3D({
  color = "#ef4444",
  position = [0, 0.1, -0.6],
  scale = 1.8,
}: Flag3DProps) {
  const clothRef = useRef<THREE.Group>(null);

  // Lá cờ hình tam giác đuôi nheo
  const pennant = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.17);
    shape.quadraticCurveTo(0.25, 0.1, 0.5, 0);
    shape.quadraticCurveTo(0.25, -0.1, 0, -0.17);
    shape.lineTo(0, 0.17);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
  }, []);

  useFrame(({ clock }) => {
    if (clothRef.current) {
      const t = clock.getElapsedTime();
      clothRef.current.rotation.y = Math.sin(t * 3) * 0.25;
      clothRef.current.rotation.z = Math.sin(t * 5) * 0.04;
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* Đế tròn */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.1, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.1, 0.025, 8, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Cột cờ */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.025, 0.9, 4, 10]} />
        <meshStandardMaterial color="#f4ead8" roughness={0.5} />
      </mesh>
      {/* Quả cầu vàng trên đỉnh */}
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.06, 14, 12]} />
        <meshStandardMaterial color="#ffd23f" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Lá cờ đuôi nheo */}
      <group ref={clothRef} position={[0.02, 0.84, 0]}>
        <mesh geometry={pennant} position={[0, 0, -0.015]} castShadow>
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}
