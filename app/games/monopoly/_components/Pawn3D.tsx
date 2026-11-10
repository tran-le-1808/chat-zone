"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type PawnType = "dragon" | "bunny" | "cat" | "lion";
export type PawnState = "idle" | "moving" | "winner" | "loser";

interface Pawn3DProps {
  type: PawnType;
  state?: PawnState;
  /** Màu khăn quàng (màu người chơi) */
  color?: string;
  position?: [number, number, number];
  scale?: number;
}

/**
 * Bảng màu từng nhân vật — phong cách đồ chơi vinyl pastel.
 * body: màu thân · belly: bụng & mõm · accent: chi tiết riêng · inner: tai trong
 */
const PALETTE: Record<
  PawnType,
  { body: string; belly: string; accent: string; inner: string; scarf: string }
> = {
  dragon: {
    body: "#6fe3d6",
    belly: "#fff3c4",
    accent: "#ffd77a",
    inner: "#3cc9b6",
    scarf: "#00c8e0",
  },
  bunny: {
    body: "#ffb3cf",
    belly: "#fff6fa",
    accent: "#ffffff",
    inner: "#ff8fb4",
    scarf: "#ff3d8b",
  },
  cat: {
    body: "#c9b8ff",
    belly: "#f6f2ff",
    accent: "#9d86f2",
    inner: "#ffb3cb",
    scarf: "#a855f7",
  },
  lion: {
    body: "#ffd768",
    belly: "#fff6d6",
    accent: "#ff9442",
    inner: "#ffb36b",
    scarf: "#e84a3c",
  },
};

const SEG = 24;

