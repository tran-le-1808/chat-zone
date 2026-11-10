import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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
  const discRef = useRef<THREE.Mesh>(null);
  const puffRef = useRef<THREE.Mesh>(null);
  const puffT = useRef(-1);
  const wasMoving = useRef(false);
  const currentPos = useRef(
    new THREE.Vector3(
      targetPos[0] + offset[0],
      targetPos[1],
      targetPos[2] + offset[1],
    ),
  );

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const targetVector = new THREE.Vector3(
      targetPos[0] + offset[0],
      targetPos[1],
      targetPos[2] + offset[1],
    );

    currentPos.current.lerp(targetVector, 0.35);

    const dist = currentPos.current.distanceToSquared(targetVector);
    if (dist < 0.0001) {
      currentPos.current.copy(targetVector);
      // Vừa đáp xuống ô -> phụt bụi
      if (wasMoving.current && state !== "moving") {
        wasMoving.current = false;
        puffT.current = 0;
      }
    } else if (dist > 0.01) {
      wasMoving.current = true;
    }

    groupRef.current.position.copy(currentPos.current);

    // Đĩa màu người chơi nhấp nháy nhẹ
    if (discRef.current) {
      const m = discRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.12;
    }

    // Vòng bụi khi đáp
    if (puffRef.current) {
      const m = puffRef.current.material as THREE.MeshBasicMaterial;
      if (puffT.current >= 0) {
        puffT.current += delta;
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
      {/* Nhân vật to hơn để dễ nhìn từ góc camera của bàn cờ */}
      <Pawn3D type={type} state={state} scale={PAWN_SCALE} />
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
  // Các nhóm màu mà 1 người sở hữu trọn bộ (tiền thuê x2 — chỉ để hiển thị)
  const monopolyGroups = useMemo(() => getMonopolyGroups(tiles), [tiles]);

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{
        position: [0, 22, 16],
        fov: 60,
      }}
      // Giới hạn độ phân giải trên màn hình retina để giảm tải GPU
      dpr={[1, 1.5]}
      shadows
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

      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom={true}
        minDistance={15}
        maxDistance={45}
        target={[0, -1.5, 0]}
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
