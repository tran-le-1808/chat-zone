"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/**
 * Bộ biểu tượng hoạt hình cho các ô đặc biệt — cùng một art direction:
 * khối tròn trịa, màu tươi, chất liệu nhựa mềm, chuyển động nhẹ nhàng.
 */

function Toy({
  c,
  r = 0.45,
  m = 0,
  e,
  ei = 0.35,
  o,
}: {
  c: string;
  r?: number;
  m?: number;
  e?: string;
  ei?: number;
  o?: number;
}) {
  return (
    <meshStandardMaterial
      color={c}
      roughness={r}
      metalness={m}
      emissive={e ?? "#000000"}
      emissiveIntensity={e ? ei : 0}
      transparent={o !== undefined}
      opacity={o ?? 1}
      depthWrite={o === undefined}
    />
  );
}

/** Bóng mềm dưới chân vật thể */
function SoftShadow({ r = 0.5 }: { r?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <circleGeometry args={[r, 24]} />
      <meshBasicMaterial
        color="#000000"
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Dấu hỏi chấm 3D */
function QuestionMark({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <torusGeometry args={[0.13, 0.05, 10, 24, Math.PI * 1.5]} />
        <Toy c={color} r={0.3} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <capsuleGeometry args={[0.05, 0.08, 4, 10]} />
        <Toy c={color} r={0.3} />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <Toy c={color} r={0.3} />
      </mesh>
    </group>
  );
}

// ======================================================= CƠ HỘI: hộp quà
export function ChanceIcon() {
  const qRef = useRef<THREE.Group>(null);
  const boxRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (qRef.current) {
      qRef.current.position.y = 1.15 + Math.sin(t * 2.4) * 0.08;
      qRef.current.rotation.y = Math.sin(t * 1.3) * 0.5;
    }
    if (boxRef.current) {
      const s = 1 + Math.max(0, Math.sin(t * 2.4)) * 0.04;
      boxRef.current.scale.set(1 / s, s, 1 / s);
    }
  });
  return (
    <group>
      <SoftShadow r={0.5} />
      <group ref={boxRef}>
        <RoundedBox
          args={[0.7, 0.55, 0.7]}
          radius={0.08}
          smoothness={3}
          position={[0, 0.28, 0]}
          castShadow
        >
          <Toy c="#ff8a3d" />
        </RoundedBox>
        <RoundedBox
          args={[0.8, 0.16, 0.8]}
          radius={0.06}
          smoothness={3}
          position={[0, 0.6, 0]}
          castShadow
        >
          <Toy c="#ff9f5a" />
        </RoundedBox>
        {/* Ruy băng */}
        <mesh position={[0, 0.36, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.72]} />
          <Toy c="#ffd23f" r={0.3} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <boxGeometry args={[0.72, 0.6, 0.16]} />
          <Toy c="#ffd23f" r={0.3} />
        </mesh>
        {/* Nơ */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.14, 0.76, 0]}
            rotation={[0, 0, s * 0.6]}
            scale={[1, 0.6, 0.6]}
          >
            <torusGeometry args={[0.1, 0.045, 8, 16]} />
            <Toy c="#ffd23f" r={0.3} />
          </mesh>
        ))}
      </group>
      <group ref={qRef} position={[0, 1.15, 0]}>
        <QuestionMark color="#ffffff" />
      </group>
    </group>
  );
}

