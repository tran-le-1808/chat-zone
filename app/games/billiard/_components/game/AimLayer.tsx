"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
import { CAROM_POWER_EXP, STROKE_MS, useBilliard } from "../../_context/BilliardGameContext";
import { PREVIEW_POWER, cuePullDistance, powerCurve } from "../../../_shared/shot/shotMath";

const R = C.ballRadius;
const CUE_LEN = C.cueLength;
const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

/** Vị trí & hướng cây cơ theo hình học vật lý (đầu cơ tại điểm chạm 3D trên bi) */
function pose(cx: number, cy: number, aim: Parameters<typeof sanitizeShot>[0], cue: BallId, pull: number) {
  const shot = sanitizeShot(aim, cue);
  const { d } = cueFrame(shot);
  const r = cueContactPoint(shot, C);
  const contact = toThree(cx + r.x, cy + r.y, R + r.z);
  const back = toThree(-d.x, -d.y, -d.z).normalize();
  const tip = contact.clone().addScaledVector(back, pull);
  const mid = tip.clone().addScaledVector(back, CUE_LEN / 2);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), back);
  return { mid, quat };
}

/**
 * Cây cơ: lùi ra sau tối đa ~18 cm theo mức kéo; khi thả tay đẩy tới chạm đầu bi trong
 * ~100 ms rồi mới giải phóng bi. Kéo mạnh thì đầu cơ rung nhẹ.
 */
function CueStick({ visible }: { visible: boolean }) {
  const { match, aim, strokeRef } = useBilliard();
  const ref = useRef<THREE.Group>(null);
  const cur = useRef({ match, aim, visible });
  useEffect(() => {
    cur.current = { match, aim, visible };
  });
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const st = strokeRef.current;
    const now = performance.now();
    if (st && now - st.t0 < STROKE_MS + 160) {
      const k = Math.min(1, (now - st.t0) / STROKE_MS);
      const start = cuePullDistance(st.d);
      // Đẩy tới (ease-in), rồi theo đà thêm ~1 cm
      const pull = k < 1 ? start * (1 - k * k) : -Math.min(0.01, (now - st.t0 - STROKE_MS) * 0.00008);
      const p = pose(st.cue[0], st.cue[1], st.aim, (cur.current.match?.turn ?? 0) as BallId, pull);
      g.position.copy(p.mid);
      g.quaternion.copy(p.quat);
      g.visible = true;
      return;
    }
    const { match: m, aim: a, visible: v } = cur.current;
    const cue = m?.balls[m.turn];
    if (!v || !m || !cue) {
      g.visible = false;
      return;
    }
    const p = pose(cue[0], cue[1], a, m.turn as BallId, cuePullDistance(a.power));
    g.position.copy(p.mid);
    if (a.power > 0.25) g.position.y += Math.sin(now * 0.07) * 0.0007 * a.power;
    g.quaternion.copy(p.quat);
    g.visible = true;
  });
  return (
    <group ref={ref} visible={false}>
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
  );
}

/**
 * Cây cơ + đường bi cái đi tới lần chạm đầu tiên (chỉ hiện ở máy mình).
 * Đường được mô phỏng bằng cùng physics với server; cập nhật ngay khi đổi hướng / điểm chạm / góc cơ.
 */
export default function AimLayer() {
  const { match, canShoot, aim } = useBilliard();
  // Lực dùng để dự đoán: lực đang kéo (đã qua đường cong), hoặc lực xem trước khi chưa kéo
  const rawPower = aim.power > 0.04 ? powerCurve(aim.power, CAROM_POWER_EXP) : PREVIEW_POWER;
  const power = useDeferredValue(rawPower);
  const path = useMemo(
    () =>
      match && canShoot
        ? predictCuePath(
            match.balls,
            sanitizeShot(
              { dirX: aim.dirX, dirY: aim.dirY, tipX: aim.tipX, tipY: aim.tipY, elevation: aim.elevation, power },
              (match.turn ?? 0) as BallId,
            ),
          )
        : null,
    [match, canShoot, aim.dirX, aim.dirY, aim.tipX, aim.tipY, aim.elevation, power],
  );
  const cueBall = match?.balls[match.turn];

  // Trắng: chạm bi · Xám: chạm băng trước · Cam: bi dừng trước khi chạm gì
  const endColor = !path ? "#fff" : path.endReason === "ball" ? "#ffffff" : path.endReason === "cushion" ? "#94a3b8" : "#fb923c";

  return (
    <group>
      {match && cueBall && canShoot && path && (
        <>
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
          <mesh position={[path.end.x, R, -path.end.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[R * 0.9, R, 32]} />
            <meshBasicMaterial color={endColor} transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      <CueStick visible={!!match && !!cueBall && canShoot} />
    </group>
  );
}
