"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { POOL_PHYSICS as C } from "../_lib/physics/config";
import PoolTable3D, { FLOOR_Y, outerSize } from "./PoolTable3D";
import PoolBalls3D from "./PoolBalls3D";
import PoolAim3D from "./PoolAim3D";
import { usePool, type CameraMode, type Quality } from "./PoolContext";
import { aimTowards, onCueShaft, pullFromAlong, rotatedAim } from "../../_shared/shot/shotMath";

const R = C.ballRadius;
const LAMP_Y = 1.0;

/**
 * Camera: từ trên / nghiêng canh vừa bàn, "sau cơ" ngang tầm mắt người chơi.
 * Mọi chuyển cảnh nội suy mượt (đổi chế độ, sang lượt mới).
 */
function CameraRig({ mode }: { mode: CameraMode }) {
  const { camera, size } = useThree();
  const controls = useThree((s) => s.controls as unknown as OrbitControlsImpl | null);
  const { rack, aim, table, getPlayback, prefs } = usePool();
  /** Góc nhìn mặc định của chế độ hiện tại (camera trở về đây sau khi theo bi) */
  const home = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const following = useRef(false);
  const goal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), active: false });
  const curTarget = useRef(new THREE.Vector3());

  // Đặt đích mới khi đổi chế độ / kích thước khung
  useEffect(() => {
    if (mode === "behind") return;
    const cam = camera as THREE.PerspectiveCamera;
    // Bàn to hơn: canh khung theo mặt chơi + băng + chỉ một phần thành gỗ (bỏ ~3.5 cm viền ngoài mỗi phía, vẫn thấy đủ 6 lỗ)
    const o = outerSize(table);
    const aspect = size.width / Math.max(1, size.height);
    const fov = (cam.fov * Math.PI) / 180;
    const fitH = (o.h - 0.07) / 2 / Math.tan(fov / 2);
    const fitW = (o.w - 0.07) / 2 / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(fitH, fitW) * (mode === "top" ? 1 : 1.03);
    if (mode === "top") goal.current.pos.set(0, dist, 0.001);
    else goal.current.pos.set(0, dist * 0.78, dist * 0.66);
    goal.current.target.set(0, 0, 0);
    goal.current.active = true;
    home.current.pos.copy(goal.current.pos);
    home.current.target.copy(goal.current.target);
  }, [camera, size.width, size.height, mode, table]);

  useFrame((_, delta) => {
    if (mode === "behind") {
      const cue = rack.balls.find((b) => b.n === 0) ?? { x: 0, y: 0 };
      const l = Math.hypot(aim.dirX, aim.dirY) || 1;
      const dx = aim.dirX / l;
      const dy = aim.dirY / l;
      // Tầm mắt người chơi cúi ngắm: sau bi ~0.9 m, cao ~0.3 m trên mặt bàn
      const pos = new THREE.Vector3(cue.x - dx * 0.9, 0.3, -(cue.y - dy * 0.9));
      const tgt = new THREE.Vector3(cue.x + dx * 0.8, 0, -(cue.y + dy * 0.8));
      const k = 1 - Math.exp(-delta * 6);
      camera.position.lerp(pos, k);
      curTarget.current.lerp(tgt, k);
      camera.lookAt(curTarget.current);
      return;
    }
    // Camera khi đánh: theo bi cái (nhẹ, không giật) — ssau cú đánh trở về góc mặc định
    const pb = getPlayback();
    const rolling = !!pb && !pb.done && prefs.followCam && mode !== "top" && performance.now() >= pb.t0;
    if (rolling && pb) {
      const tr = pb.trace;
      const bi = tr.ballIds.indexOf(0);
      if (bi >= 0 && tr.frameCount > 1) {
        const f = Math.min(tr.frameCount - 1, ((performance.now() - pb.t0) / 1000) * tr.fps);
        const i0 = Math.floor(f);
        const i1 = Math.min(tr.frameCount - 1, i0 + 1);
        const k = f - i0;
        const nb = tr.ballIds.length;
        const a = (i0 * nb + bi) * 7;
        const b = (i1 * nb + bi) * 7;
        const cx = tr.frames[a] + (tr.frames[b] - tr.frames[a]) * k;
        const cy = tr.frames[a + 1] + (tr.frames[b + 1] - tr.frames[a + 1]) * k;
        // Dịch cả camera & điểm nhìn theo 55% vị trí bi cái, kéo gần ~12%
        const tgt = new THREE.Vector3(cx * 0.55, 0, -cy * 0.55);
        const pos = home.current.pos.clone().sub(home.current.target).multiplyScalar(0.88).add(tgt);
        const kk = 1 - Math.exp(-delta * 3.5);
        camera.position.lerp(pos, kk);
        curTarget.current.lerp(tgt, kk);
        camera.lookAt(curTarget.current);
        following.current = true;
        goal.current.active = false;
        return;
      }
    }
    if (following.current) {
      following.current = false;
      goal.current.pos.copy(home.current.pos);
      goal.current.target.copy(home.current.target);
      goal.current.active = true;
    }
    if (goal.current.active) {
      // Nội suy theo thời gian thực (không phụ thuộc FPS), dừng khi đã tới đích
      const k = 1 - Math.exp(-delta * 7);
      camera.position.lerp(goal.current.pos, k);
      curTarget.current.lerp(goal.current.target, k);
      if (camera.position.distanceTo(goal.current.pos) < 0.002) {
        camera.position.copy(goal.current.pos);
        curTarget.current.copy(goal.current.target);
        goal.current.active = false;
      }
      camera.lookAt(curTarget.current);
      if (controls) {
        controls.target.copy(curTarget.current);
        controls.update();
      }
    }
  });
  return null;
}

