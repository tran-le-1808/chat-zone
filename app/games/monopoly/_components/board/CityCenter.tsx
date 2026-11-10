"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOARD_COLORS } from "./theme";

/**
 * Thành phố thu nhỏ ở giữa bàn cờ (phong cách đồ chơi, chủ đề Việt Nam):
 * Tháp Tỷ Phú · phố nhà ống · hồ có chùa & cầu son · đu quay · cây xanh.
 * Chiều cao tháp được giới hạn để không che các ô phía xa camera.
 */
const GROUND_TOP = 0.06;

function Mat({
  c,
  r = 0.6,
  m = 0,
  e,
}: {
  c: string;
  r?: number;
  m?: number;
  e?: string;
}) {
  return (
    <meshStandardMaterial
      color={c}
      roughness={r}
      metalness={m}
      emissive={e ?? "#000000"}
      emissiveIntensity={e ? 0.35 : 0}
    />
  );
}

// ---------------------------------------------------------------- Cây xanh
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
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.38, 14, 12]} />
        <Mat c={greens[tone % 3]} />
      </mesh>
      <mesh position={[0.12, 1.02, 0.05]}>
        <sphereGeometry args={[0.26, 12, 10]} />
        <Mat c={greens[(tone + 1) % 3]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- Tháp trung tâm
function BillionaireTower() {
  const crownRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crownRef.current) crownRef.current.rotation.y = clock.elapsedTime * 0.6;
  });

  const tiers: { w: number; h: number; y: number; c: string }[] = [
    { w: 2.3, h: 2.6, y: 0.55, c: "#45c4c9" },
    { w: 1.7, h: 2.0, y: 3.15, c: "#5fd3d3" },
    { w: 1.1, h: 1.4, y: 5.15, c: "#7fe0dc" },
  ];

  return (
    <group>
      {/* Bệ tháp */}
      <mesh position={[0, GROUND_TOP + 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.1, 0.5, 3.1]} />
        <Mat c="#f4e7cf" />
      </mesh>
      {tiers.map((t, i) => (
        <group key={i} position={[0, GROUND_TOP + t.y, 0]}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <boxGeometry args={[t.w, t.h, t.w]} />
            <Mat c={t.c} r={0.25} m={0.15} />
          </mesh>
          {/* Dải kính / sàn tầng */}
          {Array.from({ length: Math.floor(t.h / 0.5) }, (_, k) => (
            <mesh key={k} position={[0, 0.3 + k * 0.5, 0]}>
              <boxGeometry args={[t.w + 0.04, 0.07, t.w + 0.04]} />
              <Mat c="#ffffff" r={0.4} />
            </mesh>
          ))}
          {/* Mái viền vàng */}
          <mesh position={[0, t.h + 0.04, 0]}>
            <boxGeometry args={[t.w + 0.2, 0.08, t.w + 0.2]} />
            <Mat c={BOARD_COLORS.trim} r={0.3} m={0.4} />
          </mesh>
        </group>
      ))}
      {/* Chóp vàng xoay */}
      <group ref={crownRef} position={[0, GROUND_TOP + 6.65, 0]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <coneGeometry args={[0.45, 0.6, 4]} />
          <Mat c="#ffcf3f" r={0.25} m={0.5} e="#ffb300" />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.13, 14, 12]} />
          <Mat c="#fff3b0" r={0.2} m={0.3} e="#ffd84d" />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- Phố nhà ống
function TubeHouse({
  position,
  color,
  floors,
  rotationY = 0,
}: {
  position: [number, number, number];
  color: string;
  floors: number;
  rotationY?: number;
}) {
  const h = floors * 0.62;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.85, h, 1.3]} />
        <Mat c={color} />
      </mesh>
      {/* Cửa sổ mỗi tầng + ban công */}
      {Array.from({ length: floors }, (_, f) => (
        <group key={f} position={[0, 0.34 + f * 0.62, 0.66]}>
          <mesh>
            <boxGeometry args={[0.46, 0.3, 0.03]} />
            <Mat c="#bfe9ff" r={0.2} />
          </mesh>
          {f > 0 && (
            <mesh position={[0, -0.18, 0.05]}>
              <boxGeometry args={[0.66, 0.05, 0.12]} />
              <Mat c="#ffffff" />
            </mesh>
          )}
        </group>
      ))}
      {/* Mái ngói đỏ */}
      <mesh position={[0, h + 0.12, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.72, 0.3, 4]} />
        <Mat c="#d9573b" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- Hồ, chùa & cầu son