// ======================================================= KHÍ VẬN: quả cầu pha lê
export function FateIcon() {
  const starRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (starRef.current) {
      starRef.current.rotation.y = t * 1.5;
      starRef.current.rotation.x = t * 0.7;
    }
    if (sparkRef.current) {
      sparkRef.current.rotation.y = -t * 0.8;
      sparkRef.current.children.forEach((c, i) => {
        c.scale.setScalar(0.6 + Math.abs(Math.sin(t * 3 + i)) * 0.6);
      });
    }
  });
  return (
    <group>
      <SoftShadow r={0.45} />
      {/* Chân đế */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.4, 0.2, 24]} />
        <Toy c="#7357e0" />
      </mesh>
      <mesh position={[0, 0.23, 0]}>
        <torusGeometry args={[0.27, 0.05, 10, 24]} />
        <Toy c="#ffd23f" r={0.3} m={0.3} />
      </mesh>
      {/* Cầu pha lê */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.38, 28, 24]} />
        <Toy c="#cbb8ff" r={0.1} e="#9b7bff" ei={0.4} o={0.82} />
      </mesh>
      <mesh ref={starRef} position={[0, 0.6, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <Toy c="#fff3b0" r={0.2} e="#ffd84d" ei={0.9} />
      </mesh>
      {/* Lấp lánh xung quanh */}
      <group ref={sparkRef} position={[0, 0.6, 0]}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * 0.55,
                (i % 2) * 0.25 - 0.1,
                Math.sin(a) * 0.55,
              ]}
            >
              <octahedronGeometry args={[0.05, 0]} />
              <Toy c="#ffffff" e="#ffffff" ei={0.8} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ======================================================= THUẾ: túi tiền + xu
export function TaxIcon() {
  const sackRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (sackRef.current)
      sackRef.current.rotation.z = Math.sin(clock.elapsedTime * 2) * 0.08;
  });
  return (
    <group>
      <SoftShadow r={0.5} />
      <group ref={sackRef}>
        <mesh position={[0, 0.36, 0]} scale={[1, 0.9, 0.9]} castShadow>
          <sphereGeometry args={[0.38, 24, 20]} />
          <Toy c="#8fcf6b" />
        </mesh>
        {/* Cổ túi & dây buộc */}
        <mesh position={[0, 0.72, 0]} castShadow>
          <coneGeometry args={[0.2, 0.28, 16]} />
          <Toy c="#8fcf6b" />
        </mesh>
        <mesh position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.04, 8, 20]} />
          <Toy c="#d64545" />
        </mesh>
        {/* Huy hiệu đồng xu phía trước */}
        <mesh position={[0, 0.36, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.04, 24]} />
          <Toy c="#ffd23f" r={0.25} m={0.4} e="#d99a00" ei={0.2} />
        </mesh>
      </group>
      {/* Chồng xu bên cạnh */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[0.5, 0.05 + i * 0.09, 0.15]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 20]} />
          <Toy c="#ffd23f" r={0.25} m={0.4} e="#d99a00" ei={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ======================================================= LỄ HỘI: cổng đèn lồng
export function FestivalIcon() {
  const lanternsRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!lanternsRef.current) return;
    lanternsRef.current.children.forEach((c, i) => {
      c.rotation.z = Math.sin(clock.elapsedTime * 2 + i * 1.3) * 0.15;
    });
  });
  const lanternColors = ["#e8392f", "#ffb020", "#e8392f"];
  return (
    <group position={[0, 0, -0.2]}>
      <SoftShadow r={1.1} />
      {/* Cổng gỗ */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 1.4, 12]} />
          <Toy c="#b8322a" />
        </mesh>
      ))}
      <RoundedBox
        args={[2.5, 0.16, 0.3]}
        radius={0.06}
        smoothness={3}
        position={[0, 1.45, 0]}
        castShadow
      >
        <Toy c="#d63a2f" />
      </RoundedBox>
      <RoundedBox
        args={[2.2, 0.08, 0.22]}
        radius={0.03}
        smoothness={2}
        position={[0, 1.3, 0]}
      >
        <Toy c="#ffd23f" r={0.3} m={0.3} />
      </RoundedBox>
      {/* Đèn lồng đung đưa */}
      <group ref={lanternsRef}>
        {[-0.6, 0, 0.6].map((x, i) => (
          <group key={x} position={[x, 1.26, 0]}>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.24, 6]} />
              <Toy c="#5b3a1e" />
            </mesh>
            <mesh position={[0, -0.42, 0]} scale={[1, 0.85, 1]} castShadow>
              <sphereGeometry args={[0.2, 20, 16]} />
              <Toy c={lanternColors[i]} e={lanternColors[i]} ei={0.45} />
            </mesh>
            {[-0.24, -0.6].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.05, 14]} />
                <Toy c="#ffd23f" r={0.3} m={0.4} />
              </mesh>
            ))}
            <mesh position={[0, -0.72, 0]}>
              <coneGeometry args={[0.04, 0.16, 8]} />
              <Toy c="#ffd23f" />
            </mesh>
          </group>
        ))}
      </group>
      {/* Trống hội nhỏ */}
      <mesh position={[0.65, 0.18, 0.55]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.3, 20]} />
        <Toy c="#d63a2f" />
      </mesh>
      <mesh position={[0.65, 0.34, 0.55]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 20]} />
        <Toy c="#f6e3c4" />
      </mesh>
    </group>
  );
}