/** Vật liệu nhựa mềm bóng nhẹ */
function Toy({ color, rough = 0.5 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={0} />;
}

export default function Pawn3D({
  type,
  state = "idle",
  color,
  position = [0, 0, 0],
  scale = 1,
}: Pawn3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const eyesRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);

  const p = PALETTE[type];
  const scarf = color ?? p.scarf;
  // Lệch pha ngẫu nhiên để các quân không chuyển động giống hệt nhau
  const seed = useMemo(
    () => ({ dragon: 0.3, bunny: 1.7, cat: 2.9, lion: 4.1 })[type],
    [type],
  );

  // ==========================================
  // HOẠT HỌA
  // ==========================================
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime() + seed;

    g.rotation.set(0, 0, 0);
    let sx = 1;
    let sy = 1;
    let y = position[1];
    let armSwing = Math.sin(t * 2) * 0.15;
    let headTilt = Math.sin(t * 1.6) * 0.08;
    let headTurn = Math.sin(t * 0.9) * 0.2;

    switch (state) {
      case "idle": {
        // Thở nhẹ (co giãn) + nhún
        const breathe = Math.sin(t * 3);
        y += (breathe + 1) * 0.02;
        sy = 1 + breathe * 0.025;
        sx = 1 - breathe * 0.015;
        break;
      }
      case "moving": {
        // Nhảy tưng tưng, nén lại khi chạm đất
        const hop = Math.abs(Math.sin(t * 10));
        y += hop * 0.35;
        sy = 0.86 + hop * 0.2;
        sx = 1.08 - hop * 0.1;
        armSwing = Math.sin(t * 20) * 0.7;
        headTilt = Math.sin(t * 10) * 0.12;
        headTurn = 0;
        break;
      }
      case "winner": {
        const hop = Math.abs(Math.sin(t * 8));
        y += hop * 0.6;
        g.rotation.y = t * 5;
        armSwing = -1.8 + Math.sin(t * 16) * 0.4; // giơ tay ăn mừng
        sy = 0.9 + hop * 0.15;
        break;
      }
      case "loser": {
        y -= 0.05;
        g.rotation.x = -0.35;
        headTilt = 0.35;
        headTurn = Math.sin(t * 3) * 0.1;
        armSwing = 0.3;
        sy = 0.92;
        break;
      }
    }

    g.position.y = y;
    g.scale.set(scale * sx, scale * sy, scale * sx);

    if (headRef.current) {
      headRef.current.rotation.z = headTilt;
      headRef.current.rotation.y = headTurn;
    }
    if (armLRef.current) armLRef.current.rotation.x = armSwing;
    if (armRRef.current)
      armRRef.current.rotation.x = state === "winner" ? armSwing : -armSwing;
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 4) * 0.4;

    // Chớp mắt mỗi ~3.5 giây
    if (eyesRef.current) {
      const blink = (t % 3.5) < 0.12 ? 0.12 : 1;
      eyesRef.current.scale.y = state === "loser" ? 0.35 : blink;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* ================= CHÂN ================= */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.1, 0, 0.02]}>
          <mesh position={[0, 0.11, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.08, 6, SEG]} />
            <Toy color={p.body} />
          </mesh>
          <mesh position={[0, 0.045, 0.03]} scale={[1, 0.6, 1.25]} castShadow>
            <sphereGeometry args={[0.085, SEG, SEG]} />
            <Toy color={type === "lion" ? p.belly : p.body} />
          </mesh>
        </group>
      ))}

      {/* ================= THÂN ================= */}
      <group ref={bodyRef}>
        <mesh position={[0, 0.34, 0]} scale={[1, 1.08, 0.95]} castShadow>
          <sphereGeometry args={[0.24, SEG, SEG]} />
          <Toy color={p.body} />
        </mesh>
        {/* Bụng */}
        <mesh position={[0, 0.3, 0.185]} scale={[1, 1.05, 0.42]}>
          <sphereGeometry args={[0.16, 32, 32]} />
          <Toy color={p.belly} />
        </mesh>

        {/* Khăn quàng màu người chơi */}
        <mesh position={[0, 0.53, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.17, 0.05, 12, SEG]} />
          <Toy color={scarf} rough={0.6} />
        </mesh>
        <mesh
          position={[0.1, 0.47, 0.15]}
          rotation={[0.3, 0, -0.4]}
          scale={[0.7, 1.2, 0.5]}
        >
          <sphereGeometry args={[0.06, 12, 12]} />
          <Toy color={scarf} rough={0.6} />
        </mesh>

        {/* Tay (xoay quanh vai) */}
        {[-1, 1].map((s) => (
          <group
            key={s}
            ref={s < 0 ? armLRef : armRRef}
            position={[s * 0.21, 0.46, 0]}
          >
            <mesh
              position={[s * 0.05, -0.08, 0.02]}
              rotation={[0, 0, s * 0.5]}
              castShadow
            >
              <capsuleGeometry args={[0.06, 0.1, 6, SEG]} />
              <Toy color={p.body} />
            </mesh>
          </group>
        ))}

        {/* ---- Chi tiết thân theo nhân vật ---- */}
        {type === "dragon" && (
          <>
            {/* Cánh nhỏ */}
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * 0.16, 0.44, -0.19]}
                rotation={[0.2, s * 0.6, s * 0.5]}
                scale={[1, 0.75, 0.25]}
              >
                <sphereGeometry args={[0.14, SEG, SEG]} />
                <Toy color={p.accent} />
              </mesh>
            ))}
            {/* Đuôi */}
            <group ref={tailRef} position={[0, 0.2, -0.2]}>
              <mesh rotation={[-1.9, 0, 0]} position={[0, 0, -0.08]} castShadow>
                <coneGeometry args={[0.09, 0.26, SEG]} />
                <Toy color={p.body} />
              </mesh>
            </group>
          </>
        )}

        {type === "bunny" && (
          <group ref={tailRef} position={[0, 0.24, -0.24]}>
            <mesh>
              <sphereGeometry args={[0.085, SEG, SEG]} />
              <Toy color={p.accent} rough={0.8} />
            </mesh>
          </group>
        )}

        {type === "cat" && (
          <group ref={tailRef} position={[0.08, 0.2, -0.2]}>
            <mesh rotation={[0, Math.PI / 2, 0.4]} position={[0, 0.12, -0.02]}>
              <torusGeometry args={[0.13, 0.045, 10, SEG, Math.PI * 1.2]} />
              <Toy color={p.body} />
            </mesh>
          </group>
        )}

        {type === "lion" && (
          <group ref={tailRef} position={[0, 0.2, -0.2]}>
            <mesh rotation={[-1.2, 0, 0]} position={[0, 0.03, -0.1]}>
              <cylinderGeometry args={[0.025, 0.025, 0.24, 8]} />
              <Toy color={p.body} />
            </mesh>
            <mesh position={[0, 0.1, -0.2]}>
              <sphereGeometry args={[0.06, SEG, SEG]} />
              <Toy color={p.accent} rough={0.8} />
            </mesh>
          </group>
        )}
      </group>

      {/* ================= ĐẦU ================= */}
      <group ref={headRef} position={[0, 0.84, 0]}>
        {/* Bờm sư tử (phía sau đầu) */}
        {type === "lion" &&
          Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.31, Math.sin(a) * 0.28, -0.08]}
                castShadow
              >
                <sphereGeometry args={[0.12, 16, 16]} />
                <Toy color={p.accent} rough={0.7} />
              </mesh>
            );
          })}

        {/* Khối đầu */}
        <mesh scale={[1.1, 0.95, 1]} castShadow>
          <sphereGeometry args={[0.32, SEG + 8, SEG + 8]} />
          <Toy color={p.body} />
        </mesh>

        {/* Mõm */}
        <mesh position={[0, -0.08, 0.25]} scale={[1.3, 0.8, 0.6]}>
          <sphereGeometry args={[0.11, SEG, SEG]} />
          <Toy color={p.belly} />
        </mesh>

        {/* Mắt đen bóng + đốm sáng */}
        <group ref={eyesRef} position={[0, 0.02, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.125, 0, 0.285]}>
              <mesh scale={[1, 1.15, 0.7]}>
                <sphereGeometry args={[0.05, SEG, SEG]} />
                <meshStandardMaterial
                  color="#141414"
                  roughness={0.08}
                  metalness={0.2}
                />
              </mesh>
              <mesh position={[0.016, 0.024, 0.03]}>
                <sphereGeometry args={[0.015, 10, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>

        {/* Má hồng */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.205, -0.07, 0.258]}
            rotation={[0, s * 0.62, 0]}
          >
            <circleGeometry args={[0.055, SEG]} />
            <meshBasicMaterial color="#ff6f96" transparent opacity={0.6} />
          </mesh>
        ))}

        {/* Mũi + miệng cười */}
        <mesh position={[0, -0.05, 0.315]} scale={[1.3, 1, 1]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <Toy color={type === "dragon" ? p.inner : "#e0607e"} rough={0.3} />
        </mesh>
        <mesh position={[0, -0.095, 0.312]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.028, 0.007, 6, 16, Math.PI]} />
          <meshBasicMaterial color="#3a2a2a" />
        </mesh>

        {/* ---- Chi tiết đầu theo nhân vật ---- */}
        {type === "dragon" && (
          <>
            {/* Sừng */}
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * 0.15, 0.28, -0.02]}
                rotation={[0, 0, -s * 0.35]}
                castShadow
              >
                <coneGeometry args={[0.05, 0.16, SEG]} />
                <Toy color={p.accent} />
              </mesh>
            ))}
            {/* Gai lưng trên đỉnh đầu */}
            {[0, 1, 2].map((i) => (
              <mesh
                key={i}
                position={[0, 0.29 - i * 0.07, -0.08 - i * 0.1]}
                rotation={[-0.5 - i * 0.35, 0, 0]}
              >
                <coneGeometry args={[0.04, 0.1, 12]} />
                <Toy color={p.inner} />
              </mesh>
            ))}
            {/* Tai nhỏ */}
            {[-1, 1].map((s) => (
              <mesh
                key={`e${s}`}
                position={[s * 0.33, 0.06, -0.02]}
                rotation={[0, 0, -s * 0.9]}
                scale={[1, 0.6, 0.35]}
              >
                <sphereGeometry args={[0.08, SEG, SEG]} />
                <Toy color={p.body} />
              </mesh>
            ))}
          </>
        )}

        {type === "bunny" &&
          [-1, 1].map((s) => (
            <group
              key={s}
              position={[s * 0.12, 0.38, -0.03]}
              rotation={[-0.1, 0, -s * 0.18]}
            >
              <mesh castShadow>
                <capsuleGeometry args={[0.075, 0.26, 8, SEG]} />
                <Toy color={p.body} />
              </mesh>
              <mesh position={[0, 0.01, 0.062]} scale={[0.55, 0.82, 0.25]}>
                <capsuleGeometry args={[0.07, 0.24, 8, SEG]} />
                <Toy color={p.inner} />
              </mesh>
            </group>
          ))}

        {type === "cat" && (
          <>
            {[-1, 1].map((s) => (
              <group
                key={s}
                position={[s * 0.2, 0.25, 0]}
                rotation={[0, 0, -s * 0.38]}
              >
                <mesh castShadow>
                  <coneGeometry args={[0.1, 0.17, SEG]} />
                  <Toy color={p.body} />
                </mesh>
                <mesh position={[0, -0.015, 0.062]} scale={[0.6, 0.7, 0.3]}>
                  <coneGeometry args={[0.1, 0.17, SEG]} />
                  <Toy color={p.inner} />
                </mesh>
              </group>
            ))}
            {/* Vằn trán */}
            {[-1, 0, 1].map((i) => (
              <mesh
                key={`s${i}`}
                position={[i * 0.06, 0.22, 0.2]}
                rotation={[-0.75, 0, i * 0.25]}
                scale={[0.5, 1, 0.4]}
              >
                <capsuleGeometry args={[0.022, 0.06, 4, 10]} />
                <Toy color={p.accent} />
              </mesh>
            ))}
            {/* Ria mép */}
            {[-1, 1].map((s) =>
              [-0.06, 0.06].map((tilt) => (
                <mesh
                  key={`${s}${tilt}`}
                  position={[s * 0.2, -0.07 + tilt * 0.3, 0.27]}
                  rotation={[0, 0, Math.PI / 2 + s * tilt * 3]}
                >
                  <cylinderGeometry args={[0.004, 0.004, 0.13, 4]} />
                  <meshBasicMaterial color="#5b4a7a" />
                </mesh>
              )),
            )}
          </>
        )}

        {type === "lion" &&
          [-1, 1].map((s) => (
            <group key={s} position={[s * 0.22, 0.24, 0]}>
              <mesh scale={[1, 1, 0.6]} castShadow>
                <sphereGeometry args={[0.075, SEG, SEG]} />
                <Toy color={p.body} />
              </mesh>
              <mesh position={[0, 0, 0.03]} scale={[0.6, 0.6, 0.4]}>
                <sphereGeometry args={[0.075, SEG, SEG]} />
                <Toy color={p.inner} />
              </mesh>
            </group>
          ))}
      </group>
    </group>
  );
}
