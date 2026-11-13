"use client";

import { useDeferredValue, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { POOL_PHYSICS as C } from "../_lib/physics/config";
import { cueContactPoint, cueFrame, sanitizeShot } from "../_lib/physics/cue";
import { simulateShot } from "../_lib/physics/simulator";
import { FRAME_STRIDE } from "../_lib/physics/types";
import { castAim, targetPath } from "../_lib/aim";
import { STROKE_TIME, usePool } from "./PoolContext";
import { PREVIEW_POWER, cuePullDistance } from "../../_shared/shot/shotMath";
import type { ShotCommand } from "../_lib/physics/types";

const R = C.ballRadius;
const CUE_LEN = 1.47;
const v3 = (x: number, y: number, h = R * 0.15) => new THREE.Vector3(x, h, -y);

/** Quỹ đạo dự đoán đầy đủ (chế độ "Đầy đủ" / tập luyện): mô phỏng thật cú đánh */
function FullPrediction() {
  const { rack, aim, physics, table: T } = usePool();
  const deferred = useDeferredValue(aim);
  const paths = useMemo(() => {
    const tr = simulateShot(rack.balls, sanitizeShot({ ...deferred, power: deferred.power > 0.04 ? deferred.power : PREVIEW_POWER }, physics), { record: true, config: { ...physics, frameRate: 40 } });
    const nb = tr.ballIds.length;
    const out: { n: number; pts: THREE.Vector3[] }[] = [];
    tr.ballIds.forEach((n, bi) => {
      const pts: THREE.Vector3[] = [];
      for (let f = 0; f < tr.frameCount; f++) {
        const o = (f * nb + bi) * FRAME_STRIDE;
        const pk = tr.frames[o + 5];
        if (pk > 0) {
          const hole = T.pockets[pk - 1];
          pts.push(v3(hole.x, hole.y));
          break;
        }
        pts.push(v3(tr.frames[o], tr.frames[o + 1]));
      }
      const a = pts[0];
      const moved = pts.some((p) => p.distanceTo(a) > 0.004);
      if (moved && pts.length > 1) out.push({ n, pts });
    });
    return out;
  }, [rack.balls, deferred, physics, T]);
  return (
    <group>
      {paths.map((p) => (
        <Line
          key={p.n}
          points={p.pts}
          color={p.n === 0 ? "#ffffff" : "#ffd166"}
          lineWidth={1.4}
          transparent
          opacity={0.75}
        />
      ))}
    </group>
  );
}

/** Vị trí & hướng cây cơ theo hình học vật lý (đầu cơ tại điểm chạm 3D trên bi) */
function cuePose(cx: number, cy: number, shot: ShotCommand, pull: number) {
  const { d } = cueFrame(shot);
  const r = cueContactPoint(shot, C);
  const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);
  const contact = toThree(cx + r.x, cy + r.y, R + r.z);
  const back = toThree(-d.x, -d.y, -d.z).normalize();
  const tip = contact.clone().addScaledVector(back, pull);
  const mid = tip.clone().addScaledVector(back, CUE_LEN / 2);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), back);
  return { mid, quat };
}

/**
 * Cây cơ 147 cm: đầu da xanh phấn Ø13 mm, ferrule trắng, ngọn gỗ phong, đuôi gỗ sẫm có quấn cán.
 * Khi kéo lực, cơ lùi ra; khi đánh, cơ đẩy tới chạm bi (STROKE_TIME) rồi ẩn.
 */
