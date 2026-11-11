import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useIsCompact, useIsPhoneLandscape } from "./ui/useScreen";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Pawn3D, { PawnState, PawnType } from "./Pawn3D";
import Building3D, { HouseType } from "./Building3D";
import { Flag3D } from "./Flag3D";
import {
  ChanceIcon,
  FateIcon,
  FestivalIcon,
  JailIcon,
  RpsIcon,
  TaxIcon,
  XocDiaIcon,
  TravelIcon,
} from "./board/CartoonIcons";
import Tile3D, {
  BAND_TOP,
  TILE_TOP,
  getBuildingAnchor,
  getTileLayout,
} from "./board/Tile3D";
import {
  MonopolyMarker,
  RentDoubleEffects,
  getMonopolyGroups,
} from "./board/MonopolyEffects";
import CityCenter from "./board/CityCenter";
import IslandEnvironment from "./board/IslandEnvironment";
import { GoIcon3D, StationIcon3D } from "./board/SpecialIcons";
import { BOARD_COLORS } from "./board/theme";

export interface Player3D {
  id: number;
  type: PawnType;
  color: string;
  tileIndex: number;
  isBankrupt?: boolean;
}

export interface Tile3DData {
  id: number;
  name: string;
  color: string;
  position: [number, number, number];
  houses: number;
  hasVilla: boolean;
  ownerId?: number;
  ownerColor?: string;
  currentRent?: number;
  landPrice?: number;
  size: [number, number, number];
  type?: string;
  isFestival?: boolean; // Thêm flag nhận biết ô đang tổ chức Lễ Hội
  groupCode?: string;
}