function LakeWithPagoda() {
  const boatRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!boatRef.current) return;
    const a = clock.elapsedTime * 0.35;
    boatRef.current.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.1);
    boatRef.current.rotation.y = -a;
  });

  return (
    <group>
      {/* Mặt hồ */}
      <mesh position={[0, GROUND_TOP + 0.01, 0]} scale={[1.25, 1, 0.95]}>
        <cylinderGeometry args={[2.3, 2.3, 0.04, 40]} />
        <Mat c="#4cc3e6" r={0.15} />
      </mesh>
      <mesh position={[0, GROUND_TOP + 0.0, 0]} scale={[1.25, 1, 0.95]}>
        <cylinderGeometry args={[2.45, 2.45, 0.05, 40]} />
        <Mat c="#d9c9a3" />
      </mesh>

      {/* Đảo nhỏ & chùa mái cong */}
      <group position={[0.2, GROUND_TOP, -0.1]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.6, 0.7, 0.12, 20]} />
          <Mat c="#8fd66f" />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.55, 0.6, 0.55]} />
          <Mat c="#f6e3c4" />
        </mesh>
        {[0, 1].map((i) => (
          <mesh
            key={i}
            position={[0, 0.8 + i * 0.36, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <coneGeometry args={[0.62 - i * 0.18, 0.32, 4]} />
            <Mat c="#b8322a" />
          </mesh>
        ))}
        <mesh position={[0, 1.35, 0]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <Mat c={BOARD_COLORS.trim} m={0.4} />
        </mesh>
      </group>

      {/* Cầu son cong */}
      <group position={[-1.35, GROUND_TOP + 0.05, 0.75]} rotation={[0, 0.7, 0]}>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[0.75, 0.07, 8, 20, Math.PI]} />
          <Mat c="#d63a2f" />
        </mesh>
      </group>

      {/* Thuyền nhỏ chạy quanh hồ */}
      <group ref={boatRef} position={[0, GROUND_TOP + 0.05, 0]}>
        <mesh scale={[1, 0.4, 0.45]}>
          <sphereGeometry args={[0.22, 12, 8]} />
          <Mat c="#a0623d" />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <coneGeometry args={[0.12, 0.12, 12]} />
          <Mat c="#f2d38a" />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- Đu quay
function FerrisWheel() {
  const wheelRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (wheelRef.current) wheelRef.current.rotation.z += delta * 0.4;
  });
  const cabinColors = [
    "#ff6b8b",
    "#ffd166",
    "#5ec8f2",
    "#9b7bf0",
    "#6bd68a",
    "#ff9f43",
  ];

  return (
    <group>
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} position={[0, GROUND_TOP + 0.85, z]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.09, 1.7, 8]} />
          <Mat c="#e8edf5" />
        </mesh>
      ))}
      <group ref={wheelRef} position={[0, GROUND_TOP + 1.7, 0]}>
        <mesh>
          <torusGeometry args={[1.2, 0.05, 8, 40]} />
          <Mat c="#ffffff" r={0.3} />
        </mesh>
        {cabinColors.map((c, i) => {
          const a = (i / cabinColors.length) * Math.PI * 2;
          return (
            <group key={c}>
              <mesh rotation={[0, 0, a]} position={[0, 0, 0]}>
                <boxGeometry args={[2.4, 0.03, 0.03]} />
                <Mat c="#e8edf5" />
              </mesh>
              <mesh
                position={[Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0]}
                castShadow
              >
                <sphereGeometry args={[0.17, 12, 10]} />
                <Mat c={c} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- Toà nhà thấp
function Block({
  position,
  size,
  color,
  roof,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roof: string;
}) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <Mat c={color} />
      </mesh>
      {Array.from({ length: Math.max(1, Math.floor(h / 0.55)) }, (_, k) => (
        <mesh key={k} position={[0, 0.35 + k * 0.55, d / 2 + 0.01]}>
          <boxGeometry args={[w * 0.75, 0.22, 0.02]} />
          <Mat c="#cfefff" r={0.2} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.05, 0]}>
        <boxGeometry args={[w + 0.12, 0.1, d + 0.12]} />
        <Mat c={roof} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- Nhà nhỏ mái dốc
function SmallHouse({
  position,
  wall,
  roof,
  rotationY = 0,
}: {
  position: [number, number, number];
  wall: string;
  roof: string;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.7, 0.85]} />
        <Mat c={wall} />
      </mesh>
      <mesh
        position={[0, 0.88, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[1, 1, 0.85]}
        castShadow
      >
        <coneGeometry args={[0.82, 0.42, 4]} />
        <Mat c={roof} />
      </mesh>
      <mesh position={[0, 0.25, 0.43]}>
        <boxGeometry args={[0.22, 0.4, 0.02]} />
        <Mat c="#8a5a3b" />
      </mesh>
      <mesh position={[0.28, 0.42, 0.43]}>
        <boxGeometry args={[0.2, 0.18, 0.02]} />
        <Mat c="#cfefff" r={0.2} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- Sạp chợ
function MarketStall({
  position,
  awning,
}: {
  position: [number, number, number];
  awning: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.8, 0.44, 0.55]} />
        <Mat c="#f3e2c3" />
      </mesh>
      {/* Mái bạt sọc */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[-0.3 + i * 0.2, 0.62, 0.05]}
          rotation={[0.35, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.2, 0.04, 0.75]} />
          <Mat c={i % 2 === 0 ? awning : "#ffffff"} />
        </mesh>
      ))}
      {/* Hàng hoá */}
      {[-0.22, 0, 0.22].map((x, i) => (
        <mesh key={x} position={[x, 0.5, 0.15]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <Mat c={["#ff8a3d", "#7ed957", "#ff5d73"][i]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- Bồn hoa
function FlowerBed({
  position,
  seed,
}: {
  position: [number, number, number];
  seed: number;
}) {
  const colors = ["#ff6b9a", "#ffd23f", "#ff8a3d", "#c084fc", "#ffffff"];
  return (
    <group position={position}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.6, 0.65, 0.16, 20]} />
        <Mat c="#d9c9a3" />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.04, 20]} />
        <Mat c="#4f9a3c" r={0.9} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + seed;
        const r = i === 0 ? 0 : 0.32;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.25, Math.sin(a) * r]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Mat c={colors[(i + seed) % colors.length]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- Đèn đường
function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.06, 12]} />
        <Mat c="#3b4b78" />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 1.0, 8]} />
        <Mat c="#3b4b78" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.12, 14, 12]} />
        <Mat c="#fff6c8" e="#ffd84d" />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <coneGeometry args={[0.12, 0.08, 12]} />
        <Mat c="#3b4b78" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- Hàng rào trắng