// ======================================================= DU LỊCH: máy bay hoạt hình
export function TravelIcon() {
  const planeRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (planeRef.current) {
      planeRef.current.position.y = 0.95 + Math.sin(t * 2) * 0.12;
      planeRef.current.rotation.z = Math.sin(t * 2) * 0.08;
      planeRef.current.rotation.x = Math.sin(t * 1.3) * 0.08;
    }
    if (propRef.current) propRef.current.rotation.x += delta * 25;
  });
  return (
    <group>
      <SoftShadow r={0.9} />
      {/* Đường băng nhỏ */}
      <RoundedBox
        args={[2.4, 0.04, 0.6]}
        radius={0.02}
        smoothness={2}
        position={[0, 0.02, 0.5]}
      >
        <Toy c="#7a8396" r={0.8} />
      </RoundedBox>
      {[-0.8, -0.2, 0.4, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.5]}>
          <boxGeometry args={[0.28, 0.01, 0.06]} />
          <Toy c="#ffffff" />
        </mesh>
      ))}
      <group
        ref={planeRef}
        position={[0, 0.95, -0.15]}
        rotation={[0, 0, 0]}
        scale={1.1}
      >
        {/* Thân */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.2, 0.9, 8, 20]} />
          <Toy c="#ffffff" r={0.35} />
        </mesh>
        {/* Mũi đỏ */}
        <mesh position={[-0.68, 0, 0]} scale={[0.6, 1, 1]}>
          <sphereGeometry args={[0.16, 16, 14]} />
          <Toy c="#ff5a4e" />
        </mesh>
        <mesh ref={propRef} position={[-0.78, 0, 0]}>
          <boxGeometry args={[0.03, 0.5, 0.07]} />
          <Toy c="#4a5a78" />
        </mesh>
        {/* Cửa sổ */}
        {[-0.25, 0, 0.25].map((x) => (
          <mesh key={x} position={[x, 0.07, 0.19]}>
            <sphereGeometry args={[0.055, 12, 10]} />
            <Toy c="#5ec8f2" r={0.15} />
          </mesh>
        ))}
        {/* Cánh */}
        <RoundedBox
          args={[0.42, 0.06, 1.5]}
          radius={0.03}
          smoothness={2}
          position={[-0.05, -0.05, 0]}
          castShadow
        >
          <Toy c="#3fa9f5" />
        </RoundedBox>
        <RoundedBox
          args={[0.22, 0.05, 0.6]}
          radius={0.02}
          smoothness={2}
          position={[0.58, 0.02, 0]}
        >
          <Toy c="#3fa9f5" />
        </RoundedBox>
        <RoundedBox
          args={[0.24, 0.32, 0.05]}
          radius={0.02}
          smoothness={2}
          position={[0.6, 0.2, 0]}
        >
          <Toy c="#ff5a4e" />
        </RoundedBox>
      </group>
    </group>
  );
}

