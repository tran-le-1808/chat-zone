"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  BOARD_CAMERA,
  cameraPosition,
  fitBoard,
  groundAxes,
  type BoardFit,
  type BoardFitMode,
} from "./cameraConfig";

/**
 * Bộ điều khiển camera bàn cờ (một useFrame duy nhất):
 *  - fit bàn theo khung hình + chế độ "Phóng đầy" / "Toàn cảnh" (xem cameraConfig.ts)
 *  - tự theo quân cờ đang chơi (kể cả 6 ô phía trước) khi bàn bị cắt hoặc đã zoom
 *  - pinch / lăn chuột để zoom, kéo để pan, chạm đúp để về mặc định;
 *    tự kéo thì tạm dừng tự theo 4 giây
 * Chỉ camera thay đổi: toạ độ logic của bàn cờ không bị ảnh hưởng.
 */
interface Props {
  mode: BoardFitMode;
  /** Điểm cần giữ trong khung (x, z) — ô quân cờ đang chơi và các ô phía trước */
  focus: [number, number] | null;
}

const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DIST = 28;
const DRAG_THRESHOLD = 6;

export default function CameraRig({ mode, focus }: Props) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dom = useThree((s) => s.gl.domElement);

  const st = useRef({
    zoom: 1,
    zoomT: 1,
    // Pan theo trục màn hình trên mặt đất: x = sang phải, y = ra xa camera
    pan: new THREE.Vector2(),
    panT: new THREE.Vector2(),
    dist: 100,
    key: "",
    pointers: new Map<number, { x: number; y: number }>(),
    pinch: 0,
    moved: 0,
    lastTapT: 0,
    lastTapX: 0,
    lastTapY: 0,
    userT: -1e9,
    height: 1,
    focus: null as [number, number] | null,
    fit: null as BoardFit | null,
    fitKey: "",
  });
  useEffect(() => {
    const s = st.current;
    s.height = size.height;
    s.focus = focus;
  });

  useEffect(() => {
    if (!BOARD_CAMERA.enableZoom) return;
    const s = st.current;
    const el0: HTMLElement = dom;
    const prevStyle = el0.getAttribute("style");
    el0.style.setProperty("touch-action", "none");

    const limits = () => {
      const lim = BOARD_CAMERA.panLimit * (1 - 1 / s.zoomT);
      return { x: lim, y: lim + (s.fit?.allowUp ?? 0) };
    };
    const clampPan = () => {
      const l = limits();
      s.panT.x = THREE.MathUtils.clamp(s.panT.x, -l.x, l.x);
      s.panT.y = THREE.MathUtils.clamp(s.panT.y, -l.y, l.y);
    };
    const setZoom = (z: number) => {
      s.zoomT = THREE.MathUtils.clamp(
        z,
        BOARD_CAMERA.minZoom,
        BOARD_CAMERA.maxZoom,
      );
      s.userT = performance.now();
      clampPan();
    };
    const reset = () => {
      s.zoomT = 1;
      s.panT.set(0, 0);
      s.userT = -1e9; // về mặc định -> tự theo lại ngay
    };

    const onDown = (e: PointerEvent) => {
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (s.pointers.size === 1) s.moved = 0;
      if (s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        s.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        s.moved = 99;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = s.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (s.pointers.size >= 2) {
        const [a, b] = [...s.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (s.pinch > 0 && d > 0) setZoom(s.zoomT * (d / s.pinch));
        s.pinch = d;
        return;
      }
      s.moved += Math.abs(dx) + Math.abs(dy);
      if (s.moved < DRAG_THRESHOLD) return;
      const l = limits();
      if (l.x <= 1e-3 && l.y <= 1e-3) return;
      // Kéo: nội dung đi theo ngón tay -> điểm nhìn dịch ngược lại
      const fov = THREE.MathUtils.degToRad(BOARD_CAMERA.fov);
      const wpp = (2 * s.dist * Math.tan(fov / 2)) / s.height;
      const el = THREE.MathUtils.degToRad(s.fit?.elevationDeg ?? 45);
      s.panT.x += -dx * wpp;
      s.panT.y += (dy * wpp) / Math.sin(el);
      s.userT = performance.now();
      clampPan();
    };
    const onUp = (e: PointerEvent) => {
      const wasSingle = s.pointers.size === 1;
      s.pointers.delete(e.pointerId);
      if (s.pointers.size < 2) s.pinch = 0;
      if (!wasSingle || s.moved >= DRAG_THRESHOLD) return;
      const now = performance.now();
      if (
        now - s.lastTapT < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - s.lastTapX, e.clientY - s.lastTapY) <
          DOUBLE_TAP_DIST
      ) {
        reset();
        s.lastTapT = 0;
      } else {
        s.lastTapT = now;
        s.lastTapX = e.clientX;
        s.lastTapY = e.clientY;
      }
    };
    const onCancel = (e: PointerEvent) => {
      s.pointers.delete(e.pointerId);
      s.pinch = 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(s.zoomT * Math.exp(-e.deltaY * 0.0015));
    };

    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onCancel);
    dom.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (prevStyle === null) el0.removeAttribute("style");
      else el0.setAttribute("style", prevStyle);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onCancel);
      dom.removeEventListener("wheel", onWheel);
    };
  }, [dom]);

  useFrame((_, delta) => {
    const s = st.current;
    if (!size.width || !size.height) return;
    // Fit lại khi đổi kích thước khung / chế độ (resize, xoay màn hình, visualViewport)
    const fitKey = `${size.width}x${size.height}|${mode}`;
    if (fitKey !== s.fitKey || !s.fit) {
      s.fitKey = fitKey;
      s.fit = fitBoard(size.width, size.height, mode);
      s.zoomT = 1;
      s.userT = -1e9;
      s.key = "";
    }
    const fit = s.fit;
    const axes = groundAxes(BOARD_CAMERA.azimuthDeg);

    // Tự theo quân cờ: khi bàn bị cắt dọc hoặc khi đã zoom (trừ 4s sau khi người chơi tự kéo)
    const following =
      s.focus &&
      performance.now() - s.userT > BOARD_CAMERA.followPauseMs &&
      (fit.allowUp > 0 || s.zoomT > 1.05);
    if (following && s.focus) {
      const rel = _rel.set(s.focus[0], 0, s.focus[1]).sub(fit.target.clone().setY(0));
      const lim = BOARD_CAMERA.panLimit * (1 - 1 / s.zoomT);
      s.panT.x = THREE.MathUtils.clamp(rel.dot(axes.right), -lim, lim);
      s.panT.y = THREE.MathUtils.clamp(
        rel.dot(axes.forward),
        -(lim + fit.allowUp),
        lim + fit.allowUp,
      );
    } else if (!following && s.zoomT <= 1.001 && s.userT < 0) {
      s.panT.set(0, 0);
    }

    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 8);
    s.zoom += (s.zoomT - s.zoom) * k;
    s.pan.lerp(s.panT, k);
    if (Math.abs(s.zoomT - s.zoom) < 1e-4) s.zoom = s.zoomT;
    const key = `${s.fitKey}|${s.zoom.toFixed(4)}|${s.pan.x.toFixed(3)}|${s.pan.y.toFixed(3)}`;
    if (key === s.key) return;
    s.key = key;

    const target = fit.target
      .clone()
      .addScaledVector(axes.right, s.pan.x)
      .addScaledVector(axes.forward, s.pan.y);
    s.dist = fit.distance / s.zoom;
    camera.position.copy(
      cameraPosition(target, s.dist, fit.elevationDeg, BOARD_CAMERA.azimuthDeg),
    );
    camera.lookAt(target);
  });

  return null;
}

const _rel = new THREE.Vector3();
