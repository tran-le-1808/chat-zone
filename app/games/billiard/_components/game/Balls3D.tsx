"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_PHYSICS as C } from "../../_lib/physics";
import { BALL_COLORS } from "../../_lib/types";
import { useBilliard } from "../../_context/BilliardGameContext";

const R = C.ballRadius;

/** Texture bi: màu nền + vài chấm nhỏ để nhìn thấy bi đang xoay */
function makeBallTexture(color: string, dot: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = dot;
  for (const [x, y] of [
    [64, 64],
    [192, 64],
    [128, 20],
    [128, 108],
  ]) {
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DOT_COLORS = ["#c9c9c0", "#c9960a", "#9e1b1b"];

/**
 * 3 viên bi: vị trí lấy từ quỹ đạo server (nội suy), hướng xoay tích phân từ
 * vận tốc góc (chỉ để hiển thị). Không re-render React mỗi khung hình.
 */
export default function Balls3D({ debug }: { debug: boolean }) {
  const { sampleBalls } = useBilliard();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const vArrows = useRef<(THREE.ArrowHelper | null)[]>([]);
  const wArrows = useRef<(THREE.ArrowHelper | null)[]>([]);
  const prev = useRef<{ x: number; y: number }[]>([]);

  const textures = useMemo(
    () => BALL_COLORS.map((col, i) => makeBallTexture(col, DOT_COLORS[i])),
    [],
  );
  const arrows = useMemo(
    () =>
      [0, 1, 2].map(() => ({
        v: new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(),
          0.1,
          0x22d3ee,
        ),
        w: new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(),
          0.1,
          0xf472b6,
        ),
      })),
    [],
  );

  const axis = useMemo(() => new THREE.Vector3(), []);
  const dq = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const samples = sampleBalls();
    samples.forEach((s, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.position.set(s.x, R, -s.y);
      // ω physics (x, y, z) -> three (x, z, -y)
      axis.set(s.wx, s.wz, -s.wy);
      const w = axis.length();
      if (w > 1e-3) {
        dq.setFromAxisAngle(axis.multiplyScalar(1 / w), w * dt);
        mesh.quaternion.premultiply(dq);
      }
      if (debug) {
        const p = prev.current[i] ?? { x: s.x, y: s.y };
        const vx = (s.x - p.x) / Math.max(dt, 1e-3);
        const vy = (s.y - p.y) / Math.max(dt, 1e-3);
        const sp = Math.hypot(vx, vy);
        const va = vArrows.current[i];
        if (va) {
          va.visible = sp > 0.02;
          va.position.set(s.x, R * 2.2, -s.y);
          if (sp > 0.02) {
            va.setDirection(new THREE.Vector3(vx / sp, 0, -vy / sp));
            va.setLength(Math.min(0.6, sp * 0.15), 0.03, 0.02);
          }
        }
        const wa = wArrows.current[i];
        if (wa) {
          const wl = Math.hypot(s.wx, s.wy, s.wz);
          wa.visible = wl > 0.5;
          wa.position.set(s.x, R, -s.y);
          if (wl > 0.5) {
            wa.setDirection(
              new THREE.Vector3(s.wx / wl, s.wz / wl, -s.wy / wl),
            );
            wa.setLength(Math.min(0.25, wl * 0.004 + 0.04), 0.02, 0.015);
          }
        }
      }
      prev.current[i] = { x: s.x, y: s.y };
    });
  });

  return (
    <group>
      {textures.map((tex, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          castShadow
        >
          <sphereGeometry args={[R, 32, 24]} />
          <meshPhysicalMaterial
            map={tex}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        </mesh>
      ))}
      {debug &&
        arrows.map((a, i) => (
          <group key={i}>
            <primitive
              object={a.v}
              ref={(o: THREE.ArrowHelper | null) => {
                vArrows.current[i] = o;
              }}
            />
            <primitive
              object={a.w}
              ref={(o: THREE.ArrowHelper | null) => {
                wArrows.current[i] = o;
              }}
            />
          </group>
        ))}
    </group>
  );
}
