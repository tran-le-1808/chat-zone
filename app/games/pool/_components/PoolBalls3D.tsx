"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { poolSound } from "../_lib/poolSound";
import { POOL_PHYSICS as C } from "../_lib/physics/config";
import { FRAME_STRIDE, type BallSpot } from "../_lib/physics/types";
import { makeBallTexture } from "../_lib/ballArt";
import { contactShadowTexture } from "../_lib/textures";
import { usePool } from "./PoolContext";
import { FLOOR_Y } from "./PoolTable3D";

const R = C.ballRadius;
const ALL = Array.from({ length: 16 }, (_, i) => i);

/**
 * 16 viên bi. Khi phát lại cú đánh: vị trí nội suy từ quỹ đạo đã mô phỏng; hướng xoay TÍCH PHÂN
 * từ ω của engine (quaternion) nên số trên bi lăn / xoáy thật; bi rơi lỗ tụt theo z của engine.
 * Âm thanh phát đúng thời điểm & vị trí sự kiện. Không re-render React mỗi khung hình.
 */
export default function PoolBalls3D() {
  const { rack, getPlayback, prefs } = usePool();
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const statics = useRef<BallSpot[]>(rack.balls);
  /** Giữ vị trí cuối cú đánh tới khi trạng thái ván mới được áp (tránh nháy) */
  const hold = useRef<BallSpot[] | null>(null);
  const textures = useMemo(() => ALL.map((n) => makeBallTexture(n)), []);
  const shadowTex = useMemo(() => contactShadowTexture(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const dq = useMemo(() => new THREE.Quaternion(), []);

  /** Vị trí đang hiển thị & hoạt cảnh nội suy (~150 ms) khi trạng thái nhảy (lệch server, đối thủ đặt bi) */
  const shown = useRef(new Map<number, { x: number; y: number }>());
  const blend = useRef<{ from: Map<number, { x: number; y: number }>; t0: number } | null>(null);
  useEffect(() => {
    statics.current = rack.balls;
    hold.current = null;
    blend.current = { from: new Map(shown.current), t0: performance.now() };
  }, [rack.balls]);

  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  const place = (n: number, x: number, y: number, h: number, visible: boolean) => {
    if (visible) shown.current.set(n, { x, y });
    else shown.current.delete(n);
    const mesh = meshes.current[n];
    const sh = shadows.current[n];
    if (mesh) {
      mesh.visible = visible;
      mesh.position.set(x, h, -y);
    }
    if (sh) {
      sh.visible = visible && h > R - 0.01;
      sh.position.set(x, 0.0012, -y);
      // Bi bay cao: bóng trên bàn nở ra và mờ đi theo độ cao (h − R)
      const lift = Math.max(0, h - R);
      sh.scale.setScalar(1 + lift * 5);
      (sh.material as THREE.MeshBasicMaterial).opacity = 0.75 / (1 + lift * 14);
    }
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const pb = getPlayback();
    if (pb && !pb.done) {
      const tr = pb.trace;
      const el = Math.max(0, (performance.now() - pb.t0) / 1000);
      if (performance.now() >= pb.t0) {
        while (pb.evIdx < tr.events.length && tr.events[pb.evIdx].t <= el) {
          const e = tr.events[pb.evIdx++];
          if (e.type === "cue") poolSound.play(e.miscue ? "miscue" : "cue", e.speed / 9, e.x, e.y);
          else if (e.type === "ball") poolSound.play("ball", e.speed / 5, e.x, e.y);
          else if (e.type === "land") poolSound.play("land", e.speed / 3, e.x, e.y);
          else if (e.type === "offtable") poolSound.play("land", 0.6, e.x, e.y);
          else if (e.type === "jump") poolSound.play("jump", e.vz / 4, e.x, e.y);
          else if (e.type === "cushion")
            poolSound.play(e.part === "rail" ? "rail" : e.part === "back" ? "back" : "jaw", e.speed / 4, e.x, e.y);
          else poolSound.play("drop", 1, e.x, e.y);
        }
      }
      const f = Math.min(tr.frameCount - 1, el * tr.fps);
      const i0 = Math.floor(f);
      const i1 = Math.min(tr.frameCount - 1, i0 + 1);
      const k = f - i0;
      const nb = tr.ballIds.length;
      const F = tr.frames;
      const seen = new Set<number>();
      tr.ballIds.forEach((n, bi) => {
        const mesh = meshes.current[n];
        if (!mesh) return;
        seen.add(n);
        const o0 = (i0 * nb + bi) * FRAME_STRIDE;
        const o1 = (i1 * nb + bi) * FRAME_STRIDE;
        const status = F[o0 + 5];
        const x = F[o0] + (F[o1] - F[o0]) * k;
        const y = F[o0 + 1] + (F[o1 + 1] - F[o0 + 1]) * k;
        const z = F[o0 + 6] + (F[o1 + 6] - F[o0 + 6]) * k;
        const off = status === 100 ? pb.offAt.get(n) : undefined;
        if (off && el >= off.t) {
          // Bi văng khỏi bàn: tiếp tục bay theo quỹ đạo ném xiên rồi rơi xuống sàn
          const t = el - off.t;
          const hh = R + off.h + off.vz * t - 0.5 * C.gravity * t * t;
          place(n, off.x + off.vx * t, off.y + off.vy * t, hh, hh > FLOOR_Y + R);
        } else place(n, x, y, R - z, status === 0);
        // ω physics (x, y, z) -> three (x, z, −y): tích phân quaternion
        axis.set(F[o0 + 2], F[o0 + 4], -F[o0 + 3]);
        const w = axis.length();
        if (w > 1e-3 && el > 0) {
          dq.setFromAxisAngle(axis.multiplyScalar(1 / w), w * dt);
          mesh.quaternion.premultiply(dq);
        }
      });
      ALL.forEach((n) => {
        if (!seen.has(n)) place(n, 0, 0, R, false);
      });
      if (el >= tr.result.duration + 0.05) {
        pb.done = true;
        hold.current = tr.result.final;
        pb.onDone();
      }
      return;
    }
    const spots = hold.current ?? statics.current;
    const on = new Map(spots.map((b) => [b.n, b]));
    const bl = blend.current;
    const k = bl ? Math.min(1, (performance.now() - bl.t0) / 150) : 1;
    const e = 1 - (1 - k) * (1 - k);
    ALL.forEach((n) => {
      const b = on.get(n);
      if (!b) return place(n, 0, 0, R, false);
      const f = bl?.from.get(n);
      if (f && k < 1 && Math.hypot(f.x - b.x, f.y - b.y) < 0.6)
        place(n, f.x + (b.x - f.x) * e, f.y + (b.y - f.y) * e, R, true);
      else place(n, b.x, b.y, R, true);
    });
    if (k >= 1) blend.current = null;
  });

  const lowQ = prefs.quality === "low";
  return (
    <group>
      {ALL.map((n) => (
        <group key={n}>
          <mesh
            ref={(m) => {
              meshes.current[n] = m;
            }}
            visible={false}
            castShadow={!lowQ}
            // Số trên bi quay lên trên lúc mới xếp (mỗi bi nghiêng chữ khác nhau)
            rotation={[-Math.PI / 2, 0, n * 0.7]}
          >
            <sphereGeometry args={[R, 40, 28]} />
            <meshPhysicalMaterial map={textures[n]} roughness={0.05} clearcoat={1} clearcoatRoughness={0.03} envMapIntensity={1.1} />
          </mesh>
          {/* Bóng tiếp xúc đậm ngay chân bi */}
          <mesh
            ref={(m) => {
              shadows.current[n] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <planeGeometry args={[R * 2.6, R * 2.6]} />
            <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
