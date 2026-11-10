"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Pawn3D, { PawnState, PawnType } from "./Pawn3D";

function Turntable({ type, state }: { type: PawnType; state: PawnState }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.6;
  });
  return (
    <group ref={ref}>
      <Pawn3D type={type} state={state} />
      {/* Bóng tròn dưới chân */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.38, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

interface PawnPreviewProps {
  type: PawnType;
  state?: PawnState;
  className?: string;
}

/** Xem trước nhân vật 3D (dùng trong phòng chờ) */
export default function PawnPreview({
  type,
  state = "idle",
  className = "",
}: PawnPreviewProps) {
  return (
    <div className={`pointer-events-none ${className}`}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.75, 2.6], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[2, 3, 3]} intensity={1.6} />
        <directionalLight position={[-2, 1, -2]} intensity={0.5} color="#ffd6f0" />
        <Turntable type={type} state={state} />
      </Canvas>
    </div>
  );
}