// ======================================================= NHÀ TÙ: nhà giam đồ chơi
export function JailIcon() {
  const lockRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (lockRef.current)
      lockRef.current.rotation.z = Math.sin(clock.elapsedTime * 2.5) * 0.12;
  });
  const W = 2.0;
  const D = 1.6;
  const H = 1.1;
  const bars = 6;
  return (
    <group position={[0, 0, -0.2]}>
      <SoftShadow r={1.2} />
      {/* Nền đá */}
      <RoundedBox
        args={[W + 0.3, 0.14, D + 0.3]}
        radius={0.06}
        smoothness={3}
        position={[0, 0.07, 0]}
        receiveShadow
      >
        <Toy c="#c9cfdc" r={0.8} />
      </RoundedBox>
      {/* Tường sau */}
      <RoundedBox
        args={[W, H, 0.18]}
        radius={0.06}
        smoothness={3}
        position={[0, 0.14 + H / 2, -D / 2]}
        castShadow
      >
        <Toy c="#9aa6bd" r={0.7} />
      </RoundedBox>
      {/* Song sắt phía trước (sọc cam - xám đồ chơi) */}
      {Array.from({ length: bars }, (_, i) => {
        const x = -W / 2 + 0.12 + (i * (W - 0.24)) / (bars - 1);
        return (
          <group key={i} position={[x, 0.14, D / 2]}>
            <mesh position={[0, H / 2, 0]} castShadow>
              <capsuleGeometry args={[0.05, H - 0.1, 4, 10]} />
              <Toy c="#4a5a78" r={0.35} m={0.2} />
            </mesh>
            <mesh position={[0, H + 0.02, 0]}>
              <sphereGeometry args={[0.08, 12, 10]} />
              <Toy c="#ffb020" />
            </mesh>
          </group>
        );
      })}
      {/* Khung mái để trống (nhìn từ trên vẫn thấy bên trong) */}
      {[
        [0, -D / 2, W + 0.2, 0.16],
        [0, D / 2, W + 0.2, 0.16],
        [-W / 2, 0, 0.16, D + 0.2],
        [W / 2, 0, 0.16, D + 0.2],
      ].map(([x, z, w, d], i) => (
        <RoundedBox
          key={i}
          args={[w, 0.14, d]}
          radius={0.06}
          smoothness={2}
          position={[x, 0.14 + H + 0.07, z]}
          castShadow
        >
          <Toy c="#ff8a3d" />
        </RoundedBox>
      ))}
      {/* Quả tạ & xích bên trong */}
      <mesh position={[-0.35, 0.36, -0.1]} castShadow>
        <sphereGeometry args={[0.2, 18, 14]} />
        <Toy c="#3b4060" r={0.35} m={0.3} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[-0.1 + i * 0.16, 0.2, 0.05 + i * 0.05]}
          rotation={[Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0]}
        >
          <torusGeometry args={[0.07, 0.025, 8, 14]} />
          <Toy c="#8b93a8" m={0.4} r={0.3} />
        </mesh>
      ))}
      {/* Biển vàng trên mái */}
      <RoundedBox
        args={[1.0, 0.3, 0.08]}
        radius={0.04}
        smoothness={2}
        position={[0, 0.14 + H + 0.32, D / 2 + 0.05]}
      >
        <Toy c="#ffd23f" />
      </RoundedBox>
      {/* Ổ khoá đung đưa */}
      <group ref={lockRef} position={[0.35, 0.14 + H * 0.5, D / 2 + 0.1]}>
        <RoundedBox
          args={[0.24, 0.2, 0.08]}
          radius={0.04}
          smoothness={2}
          position={[0, -0.12, 0]}
        >
          <Toy c="#ffd23f" m={0.4} r={0.3} />
        </RoundedBox>
        <mesh>
          <torusGeometry args={[0.07, 0.022, 8, 16, Math.PI]} />
          <Toy c="#cbd5e1" m={0.5} r={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ======================================================= OẲN TÙ TÌ: búa – bao – kéo
export function RpsIcon() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.y = Math.sin(t * 0.8) * 0.5;
    g.children.forEach((c, i) => {
      c.position.y = 0.55 + Math.abs(Math.sin(t * 2.6 + i * 2.1)) * 0.22;
    });
  });
  const ring = (i: number): [number, number, number] => {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * 0.42, 0.55, Math.sin(a) * 0.42];
  };
  return (
    <group>
      <SoftShadow r={0.65} />
      {/* Bục tròn */}
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.6, 0.66, 0.16, 32]} />
        <Toy c="#ff5c9a" />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.03, 32]} />
        <Toy c="#ffe0f0" />
      </mesh>
      <group ref={groupRef}>
        {/* Búa: cụm đá tròn */}
        <group position={ring(0)}>
          {[
            [0, 0, 0, 0.16],
            [0.1, 0.05, 0.06, 0.1],
            [-0.09, 0.06, -0.04, 0.1],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <sphereGeometry args={[r, 14, 12]} />
              <Toy c={i ? "#a7adbd" : "#8b93a8"} r={0.7} />
            </mesh>
          ))}
        </group>
        {/* Bao: tờ giấy bo tròn hơi cong */}
        <group position={ring(1)} rotation={[0.35, 0.4, 0.1]}>
          <RoundedBox
            args={[0.36, 0.46, 0.04]}
            radius={0.03}
            smoothness={2}
            castShadow
          >
            <Toy c="#ffffff" r={0.6} />
          </RoundedBox>
          {[-0.1, 0, 0.1].map((y) => (
            <mesh key={y} position={[0, y, 0.025]}>
              <boxGeometry args={[0.24, 0.02, 0.005]} />
              <Toy c="#9cc7ff" />
            </mesh>
          ))}
        </group>
        {/* Kéo: 2 lưỡi bắt chéo + 2 tay cầm tròn */}
        <group position={ring(2)} rotation={[Math.PI / 2.6, 0, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} rotation={[0, 0, s * 0.35]}>
              <mesh position={[0, 0.14, 0]} castShadow>
                <boxGeometry args={[0.05, 0.3, 0.02]} />
                <Toy c="#d8dde8" m={0.5} r={0.25} />
              </mesh>
              <mesh position={[0, -0.08, 0]}>
                <torusGeometry args={[0.07, 0.025, 8, 16]} />
                <Toy c={s < 0 ? "#ff5a4e" : "#3fa9f5"} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

// ======================================================= XÓC ĐĨA: đĩa + 4 đồng + bát úp hé mở
export function XocDiaIcon() {
  const bowlRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const b = bowlRef.current;
    if (!b) return;
    const t = clock.elapsedTime;
    // Bát nhấp nhổm như đang xóc rồi hé mở
    b.position.y = 0.55 + Math.abs(Math.sin(t * 1.6)) * 0.22;
    b.rotation.z = -0.35 + Math.sin(t * 9) * 0.05;
  });
  const coins = [
    [-0.16, -0.06, true],
    [0.14, -0.1, false],
    [-0.04, 0.14, true],
    [0.2, 0.12, true],
  ] as const;
  return (
    <group>
      <SoftShadow r={0.62} />
      {/* Đĩa sứ viền đỏ */}
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.58, 0.5, 0.1, 36]} />
        <Toy c="#dc2626" />
      </mesh>
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.02, 36]} />
        <Toy c="#fff8ec" r={0.35} />
      </mesh>
      {/* 4 đồng: mặt trắng / mặt đỏ */}
      {coins.map(([x, z, white], i) => (
        <mesh key={i} position={[x, 0.14, z]}>
          <cylinderGeometry args={[0.1, 0.1, 0.035, 20]} />
          <Toy c={white ? "#ffffff" : "#e8392f"} r={0.35} />
        </mesh>
      ))}
      {/* Bát úp hé mở */}
      <group
        ref={bowlRef}
        position={[0.22, 0.55, -0.05]}
        rotation={[0, 0, -0.35]}
      >
        <mesh castShadow>
          <sphereGeometry
            args={[0.42, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <Toy c="#e8392f" />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.08, 18]} />
          <Toy c="#ffd23f" m={0.3} />
        </mesh>
      </group>
    </group>
  );
}
