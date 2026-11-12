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
    const fitH = TABLE_OUTER.h / 2 / Math.tan(fov / 2);
    const fitW = TABLE_OUTER.w / 2 / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(fitH, fitW) * 1.08;
    if (mode === "top") cam.position.set(0, dist, 0.001);
    else cam.position.set(0, dist * 0.82, dist * 0.62);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera, size.width, size.height, mode, controls]);
  return null;
}

/** Mặt phẳng nhận thao tác ngắm: kéo / chạm để chọn hướng từ bi cái tới điểm chạm */
function AimInput() {
  const { match, canShoot, setAim } = useBilliard();
  const dragging = useRef(false);

  const aimAt = (e: ThreeEvent<PointerEvent>) => {
    if (!match) return;
    const [cx, cy] = match.balls[match.turn];
    const px = e.point.x;
    const py = -e.point.z;
    const dx = px - cx;
    const dy = py - cy;
    if (Math.hypot(dx, dy) < 0.01) return;
    setAim({ dirX: dx, dirY: dy });
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      onPointerDown={(e) => {
        // Chuột trái / 1 ngón: ngắm. Chuột phải / 2 ngón: xoay camera (OrbitControls)
        if (!canShoot || (e.pointerType === "mouse" && e.button !== 0)) return;
        dragging.current = true;
        aimAt(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current && canShoot) aimAt(e);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
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
