"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Bụi khi chạm đất — bể hạt dùng lại (object pool, 40 hạt, 1 InstancedMesh):
 * không cấp phát bộ nhớ trong vòng lặp. Mỗi lần chạm bật 4 hạt ra hai bên chân.
 */
const MAX = 40;
const LIFE = 0.3;

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  t: number; // tuổi; >= LIFE = chết
}
const pool: P[] = Array.from({ length: MAX }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: LIFE }));
let cursor = 0;
let dirty = false;

/** Bật bụi tại (x,y,z) — `scale` ~ chiều cao nhân vật */
export function emitDust(x: number, y: number, z: number, scale = 1, count = 4) {
  for (let i = 0; i < count; i++) {
    const p = pool[cursor++ % MAX];
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.8;
    const sp = 0.9 + Math.random() * 0.6;
    p.x = x; p.y = y + 0.04; p.z = z;
    p.vx = Math.cos(a) * sp * scale; p.vz = Math.sin(a) * sp * scale;
    p.vy = (0.55 + Math.random() * 0.4) * scale;
    p.t = 0;
  }
  dirty = true;
}

export default function DustPool() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < MAX; i++) m.setMatrixAt(i, dummy.matrix);
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, delta) => {
    const m = ref.current;
    if (!m || !dirty) return;
    const dt = Math.min(delta, 0.05);
    let alive = false;
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (p.t < LIFE) {
        p.t += dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 2.2 * dt; p.vx *= 0.94; p.vz *= 0.94;
        const k = Math.max(0, 1 - p.t / LIFE);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar((0.1 + 0.12 * (1 - k)) * (p.t < LIFE ? 1 : 0));
        alive = alive || k > 0;
      } else {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (!alive) dirty = false;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#f4ecd8" transparent opacity={0.7} depthWrite={false} />
    </instancedMesh>
  );
}