function CueStick({ visible }: { visible: boolean }) {
  const { rack, aim, getPlayback } = usePool();
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const pb = getPlayback();
    const cue = rack.balls.find((b) => b.n === 0);
    if (pb && pb.stroke && pb.cmd && cue) {
      const now = performance.now();
      const left = (pb.t0 - now) / 1000;
      if (left > -0.5) {
        // 1) đẩy cơ tới chạm bi (≈100 ms)  2) theo đà ~1.5 cm  3) thu cơ về phía sau rồi ẩn
        const p = Math.max(0, Math.min(1, 1 - left / STROKE_TIME));
        const start = cuePullDistance(pb.cmd.power);
        const since = -left;
        let pull: number;
        if (left > 0) pull = start * (1 - p * p);
        else if (since < 0.08) pull = -0.015 * (since / 0.08);
        else {
          const q = Math.min(1, (since - 0.08) / 0.3);
          pull = -0.015 + 0.155 * (1 - (1 - q) * (1 - q));
        }
        const pose = cuePose(cue.x, cue.y, sanitizeShot(pb.cmd, C), pull);
        g.position.copy(pose.mid);
        g.quaternion.copy(pose.quat);
        g.visible = true;
        return;
      }
      g.visible = false;
      return;
    }
    if (!visible || !cue) {
      g.visible = false;
      return;
    }
    // Khoảng lùi tối đa ~18 cm ứng với lực 100%; kéo mạnh thì đầu cơ rung nhẹ (cảm giác căng)
    const pose = cuePose(cue.x, cue.y, sanitizeShot(aim, C), cuePullDistance(aim.power));
    g.position.copy(pose.mid);
    if (aim.power > 0.25) g.position.y += Math.sin(performance.now() * 0.07) * 0.0007 * aim.power;
    g.quaternion.copy(pose.quat);
    g.visible = true;
  });
  const L2 = CUE_LEN / 2;
  return (
    <group ref={ref} visible={false}>
      {/* Ngọn gỗ phong (côn 13 mm -> 21 mm) */}
      <mesh position={[0, -L2 + 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.0095, 0.0065, 0.74, 20]} />
        <meshPhysicalMaterial color="#e8cf9f" roughness={0.35} clearcoat={0.6} />
      </mesh>
      {/* Ferrule trắng */}
      <mesh position={[0, -L2 + 0.0185, 0]}>
        <cylinderGeometry args={[0.0065, 0.0065, 0.025, 20]} />
        <meshPhysicalMaterial color="#f7f5ef" roughness={0.2} clearcoat={1} />
      </mesh>
      {/* Đầu da xanh phấn */}
      <mesh position={[0, -L2 + 0.003, 0]}>
        <cylinderGeometry args={[0.0064, 0.0064, 0.006, 20]} />
        <meshStandardMaterial color="#3b82c4" roughness={0.9} />
      </mesh>
      {/* Khớp nối + thân đuôi gỗ sẫm + quấn cán */}
      <mesh position={[0, -L2 + 0.78, 0]}>
        <cylinderGeometry args={[0.0108, 0.0098, 0.04, 20]} />
        <meshPhysicalMaterial color="#d8d2c4" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, L2 - 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.0145, 0.011, 0.62, 20]} />
        <meshPhysicalMaterial color="#3a1a0c" roughness={0.3} clearcoat={1} />
      </mesh>
      <mesh position={[0, L2 - 0.26, 0]}>
        <cylinderGeometry args={[0.0147, 0.0139, 0.24, 20]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Đường ngắm (bi ma, hướng bi mục tiêu, hướng bi cái theo quy tắc 90°) + cây cơ */
export default function PoolAim3D() {
  const { rack, aim, canShoot, phase, prefs, effectiveCall, isHumanTurn, table: T, setup } = usePool();
  const cue = rack.balls.find((b) => b.n === 0);
  const showAim = !!cue && (canShoot || (phase === "thinking" && !isHumanTurn));
  const cast = useMemo(
    () => (showAim ? castAim(rack.balls, aim.dirX, aim.dirY) : null),
    [showAim, rack.balls, aim.dirX, aim.dirY],
  );
  // Chế độ xếp hạng: tắt đường dự đoán quỹ đạo đầy đủ
  const guide = prefs.guide === "full" && setup.config.allowFullGuide === false ? "ghost" : prefs.guide;

  const callMarks = effectiveCall && (phase === "idle" || phase === "thinking") && (() => {
    const p = T.pockets[effectiveCall.pocket];
    const b = rack.balls.find((x) => x.n === effectiveCall.ball);
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.mouthX, 0.002, -p.mouthY]}>
          <ringGeometry args={[0.035, 0.045, 32]} />
          <meshBasicMaterial color="#ffd166" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        {b && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[b.x, 0.002, -b.y]}>
            <ringGeometry args={[R * 1.15, R * 1.35, 32]} />
            <meshBasicMaterial color="#ffd166" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  })();

  const hitColor = cast?.hitBall === null ? "#94a3b8" : "#ffffff";
  const target = cast && cast.hitBall !== null ? rack.balls.find((b) => b.n === cast.hitBall) : null;

  return (
    <group>
      {showAim && cue && cast && (
        guide === "full" ? (
          <FullPrediction />
        ) : (
          <>
            <Line points={[v3(cue.x, cue.y), v3(cast.end.x, cast.end.y)]} color={hitColor} lineWidth={1.4} dashed dashSize={0.03} gapSize={0.02} transparent opacity={0.85} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cast.end.x, R, -cast.end.y]}>
              <ringGeometry args={[R * 0.9, R, 32]} />
              <meshBasicMaterial color={hitColor} transparent opacity={0.85} side={THREE.DoubleSide} />
            </mesh>
            {guide === "ghost" && target && cast.objectDir && (() => {
              // Đường bi mục tiêu đi tới bi chắn / băng đầu tiên; xanh lá nếu lọt miệng lỗ (có khả năng vào lỗ)
              const path = targetPath(rack.balls, target, cast.objectDir, T);
              const color = path.pocket !== null ? "#4ade80" : "#ffd166";
              const pk = path.pocket !== null ? T.pockets[path.pocket] : null;
              return (
                <>
                  <Line points={[v3(target.x, target.y), v3(path.end.x, path.end.y)]} color={color} lineWidth={1.8} transparent opacity={0.9} />
                  {pk && (
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pk.mouthX, 0.003, -pk.mouthY]}>
                      <ringGeometry args={[pk.mouth * 0.32, pk.mouth * 0.4, 32]} />
                      <meshBasicMaterial color="#4ade80" transparent opacity={0.85} side={THREE.DoubleSide} />
                    </mesh>
                  )}
                  {!pk && path.blocker !== null && (
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[path.end.x, 0.003, -path.end.y]}>
                      <ringGeometry args={[R * 0.7, R * 0.9, 24]} />
                      <meshBasicMaterial color="#fb923c" transparent opacity={0.8} side={THREE.DoubleSide} />
                    </mesh>
                  )}
                </>
              );
            })()}
            {guide === "ghost" && cast.cueDir && (
              <Line
                points={[v3(cast.end.x, cast.end.y), v3(cast.end.x + cast.cueDir.x * 0.18, cast.end.y + cast.cueDir.y * 0.18)]}
                color="#93c5fd"
                lineWidth={1.2}
                transparent
                opacity={0.7}
              />
            )}
          </>
        )
      )}
      {callMarks}
      <CueStick visible={showAim} />
    </group>
  );
}