// Hiệu ứng ô đang tổ chức Lễ Hội: KHUNG viền phát sáng + đốm lấp lánh.
// Không phủ kín mặt ô để tên & giá tiền luôn đọc được.
function FestivalTileGlow({ size }: { size: [number, number, number] }) {
  const frameRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Group>(null);
  const w = size[0] - 0.12;
  const d = size[2] - 0.12;
  const t = 0.14;

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    frameRef.current?.children.forEach((c) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.1 + Math.sin(time * 4) * 0.5;
    });
    sparkRef.current?.children.forEach((c, i) => {
      c.position.y = 0.25 + ((time * 0.6 + i * 0.37) % 1) * 0.9;
      c.scale.setScalar(0.6 + Math.abs(Math.sin(time * 3 + i)) * 0.6);
    });
  });

  const sparks = [
    [-w / 2 + 0.2, -d / 2 + 0.2],
    [w / 2 - 0.2, -d / 2 + 0.2],
    [-w / 2 + 0.2, d / 2 - 0.2],
    [w / 2 - 0.2, d / 2 - 0.2],
    [0, -d / 2 + 0.15],
    [0, d / 2 - 0.15],
  ];

  return (
    <group position={[0, 0.06, 0]}>
      <pointLight
        position={[0, 0.8, 0]}
        color="#facc15"
        intensity={2.2}
        distance={2.6}
        decay={1.2}
      />
      <group ref={frameRef}>
        {[
          [0, -d / 2 + t / 2, w, t],
          [0, d / 2 - t / 2, w, t],
          [-w / 2 + t / 2, 0, t, d],
          [w / 2 - t / 2, 0, t, d],
        ].map(([x, z, fw, fd], i) => (
          <mesh key={i} position={[x, 0.02, z]}>
            <boxGeometry args={[fw, 0.05, fd]} />
            <meshStandardMaterial
              color="#ffd23f"
              emissive="#ffb300"
              emissiveIntensity={1.2}
            />
          </mesh>
        ))}
      </group>
      <group ref={sparkRef}>
        {sparks.map(([x, z], i) => (
          <mesh key={i} position={[x, 0.3, z]}>
            <octahedronGeometry args={[0.06, 0]} />
            <meshBasicMaterial color="#fff3b0" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Kích thước nhân vật trên bàn cờ */
const PAWN_SCALE = 1.5;

// ---- Nhảy từng ô ----
/** Thời gian 1 cú nhảy sang ô kế (giây) – ngắn hơn khoảng cách giữa 2 bước trong GameContext */
const HOP_BASE_S = 0.24;
const HOP_MAX_S = 0.6;
/** Độ cao cú nhảy (tăng theo khoảng cách, vd. bay tới ô Du lịch / bị bắt vào tù) */
const HOP_BASE_HEIGHT = 0.7;
const HOP_MAX_HEIGHT = 2.2;
/** Nén người khi đáp xuống ô */
const LAND_SQUASH_S = 0.16;

// ---- Bay tới ô đích khi đi Du lịch ----
/** Thời gian chuyến bay (giây) – khớp FLIGHT_MS trong GameContext */
const FLIGHT_S = 1.9;
const FLIGHT_BASE_HEIGHT = 3.2;
const FLIGHT_MAX_HEIGHT = 6.5;
const PLANE_SCALE = 0.9;

const easeInOut = (p: number) =>
  p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

function SmoothPawn({
  targetPos,
  type,
  state,
  offset,
  color,
}: {
  targetPos: [number, number, number];
  type: PawnType;
  state: PawnState;
  offset: [number, number];
  color: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const planeRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const puffRef = useRef<THREE.Mesh>(null);
  const stepRingRef = useRef<THREE.Mesh>(null);
  const puffT = useRef(-1);
  const stepRingT = useRef(-1);
  const wasMoving = useRef(false);

  // Trạng thái cú nhảy / chuyến bay hiện tại
  const initPos = new THREE.Vector3(
    targetPos[0] + offset[0],
    targetPos[1],
    targetPos[2] + offset[1],
  );
  const currentPos = useRef(initPos);
  const hopFrom = useRef(initPos.clone());
  const hopTo = useRef(initPos.clone());
  const hopT = useRef(-1);
  const hopDur = useRef(HOP_BASE_S);
  const hopHeight = useRef(HOP_BASE_HEIGHT);
  /** Cú di chuyển hiện tại là chuyến bay (đi Du lịch) */
  const isFlight = useRef(false);
  const landT = useRef(-1);
  const yaw = useRef(0);
  const facing = useRef(0);
  /** 0 = nhân vật đứng, 1 = đang ở trong máy bay */
  const planeMix = useRef(0);
  const tmp = useRef(new THREE.Vector3());

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const target = tmp.current.set(
      targetPos[0] + offset[0],
      targetPos[1],
      targetPos[2] + offset[1],
    );
    const flying = state === "flying";

    // Có ô đích mới -> nhảy sang ô kế, hoặc bay thẳng tới đích khi đi Du lịch
    if (hopTo.current.distanceToSquared(target) > 1e-6) {
      hopFrom.current.copy(currentPos.current);
      hopTo.current.copy(target);
      const dist = hopFrom.current.distanceTo(hopTo.current);
      isFlight.current = flying;
      if (flying) {
        hopDur.current = FLIGHT_S;
        hopHeight.current = Math.min(
          FLIGHT_MAX_HEIGHT,
          FLIGHT_BASE_HEIGHT + dist * 0.12,
        );
      } else {
        hopDur.current = Math.min(HOP_MAX_S, HOP_BASE_S + dist * 0.02);
        hopHeight.current = Math.min(
          HOP_MAX_HEIGHT,
          HOP_BASE_HEIGHT + dist * 0.08,
        );
      }
      const dx = hopTo.current.x - hopFrom.current.x;
      const dz = hopTo.current.z - hopFrom.current.z;
      if (dx * dx + dz * dz > 1e-4) facing.current = Math.atan2(dx, dz);
      hopT.current = 0;
      wasMoving.current = true;
    }

    let lift = 0;
    let sy = 1;
    let pitch = 0;
    if (hopT.current >= 0) {
      hopT.current = Math.min(1, hopT.current + dt / hopDur.current);
      const p = hopT.current;
      const e = easeInOut(p);
      currentPos.current.lerpVectors(hopFrom.current, hopTo.current, e);
      // Đường vòng cung (cú nhảy thấp / chuyến bay cao)
      lift = 4 * hopHeight.current * p * (1 - p);
      if (isFlight.current) {
        // Mũi máy bay ngóc lên khi cất cánh, chúc xuống khi hạ cánh
        const dist = hopFrom.current.distanceTo(hopTo.current);
        const climb = 4 * hopHeight.current * (1 - 2 * p);
        const ground = dist * 4 * Math.min(p, 1 - p) + 0.5;
        pitch = THREE.MathUtils.clamp(-Math.atan2(climb, ground), -0.6, 0.6);
      } else {
        sy = 1 + 0.14 * Math.sin(Math.PI * p);
      }
      if (p >= 1) {
        hopT.current = -1;
        landT.current = 0;
        if (!isFlight.current) stepRingT.current = 0;
      }
    }

    // Nén người khi chạm ô
    if (landT.current >= 0) {
      landT.current += dt;
      const q = Math.min(1, landT.current / LAND_SQUASH_S);
      sy = 1 - 0.2 * Math.sin(Math.PI * q);
      if (q >= 1) landT.current = -1;
    }

    // Đáp xuống ô cuối cùng -> phụt bụi lớn
    if (
      wasMoving.current &&
      hopT.current < 0 &&
      state !== "moving" &&
      !flying
    ) {
      wasMoving.current = false;
      puffT.current = 0;
    }

    g.position.set(
      currentPos.current.x,
      currentPos.current.y + lift,
      currentPos.current.z,
    );

    // Chuyển đổi nhân vật <-> máy bay (thu nhỏ / phóng to mượt)
    const wantPlane = flying || (isFlight.current && hopT.current >= 0);
    planeMix.current +=
      ((wantPlane ? 1 : 0) - planeMix.current) * Math.min(1, dt * 9);
    const mix = planeMix.current;

    if (bodyRef.current) {
      const sxz = 1 / Math.sqrt(sy); // giữ thể tích khi co giãn
      const k = 1 - mix;
      bodyRef.current.visible = k > 0.02;
      bodyRef.current.scale.set(sxz * k, sy * k, sxz * k);
      // Quay mặt theo hướng đi; đứng yên thì quay lại nhìn camera
      const wantYaw = state === "moving" || flying ? facing.current : 0;
      let diff = wantYaw - yaw.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      yaw.current += diff * Math.min(1, dt * 10);
      bodyRef.current.rotation.y = yaw.current;
    }

    if (planeRef.current) {
      const pl = planeRef.current;
      pl.visible = mix > 0.02;
      pl.scale.setScalar(mix * PLANE_SCALE);
      pl.rotation.set(0, 0, 0);
      pl.rotation.y = facing.current;
      // Đang bay: nghiêng mũi theo quỹ đạo + chao cánh nhẹ; chờ cất cánh: lơ lửng
      const bob = Math.sin(clock.elapsedTime * 5) * 0.06;
      pl.position.y = 0.6 + (hopT.current >= 0 ? 0 : bob);
      pl.rotateX(pitch);
      pl.rotateZ(Math.sin(clock.elapsedTime * 3) * 0.12);
      // Cánh quạt quay
      const prop = pl.getObjectByName("propeller");
      if (prop) prop.rotation.z += dt * 40;
    }

    // Đĩa màu người chơi nhấp nháy nhẹ (nằm trên ô, như bóng máy bay khi bay)
    if (discRef.current) {
      discRef.current.position.y = 0.035 - lift;
      const m = discRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.12;
    }

    // Vòng sáng mỗi bước
    if (stepRingRef.current) {
      const m = stepRingRef.current.material as THREE.MeshBasicMaterial;
      if (stepRingT.current >= 0) {
        stepRingT.current += dt;
        const p = stepRingT.current / 0.35;
        stepRingRef.current.visible = p < 1;
        stepRingRef.current.position.y = 0.05 - lift;
        stepRingRef.current.scale.setScalar(0.5 + p * 0.9);
        m.opacity = 0.75 * (1 - p);
        if (p >= 1) stepRingT.current = -1;
      } else {
        stepRingRef.current.visible = false;
      }
    }

    // Vòng bụi khi đáp ô cuối
    if (puffRef.current) {
      const m = puffRef.current.material as THREE.MeshBasicMaterial;
      if (puffT.current >= 0) {
        puffT.current += dt;
        const p = puffT.current / 0.45;
        puffRef.current.visible = p < 1;
        puffRef.current.scale.setScalar(0.6 + p * 1.2);
        m.opacity = 0.6 * (1 - p);
        if (p >= 1) puffT.current = -1;
      } else {
        puffRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Đĩa màu người chơi dưới chân -> dễ nhận ra quân của ai */}
      <mesh
        ref={discRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.035, 0]}
      >
        <ringGeometry args={[0.38, 0.6, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      {/* Vòng sáng màu người chơi loé lên ở mỗi ô vừa nhảy qua */}
      <mesh
        ref={stepRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        visible={false}
      >
        <ringGeometry args={[0.45, 0.7, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={puffRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        visible={false}
      >
        <ringGeometry args={[0.5, 0.7, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {/* Nhân vật to hơn để dễ nhìn từ góc camera của bàn cờ.
          Cú nhảy & co giãn do SmoothPawn điều khiển (bodyRef). */}
      <group ref={bodyRef}>
        <Pawn3D type={type} state={state} scale={PAWN_SCALE} />
      </group>
      {/* Máy bay chở nhân vật khi đi Du lịch */}
      <group ref={planeRef} visible={false}>
        <ToyPlane color={color} />
      </group>
    </group>
  );
}

/** Máy bay đồ chơi (mũi hướng +Z), cánh & đuôi theo màu người chơi */
function ToyPlane({ color }: { color: string }) {
  return (
    <group>
      {/* Thân */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.32, 1.1, 6, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </mesh>
      {/* Sọc màu người chơi quanh thân */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
        <cylinderGeometry args={[0.335, 0.335, 0.22, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Kính buồng lái */}
      <mesh position={[0, 0.2, 0.42]} scale={[0.75, 0.6, 1]}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial
          color="#7dd3fc"
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      {/* Cánh chính */}
      <mesh position={[0, -0.04, 0.05]} castShadow>
        <boxGeometry args={[2.3, 0.07, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Đuôi ngang & đuôi đứng */}
      <mesh position={[0, 0.05, -0.75]}>
        <boxGeometry args={[0.95, 0.06, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, -0.75]}>
        <boxGeometry args={[0.06, 0.5, 0.32]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Mũi + cánh quạt */}
      <mesh position={[0, 0, 0.88]}>
        <sphereGeometry args={[0.12, 12, 10]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} />
      </mesh>
      <group name="propeller" position={[0, 0, 0.95]}>
        <mesh>
          <boxGeometry args={[0.9, 0.09, 0.03]} />
          <meshStandardMaterial color="#475569" roughness={0.5} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.9, 0.09, 0.03]} />
          <meshStandardMaterial color="#475569" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Hiệu ứng khi ô đất đổi chủ / xây thêm nhà: xu vàng & sao bắn lên + vòng sáng lan ra.
 * Chỉ là hiển thị, chạy dựa trên thay đổi dữ liệu ô (không đụng tới logic game).
 */
const BURST_PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return {
    vx: Math.cos(a) * (0.8 + (i % 3) * 0.3),
    vz: Math.sin(a) * (0.8 + (i % 3) * 0.3),
    vy: 2.4 + (i % 4) * 0.4,
    coin: i % 2 === 0,
  };
});

function PurchaseBurst({
  color,
  onDone,
}: {
  color: string;
  onDone: () => void;
}) {
  // Gỡ hẳn hiệu ứng khỏi cảnh khi chạy xong (không để vật thể vô hình nằm lại trên ô)
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), 1300);
    return () => clearTimeout(timer);
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    const p = t.current / 1.2;
    const g = groupRef.current;
    if (!g) return;
    g.visible = p < 1;
    if (p >= 1) return;
    g.children.forEach((child, i) => {
      const part = BURST_PARTICLES[i];
      if (!part) return;
      const tt = t.current;
      child.position.set(
        part.vx * tt,
        0.2 + part.vy * tt - 4 * tt * tt,
        part.vz * tt,
      );
      child.rotation.y = tt * 8;
      child.scale.setScalar(Math.max(0.01, 1 - p));
    });
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.3 + p * 2.2);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.7 * (1 - p);
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {BURST_PARTICLES.map((part, i) =>
          part.coin ? (
            <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 14]} />
              <meshStandardMaterial
                color="#ffd23f"
                metalness={0.4}
                roughness={0.3}
                emissive="#d99a00"
                emissiveIntensity={0.4}
              />
            </mesh>
          ) : (
            <mesh key={i}>
              <octahedronGeometry args={[0.08, 0]} />
              <meshBasicMaterial color={color} />
            </mesh>
          ),
        )}
      </group>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
      >
        <ringGeometry args={[0.6, 0.75, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Theo dõi thay đổi sở hữu / số nhà của 1 ô và phát hiệu ứng mua đất.
 * Dùng `key` tăng dần để mỗi lần thay đổi tạo 1 hiệu ứng mới.
 */
function TileEventEffects({ tile }: { tile: Tile3DData }) {
  const signature = `${tile.ownerId ?? "-"}:${tile.houses}:${tile.hasVilla ? 1 : 0}`;
  const prevSig = useRef(signature);
  const [burst, setBurst] = useState(0);
  const [doneBurst, setDoneBurst] = useState(0);

  useEffect(() => {
    if (prevSig.current === signature) return;
    prevSig.current = signature;
    // Chỉ phát khi có chủ (mua / nâng cấp), không phát khi bán / phá sản
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tile.ownerId !== undefined) setBurst((b) => b + 1);
  }, [signature, tile.ownerId]);

  if (!burst || burst === doneBurst) return null;
  return (
    <PurchaseBurst
      key={burst}
      color={tile.ownerColor ?? "#ffd23f"}
      onDone={() => setDoneBurst(burst)}
    />
  );
}

// Quân cờ chibi to hơn -> giãn khoảng cách khi nhiều quân đứng chung 1 ô
const PAWN_OFFSETS: [number, number][] = [
  [-0.55, -0.5],
  [0.55, -0.5],
  [-0.55, 0.48],
  [0.55, 0.48],
];

interface Monopoly3DSceneProps {
  players: Player3D[];
  tiles: Tile3DData[];
  pawnStates: Record<number, PawnState>;
  isTravelSelecting?: boolean;
  onTileSelect?: (tileId: number) => void;
}

function TravelSelectableTile({
  tile,
  onSelect,
}: {
  tile: Tile3DData;
  onSelect: () => void;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const pulse = 0.25 + (Math.sin(clock.elapsedTime * 6) + 1) * 0.2;
    materialRef.current.opacity = pulse;
  });

  return (
    <group>
      <mesh
        position={[0, 0.22, 0]}
        onClick={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "auto";
          onSelect();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[tile.size[0] * 0.92, 0.08, tile.size[2] * 0.92]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#22d3ee"
          emissive="#0891b2"
          emissiveIntensity={1}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// CAMERA TỰ CO GIÃN THEO TỈ LỆ MÀN HÌNH
// Bố cục gốc được thiết kế cho màn hình ngang (~1.45). Màn hình hẹp hơn (điện thoại
// dọc, iPad dọc) sẽ lùi camera ra xa theo đúng tỉ lệ để luôn thấy trọn bề ngang bàn cờ.
// ---------------------------------------------------------------------------
const CAMERA_TARGET = new THREE.Vector3(0, -1.5, 0);
const CAMERA_HOME = new THREE.Vector3(0, 22, 16);
const CAMERA_DIR = CAMERA_HOME.clone().sub(CAMERA_TARGET).normalize();
const CAMERA_BASE_DISTANCE = CAMERA_HOME.distanceTo(CAMERA_TARGET);
// Màn hình hẹp hơn tỉ lệ này thì lùi camera để vừa khít bề ngang bàn cờ (~90% chiều rộng)
const DESIGN_ASPECT = 1.12;
const MAX_CAMERA_FACTOR = 3.3;

// Điện thoại xoay ngang: chiều cao là giới hạn -> kéo camera lại gần & dời điểm nhìn
// về phía dãy gần để bàn cờ to hơn (phần viền ngoài của đảo bị cắt bớt cũng không sao)
const PHONE_LANDSCAPE_ZOOM = 0.84;
const DEFAULT_TARGET: [number, number, number] = [0, -1.5, 0];
const PHONE_LANDSCAPE_TARGET: [number, number, number] = [0, -1.5, 2.2];

function ResponsiveCamera({
  zoom,
  target,
}: {
  zoom: number;
  target: [number, number, number];
}) {
  const camera = useThree((s) => s.camera);
  const getState = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    if (!width || !height) return;
    const aspect = width / height;
    // Bề ngang nhìn thấy tỉ lệ với (khoảng cách × tỉ lệ màn hình) -> bù lại khi màn hình hẹp
    const k = Math.min(MAX_CAMERA_FACTOR, Math.max(1, DESIGN_ASPECT / aspect));
    const dist = CAMERA_BASE_DISTANCE * k * zoom;
    const t = new THREE.Vector3(...target);
    camera.position.copy(t).addScaledVector(CAMERA_DIR, dist);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    // Sương mù lùi theo camera để bàn cờ không bị mờ khi camera ở xa
    const fog = getState().scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.near = dist + 20;
      fog.far = dist + 85;
    }
  }, [camera, getState, width, height, zoom, target]);

  return null;
}

/** Khung viền vàng (4 thanh) quanh một hình vuông nửa cạnh `half` */
function GoldTrim({
  half,
  y,
  t = 0.18,
}: {
  half: number;
  y: number;
  t?: number;
}) {
  const len = half * 2 + t;
  return (
    <group>
      {[
        [0, half, len, t],
        [0, -half, len, t],
        [half, 0, t, len],
        [-half, 0, t, len],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, 0.06, d]} />
          <meshStandardMaterial
            color={BOARD_COLORS.trim}
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

function Monopoly3DScene({
  players,
  tiles,
  pawnStates,
  isTravelSelecting = false,
  onTileSelect,
}: Monopoly3DSceneProps) {
  const isCompact = useIsCompact();
  const isPhoneLandscape = useIsPhoneLandscape();
  const cameraTarget = isPhoneLandscape
    ? PHONE_LANDSCAPE_TARGET
    : DEFAULT_TARGET;
  // Các nhóm màu mà 1 người sở hữu trọn bộ (tiền thuê x2 — chỉ để hiển thị)
  const monopolyGroups = useMemo(() => getMonopolyGroups(tiles), [tiles]);

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{
        position: [0, 22, 16],
        fov: 60,
      }}
      // Giới hạn độ phân giải trên màn hình retina để giảm tải GPU
      dpr={[1, 1.5]}
      // Điện thoại: tắt bóng đổ để chơi mượt hơn
      shadows={!isCompact}
      // Không tone-mapping: màu tươi sáng kiểu đồ chơi
      flat
    >
      <color attach="background" args={[BOARD_COLORS.sky]} />
      <fog attach="fog" args={[BOARD_COLORS.sky, 48, 110]} />

      <hemisphereLight args={["#e8f6ff", "#6f9a5a", 0.9]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[14, 28, 18]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />

      <ResponsiveCamera
        zoom={isPhoneLandscape ? PHONE_LANDSCAPE_ZOOM : 1}
        target={cameraTarget}
      />
      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom={true}
        minDistance={15}
        maxDistance={CAMERA_BASE_DISTANCE * MAX_CAMERA_FACTOR + 10}
        target={cameraTarget}
      />

      {/* Đảo, biển, đường & xe buýt, mây */}
      <IslandEnvironment />

      {/* Đế bàn cờ + viền vàng */}
      <mesh position={[0, -0.46, 0]} receiveShadow castShadow>
        <boxGeometry args={[28.6, 0.8, 28.6]} />
        <meshStandardMaterial color={BOARD_COLORS.slab} roughness={0.5} />
      </mesh>
      <GoldTrim half={13.95} y={-0.03} />
      <GoldTrim half={9.95} y={-0.03} t={0.12} />

      {/* Thành phố trung tâm */}
      <CityCenter />

      {tiles.map((tile) => {
        let houseType: HouseType | null = null;
        const isOnlyLandOwned =
          tile.ownerId !== undefined &&
          tile.houses === 0 &&
          !tile.hasVilla &&
          tile.type === "PROPERTY";

        if (tile.hasVilla) houseType = "villa";
        else if (tile.houses === 1) houseType = "1_floor";
        else if (tile.houses === 2) houseType = "2_floors";
        else if (tile.houses === 3) houseType = "3_floors";

        const layout = getTileLayout(tile);
        const band: [number, number, number] = [
          layout.band[0],
          BAND_TOP,
          layout.band[1],
        ];
        const anchor = getBuildingAnchor(tile);
        const isMono =
          tile.type === "PROPERTY" &&
          !!tile.groupCode &&
          monopolyGroups.has(tile.groupCode);
        // Biểu tượng ô đặc biệt (không phải góc): đặt lệch xuống dưới nhãn
        const iconPos: [number, number, number] = [
          layout.body[0],
          TILE_TOP,
          layout.body[1] - (Math.floor(tile.id / 9) === 2 ? 0.45 : 0.3),
        ];

        return (
          <group key={tile.id} position={tile.position}>
            <Tile3D tile={tile} isMonopoly={isMono} />

            {/* Đủ bộ màu: dải màu phát sáng + huy hiệu x2 */}
            {isMono && <MonopolyMarker tile={tile} />}

            {/* HIỆU ỨNG TỔ CHỨC LỄ HỘI: Hào quang phát sáng bao quanh ô đất */}
            {tile.isFestival && <FestivalTileGlow size={tile.size} />}

            {isTravelSelecting && (
              <TravelSelectableTile
                tile={tile}
                onSelect={() => onTileSelect?.(tile.id)}
              />
            )}

            {/* Ô góc */}
            {tile.type === "GO" && <GoIcon3D />}
            {tile.type === "JAIL" && <JailIcon />}
            {tile.type === "FESTIVAL" && <FestivalIcon />}
            {tile.type === "TRAVEL" && <TravelIcon />}

            {/* Ô đặc biệt trên cạnh */}
            {tile.type === "CHANCE" && (
              <group position={iconPos} scale={1.3}>
                <ChanceIcon />
              </group>
            )}
            {tile.type === "FATE" && (
              <group position={iconPos} scale={1.3}>
                <FateIcon />
              </group>
            )}
            {tile.type === "MINIGAME" && (
              <group position={iconPos} scale={1.3}>
                <RpsIcon />
              </group>
            )}
            {tile.type === "XOCDIA" && (
              <group position={iconPos} scale={1.3}>
                <XocDiaIcon />
              </group>
            )}
            {tile.type === "TAX" && (
              <group position={iconPos} scale={1.3}>
                <TaxIcon />
              </group>
            )}
            {tile.type === "STATION" && (
              <group
                position={band}
                rotation={[0, layout.band[0] !== 0 ? Math.PI / 2 : 0, 0]}
              >
                <StationIcon3D color={tile.ownerColor} />
              </group>
            )}

            {/* Cờ / nhà trên dải màu */}
            {isOnlyLandOwned && (
              <Flag3D
                color={tile.ownerColor || "#ef4444"}
                position={anchor.position}
                scale={1.3}
              />
            )}

            {houseType && (
              // Ô cạnh Tây / Đông có dải màu dọc -> xoay dãy nhà theo dải màu
              <group
                position={anchor.position}
                rotation={[0, anchor.alongZ ? Math.PI / 2 : 0, 0]}
              >
                <Building3D
                  type={houseType}
                  scale={houseType === "villa" ? 0.55 : 0.62}
                  roofColor={tile.ownerColor}
                  isFestival={tile?.isFestival}
                />
              </group>
            )}

            {/* Hiệu ứng mua đất / xây nhà */}
            <group position={anchor.position}>
              <TileEventEffects tile={tile} />
            </group>
          </group>
        );
      })}

      {/* Hiệu ứng x2 khi người khác đi vào ô thuộc bộ màu đủ */}
      <RentDoubleEffects
        players={players}
        tiles={tiles}
        pawnStates={pawnStates}
        monopolyGroups={monopolyGroups}
      />

      {/* Quân cờ người chơi */}
      {players
        ?.filter((player) => !player.isBankrupt)
        ?.map((p, idx) => {
          const tilePos = tiles[p.tileIndex]?.position || [9, 0.1, 9];
          return (
            <SmoothPawn
              key={p.id}
              type={p.type}
              state={pawnStates[p.id] || "idle"}
              targetPos={tilePos}
              offset={PAWN_OFFSETS[idx]}
              color={p.color}
            />
          );
        })}
    </Canvas>
  );
}

// Chỉ vẽ lại khi dữ liệu bàn cờ / quân cờ thực sự thay đổi
export default memo(Monopoly3DScene);