function Fence({
  position,
  length,
  rotationY = 0,
}: {
  position: [number, number, number];
  length: number;
  rotationY?: number;
}) {
  const posts = Math.max(2, Math.round(length / 0.35) + 1);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[0.12, 0.26].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[length, 0.04, 0.04]} />
          <Mat c="#ffffff" />
        </mesh>
      ))}
      {Array.from({ length: posts }, (_, i) => (
        <mesh
          key={i}
          position={[-length / 2 + (i * length) / (posts - 1), 0.17, 0]}
        >
          <boxGeometry args={[0.06, 0.34, 0.06]} />
          <Mat c="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function CityCenter() {
  const R = 4.7; // nửa cạnh vòng đường quanh quảng trường
  const roadW = 1.0;

  return (
    <group>
      {/* Vỉa hè & nền cỏ */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[19.8, 0.2, 19.8]} />
        <Mat c={BOARD_COLORS.sidewalk} />
      </mesh>
      <mesh position={[0, GROUND_TOP - 0.1, 0]} receiveShadow>
        <boxGeometry args={[19.0, 0.2, 19.0]} />
        <Mat c={BOARD_COLORS.cityGround} r={0.9} />
      </mesh>

      {/* Đường vòng quanh quảng trường + 4 trục đường */}
      {[
        { p: [0, -R] as const, s: [2 * R + roadW, roadW] as const },
        { p: [0, R] as const, s: [2 * R + roadW, roadW] as const },
        { p: [-R, 0] as const, s: [roadW, 2 * R + roadW] as const },
        { p: [R, 0] as const, s: [roadW, 2 * R + roadW] as const },
        { p: [0, -7.1] as const, s: [roadW, 4.0] as const },
        { p: [0, 7.1] as const, s: [roadW, 4.0] as const },
        { p: [-7.1, 0] as const, s: [4.0, roadW] as const },
        { p: [7.1, 0] as const, s: [4.0, roadW] as const },
      ].map((r, i) => (
        <mesh
          key={i}
          position={[r.p[0], GROUND_TOP + 0.005, r.p[1]]}
          receiveShadow
        >
          <boxGeometry args={[r.s[0], 0.02, r.s[1]]} />
          <Mat c={BOARD_COLORS.road} r={0.9} />
        </mesh>
      ))}

      {/* Quảng trường & tháp */}
      <mesh position={[0, GROUND_TOP + 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[3.3, 3.3, 0.03, 40]} />
        <Mat c="#f1e6cc" />
      </mesh>
      <BillionaireTower />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <Tree
            key={i}
            position={[Math.cos(a) * 2.6, GROUND_TOP, Math.sin(a) * 2.6]}
            scale={0.8}
            tone={i}
          />
        );
      })}

      {/* Góc Tây Bắc: hồ & chùa */}
      <group position={[-7.15, 0, -7.15]}>
        <LakeWithPagoda />
      </group>

      {/* Góc Đông Bắc: phố nhà ống (thấp 1-2 tầng để không che các ô phía xa) */}
      <group position={[6.8, GROUND_TOP, -6.7]}>
        {[
          ["#ffd166", 2],
          ["#ff9fb7", 2],
          ["#8ee0c8", 1],
          ["#9ccaff", 2],
        ].map(([c, f], i) => (
          <TubeHouse
            key={`a${i}`}
            position={[-1.4 + i * 0.95, 0, -0.8]}
            color={c as string}
            floors={f as number}
          />
        ))}
        {[
          ["#c8b6ff", 1],
          ["#ffb27a", 2],
          ["#fff0a8", 1],
        ].map(([c, f], i) => (
          <TubeHouse
            key={`b${i}`}
            position={[-0.9 + i * 0.95, 0, 1.0]}
            color={c as string}
            floors={f as number}
          />
        ))}
      </group>

      {/* Góc Tây Nam: công viên đu quay + chợ */}
      <group position={[-7.4, 0, 6.6]}>
        <group position={[-0.6, 0, -0.6]} scale={1.35}>
          <FerrisWheel />
        </group>
        <Tree position={[-2.0, GROUND_TOP, 0.6]} tone={0} />
        <Tree position={[1.9, GROUND_TOP, -1.9]} tone={1} />
        {[0, 1, 2].map((i) => (
          <MarketStall
            key={i}
            position={[0.4 + i * 0.95, GROUND_TOP, 1.6]}
            awning={["#ff6b6b", "#ffd166", "#4fc3f7"][i]}
          />
        ))}
      </group>

      {/* Bồn hoa 4 góc quảng trường */}
      {[
        [-3.75, -3.75],
        [3.75, -3.75],
        [-3.75, 3.75],
        [3.75, 3.75],
      ].map(([x, z], i) => (
        <FlowerBed key={i} position={[x, GROUND_TOP, z]} seed={i} />
      ))}

      {/* Nhà nhỏ dọc các trục đường */}
      {[
        [-2.4, -6.4, "#ffcf99", "#e05a47"],
        [2.4, -6.6, "#b9e3ff", "#4a7bd0"],
        [-2.4, -8.4, "#d7f2c0", "#e07b39"],
        [2.4, -8.5, "#ffd6e6", "#8b5cf6"],
        [-6.5, -2.4, "#fff1b8", "#d9573b"],
        [-8.5, -2.5, "#c9f0e4", "#3f8f7a"],
        [6.5, 2.4, "#ffe0cc", "#c2410c"],
        [8.5, 2.5, "#e5dcff", "#d9573b"],
        [6.4, -2.4, "#d5f5ff", "#e05a47"],
        [-6.4, 2.4, "#ffe8a3", "#4a7bd0"],
        [2.4, 6.4, "#ffd1d1", "#3f8f7a"],
        [-2.4, 8.5, "#d9f99d", "#c2410c"],
      ].map(([x, z, wall, roof], i) => (
        <SmallHouse
          key={i}
          position={[x as number, GROUND_TOP, z as number]}
          wall={wall as string}
          roof={roof as string}
          rotationY={(i % 2) * Math.PI}
        />
      ))}

      {/* Góc Đông Nam: khu nhà thấp */}
      <group position={[7.1, GROUND_TOP, 7.1]}>
        <Block
          position={[-1.1, 0, -1.0]}
          size={[1.4, 1.6, 1.2]}
          color="#ffb3a7"
          roof="#7a8bb5"
        />
        <Block
          position={[0.9, 0, -1.1]}
          size={[1.2, 2.2, 1.1]}
          color="#a7d8ff"
          roof="#e86f5a"
        />
        <Block
          position={[-0.2, 0, 1.2]}
          size={[2.2, 1.1, 1.0]}
          color="#ffe39a"
          roof="#5aa58b"
        />
        <Tree position={[1.7, 0, 1.3]} tone={2} scale={0.85} />
      </group>

      {/* Đèn đường quanh quảng trường & dọc trục đường */}
      {[
        [-R - 0.75, -R - 0.75],
        [R + 0.75, -R - 0.75],
        [-R - 0.75, R + 0.75],
        [R + 0.75, R + 0.75],
        [-0.75, -6.4],
        [0.75, 6.4],
        [-6.4, 0.75],
        [6.4, -0.75],
      ].map(([x, z], i) => (
        <StreetLamp key={i} position={[x, GROUND_TOP, z]} />
      ))}

      {/* Hàng rào công viên đu quay */}
      <Fence position={[-7.4, GROUND_TOP, 4.3]} length={3.6} />
      <Fence
        position={[-9.15, GROUND_TOP, 6.6]}
        length={4.4}
        rotationY={Math.PI / 2}
      />

      {/* Hàng cây dọc các trục đường */}
      {[2.2, 3.4].flatMap((off) =>
        [-1, 1].flatMap((s) => [
          <Tree
            key={`x${off}${s}a`}
            position={[s * (R + 1.0 + off), GROUND_TOP, -0.95]}
            scale={0.6}
            tone={1}
          />,
          <Tree
            key={`x${off}${s}b`}
            position={[s * (R + 1.0 + off), GROUND_TOP, 0.95]}
            scale={0.6}
            tone={2}
          />,
          <Tree
            key={`z${off}${s}a`}
            position={[-0.95, GROUND_TOP, s * (R + 1.0 + off)]}
            scale={0.6}
            tone={0}
          />,
          <Tree
            key={`z${off}${s}b`}
            position={[0.95, GROUND_TOP, s * (R + 1.0 + off)]}
            scale={0.6}
            tone={1}
          />,
        ]),
      )}
    </group>
  );
}

export default memo(CityCenter);
