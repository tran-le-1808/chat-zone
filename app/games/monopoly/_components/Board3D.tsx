import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useIsCompact } from "./ui/useScreen";
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
import CameraRig from "./board/CameraRig";
import DustPool, { emitDust } from "./board/anim/DustPool";
import { tileFx } from "./board/anim/tileFx";
import { playStepLand } from "./board/anim/stepSound";
import { clearMoveHint, getMoveHint } from "./board/anim/moveBus";
import { moveFxEnabled, prefersReducedMotion } from "./board/anim/animSettings";
import {
  SLOTS,
  T_STEP,
  hopPose,
  jitter,
  landSpring,
  volumeXZ,
} from "./board/anim/stepTimeline";
import { GoIcon3D, StationIcon3D } from "./board/SpecialIcons";
import { BOARD_COLORS } from "./board/theme";
import { BOARD_CAMERA, groundAxes, type BoardFitMode } from "./board/cameraConfig";

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

// ---- Bay tới ô đích khi đi Du lịch ----
/** Thời gian chuyến bay (giây) – khớp FLIGHT_MS trong GameContext */
const FLIGHT_S = 1.9;
const FLIGHT_BASE_HEIGHT = 3.2;
const FLIGHT_MAX_HEIGHT = 6.5;
const PLANE_SCALE = 0.9;

const easeInOut = (p: number) =>
  p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

/** Quân cờ đang ở các trạng thái "đang đi" (kể cả bước cuối "landing") */
const isStepping = (s: PawnState) => s === "moving" || s === "landing";

/** Điểm đứng mặc định nằm ở NỬA SAU ô (xa camera) để không che chữ giá/tên ở nửa trước */
const STAND_REAR = 0.5;
const TILE_UNIT = 2.7;
const AXES = groundAxes(BOARD_CAMERA.azimuthDeg);

/** Độ lệch (thế giới) của khe đứng: slot = (ngang, sâu) theo bề rộng ô */
function standOffset(slot: [number, number], out: THREE.Vector3) {
  return out
    .set(0, 0, 0)
    .addScaledVector(AXES.right, slot[0] * TILE_UNIT)
    .addScaledVector(AXES.forward, slot[1] * TILE_UNIT + STAND_REAR);
}

type HopKind = "step" | "jump" | "flight";
interface Hop {
  kind: HopKind;
  tile: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  H: number;
  idx: number;
  last: boolean;
  fired: boolean;
}

