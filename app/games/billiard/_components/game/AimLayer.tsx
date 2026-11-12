"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { predictCuePath } from "../../_lib/aimRay";
import {
  DEFAULT_PHYSICS as C,
  cueContactPoint,
  cueFrame,
  sanitizeShot,
  type BallId,
} from "../../_lib/physics";
import { useBilliard } from "../../_context/BilliardGameContext";

const R = C.ballRadius;
const CUE_LEN = C.cueLength;

/**
 * Cây cơ + đường bi cái đi tới lần chạm đầu tiên (chỉ hiện ở máy mình).
 * Đường được mô phỏng bằng cùng physics với server nên cong / ngắn đúng như thật.
 * Không vẽ đường dội / đường đi sau va chạm.
 */
export default function AimLayer() {
  const { match, canShoot, aim } = useBilliard();
  // Đường đi tới mô phỏng bằng cùng physics với server (đổi ngắm / lực / góc cơ / điểm chạm thì tính lại)
  const path = useMemo(
    () =>
      match && canShoot
        ? predictCuePath(
            match.balls,
            sanitizeShot(aim, (match.turn ?? 0) as BallId),
          )
        : null,
    [match, canShoot, aim],
  );
  const cue = (match?.turn ?? 0) as BallId;
  const cueBall = match?.balls[cue];
  if (!match || !cueBall || !canShoot || !path) return null;
  const [cx, cy] = cueBall;

  // Cây cơ theo đúng hình học vật lý: đầu cơ ở điểm chạm 3D trên bi, thân cơ dọc trục −d
  // (cùng hàm server dùng để tính xung lực) -> 90° là cơ dựng đứng trên đỉnh bi thật sự.
  const shot = sanitizeShot(aim, cue);
  const { d } = cueFrame(shot);
  const r = cueContactPoint(shot, C);
  const pull = 0.02 + aim.power * 0.2; // đầu cơ lùi theo lực (chỉ để hiển thị)
  // physics (x, y, z) -> three (x, z, -y)
  const toThree = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, z, -y);
  const contact = toThree(cx + r.x, cy + r.y, R + r.z);
  const back = toThree(-d.x, -d.y, -d.z).normalize();
  const tip = contact.clone().addScaledVector(back, pull);
  const butt = tip.clone().addScaledVector(back, CUE_LEN);
  const mid = tip.clone().add(butt).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    back,
  );

  // Trắng: chạm bi · Xám: chạm băng trước · Cam: bi dừng trước khi chạm gì
  const endColor =
    path.endReason === "ball"
      ? "#ffffff"
      : path.endReason === "cushion"
        ? "#94a3b8"
        : "#fb923c";

  return (
    <group>
      {/* Đường bi cái đi tới (theo vật lý thật, dừng ở lần chạm đầu tiên) */}
      <Line
        points={path.points.map((p) => new THREE.Vector3(p.x, R * 0.15, -p.y))}
        color={endColor}
        lineWidth={1.5}
        dashed
        dashSize={0.03}
        gapSize={0.02}
        transparent
        opacity={0.85}
      />
      {/* Bi ma tại điểm chạm / nơi bi dừng */}
      <mesh
        position={[path.end.x, R, -path.end.y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[R * 0.9, R, 32]} />
        <meshBasicMaterial
          color={endColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Cây cơ: đầu trắng, thân gỗ, đuôi tối */}
      <group position={mid} quaternion={quat}>
        <mesh castShadow>
          <cylinderGeometry args={[0.014, 0.0065, CUE_LEN, 16]} />
          <meshStandardMaterial color="#d9b382" roughness={0.4} />
        </mesh>
        <mesh position={[0, -CUE_LEN / 2 + 0.012, 0]}>
          <cylinderGeometry args={[0.0066, 0.0064, 0.024, 16]} />
          <meshStandardMaterial color="#f5f5f0" />
        </mesh>
        <mesh position={[0, -CUE_LEN / 2 + 0.003, 0]}>
          <cylinderGeometry args={[0.0064, 0.0064, 0.006, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, CUE_LEN / 2 - 0.22, 0]}>
          <cylinderGeometry args={[0.0142, 0.0125, 0.44, 16]} />
          <meshStandardMaterial color="#1c1917" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