/** Hậu kỳ: GTAO (bóng che khuất ở chân băng, quanh bi) + bloom rất nhẹ + tone mapping ACES */
function PostFX({ quality }: { quality: Quality }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    if (quality !== "high") return null;
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.blendIntensity = 0.85;
    c.addPass(ao);
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.12, 0.35, 0.92));
    c.addPass(new OutputPass());
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, gl, scene, camera]);
  useEffect(() => {
    composer?.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);
  useEffect(() => () => composer?.dispose(), [composer]);
  useFrame(() => {
    if (composer) composer.render();
    else gl.render(scene, camera);
  }, 1);
  return null;
}

/** Phòng bida: đèn bàn treo chữ nhật 3 bóng cách bàn ~1 m, phần còn lại tối */
function Room({ quality }: { quality: Quality }) {
  const { table } = usePool();
  const lamp = useRef<THREE.Group>(null);
  // Nhìn từ trên xuống (camera cao hơn đèn): ẩn chụp đèn để không che bàn
  useFrame(({ camera }) => {
    if (lamp.current) lamp.current.visible = camera.position.y < LAMP_Y + 0.05;
  });
  const o = outerSize(table);
  useMemo(() => RectAreaLightUniformsLib.init(), []);
  const shadowSize = quality === "high" ? 2048 : 1024;
  return (
    <group>
      <fog attach="fog" args={["#0b0b10", 4, 11]} />
      <hemisphereLight args={["#ffeedd", "#14121a", 0.18]} />
      {/* Ánh sáng chính: 3 bóng trong chụp đèn chữ nhật */}
      {[-0.85, 0, 0.85].map((x) => (
        <group key={x}>
          <rectAreaLight position={[x, LAMP_Y - 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} width={0.55} height={0.32} intensity={5} color="#fff3e0" />
        </group>
      ))}
      {/* 2 đèn spot mềm để đổ bóng */}
      {[-0.7, 0.7].map((x) => (
        <spotLight
          key={x}
          position={[x, LAMP_Y + 0.4, 0]}
          angle={0.9}
          penumbra={0.9}
          intensity={7}
          decay={1.6}
          color="#fff1dc"
          castShadow={quality !== "low"}
          shadow-mapSize={[shadowSize, shadowSize]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.015}
          shadow-radius={6}
        />
      ))}
      {/* Chụp đèn kim loại xanh sẫm + dây treo */}
      <group ref={lamp}>
      <mesh position={[0, LAMP_Y + 0.02, 0]}>
        <boxGeometry args={[2.3, 0.1, 0.42]} />
        <meshPhysicalMaterial color="#123d2c" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.9, LAMP_Y + 0.8, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 1.5, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      {[-0.85, 0, 0.85].map((x) => (
        <mesh key={x} position={[x, LAMP_Y - 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.28]} />
          <meshBasicMaterial color="#fff6e6" />
        </mesh>
      ))}
      </group>
      {/* Sàn gỗ tối, tường, kệ cơ, ghế */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#2a1c14" roughness={0.8} />
      </mesh>
      {[
        [0, 1.2, -4.5, 16, 4, 0],
        [0, 1.2, 4.5, 16, 4, Math.PI],
        [-6, 1.2, 0, 9, 4, Math.PI / 2],
        [6, 1.2, 0, 9, 4, -Math.PI / 2],
      ].map(([x, y, z, w, h, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, ry, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#1c1a22" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, -4.35]}>
        <boxGeometry args={[1.6, 1.9, 0.12]} />
        <meshStandardMaterial color="#3a2414" roughness={0.6} />
      </mesh>
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} position={[x, FLOOR_Y + 0.25, o.h / 2 + 1.4]}>
          <boxGeometry args={[1.4, 0.5, 0.5]} />
          <meshStandardMaterial color="#3b1d1d" roughness={0.7} />
        </mesh>
      ))}
      {/* Môi trường phản chiếu (dựng tại chỗ, không tải HDR): ánh đèn bàn trên bi bóng */}
      <Environment resolution={128} frames={1}>
        <color attach="background" args={["#0a0a0d"]} />
        {[-0.85, 0, 0.85].map((x) => (
          <Lightformer key={x} form="rect" intensity={3} position={[x, LAMP_Y, 0]} rotation-x={Math.PI / 2} scale={[0.5, 0.28, 1]} />
        ))}
        <Lightformer form="rect" intensity={0.25} position={[0, 1.2, -4]} scale={[10, 3, 1]} color="#ffdcb0" />
      </Environment>
    </group>
  );
}

/** Vùng kitchen (chỉ hiện khi đặt bi trong tay sau vạch đầu bàn) */
function KitchenZone() {
  const { rack, placing, table: T } = usePool();
  if (!placing || rack.ballInHand !== "kitchen") return null;
  const w = T.headStringX + T.L / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-T.L / 2 + w / 2, 0.0009, 0]}>
        <planeGeometry args={[w, T.W]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[T.headStringX, 0.001, 0]}>
        <planeGeometry args={[0.003, T.W]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

/**
 * Mặt phẳng nhận thao tác: ngắm / đặt bi cái / kéo bi (tập luyện) / kéo cơ trực tiếp trên bàn.
 * Cảm ứng ngắm TƯƠNG ĐỐI (xoay quanh bi cái theo độ lệch góc của ngón tay, không bị nhảy);
 * chuột vẫn trỏ thẳng điểm ngắm. Đang mở bi lớn thì khoá hết.
 */
function TableInput() {
  const { rack, canShoot, setAim, aim, placing, moveCue, arrange, moveBall, prefs, table, shot, shotSettings } = usePool();
  const drag = useRef<{
    kind: "aim" | "cue" | "ball" | "pull";
    n: number;
    id: number;
    sx: number;
    startAngle: number;
    fingerStart: number;
    along0: number;
    relative: boolean;
  } | null>(null);
  const o = outerSize(table);
  const toPhys = (e: ThreeEvent<PointerEvent>) => ({ x: e.point.x, y: -e.point.z });
  const cue = () => rack.balls.find((b) => b.n === 0);
  const aimAt = (x: number, y: number) => {
    const c = cue();
    if (!c) return;
    const dx = x - c.x;
    const dy = y - c.y;
    if (Math.hypot(dx, dy) < 0.01) return;
    setAim({ dirX: dx, dirY: dy });
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "aim") shot.aimEnd();
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (shot.inputLocked || drag.current) return;
        const p = toPhys(e);
        const base = { n: 0, id: e.pointerId, sx: e.nativeEvent.clientX, startAngle: 0, fingerStart: 0, along0: 0, relative: false };
        if (arrange) {
          let best = -1;
          let bd = 3 * R;
          for (const b of rack.balls) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < bd) {
              bd = d;
              best = b.n;
            }
          }
          if (best >= 0) drag.current = { ...base, kind: "ball", n: best };
          return;
        }
        if (placing) {
          drag.current = { ...base, kind: "cue" };
          moveCue(p.x, p.y);
          return;
        }
        if (!canShoot) return;
        const c = cue();
        // Kéo cơ trực tiếp trên bàn: chạm thân cơ rồi kéo lùi ra sau theo trục ngắm
        if (c && shotSettings.pullOnTable) {
          const hit = onCueShaft(c, { x: aim.dirX, y: aim.dirY }, p);
          if (hit.hit && shot.pullStart()) {
            drag.current = { ...base, kind: "pull", along0: hit.along };
            return;
          }
        }
        shot.aimStart();
        // Chạm / click ở đâu trên bàn thì ngắm tới đó ngay (không cần kéo); kéo tiếp thì xoay mượt quanh bi cái
        const toward = c ? aimTowards(c, p) : null;
        if (toward) setAim({ dirX: toward.dirX, dirY: toward.dirY });
        const startAngle = toward ? toward.angle : Math.atan2(aim.dirY, aim.dirX);
        drag.current = {
          ...base,
          kind: "aim",
          relative: e.pointerType !== "mouse" && !!c,
          startAngle,
          fingerStart: startAngle,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const p = toPhys(e);
        if (d.kind === "ball") moveBall(d.n, p.x, p.y);
        else if (d.kind === "cue") moveCue(p.x, p.y);
        else if (d.kind === "pull") {
          const c = cue();
          if (!c) return;
          const { along } = onCueShaft(c, { x: aim.dirX, y: aim.dirY }, p, 1e9, 1e9);
          shot.pullMove(pullFromAlong(d.along0, along, shotSettings.pullSensitivity));
        } else if (canShoot) {
          if (prefs.camera === "behind") {
            // Nhìn sau cơ: kéo ngang để xoay hướng ngắm
            const dx = e.nativeEvent.clientX - d.sx;
            d.sx = e.nativeEvent.clientX;
            const a = (-dx * 0.12 * shotSettings.aimSensitivity * Math.PI) / 180;
            const cs = Math.cos(a);
            const sn = Math.sin(a);
            setAim({ dirX: aim.dirX * cs - aim.dirY * sn, dirY: aim.dirX * sn + aim.dirY * cs });
          } else if (d.relative) {
            const c = cue();
            if (!c) return;
            const now = Math.atan2(p.y - c.y, p.x - c.x);
            const ang = rotatedAim(d.startAngle, d.fingerStart, now, shotSettings.aimSensitivity);
            setAim({ dirX: Math.cos(ang), dirY: Math.sin(ang) });
          } else aimAt(p.x, p.y);
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        if (d.kind === "pull") {
          drag.current = null;
          const c = cue();
          const along = c ? onCueShaft(c, { x: aim.dirX, y: aim.dirY }, toPhys(e), 1e9, 1e9).along : d.along0;
          shot.pullRelease(pullFromAlong(d.along0, along, shotSettings.pullSensitivity));
          return;
        }
        end();
      }}
      onPointerCancel={() => {
        if (drag.current?.kind === "pull") shot.pullCancel();
        end();
      }}
      onPointerLeave={() => {
        // Ngón rời khỏi bàn khi đang kéo cơ trên bàn: giữ nguyên (nhận pointerup từ cửa sổ)
        if (drag.current?.kind !== "pull") end();
      }}
    >
      <planeGeometry args={[o.w + 2, o.h + 2]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function PoolScene() {
  const { prefs } = usePool();
  const q = prefs.quality;
  return (
    <Canvas
      shadows={q === "low" ? false : "soft"}
      dpr={q === "low" ? [1, 1.25] : q === "medium" ? [1, 1.75] : [1, 2]}
      camera={{ fov: 40, near: 0.03, far: 40, position: [0, 3.5, 2.5] }}
      gl={{ antialias: q !== "high", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0b0b10"]} />
      <Room quality={q} />
      <PoolTable3D />
      <KitchenZone />
      <PoolBalls3D />
      <PoolAim3D />
      <TableInput />
      <OrbitControls
        makeDefault
        enabled={prefs.camera !== "behind"}
        enablePan={false}
        minDistance={0.6}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.47}
        mouseButtons={{
          LEFT: undefined as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: undefined as unknown as THREE.TOUCH,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
      <CameraRig mode={prefs.camera} />
      <PostFX quality={q} />
    </Canvas>
  );
}