function SmoothPawn({
  playerId,
  tileId,
  getTilePos,
  type,
  state,
  slot,
  color,
}: {
  playerId: number;
  tileId: number;
  getTilePos: (id: number) => [number, number, number];
  type: PawnType;
  state: PawnState;
  /** Khe đứng (khi đã dừng) hoặc khe "đi qua" (khi đang nhảy ngang ô có quân khác) */
  slot: [number, number];
  color: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const planeRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const puffRef = useRef<THREE.Mesh>(null);
  const stepRingRef = useRef<THREE.Mesh>(null);

  const shadowTex = useMemo(() => softShadowTexture(), []);

  // Toàn bộ trạng thái hoạt ảnh nằm trong một đối tượng (không gây render lại)
  const S = useRef<{
    pos: THREE.Vector3;
    lastTile: number;
    queue: number[];
    hop: Hop | null;
    run: number;
    runActive: boolean;
    idx: number;
    lastStartT: number;
    prevOwn: number;
    kObs: number;
    sinceLand: number;
    yaw: number;
    facing: number;
    planeMix: number;
    puffT: number;
    ringT: number;
    ready: boolean;
    tmp: THREE.Vector3;
    off: THREE.Vector3;
  }>({
    pos: new THREE.Vector3(),
    lastTile: tileId,
    queue: [],
    hop: null,
    run: 0,
    runActive: false,
    idx: 0,
    lastStartT: -1,
    prevOwn: T_STEP,
    kObs: 1,
    sinceLand: 99,
    yaw: 0,
    facing: 0,
    planeMix: 0,
    puffT: -1,
    ringT: -1,
    ready: false,
    tmp: new THREE.Vector3(),
    off: new THREE.Vector3(),
  });

  // Giá trị mới nhất cho vòng lặp (tránh dựng lại closure)
  const latest = useRef({ tileId, state, slot, getTilePos });
  useEffect(() => {
    latest.current = { tileId, state, slot, getTilePos };
  });

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const s = S.current;
    const { tileId: tile, state: st, slot: sl, getTilePos: tilePosOf } = latest.current;
    const dt = Math.min(delta, 0.05);
    const now = clock.elapsedTime;
    const flying = st === "flying";
    const stepping = isStepping(st);
    const fx = moveFxEnabled();
    const reduced = prefersReducedMotion();

    /** Vị trí đứng (thế giới) trên ô `id` với khe `slot` */
    const standAt = (id: number, slotXY: [number, number], out: THREE.Vector3) => {
      const p = tilePosOf(id);
      return standOffset(slotXY, s.off).add(out.set(p[0], p[1], p[2]));
    };

    if (!s.ready) {
      s.ready = true;
      standAt(tile, sl, s.pos);
    }

    // ---- Phát hiện ô mới ----
    if (tile !== s.lastTile) {
      s.lastTile = tile;
      if (flying) {
        startHop("flight", tile, false);
      } else if (stepping || s.hop || s.queue.length) {
        s.queue.push(tile);
      } else {
        startHop("jump", tile, false); // dịch chuyển / bị bắt vào tù: cung dài, không đi qua các ô giữa
      }
    }

    if (stepping && !s.runActive) {
      s.runActive = true;
      s.run++;
      s.idx = 0;
      s.lastStartT = -1;
      s.kObs = 1;
    }
    if (!s.hop && s.queue.length) startHop("step", s.queue.shift() as number, false);
    if (!stepping && !s.hop && !s.queue.length) {
      s.runActive = false;
      clearMoveHint(playerId);
    }

    function startHop(kind: HopKind, id: number, _unused: boolean) {
      void _unused;
      const from = s.pos.clone();
      const last = kind === "step" && st === "landing" && s.queue.length === 0;
      let dur: number;
      let H: number;
      if (kind === "flight") {
        dur = FLIGHT_S;
        const dist = from.distanceTo(standAt(id, sl, s.tmp));
        H = Math.min(FLIGHT_MAX_HEIGHT, FLIGHT_BASE_HEIGHT + dist * 0.12);
      } else if (kind === "jump") {
        const dist = from.distanceTo(standAt(id, sl, s.tmp));
        dur = Math.min(HOP_MAX_S, HOP_BASE_S + dist * 0.02);
        H = Math.min(HOP_MAX_HEIGHT, HOP_BASE_HEIGHT + dist * 0.08);
      } else {
        const idx = s.idx++;
        const [jt, jh] = jitter(playerId, s.run, idx);
        const own = T_STEP * (idx === 0 ? 1.15 : 1) * (last ? 1.25 : 1) * (1 + 0.04 * jt);
        const hint = getMoveHint(playerId)?.[idx];
        if (hint === undefined && s.lastStartT >= 0) {
          // Máy khách: bám nhịp thực tế của chủ phòng (có thể nén do giới hạn 3.2 s)
          s.kObs = Math.min(1, Math.max(0.5, (now - s.lastStartT) / s.prevOwn));
        }
        dur = hint ?? own * s.kObs;
        dur /= 1 + 0.5 * s.queue.length; // đang bị trễ -> bắt kịp
        s.lastStartT = now;
        s.prevOwn = own;
        H = HOP_BASE_HEIGHT * (last ? 1.1 : 1) * (1 + 0.05 * jh);
        if (reduced) {
          dur = Math.min(dur, 0.12);
          H = 0;
        }
      }
      const to = new THREE.Vector3();
      s.hop = { kind, tile: id, from, to, t: 0, dur, H, idx: s.idx - 1, last, fired: false };
      refreshTarget(s.hop);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      if (dx * dx + dz * dz > 1e-4) s.facing = Math.atan2(dx, dz);
    }

    /** Điểm đáp của bước (theo khe hiện tại — các quân khác có thể đã đổi khe) */
    function refreshTarget(h: Hop) {
      standAt(h.tile, sl, h.to);
    }

    // ---- Tiến trình nhảy ----
    let lift = 0;
    let sy = 1;
    let pitch = 0;
    let sink = 0;
    const hop = s.hop;
    s.sinceLand += dt;
    if (hop) {
      hop.t += dt;
      refreshTarget(hop);
      if (hop.kind === "step") {
        if (reduced) {
          const p = Math.min(1, hop.t / hop.dur);
          s.pos.lerpVectors(hop.from, hop.to, easeInOut(p));
          if (p >= 0.9 && !hop.fired) fireLand(hop);
        } else {
          const pose = hopPose(hop.t, hop.dur, hop.H, PAWN_SCALE);
          s.pos.lerpVectors(hop.from, hop.to, pose.u);
          lift = pose.lift;
          pitch = pose.pitch;
          sink = pose.sink;
          sy = pose.landed ? 1 : pose.sy;
          if (pose.landed && !hop.fired) fireLand(hop);
        }
      } else {
        const p = Math.min(1, hop.t / hop.dur);
        s.pos.lerpVectors(hop.from, hop.to, easeInOut(p));
        lift = 4 * hop.H * p * (1 - p);
        if (hop.kind === "flight") {
          const dist = hop.from.distanceTo(hop.to);
          const climb = 4 * hop.H * (1 - 2 * p);
          const ground = dist * 4 * Math.min(p, 1 - p) + 0.5;
          pitch = THREE.MathUtils.clamp(-Math.atan2(climb, ground), -0.6, 0.6);
        } else {
          sy = 1 + 0.14 * Math.sin(Math.PI * p);
        }
        if (p >= 1 && !hop.fired) {
          hop.fired = true;
          if (hop.kind === "jump") fireLand(hop);
          else s.sinceLand = 0;
        }
      }
      if (hop.t >= hop.dur) {
        s.pos.copy(hop.to);
        s.hop = null;
        if (hop.last) s.puffT = 0;
        if (s.queue.length) startHop("step", s.queue.shift() as number, false);
      }
    } else {
      // Đứng yên: trượt mượt (lò xo ~180 ms) sang khe mới khi có quân khác tới / đi
      standAt(tile, sl, s.tmp);
      s.pos.lerp(s.tmp, 1 - Math.exp(-dt * 12));
      if (s.pos.distanceToSquared(s.tmp) < 1e-8) s.pos.copy(s.tmp);
    }

    function fireLand(h: Hop) {
      h.fired = true;
      s.sinceLand = 0;
      const strong = h.last;
      if (fx && h.kind !== "flight") {
        tileFx.land(h.tile, now, strong);
        emitDust(h.to.x, h.to.y, h.to.z, PAWN_SCALE * 0.5, strong ? 5 : 4);
        s.ringT = 0;
      }
      if (h.kind === "step") playStepLand({ last: h.last, playerId, step: h.idx });
    }

    // Lò xo sau chạm đất (chồng lên chuẩn bị của bước kế)
    if (!reduced) sy *= landSpring(s.sinceLand);

    g.position.set(s.pos.x, s.pos.y + lift, s.pos.z);

    // Chuyển đổi nhân vật <-> máy bay (thu nhỏ / phóng to mượt)
    const wantPlane = flying || (hop?.kind === "flight");
    s.planeMix += ((wantPlane ? 1 : 0) - s.planeMix) * Math.min(1, dt * 9);
    const mix = s.planeMix;

    if (bodyRef.current) {
      const sxz = volumeXZ(sy); // giữ thể tích khi co giãn
      const k = 1 - mix;
      bodyRef.current.visible = k > 0.02;
      bodyRef.current.scale.set(sxz * k, sy * k, sxz * k);
      bodyRef.current.position.y = -sink; // hạ trọng tâm, chân vẫn dính mặt ô
      // Quay mặt theo hướng đi (xong trước khi nhảy); đứng yên thì quay lại nhìn camera
      const wantYaw = stepping || flying || hop ? s.facing : 0;
      let diff = wantYaw - s.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.yaw += diff * Math.min(1, dt * 16);
      bodyRef.current.rotation.order = "YXZ";
      bodyRef.current.rotation.set(pitch, s.yaw, 0);
    }

    if (planeRef.current) {
      const pl = planeRef.current;
      pl.visible = mix > 0.02;
      pl.scale.setScalar(mix * PLANE_SCALE);
      pl.rotation.set(0, 0, 0);
      pl.rotation.y = s.facing;
      const bob = Math.sin(clock.elapsedTime * 5) * 0.06;
      pl.position.y = 0.6 + (hop ? 0 : bob);
      pl.rotateX(pitch);
      pl.rotateZ(Math.sin(clock.elapsedTime * 3) * 0.12);
      const prop = pl.getObjectByName("propeller");
      if (prop) prop.rotation.z += dt * 40;
    }

    // Bóng tiếp xúc: nằm trên mặt ô, nhỏ lại 25% & mờ đi 40% khi lên cao
    if (shadowRef.current) {
      const h = hop ? Math.min(1, lift / Math.max(0.01, hop.kind === "step" ? hop.H : 1.5)) : 0;
      shadowRef.current.position.y = 0.03 - lift;
      shadowRef.current.scale.setScalar(1 - 0.25 * h);
      (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - 0.4 * h);
    }

    // Đĩa màu người chơi nằm trên ô (như bóng máy bay khi bay)
    if (discRef.current) {
      discRef.current.position.y = 0.035 - lift;
      const m = discRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.12;
    }

    // Vòng sáng mỗi lần chạm đất
    if (stepRingRef.current) {
      const m = stepRingRef.current.material as THREE.MeshBasicMaterial;
      if (s.ringT >= 0) {
        s.ringT += dt;
        const p = s.ringT / 0.35;
        stepRingRef.current.visible = p < 1;
        stepRingRef.current.position.y = 0.05 - lift;
        stepRingRef.current.scale.setScalar(0.5 + p * 0.9);
        m.opacity = 0.75 * (1 - p);
        if (p >= 1) s.ringT = -1;
      } else {
        stepRingRef.current.visible = false;
      }
    }

    // Vòng bụi khi đáp ô cuối
    if (puffRef.current) {
      const m = puffRef.current.material as THREE.MeshBasicMaterial;
      if (s.puffT >= 0 && fx) {
        s.puffT += dt;
        const p = s.puffT / 0.45;
        puffRef.current.visible = p < 1;
        puffRef.current.scale.setScalar(0.6 + p * 1.2);
        m.opacity = 0.6 * (1 - p);
        if (p >= 1) s.puffT = -1;
      } else {
        puffRef.current.visible = false;
        if (!fx) s.puffT = -1;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Bóng tiếp xúc mềm dưới chân */}
      <mesh
        ref={shadowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        renderOrder={1}
      >
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          map={shadowTex}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
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
      {/* Vòng sáng màu người chơi loé lên ở mỗi ô vừa chạm */}
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

/** Texture bóng mềm (gradient tròn) — tạo một lần */
let _shadowTex: THREE.CanvasTexture | null = null;
function softShadowTexture() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const gr = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.85)");
    gr.addColorStop(0.55, "rgba(0,0,0,0.35)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
  }
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}

/** Cập nhật hiệu ứng lún ô mỗi khung hình (một vòng lặp duy nhất) */
function TileFxDriver() {
  useFrame(({ clock }) => {
    tileFx.step(clock.elapsedTime);
  });
  return null;
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

interface Monopoly3DSceneProps {
  players: Player3D[];
  tiles: Tile3DData[];
  pawnStates: Record<number, PawnState>;
  isTravelSelecting?: boolean;
  onTileSelect?: (tileId: number) => void;
  /** Chạm vào một ô (không phải kéo) -> mở thẻ thông tin */
  onTileInfo?: (tileId: number) => void;
  /** Phóng đầy chiều rộng (mặc định) hoặc toàn cảnh vừa khung */
  fitMode?: BoardFitMode;
  /** Người chơi mà camera tự theo (lượt hiện tại) */
  focusPlayerId?: number;
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
// CAMERA: cấu hình tập trung ở ./board/cameraConfig.ts. Chỉ camera thay đổi,
// bàn cờ giữ nguyên toạ độ logic.
// ---------------------------------------------------------------------------
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
  onTileInfo,
  fitMode = "fillWidth",
  focusPlayerId,
}: Monopoly3DSceneProps) {
  const isCompact = useIsCompact();
  // Vị trí ô theo id (cho hoạt ảnh nhảy từng ô)
  const getTilePos = useCallback(
    (id: number): [number, number, number] =>
      tiles[id]?.position ?? [0, 0.4, 0],
    [tiles],
  );
  // Khe đứng: nhiều quân cùng ô xếp theo bảng khe cố định (không chồng nhau). Quân đang đi
  // ngang qua ô có quân khác thì lệch về phía camera để nhảy QUA chứ không đáp lên khe đó.
  const pawnSlots = useMemo(() => {
    const stationary = new Map<number, number[]>();
    const alive = (players ?? []).filter((p) => !p.isBankrupt);
    for (const p of alive) {
      const st = pawnStates[p.id];
      if (st === "moving") continue;
      const arr = stationary.get(p.tileIndex) ?? [];
      arr.push(p.id);
      stationary.set(p.tileIndex, arr);
    }
    const out = new Map<number, [number, number]>();
    for (const p of alive) {
      const group = stationary.get(p.tileIndex) ?? [];
      if (pawnStates[p.id] === "moving") {
        out.set(p.id, group.length ? [0, -0.42] : [0, 0]);
        continue;
      }
      const slots = SLOTS[Math.min(4, Math.max(1, group.length))];
      out.set(p.id, slots[Math.max(0, group.indexOf(p.id))] ?? [0, 0]);
    }
    return out;
  }, [players, pawnStates]);
  // Điểm camera cần giữ trong khung: ô quân cờ đang chơi (ưu tiên quân đang di chuyển)
  // và các ô phía trước (6 ô) -> lấy điểm giữa
  const focus = useMemo<[number, number] | null>(() => {
    const mover = players?.find((p) => {
      const st = pawnStates[p.id];
      return st === "moving" || st === "landing" || st === "flying";
    });
    const who = mover ?? players?.find((p) => p.id === focusPlayerId);
    if (!who || !tiles.length) return null;
    const a = tiles[who.tileIndex]?.position;
    const b = tiles[(who.tileIndex + 6) % tiles.length]?.position;
    if (!a) return null;
    const bb = b ?? a;
    return [(a[0] * 2 + bb[0]) / 3, (a[2] * 2 + bb[2]) / 3];
  }, [players, pawnStates, tiles, focusPlayerId]);
  // Các nhóm màu mà 1 người sở hữu trọn bộ (tiền thuê x2 — chỉ để hiển thị)
  const monopolyGroups = useMemo(() => getMonopolyGroups(tiles), [tiles]);

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{
        position: [60, 80, 60],
        fov: BOARD_CAMERA.fov,
        near: BOARD_CAMERA.near,
        far: BOARD_CAMERA.far,
      }}
      // Giới hạn độ phân giải trên màn hình retina để giảm tải GPU
      dpr={[1, 1.5]}
      // Điện thoại: tắt bóng đổ để chơi mượt hơn
      shadows={!isCompact}
      // Không tone-mapping: màu tươi sáng kiểu đồ chơi
      flat
    >
      <color attach="background" args={[BOARD_COLORS.backdrop]} />
      
      <hemisphereLight args={["#e8f6ff", "#6f9a5a", 0.9]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[14, 28, 18]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />

      <TileFxDriver />
      <DustPool />
      <CameraRig mode={fitMode} focus={focus} />


      {/* Đế bàn cờ + viền vàng */}
      <mesh position={[0, -0.46, 0]} receiveShadow castShadow>
        <boxGeometry args={[28.6, 0.8, 28.6]} />
        <meshStandardMaterial color={BOARD_COLORS.slab} roughness={0.5} />
      </mesh>
      <GoldTrim half={13.95} y={-0.03} />
      <GoldTrim half={9.3} y={-0.03} t={0.12} />

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
          layout.body[1] - (Math.floor(tile.id / 8) === 2 ? 0.45 : 0.3),
        ];

        return (
          <group
            key={tile.id}
            position={tile.position}
            ref={(g) => tileFx.register(tile.id, g, tile.position[1])}
            onClick={(e) => {
              // Bỏ qua khi người chơi đang kéo / pinch camera
              if (e.delta > 6 || isTravelSelecting) return;
              e.stopPropagation();
              onTileInfo?.(tile.id);
            }}
          >
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
        ?.map((p) => (
          <SmoothPawn
            key={p.id}
            playerId={p.id}
            tileId={p.tileIndex}
            getTilePos={getTilePos}
            type={p.type}
            state={pawnStates[p.id] || "idle"}
            slot={pawnSlots.get(p.id) ?? [0, 0]}
            color={p.color}
          />
        ))}
    </Canvas>
  );
}

// Chỉ vẽ lại khi dữ liệu bàn cờ / quân cờ thực sự thay đổi
export default memo(Monopoly3DScene);
