"use client";

/**
 * SÂN KHẤU AI SHOT STUDIO: dùng lại bàn 3D + bi của game (Table3D, BallsView) — footage là render thật.
 * Mỗi khung: (1) bộ chạy cập nhật thời gian / vị trí bi, (2) camera theo cảnh, (3) render WebGL rồi ghép
 * NGAY khung đó lên canvas 2D cùng lớp chú thích + phụ đề (dùng đúng camera vừa render → chú thích không lệch).
 * Canvas 2D này là thứ được ghi thành video.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Table3D from "../game/Table3D";
import { BallsView } from "../game/Balls3D";
import { DEFAULT_PHYSICS, tableConfigForMode, type CaromTableConfig } from "../../_lib/physics";
import { captionAt, drawOverlay } from "../../_lib/studio";
import type { CameraMode, StudioRuntime } from "./StudioRuntime";

export type Aspect = "16:9" | "9:16" | "1:1";
export const ASPECT_RATIO: Record<Aspect, number> = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1 };

export interface StageHandle {
  canvas: () => HTMLCanvasElement | null;
}

const TABLE = tableConfigForMode("free");
const R = DEFAULT_PHYSICS.ballRadius;

/** Đặt camera cho vừa bàn theo tỉ lệ khung; màn dọc thì xoay bàn cho chiều dài nằm dọc */
export function placeCamera(cam: THREE.PerspectiveCamera, aspect: number, view: "top" | "angle", table: CaromTableConfig, yawDeg = 0): void {
  const v = (cam.fov * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const portrait = aspect < 0.95;
  const L = table.outerDimensions.length + 0.12;
  const Wd = table.outerDimensions.width + 0.12;
  const along = portrait ? L : Wd; // phủ theo chiều dọc màn hình
  const across = portrait ? Wd : L; // phủ theo chiều ngang màn hình
  const d = Math.max(along / 2 / Math.tan(v / 2), across / 2 / Math.tan(h / 2)) + 0.1;
  if (view === "top" || portrait) {
    cam.up.set(portrait ? 1 : 0, 0, portrait ? 0 : -1);
    cam.position.set(0, d, 0);
    cam.lookAt(0, 0, 0);
  } else {
    const yaw = (yawDeg * Math.PI) / 180;
    const dist = d * 1.02;
    cam.up.set(0, 1, 0);
    cam.position.set(Math.sin(yaw) * dist * 0.62, dist * 0.82, Math.cos(yaw) * dist * 0.62);
    cam.lookAt(0, 0, 0.1 * Math.cos(yaw));
  }
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
}

function Director({ runtime, composite, aspect, camera, idleCamera }: { runtime: StudioRuntime; composite: React.RefObject<HTMLCanvasElement | null>; aspect: number; camera: CameraMode; idleCamera: "top" | "angle" }) {
  const { gl, scene, camera: cam } = useThree();
  const v = new THREE.Vector3();
  // 1) thời gian + vị trí bi (chạy trước BallsView)
  useFrame(() => runtime.update(performance.now()), -2);
  // 2) camera theo cảnh
  useFrame(() => {
    const pc = cam as THREE.PerspectiveCamera;
    const job = runtime.job;
    const f = runtime.frame;
    let view: "top" | "angle" = idleCamera;
    let yaw = 0;
    if (job && f?.scene) {
      const mode = job.camera;
      if (mode === "top") view = "top";
      else if (mode === "angle") view = "angle";
      else {
        // cinematic: intro lượn nhẹ, thế bi + ngắm nhìn nghiêng, cú đánh nhìn nghiêng, quay chậm + kết quả từ trên xuống
        const id = f.scene.id;
        view = id === "replay" || id === "result" || id === "setup" ? "top" : "angle";
        if (id === "intro") yaw = -18 + 36 * Math.min(1, (f.t - f.scene.start) / Math.max(0.1, f.scene.end - f.scene.start));
      }
    }
    placeCamera(pc, aspect, view, TABLE, yaw);
  }, -1);
  // 3) render + ghép lớp chú thích (ưu tiên 1: tự render)
  useFrame(() => {
    // giữ nhịp vẽ đều theo fps (màn 120 Hz không vẽ gấp đôi, ghi hình không bị lệch nhịp)
    if (!runtime.shouldDraw(performance.now())) return;
    gl.render(scene, cam);
    const out = composite.current;
    if (!out) return;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const W = out.width;
    const H = out.height;
    ctx.drawImage(gl.domElement, 0, 0, W, H);
    const job = runtime.job;
    const part = runtime.part;
    const f = runtime.frame;
    if (!job || !part || !f) return;
    cam.updateMatrixWorld();
    const project = (x: number, y: number) => {
      v.set(x, R, -y).project(cam);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
    };
    drawOverlay({
      ctx,
      W,
      H,
      project,
      frame: f,
      predicted: part.predicted,
      actual: part.actual,
      shot: part.shot,
      mode: job.mode,
      annotate: job.annotate,
      captions: job.captions,
      caption: captionAt(part.segments, f.t),
      title: job.title,
      subtitle: part.subtitle,
      difficulty: part.difficulty,
      tags: part.tags,
      techniqueLabels: part.techniqueLabels,
      mismatch: part.mismatch,
    });
    // khung đã vẽ xong cả cảnh 3D lẫn chú thích: đẩy vào video
    runtime.frameDrawn();
  }, 1);
  return null;
}

const StudioStage = forwardRef<StageHandle, { runtime: StudioRuntime; aspect: Aspect; outWidth: number; camera: CameraMode; idleCamera?: "top" | "angle" }>(function StudioStage({ runtime, aspect, outWidth, camera, idleCamera = "top" }, ref) {
  const composite = useRef<HTMLCanvasElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [cssW, setCssW] = useState(640);
  const ratio = ASPECT_RATIO[aspect];
  const outW = outWidth;
  const outH = Math.round(outWidth / ratio / 2) * 2;
  useImperativeHandle(ref, () => ({ canvas: () => composite.current }), []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssW(el.clientWidth || 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // bộ đệm WebGL >= độ phân giải video (nét khi xuất 1080p)
  const dpr = Math.max(1, Math.min(3, outW / Math.max(1, cssW)));
  return (
    <div ref={box} className="relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ aspectRatio: `${ratio}`, maxHeight: "70vh", maxWidth: `calc(70vh * ${ratio})` }}>
      <Canvas
        key={aspect}
        dpr={dpr}
        camera={{ fov: 40, near: 0.05, far: 40, position: [0, 4, 0.001] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        shadows
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#14161f"]} />
        <hemisphereLight args={["#fff8ec", "#1b1d29", 0.75]} />
        <spotLight position={[-0.8, 2.6, 0]} angle={0.7} penumbra={0.6} intensity={22} castShadow shadow-mapSize={[1024, 1024]} />
        <spotLight position={[0.8, 2.6, 0]} angle={0.7} penumbra={0.6} intensity={22} castShadow shadow-mapSize={[1024, 1024]} />
        <Table3D config={TABLE} />
        <BallsView sample={() => runtime.sample()} />
        <Director runtime={runtime} composite={composite} aspect={ratio} camera={camera} idleCamera={idleCamera} />
      </Canvas>
      <canvas ref={composite} width={outW} height={outH} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
});

export default StudioStage;
