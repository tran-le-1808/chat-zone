"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface Dice3DRef {
  rollTo: (targetValue: number) => void;
}

interface SingleDiceProps {
  position?: [number, number, number];
  initialValue?: number;
  /**
   * Yêu cầu lắc dạng khai báo: mỗi khi `id` đổi, xúc xắc tự lắc tới `value`
   * ngay khi đã mount xong (không phụ thuộc thời điểm Canvas khởi tạo).
   */
  rollRequest?: { value: number; id: number } | null;
  /** Gọi khi hiệu ứng lắc thực sự kết thúc */
  onRollEnd?: () => void;
}

/** Giới hạn bước thời gian mỗi khung hình để hiệu ứng không bị "nhảy" mất khi khung hình đầu bị khựng */
const MAX_FRAME_DELTA = 1 / 30;

// Bảng ma trận góc xoay chuẩn (+Y là mặt trên cùng)
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, -Math.PI / 2],
  4: [0, 0, Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

/** Mặt xúc xắc kiểu kẹo: nền kem, chấm tròn có bóng mềm (mặt 1 màu hồng) */
function createDiceTexture(dots: number): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  // Nền kem có vignette nhẹ cho cảm giác mặt cong
  const bg = ctx.createRadialGradient(
    S / 2,
    S / 2,
    S * 0.15,
    S / 2,
    S / 2,
    S * 0.75,
  );
  bg.addColorStop(0, "#fffdf6");
  bg.addColorStop(1, "#f3e6cf");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  const color = dots === 1 ? "#ff4f7b" : "#3b3f7a";
  const g = 0.27 * S;
  const p = {
    c: [S / 2, S / 2],
    tl: [g, g],
    tr: [S - g, g],
    bl: [g, S - g],
    br: [S - g, S - g],
    ml: [g, S / 2],
    mr: [S - g, S / 2],
  };

  const drawDot = (coords: number[], radius = S * 0.085) => {
    const [x, y] = coords;
    // Bóng lõm
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fill();
    // Chấm chính
    const grad = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      radius * 0.1,
      x,
      y,
      radius,
    );
    grad.addColorStop(0, dots === 1 ? "#ff8aa6" : "#5c62a8");
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  };

  switch (dots) {
    case 1:
      drawDot(p.c, S * 0.14);
      break;
    case 2:
      drawDot(p.tl);
      drawDot(p.br);
      break;
    case 3:
      drawDot(p.tl);
      drawDot(p.c);
      drawDot(p.br);
      break;
    case 4:
      drawDot(p.tl);
      drawDot(p.tr);
      drawDot(p.bl);
      drawDot(p.br);
      break;
    case 5:
      drawDot(p.tl);
      drawDot(p.tr);
      drawDot(p.c);
      drawDot(p.bl);
      drawDot(p.br);
      break;
    case 6:
      drawDot(p.tl);
      drawDot(p.tr);
      drawDot(p.ml);
      drawDot(p.mr);
      drawDot(p.bl);
      drawDot(p.br);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const SingleDice = forwardRef<Dice3DRef, SingleDiceProps>(
  (
    { position = [0, 0, 0], initialValue = 1, rollRequest = null, onRollEnd },
    ref,
  ) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const isRollingRef = useRef(false);

    const startQuaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const finalQuaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const rotationAxisRef = useRef<THREE.Vector3>(
      new THREE.Vector3(1, 1, 0).normalize(),
    );
    const totalAngleRef = useRef(0);
    const rollProgressRef = useRef(0);

    // Cập nhật vị trí mặt khi khởi tạo
    useEffect(() => {
      if (isRollingRef.current) return;

      const rot = FACE_ROTATIONS[initialValue] || [0, 0, 0];
      const targetEuler = new THREE.Euler(...rot);

      if (meshRef.current) {
        meshRef.current.quaternion.setFromEuler(targetEuler);
      }
    }, [initialValue]);

    // Mapping chuẩn mặt: [+X: 4, -X: 3, +Y: 1, -Y: 6, +Z: 2, -Z: 5]
    const materials = useMemo(() => {
      const faceDotMap = [4, 3, 1, 6, 2, 5];
      return faceDotMap.map((dots) => {
        const texture = createDiceTexture(dots);
        return new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.32,
          metalness: 0,
        });
      });
    }, []);

    const roundedGeometry = useMemo(
      () => new RoundedBoxGeometry(1.3, 1.3, 1.3, 4, 0.2),
      [],
    );

    const onRollEndRef = useRef(onRollEnd);
    useEffect(() => {
      onRollEndRef.current = onRollEnd;
    }, [onRollEnd]);

    /** Bắt đầu lắc tới mặt `targetValue` (trả về false nếu mesh chưa sẵn sàng) */
    const startRoll = (targetValue: number): boolean => {
      if (!meshRef.current) return false;

      isRollingRef.current = true;
      rollProgressRef.current = 0;

      // 1. Lưu lại Quaternion hiện tại làm điểm xuất phát
      const qStart = meshRef.current.quaternion.clone();
      startQuaternionRef.current.copy(qStart);

      // 2. Tạo Quaternion đích
      const rot = FACE_ROTATIONS[targetValue] || [0, 0, 0];
      const qTarget = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...rot),
      );
      finalQuaternionRef.current.copy(qTarget);

      // 3. Tính Quaternion chênh lệch từ Start tới Target: qDiff = qTarget * qStart^-1
      const qDiff = qTarget.clone().multiply(qStart.clone().invert());

      // 4. Trích xuất trục xoay (Axis) và góc xoay chênh lệch ngắn nhất (Angle)
      const axis = new THREE.Vector3();
      let angle = 2 * Math.acos(Math.min(Math.max(qDiff.w, -1), 1));

      if (angle < 0.001) {
        // Nếu xoay cùng 1 mặt, chọn 1 trục chéo ngẫu nhiên để lộn 3 vòng
        axis.set(1, 1, 0).normalize();
        angle = 0;
      } else {
        axis.set(qDiff.x, qDiff.y, qDiff.z).normalize();
      }

      rotationAxisRef.current = axis;

      // 5. Tổng góc quay = 3 VÒNG ĐẦY ĐỦ (3 * 2PI = 6PI) + Góc chênh lệch tới đích
      const EXTRA_ROUNDS = 3;
      totalAngleRef.current = EXTRA_ROUNDS * Math.PI * 2 + angle;
      return true;
    };

    useImperativeHandle(ref, () => ({
      rollTo: (targetValue: number) => {
        startRoll(targetValue);
      },
    }));

    // Lắc khi có yêu cầu mới. Effect chỉ chạy sau khi mesh đã mount nên luôn có hiệu ứng.
    const rollId = rollRequest?.id;
    const rollValue = rollRequest?.value;
    useEffect(() => {
      if (rollId === undefined || rollValue === undefined) return;
      if (!startRoll(rollValue)) onRollEndRef.current?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rollId]);

    useFrame((_, delta) => {
      if (!meshRef.current || !isRollingRef.current) return;

      // Thời gian xoay khoảng 1.2 - 1.5 giây
      rollProgressRef.current += Math.min(delta, MAX_FRAME_DELTA) * 0.75;
      const t = Math.min(rollProgressRef.current, 1);

      // Hàm Ease-Out giúp lúc đầu xoay rất nhanh, về cuối chậm dần mượt mà
      const easeOut = 1 - Math.pow(1 - t, 3);

      // Góc hiện tại tại thời điểm t
      const currentAngle = totalAngleRef.current * easeOut;

      // Tính Quaternion xoay thêm từ điểm xuất phát
      const qDelta = new THREE.Quaternion().setFromAxisAngle(
        rotationAxisRef.current,
        currentAngle,
      );

      // Cập nhật góc cho Mesh: Start * Delta
      meshRef.current.quaternion.copy(
        qDelta.multiply(startQuaternionRef.current),
      );

      // Khi hoàn thành
      if (t >= 1) {
        meshRef.current.quaternion.copy(finalQuaternionRef.current);
        isRollingRef.current = false;
        onRollEndRef.current?.();
      }
    });

    return (
      <mesh
        ref={meshRef}
        position={position}
        material={materials}
        castShadow
        receiveShadow
      >
        {/* Xúc xắc bo tròn (giữ nguyên nhóm mặt để map 6 texture) */}
        <primitive object={roundedGeometry} attach="geometry" />
      </mesh>
    );
  },
);

SingleDice.displayName = "SingleDice";
export default SingleDice;
