"use client";

import { useEffect, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import Table3D, { TABLE_OUTER } from "./Table3D";
import Balls3D from "./Balls3D";
import AimLayer from "./AimLayer";
import { useBilliard } from "../../_context/BilliardGameContext";
import { useIsCompact } from "../../../monopoly/_components/ui/useScreen";
import { aimTowards, onCueShaft, pullFromAlong, rotatedAim } from "../../../_shared/shot/shotMath";

/** Camera canh vừa bàn theo tỉ lệ màn hình; đổi chế độ nhìn thì đặt lại */
function CameraRig({ mode }: { mode: "top" | "angle" }) {
  const { camera, size } = useThree();
  const controls = useThree(
    (s) => s.controls as unknown as OrbitControlsImpl | null,
  );
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const fov = (cam.fov * Math.PI) / 180;
    // Khoảng cách để cả bàn lọt khung (theo chiều dọc & ngang)
    // Bàn to hơn: bỏ ~8 cm viền gỗ ngoài cùng mỗi phía khỏi khung hình
    const fitH = (TABLE_OUTER.h - 0.16) / 2 / Math.tan(fov / 2);
    const fitW = (TABLE_OUTER.w - 0.16) / 2 / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(fitH, fitW) * (mode === "top" ? 1 : 0.99);
    if (mode === "top") cam.position.set(0, dist, 0.001);
    else cam.position.set(0, dist * 0.82, dist * 0.62);
    // Góc nghiêng: nhìn lệch về phía gần camera một chút để bàn lấp đầy khung (không thừa khoảng trống phía trên)
    const lookZ = mode === "top" ? 0 : 0.14;
    cam.lookAt(0, 0, lookZ);
    cam.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0, lookZ);
      controls.update();
    }
  }, [camera, size.width, size.height, mode, controls]);
  return null;
}

/**
 * Mặt phẳng nhận thao tác ngắm. Cảm ứng ngắm TƯƠNG ĐỐI (xoay quanh bi cái theo độ lệch góc
 * của ngón tay, không bị nhảy); chuột trỏ thẳng điểm ngắm. Có tuỳ chọn kéo cơ trực tiếp trên
 * bàn. Đang mở bi lớn thì khoá hết.
 */
function AimInput() {
  const { match, canShoot, setAim, aim, shot, shotSettings } = useBilliard();
  const drag = useRef<{
    kind: "aim" | "pull";
    id: number;
    startAngle: number;
    fingerStart: number;
    along0: number;
    relative: boolean;
  } | null>(null);

  const cue = () => (match ? match.balls[match.turn] : null);
  const aimAt = (x: number, y: number) => {
    const c = cue();
    if (!c) return;
    const dx = x - c[0];
    const dy = y - c[1];
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
        // Chuột trái / 1 ngón: ngắm. Chuột phải / 2 ngón: xoay camera (OrbitControls)
        if (!canShoot || shot.inputLocked || drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
        const c = cue();
        const p = { x: e.point.x, y: -e.point.z };
        if (c && shotSettings.pullOnTable) {
          const hit = onCueShaft({ x: c[0], y: c[1] }, { x: aim.dirX, y: aim.dirY }, p);
          if (hit.hit && shot.pullStart()) {
            drag.current = { kind: "pull", id: e.pointerId, startAngle: 0, fingerStart: 0, along0: hit.along, relative: false };
            return;
          }
        }
        shot.aimStart();
        // Chạm / click ở đâu trên bàn thì ngắm tới đó ngay (không cần kéo); kéo tiếp thì xoay mượt quanh bi cái
        const toward = c ? aimTowards({ x: c[0], y: c[1] }, p) : null;
        if (toward) setAim({ dirX: toward.dirX, dirY: toward.dirY });
        const startAngle = toward ? toward.angle : Math.atan2(aim.dirY, aim.dirX);
        drag.current = {
          kind: "aim",
          id: e.pointerId,
          relative: e.pointerType !== "mouse" && !!c,
          along0: 0,
          startAngle,
          fingerStart: startAngle,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId || !canShoot) return;
        const c = cue();
        if (!c) return;
        const p = { x: e.point.x, y: -e.point.z };
        if (d.kind === "pull") {
          const { along } = onCueShaft({ x: c[0], y: c[1] }, { x: aim.dirX, y: aim.dirY }, p, 1e9, 1e9);
          shot.pullMove(pullFromAlong(d.along0, along, shotSettings.pullSensitivity));
        } else if (d.relative) {
          const ang = rotatedAim(d.startAngle, d.fingerStart, Math.atan2(p.y - c[1], p.x - c[0]), shotSettings.aimSensitivity);
          setAim({ dirX: Math.cos(ang), dirY: Math.sin(ang) });
        } else aimAt(p.x, p.y);
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        if (d.kind === "pull") {
          drag.current = null;
          const c = cue();
          const along = c ? onCueShaft({ x: c[0], y: c[1] }, { x: aim.dirX, y: aim.dirY }, { x: e.point.x, y: -e.point.z }, 1e9, 1e9).along : d.along0;
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
        if (drag.current?.kind !== "pull") end();
      }}
    >
      <planeGeometry args={[TABLE_OUTER.w + 2, TABLE_OUTER.h + 2]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function BilliardScene() {
  const { prefs } = useBilliard();
  const isCompact = useIsCompact();

  return (
    <Canvas
      shadows={!isCompact}
      dpr={[1, 1.75]}
      camera={{ fov: 40, near: 0.05, far: 40, position: [0, 3.5, 2.5] }}
      gl={{ antialias: true }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#14161f"]} />
      <hemisphereLight args={["#fff8ec", "#1b1d29", 0.75]} />
      {/* Đèn bàn bida treo phía trên */}
      <spotLight
        position={[-0.8, 2.6, 0]}
        angle={0.7}
        penumbra={0.6}
        intensity={22}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight
        position={[0.8, 2.6, 0]}
        angle={0.7}
        penumbra={0.6}
        intensity={22}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Table3D />
      <Balls3D debug={prefs.debug} />
      <AimLayer />
      <AimInput />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={1.2}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.45}
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
    </Canvas>
  );
}
