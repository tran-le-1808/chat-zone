"use client";

/**
 * Render 2D top-down bằng Three.js (react-three-fiber, camera trực giao) với pixel art vẽ bằng code.
 * Thế giới (x phải, y xuống) -> Three (x, -y). Thực thể cập nhật trong useFrame qua SceneRuntime (ngoài React).
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PALETTE } from "../_lib/art/palette";
import { cameraFrame, type CameraFrame } from "./cameraMath";
import { bedPose } from "../_lib/art/bedPose";
import { characterSheet, COLS, directionOf, frameFor, OUTFITS, prisonerOutfit, ROWS, underwearOutfit, type Outfit } from "../_lib/art/sprites";
import { cameraAngle } from "../_lib/engine/cameras";
import { gymMachineSpot } from "../_lib/engine/gym";
import { DIFFICULTY_PRESETS, PRISON_CONFIG as C } from "../_lib/engine/config";
import { ITEM_DEFS } from "../_lib/engine/items";
import { FLOOR } from "../_lib/engine/floor";
import { isOpaque, PRISON_MAP, tileAt } from "../_lib/engine/map";
import { cellLightsOn, isNight } from "../_lib/engine/rules";
import { tunnelComplete, tunnelSpotCenter } from "../_lib/engine/tunnel";
import type { Point } from "../_lib/engine/types";
import type { ClientView, PrisonSession } from "../_lib/session/types";
import { playerColor } from "../_lib/session/types";
import { drawMap, drawNightMask } from "./mapTexture";

const W = PRISON_MAP.width;
/** Hình nhân vật vẽ cao hơn điểm đứng (chân ở toạ độ thế giới) — camera canh theo tâm hình */
const SPRITE_LIFT = 0.32;

const H = PRISON_MAP.height;
const RAYS = 28;
/** Các ô cửa thường (bị phong toả khi có người bị truy nã từ 2 sao) */
const DOOR_TILES: [number, number][] = [];
for (let y = 0; y < PRISON_MAP.height; y++) for (let x = 0; x < PRISON_MAP.width; x++) if (PRISON_MAP.tiles[y][x] === "d") DOOR_TILES.push([x, y]);

const GUARD_COLORS: Record<string, string> = {
  PATROL: "#fde68a",
  SUSPICIOUS: "#fb923c",
  INVESTIGATE: "#f97316",
  CHASE: "#ef4444",
  SEARCH: "#facc15",
  RETURN: "#e5e7eb",
};

function rayLength(x: number, y: number, ang: number, max: number): number {
  const step = 0.2;
  const dx = Math.cos(ang) * step;
  const dy = Math.sin(ang) * step;
  let px = x;
  let py = y;
  for (let d = 0; d < max; d += step) {
    px += dx;
    py += dy;
    if (isOpaque(tileAt(PRISON_MAP, Math.floor(px), Math.floor(py)))) return d;
  }
  return max;
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.font = "bold 28px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 6;
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.strokeText(text.slice(0, 18), 128, 32);
  g.fillStyle = color;
  g.fillText(text.slice(0, 18), 128, 32);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const sheetTextures = new Map<string, THREE.CanvasTexture>();
function sheetTexture(o: Outfit): THREE.Texture {
  const key = JSON.stringify(o);
  let base = sheetTextures.get(key);
  if (!base) {
    base = new THREE.CanvasTexture(characterSheet(o));
    base.magFilter = THREE.NearestFilter;
    base.minFilter = THREE.NearestFilter;
    base.colorSpace = THREE.SRGBColorSpace;
    base.generateMipmaps = false;
    sheetTextures.set(key, base);
  }
  const t = base.clone();
  t.repeat.set(1 / COLS, 1 / ROWS);
  t.needsUpdate = true;
  return t;
}

function MapPlane({ ventOpen, fenceKey }: { ventOpen: boolean; fenceKey: string }) {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(drawMap({ ventOpen, fenceGaps: fenceKey ? fenceKey.split("|") : [] }));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [ventOpen, fenceKey]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[W / 2, -H / 2, 0]}>
      <planeGeometry args={[W, H]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** Ánh sáng ngày/đêm: lớp phủ theo giờ, đèn tạo vùng sáng (đèn phòng giam tắt lúc 21:00) */
function NightOverlay({ view }: { view: ClientView }) {
  const m = view.clock.minuteOfDay;
  const h = m / 60;
  const night = h >= 22 || h < 5 ? 0.62 : h >= 19.5 ? ((h - 19.5) / 2.5) * 0.62 : h < 6.5 ? ((6.5 - h) / 1.5) * 0.62 : 0;
  // mất điện: mọi đèn tắt (ban ngày chỉ hơi tối trong nhà)
  const blackout = view.meta.blackoutRemaining > 0;
  const darkness = blackout ? Math.max(night, 0.35) : night;
  const lock = view.meta.prisonState === "LOCKDOWN";
  const key = `${Math.round(darkness * 20)}|${cellLightsOn(m)}|${lock}|${blackout}`;
  const tex = useMemo(() => {
    const [d, lights, l, b] = key.split("|");
    const t = new THREE.CanvasTexture(drawNightMask(Math.max(Number(d) / 20, l === "true" ? 0.3 : 0), lights === "true", l === "true", b === "true"));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [key]);
  useEffect(() => () => tex.dispose(), [tex]);
  if (darkness <= 0 && !lock) return null;
  return (
    <mesh position={[W / 2, -H / 2, 3.5]}>
      <planeGeometry args={[W, H]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Highlight({ tile }: { tile: Point | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 6) * 0.2;
  });
  if (!tile) return null;
  return (
    <mesh ref={ref} position={[tile.x + 0.5, -tile.y - 0.5, 0.55]}>
      <ringGeometry args={[0.55, 0.7, 4, 1, Math.PI / 4]} />
      <meshBasicMaterial color="#ffd166" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

const SHOWERS = PRISON_MAP.interactables.filter((i) => i.kind === "shower" && i.showerSpot).map((i) => i.showerSpot!);

const BOOKSHELVES = PRISON_MAP.interactables.filter((i) => i.kind === "bookshelf").map((i, n) => ({ id: i.id, x: i.tiles[0].x, y: i.tiles[0].y, seed: n }));

/** Dấu vết đào & vật che: lỗ tường, miệng hầm, ảnh treo, thảm; dưới hầm thì vẽ đường hầm và làm tối mặt đất */
function DigLayer({ view }: { view: ClientView }) {
  const dig = view.meta.dig;
  if (!dig) return null;
  const me = view.players.find((p) => p.id === view.meId);
  const under = !!me?.underground;
  const xy = (k: string) => k.split(",").map(Number) as [number, number];
  return (
    <>
      {Object.keys(dig.holes).map((k) => {
        const [x, y] = xy(k);
        const covered = dig.decor[k] === "wall_picture";
        return (
          <mesh key={`h${k}`} position={[x + 0.5, -y - 0.5, 0.62]}>
            <planeGeometry args={covered ? [0.8, 0.8] : [0.72, 0.72]} />
            <meshBasicMaterial color={covered ? "#d6b26e" : PALETTE.ink} />
          </mesh>
        );
      })}
      {Object.keys(dig.entrances).map((k) => {
        const [x, y] = xy(k);
        const covered = dig.decor[k] === "floor_rug";
        return covered ? (
          <mesh key={`e${k}`} position={[x + 0.5, -y - 0.5, 0.61]}>
            <planeGeometry args={[0.92, 0.7]} />
            <meshBasicMaterial color="#9a3412" />
          </mesh>
        ) : (
          <mesh key={`e${k}`} position={[x + 0.5, -y - 0.5, 0.61]}>
            <circleGeometry args={[0.38, 14]} />
            <meshBasicMaterial color={PALETTE.ink} />
          </mesh>
        );
      })}
      {Object.entries(dig.decor).map(([k, it]) => {
        if (dig.holes[k] || dig.entrances[k]) return null;
        const [x, y] = xy(k);
        return it === "wall_picture" ? (
          <group key={`d${k}`} position={[x + 0.5, -y - 0.5, 0.63]}>
            <mesh>
              <planeGeometry args={[0.6, 0.5]} />
              <meshBasicMaterial color="#d6b26e" />
            </mesh>
            <mesh position={[0, 0, 0.005]}>
              <planeGeometry args={[0.44, 0.34]} />
              <meshBasicMaterial color="#60a5fa" />
            </mesh>
          </group>
        ) : (
          <mesh key={`d${k}`} position={[x + 0.5, -y - 0.5, 0.6]}>
            <planeGeometry args={[0.92, 0.7]} />
            <meshBasicMaterial color="#9a3412" />
          </mesh>
        );
      })}
      {under && (
        <>
          {/* dưới hầm: mặt đất tối đi, chỉ thấy đường hầm */}
          <mesh position={[W / 2, -H / 2, 1.5]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial color="#05060d" transparent opacity={0.82} depthWrite={false} />
          </mesh>
          {Object.keys(dig.tunnels).map((k) => {
            const [x, y] = xy(k);
            return (
              <mesh key={`t${k}`} position={[x + 0.5, -y - 0.5, 1.6]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={dig.entrances[k] ? "#a16207" : "#5b3a1e"} />
              </mesh>
            );
          })}
        </>
      )}
    </>
  );
}

function FloorStuff({ view, onPickMachine }: { view: ClientView; onPickMachine?: (machineId: string) => void }) {
  const myGym = view.me?.gym ?? null;
  return (
    <>
      {view.meta.floorItems.map((f) => (
        <mesh key={f.id} position={[f.x, -f.y, 0.6]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color={ITEM_DEFS[f.item.itemId].color} />
        </mesh>
      ))}
      {/* viền sáng món gần nhất trong tầm nhặt (E) */}
      <NearestFloorGlow view={view} />
      {Object.entries(view.meta.containers).map(([id, items]) => {
        if (items.length <= 0) return null;
        const t = PRISON_MAP.interactableById[id]?.tiles[0];
        if (!t) return null;
        return (
          <mesh key={id} position={[t.x + 0.82, -t.y - 0.18, 0.6]}>
            <circleGeometry args={[0.08, 8]} />
            <meshBasicMaterial color={PALETTE.gold} />
          </mesh>
        );
      })}
      {BOOKSHELVES.map((b) => (
        <group key={b.id} position={[b.x + 0.5, -b.y - 0.5, 0.57]}>
          <mesh>
            <planeGeometry args={[0.86, 0.5]} />
            <meshBasicMaterial color="#6b4423" />
          </mesh>
          {[-0.3, -0.12, 0.06, 0.24].map((dx, i) => (
            <mesh key={i} position={[dx, 0.02, 0.005]}>
              <planeGeometry args={[0.12, 0.36]} />
              <meshBasicMaterial color={["#c81d25", "#2f6fb0", "#e8b04b", "#3f8f5a"][(i + b.seed) % 4]} />
            </mesh>
          ))}
        </group>
      ))}
      {view.meta.gym.machines.map((m) => {
        const pos = gymMachineSpot(m.kind, m.index, view.meta.gym.perKind);
        const busy = !!m.occupantId;
        const mine = m.occupantId === view.meId;
        const progress = mine && myGym ? Math.min(1, myGym.beats / Math.max(1, myGym.need)) : 0;
        return (
          <group
            key={m.id}
            position={[pos.x, -pos.y, 0.57]}
            onClick={(e) => {
              // bấm vào máy là tập luôn (ở xa thì tự đi tới)
              e.stopPropagation();
              onPickMachine?.(m.id);
            }}
          >
            {mine && myGym && (
              <group position={[0, 0.42, 2.5]}>
                <mesh>
                  <planeGeometry args={[0.7, 0.09]} />
                  <meshBasicMaterial color="#000000" transparent opacity={0.6} />
                </mesh>
                <mesh position={[-0.35 + 0.35 * progress, 0, 0.01]} scale={[Math.max(0.001, progress), 1, 1]}>
                  <planeGeometry args={[0.7, 0.07]} />
                  <meshBasicMaterial color="#4ade80" />
                </mesh>
              </group>
            )}
            <mesh>
              <planeGeometry args={m.kind === "pressBench" ? [0.34, 0.2] : [0.22, 0.36]} />
              <meshBasicMaterial color={mine ? "#f4b942" : busy ? "#8a6a3a" : m.kind === "pressBench" ? "#6b7194" : "#2f3450"} />
            </mesh>
            <mesh position={[0, 0, 0.005]}>
              <planeGeometry args={m.kind === "pressBench" ? [0.4, 0.04] : [0.14, 0.04]} />
              <meshBasicMaterial color={m.kind === "pressBench" ? "#c9cde3" : "#11132a"} />
            </mesh>
          </group>
        );
      })}
      {view.meta.doorsLocked &&
        DOOR_TILES.map(([x, y]) => (
          <mesh key={`lock-${x}-${y}`} position={[x + 0.5, -y - 0.5, 0.59]}>
            <planeGeometry args={[0.95, 0.95]} />
            <meshBasicMaterial color={PALETTE.red} transparent opacity={0.45} />
          </mesh>
        ))}
      {Object.entries(view.meta.beds).map(([id, bed]) => {
        const pose = bedPose(id);
        if (!pose) return null;
        const half = pose.length / 2;
        // có người đang nằm: chăn vẽ đè lên người (trong nhân vật), giường chỉ vẽ gối
        const occupied = view.players.some((p) => p.bed === id && p.status !== "ESCAPED");
        return (
          <group key={id} position={[pose.x, -pose.y, 0.58]} rotation={[0, 0, pose.rot]}>
            {bed.pillow && !bed.dummy && (
              <mesh position={[0, half - 0.25, 0.01]}>
                <planeGeometry args={[0.62, 0.26]} />
                <meshBasicMaterial color={PALETTE.white} />
              </mesh>
            )}
            {bed.blanket && !bed.dummy && !occupied && (
              <mesh position={[0, -0.12 * pose.length, 0.01]}>
                <planeGeometry args={[0.86, 0.5 * pose.length + 0.1]} />
                <meshBasicMaterial color={PALETTE.blue} />
              </mesh>
            )}
            {bed.dummy && (
              <>
                <mesh position={[0, -0.1 * pose.length, 0.01]}>
                  <planeGeometry args={[0.7, 0.52 * pose.length]} />
                  <meshBasicMaterial color={PALETTE.orangeLight} />
                </mesh>
                <mesh position={[0, half - 0.25, 0.02]}>
                  <circleGeometry args={[0.17, 12]} />
                  <meshBasicMaterial color={PALETTE.skin} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      {Object.entries(view.meta.tunnels).map(([cell, t]) => {
        if (!t.progress) return null;
        const c = tunnelSpotCenter(Number(cell));
        const done = tunnelComplete(t);
        return (
          <group key={cell} position={[c.x, -c.y, 0.58]}>
            <mesh>
              <circleGeometry args={[t.covered ? 0.18 : 0.38, 12]} />
              <meshBasicMaterial color={t.covered ? PALETTE.woodDark : PALETTE.ink} transparent opacity={t.covered ? 0.6 : 1} />
            </mesh>
            {done &&
              [-0.18, 0, 0.18].map((y) => (
                <mesh key={y} position={[0, y, 0.01]}>
                  <planeGeometry args={[0.4, 0.05]} />
                  <meshBasicMaterial color={PALETTE.wood} />
                </mesh>
              ))}
          </group>
        );
      })}
    </>
  );
}

interface EntityRefs {
  group: THREE.Group;
  sprite: THREE.Mesh;
  tex: THREE.Texture;
  /** Trang phục đang vẽ (đổi khi mặc / cởi bộ đồ) */
  outfitKey?: string;
  lab?: THREE.Sprite;
  labelKey?: string;
  /** Chăn đắp khi nằm trên giường (con của sprite, xoay theo người) */
  blanket?: THREE.Mesh;
  shadow?: THREE.Mesh;
  cone?: THREE.Mesh;
  ring?: THREE.Mesh;
  bar?: THREE.Mesh;
  weapon?: THREE.Mesh;
  hpBg?: THREE.Mesh;
  hpFill?: THREE.Mesh;
  last: { x: number; y: number };
}

function fanGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((RAYS + 2) * 3), 3));
  const idx: number[] = [];
  for (let i = 1; i <= RAYS; i++) idx.push(0, i, i + 1);
  geo.setIndex(idx);
  return geo;
}

function updateFan(mesh: THREE.Mesh, x: number, y: number, facing: number, half: number, range: number) {
  const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  pos.setXYZ(0, 0, 0, 0);
  for (let i = 0; i <= RAYS; i++) {
    const a = facing - half + (2 * half * i) / RAYS;
    const len = rayLength(x, y, a, range);
    pos.setXYZ(i + 1, Math.cos(a) * len, -Math.sin(a) * len, 0);
  }
  pos.needsUpdate = true;
}

const PARTICLES = 90;

/** Trạng thái theo khung hình nằm ngoài React: mesh, camera bám, rung, hạt */
export class SceneRuntime {
  readonly root = new THREE.Group();
  private refs = new Map<string, EntityRefs>();
  private cams = new Map<string, THREE.Mesh>();
  private view: ClientView | null = null;
  private viewAt = 0;
  private last = 0;
  private camTarget: { x: number; y: number } | null = null;
  private frameErrorLogged = false;
  /** Thông tin camera cho chế độ ?debugCamera=1 */
  debug: { frame: CameraFrame; target: { x: number; y: number }; viewport: { width: number; height: number } } | null = null;
  private shakeAmt = 0;
  private alarm: THREE.Mesh;
  private particles: THREE.Points;
  private pVel = new Float32Array(PARTICLES * 3);
  private pLife = new Float32Array(PARTICLES);
  private pNext = 0;
  private arcs: { mesh: THREE.Mesh; life: number }[] = [];
  private arcNext = 0;
  private zoom = 1;

  setZoom(z: number): void {
    this.zoom = z;
  }

  constructor(private readonly session: PrisonSession) {
    for (const cam of PRISON_MAP.cameras) {
      const m = new THREE.Mesh(fanGeometry(), new THREE.MeshBasicMaterial({ color: "#f87171", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      m.frustumCulled = false;
      m.position.set(cam.x, -cam.y, 0.72);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), new THREE.MeshBasicMaterial({ color: PALETTE.red }));
      dot.position.z = 0.1;
      m.add(dot);
      this.root.add(m);
      this.cams.set(cam.id, m);
    }
    const arc = (C.combat.arcDeg * Math.PI) / 180;
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 1, 20, 1, -arc / 2, arc), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.position.z = 2.7;
      this.root.add(mesh);
      this.arcs.push({ mesh, life: 0 });
    }
    this.alarm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0, depthWrite: false }));
    this.alarm.position.set(W / 2, -H / 2, 3.6);
    this.root.add(this.alarm);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLES * 3).fill(-999), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false }));
    this.particles.frustumCulled = false;
    this.particles.position.z = 2.9;
    this.root.add(this.particles);
  }

  setView(v: ClientView): void {
    this.view = v;
    this.viewAt = performance.now();
    this.sync(v);
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  /** Vệt vung vũ khí theo hướng đánh */
  swing(x: number, y: number, facing: number, range: number): void {
    const a = this.arcs[this.arcNext++ % this.arcs.length];
    a.mesh.position.set(x, -y, 2.7);
    a.mesh.rotation.z = -facing;
    a.mesh.scale.set(range + 0.2, range + 0.2, 1);
    a.life = 0.18;
    a.mesh.visible = true;
  }

  /** Tia lửa khi đòn trúng đích */
  hit(x: number, y: number, mine: boolean): void {
    this.emit(x, y, "#ffffff", 6, 3);
    this.emit(x, y, PALETTE.red, 6, 2.5);
    if (mine) this.shake(0.1);
  }

  private addEntity(id: string, outfit: Outfit, label: string, labelColor: string, withCone: boolean, highlight: string | null): void {
    const group = new THREE.Group();
    const tex = sheetTexture(outfit);
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    sprite.position.set(0, SPRITE_LIFT, 0.2);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.scale.set(1, 0.45, 1);
    shadow.position.set(0, -0.2, 0.05);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 28), new THREE.MeshBasicMaterial({ color: highlight ?? "#ef4444", transparent: true, opacity: highlight ? 0.8 : 0 }));
    ring.position.set(0, -0.15, 0.06);
    ring.scale.set(1, 0.5, 1);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.09), new THREE.MeshBasicMaterial({ color: PALETTE.green }));
    bar.position.set(0, 1.05, 0.3);
    bar.visible = false;
    const weapon = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.1), new THREE.MeshBasicMaterial({ color: "#cbd5e1" }));
    weapon.visible = false;
    weapon.position.z = 0.35;
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.6 }));
    const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.06), new THREE.MeshBasicMaterial({ color: "#ef4444" }));
    hpBg.position.set(0, 1.0, 0.31);
    hpFill.position.set(0, 1.0, 0.32);
    hpBg.visible = false;
    hpFill.visible = false;
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(label, labelColor), depthWrite: false }));
    lab.scale.set(1.6, 0.4, 1);
    lab.position.set(0, 1.25, 0.3);
    // chăn: che từ cổ trở xuống khi nằm (vẽ trên nhân vật)
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.62), new THREE.MeshBasicMaterial({ color: PALETTE.blue }));
    blanket.position.set(0, -0.16, 0.05);
    blanket.visible = false;
    sprite.add(blanket);
    group.add(shadow, ring, sprite, bar, lab, weapon, hpBg, hpFill);
    let cone: THREE.Mesh | undefined;
    if (withCone) {
      cone = new THREE.Mesh(fanGeometry(), new THREE.MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      cone.frustumCulled = false;
      cone.position.z = -1.3;
      group.add(cone);
    }
    group.position.z = 2;
    this.root.add(group);
    this.refs.set(id, { group, sprite, tex, cone, ring, bar, weapon, hpBg, hpFill, lab, blanket, shadow, outfitKey: "", labelKey: `${label}|${labelColor}`, last: { x: 0, y: 0 } });
  }

  /** Đổi bảng sprite khi trang phục đổi (giữ nguyên khung hình đang vẽ) */
  private setOutfit(r: EntityRefs, key: string, outfit: Outfit): void {
    if (r.outfitKey === key) return;
    const first = r.outfitKey === "";
    r.outfitKey = key;
    if (first && key === "prisoner") return; // lần tạo đầu đã vẽ đồ tù
    const tex = sheetTexture(outfit);
    tex.offset.copy(r.tex.offset);
    r.tex.dispose();
    r.tex = tex;
    const m = r.sprite.material as THREE.MeshBasicMaterial;
    m.map = tex;
    m.needsUpdate = true;
  }

  private setLabel(r: EntityRefs, label: string, color: string): void {
    const key = `${label}|${color}`;
    if (!r.lab || r.labelKey === key) return;
    r.labelKey = key;
    const m = r.lab.material as THREE.SpriteMaterial;
    m.map?.dispose();
    m.map = labelTexture(label, color);
    m.needsUpdate = true;
  }

  private sync(v: ClientView): void {
    const wanted = new Set<string>();
    for (const p of v.players) {
      wanted.add(p.id);
      if (!this.refs.has(p.id)) this.addEntity(p.id, prisonerOutfit(playerColor(p.colorIndex), p.colorIndex), p.name, playerColor(p.colorIndex), false, p.id === v.meId ? "#ffffff" : null);
      const r = this.refs.get(p.id)!;
      // trang phục theo bộ đồ đang mặc: tù nhân / cai ngục (giống hệt cai ngục thật) / đồ lót
      const key = p.outfit ?? "under";
      this.setOutfit(r, key, key === "guard" ? OUTFITS.guard : key === "worker" ? OUTFITS.worker : key === "prisoner" ? prisonerOutfit(playerColor(p.colorIndex), p.colorIndex) : underwearOutfit(p.colorIndex));
      this.setLabel(r, p.outfit === "guard" ? "Cai ngục" : p.name, p.outfit === "guard" ? "#93c5fd" : playerColor(p.colorIndex));
    }
    v.guards.forEach((g, i) => {
      wanted.add(g.id);
      if (!this.refs.has(g.id)) this.addEntity(g.id, { ...OUTFITS.guard, skin: i % 3 === 1 ? PALETTE.skinDark : PALETTE.skin }, g.name, "#93c5fd", true, null);
      // cai ngục bị lột bộ đồ khi ngất: chỉ còn đồ lót
      const gr = this.refs.get(g.id)!;
      this.setOutfit(gr, g.outfit ? "guard" : "under", g.outfit ? { ...OUTFITS.guard, skin: i % 3 === 1 ? PALETTE.skinDark : PALETTE.skin } : underwearOutfit(i));
    });
    v.inmates.forEach((n, i) => {
      wanted.add(n.id);
      if (!this.refs.has(n.id)) this.addEntity(n.id, { ...prisonerOutfit(n.color, i + 1), body: PALETTE.amber, bodyDark: PALETTE.rust }, n.name, "#e5e7eb", false, null);
    });
    for (const [id, r] of this.refs)
      if (!wanted.has(id)) {
        this.root.remove(r.group);
        disposeTree(r.group);
        this.refs.delete(id);
      }
  }

  private showHp(r: EntityRefs, hp: number, max: number, down: boolean, always = false): void {
    const show = always || hp < max || down;
    r.hpBg!.visible = show;
    r.hpFill!.visible = show;
    if (!show) return;
    const f = Math.max(0.02, Math.min(1, hp / max));
    r.hpFill!.scale.x = f;
    r.hpFill!.position.x = -(0.86 * (1 - f)) / 2;
  }

  private emit(x: number, y: number, color: string, n: number, speed: number): void {
    const pos = this.particles.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.particles.geometry.getAttribute("color") as THREE.BufferAttribute;
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.pNext++ % PARTICLES;
      pos.setXYZ(i, x + (Math.random() - 0.5) * 0.3, -y + (Math.random() - 0.5) * 0.3, 0);
      const a = Math.random() * Math.PI * 2;
      this.pVel[i * 3] = Math.cos(a) * speed;
      this.pVel[i * 3 + 1] = Math.sin(a) * speed + speed * 0.5;
      this.pLife[i] = 0.4 + Math.random() * 0.4;
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  frame(camera: THREE.Camera, size: { width: number; height: number }, elapsed: number): void {
    const v = this.view;
    if (!v) return;
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    const sample = this.session.sample(now, dt);
    // camera trước tiên: đặt ngay vào nhân vật của mình (không lerp) — lỗi ở phần vẽ khác không làm camera kẹt ở góc
    const mePub = v.players.find((p) => p.id === v.meId);
    const mePose = sample.players.get(v.meId);
    if (mePub && mePose) {
      const lyingMe = mePub.bed && mePub.status === "ACTIVE" ? bedPose(mePub.bed) : null;
      this.camTarget = lyingMe ? { x: lyingMe.x, y: lyingMe.y } : { x: mePose.x, y: mePose.y - SPRITE_LIFT };
    }
    this.updateCamera(camera as THREE.OrthographicCamera, size, dt);
    try {
      this.drawFrame(v, sample, now, dt, elapsed);
    } catch (err) {
      if (!this.frameErrorLogged) {
        this.frameErrorLogged = true;
        console.error("[prison] lỗi khi vẽ khung hình", err);
      }
    }
  }

  /** Vị trí / zoom camera theo cameraMath (zoom nguyên, kẹp biên, căn giữa bản đồ nhỏ) + rung tạm thời */
  private updateCamera(cam: THREE.OrthographicCamera, size: { width: number; height: number }, dt: number): void {
    if (!this.camTarget) return;
    const f = cameraFrame({
      target: this.camTarget,
      viewport: size,
      map: { width: W, height: H },
      zoomSetting: this.zoom,
      baseTilePx: C.camera.baseTilePx,
      zoomStepHeight: C.camera.zoomStepHeight,
      centerOffsetY: C.camera.cameraCenterOffsetY,
    });
    // luôn nhìn thẳng xuống mặt bản đồ (không nghiêng), dù camera được tạo thế nào
    if (cam.rotation.x !== 0 || cam.rotation.y !== 0 || cam.rotation.z !== 0) cam.rotation.set(0, 0, 0);
    if (cam.zoom !== f.zoom) {
      cam.zoom = f.zoom;
      cam.updateProjectionMatrix();
    }
    cam.position.x = f.x;
    cam.position.y = -f.y;
    if (this.shakeAmt > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shakeAmt;
      cam.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 8);
    }
    this.debug = { frame: f, target: this.camTarget, viewport: { ...size } };
  }

  private drawFrame(v: ClientView, sample: ReturnType<PrisonSession["sample"]>, now: number, dt: number, elapsed: number): void {
    // vòi sen luôn xả nước
    for (const it of SHOWERS) if (Math.random() < 0.35) this.emit(it.x + 0.5 + (Math.random() - 0.5) * 0.5, it.y + 0.2, "#7dd3fc", 1, 0.5);
    const meUnder = !!v.players.find((p) => p.id === v.meId)?.underground;
    const setFrame = (r: EntityRefs, facing: number, state: Parameters<typeof frameFor>[0]) => {
      const col = frameFor(state, elapsed);
      const row = directionOf(facing);
      r.tex.offset.set(col / COLS, 1 - (row + 1) / ROWS);
    };
    for (const p of v.players) {
      const r = this.refs.get(p.id);
      const pose = sample.players.get(p.id);
      if (!r || !pose) continue;
      // trốn trong xe: người khác không thấy; bản thân vẫn thấy mình (để biết đang ở đâu)
      r.group.visible = p.status !== "ESCAPED" && (!p.vehicle || p.id === v.meId) && (p.id === v.meId || p.underground === meUnder);
      const moved = Math.hypot(pose.x - r.last.x, pose.y - r.last.y) > 0.002;
      r.last = { x: pose.x, y: pose.y };
      r.group.position.set(pose.x, -pose.y, 2 + (H - pose.y) * 0.001);
      // nằm trên giường: đặt đúng điểm nằm, xoay theo trục giường (đầu về đầu giường), chăn che từ cổ trở xuống
      const lying = p.bed ? bedPose(p.bed) : null;
      if (lying && p.status === "ACTIVE") {
        r.group.position.set(lying.x, -lying.y, 2 + (H - lying.y) * 0.001);
        r.sprite.rotation.z = lying.rot;
        r.sprite.position.set(0, 0, 0.2);
        r.blanket!.visible = true;
        r.shadow!.visible = false;
        setFrame(r, Math.PI / 2, { moving: false, sprinting: false, channel: false, down: false });
      } else {
        r.sprite.rotation.z = 0;
        r.sprite.position.set(0, SPRITE_LIFT, 0.2);
        r.blanket!.visible = false;
        r.shadow!.visible = true;
        setFrame(r, pose.facing, { moving: moved, sprinting: p.sprinting && moved, channel: (!!p.channel && p.channel.kind !== "sleep") || !!p.gym, down: p.status === "KNOCKED_OUT" || p.channel?.kind === "sleep" });
      }
      // máu của mình: luôn hiện trên đầu nhân vật
      if (p.id === v.meId) this.showHp(r, p.health, p.maxHealth, false, p.status !== "ESCAPED");
      const sm = r.sprite.material as THREE.MeshBasicMaterial;
      sm.opacity = p.invulnerable ? (Math.sin(elapsed * 20) > 0 ? 1 : 0.4) : p.connected ? 1 : 0.5;
      // mặc đồng phục cai ngục: tô màu xanh cai ngục (lộ rồi thì xanh xám)
      // mặc đồ cai ngục: vẽ y hệt cai ngục thật (không tô màu khác); bị mất cải trang thì hơi xám
      sm.color.set(p.outfit === "guard" && !p.disguised ? "#c4c9dc" : "#ffffff");
      const rm = r.ring!.material as THREE.MeshBasicMaterial;
      if (p.id !== v.meId) {
        rm.opacity = p.status === "KNOCKED_OUT" ? 0.5 + Math.sin(elapsed * 6) * 0.4 : p.status === "CAPTURED" ? 0.6 : 0;
        rm.color.set(p.status === "CAPTURED" ? "#a855f7" : "#ef4444");
      }
      if (p.channel && p.channel.kind !== "sleep") {
        r.bar!.visible = true;
        const prog = Math.max(0.02, p.channel.progress);
        r.bar!.scale.x = prog;
        r.bar!.position.x = -(1 - prog) / 2;
        if (Math.random() < 0.25) {
          const k = p.channel.kind;
          if (k === "dig") this.emit(pose.x, pose.y + 0.2, PALETTE.rust, 2, 1.4);
          else if (k === "rescue" || k === "openVent" || k === "cameraPanel") this.emit(pose.x + Math.cos(pose.facing) * 0.4, pose.y + Math.sin(pose.facing) * 0.4, PALETTE.gold, 1, 2);
          else if (k === "craft") this.emit(pose.x, pose.y, PALETTE.silver, 1, 0.8);
        }
      } else r.bar!.visible = false;
      const wm = r.weapon!;
      if (p.weapon && p.status === "ACTIVE") {
        wm.visible = true;
        (wm.material as THREE.MeshBasicMaterial).color.set(ITEM_DEFS[p.weapon].color);
        wm.position.set(Math.cos(pose.facing) * 0.42, -Math.sin(pose.facing) * 0.42 + 0.3, 0.35);
        wm.rotation.z = -pose.facing + (p.swinging ? 1.1 : 0.25);
      } else wm.visible = false;
    }
    const night = isNight(v.clock.minuteOfDay);
    const baseRange = C.guard.visionRange * DIFFICULTY_PRESETS[v.meta.difficulty].guardVision * (v.meta.prisonState === "LOCKDOWN" ? 1.25 : 1);
    const half = ((C.guard.visionFovDeg / 2) * Math.PI) / 180;
    let chasingMe = false;
    for (const g of v.guards) {
      const r = this.refs.get(g.id);
      const pose = sample.guards.get(g.id);
      if (!r || !pose) continue;
      // đang ở dưới hầm: không thấy ai trên mặt đất
      r.group.visible = !meUnder;
      const moved = Math.hypot(pose.x - r.last.x, pose.y - r.last.y) > 0.002;
      r.last = { x: pose.x, y: pose.y };
      r.group.position.set(pose.x, -pose.y, 2 + (H - pose.y) * 0.001);
      setFrame(r, pose.facing, { moving: moved, sprinting: g.state === "CHASE" && moved, channel: g.task === "roomSearch" && !moved, down: g.down });
      this.showHp(r, g.health, g.maxHealth, g.down);
      updateFan(r.cone!, pose.x, pose.y, pose.facing, half, baseRange * (night ? C.guard.nightVisionMultiplier + 0.15 : 1));
      r.cone!.visible = !g.down;
      const cm = r.cone!.material as THREE.MeshBasicMaterial;
      cm.color.set(GUARD_COLORS[g.state] ?? "#fde68a");
      cm.opacity = g.state === "CHASE" ? 0.3 : g.state === "PATROL" || g.state === "RETURN" ? 0.13 : 0.24;
      if (g.state === "CHASE" && g.targetPlayerId === v.meId) chasingMe = true;
    }
    for (const n of v.inmates) {
      const r = this.refs.get(n.id);
      const pose = sample.inmates.get(n.id);
      if (!r || !pose) continue;
      // đang ở dưới hầm: không thấy ai trên mặt đất
      r.group.visible = !meUnder;
      const moved = Math.hypot(pose.x - r.last.x, pose.y - r.last.y) > 0.002;
      r.last = { x: pose.x, y: pose.y };
      r.group.position.set(pose.x, -pose.y, 2 + (H - pose.y) * 0.001);
      setFrame(r, pose.facing, { moving: moved, sprinting: false, channel: false, down: n.state === "SLEEP" || n.down });
      this.showHp(r, n.health, n.maxHealth, n.down);
    }
    for (const a of this.arcs) {
      if (a.life <= 0) continue;
      a.life -= dt;
      (a.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (a.life / 0.18) * 0.65);
      if (a.life <= 0) a.mesh.visible = false;
    }
    // camera an ninh
    const camOff = v.meta.camerasOffRemaining > 0;
    const simT = v.time + (now - this.viewAt) / 1000;
    for (const cam of PRISON_MAP.cameras) {
      const m = this.cams.get(cam.id)!;
      const cm = m.material as THREE.MeshBasicMaterial;
      cm.opacity = camOff ? 0 : 0.14;
      if (!camOff) updateFan(m, cam.x, cam.y, cameraAngle(cam, simT), cam.fov / 2, cam.range);
    }
    // báo động
    const alarm = v.meta.prisonState === "LOCKDOWN" || chasingMe;
    (this.alarm.material as THREE.MeshBasicMaterial).opacity = alarm ? 0.06 + Math.max(0, Math.sin(elapsed * 6)) * 0.1 : 0;
    // hạt
    const pos = this.particles.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        pos.setXYZ(i, -999, -999, 0);
        continue;
      }
      this.pVel[i * 3 + 1] -= 4 * dt;
      pos.setXYZ(i, pos.getX(i) + this.pVel[i * 3] * dt, pos.getY(i) + this.pVel[i * 3 + 1] * dt, 0);
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    disposeTree(this.root);
    this.refs.clear();
  }
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat) {
      const map = (mat as THREE.MeshBasicMaterial).map;
      map?.dispose();
      mat.dispose();
    }
  });
}

function Entities({ runtime, view }: { runtime: SceneRuntime; view: ClientView }) {
  useEffect(() => runtime.setView(view), [runtime, view]);
  useEffect(() => () => runtime.dispose(), [runtime]);
  useFrame((state) => runtime.frame(state.camera, state.size, state.clock.elapsedTime));
  return <primitive object={runtime.root} />;
}

/** Khung biên bản đồ (chỉ ở chế độ ?debugCamera=1) */
function MapBounds() {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, H)), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo} position={[W / 2, -H / 2, 4]}>
      <lineBasicMaterial color="#22d3ee" />
    </lineSegments>
  );
}

/** Lớp debug camera: chữ thập ở tâm màn hình + vị trí nhân vật (thế giới & màn hình) + kích thước viewport */
function CameraDebug({ runtime }: { runtime: SceneRuntime }) {
  const [text, setText] = useState("");
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = runtime.debug;
      if (d)
        setText(
          `viewport ${d.viewport.width}×${d.viewport.height} · zoom ${d.frame.zoom}px/ô\n` +
            `nhân vật (thế giới) ${d.target.x.toFixed(2)}, ${d.target.y.toFixed(2)}\n` +
            `nhân vật (màn hình) ${d.frame.screenX.toFixed(1)}, ${d.frame.screenY.toFixed(1)}` +
            `${d.frame.clampedX || d.frame.clampedY ? " · kẹp biên" : ""}`,
        );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-300/70" />
      <div className="absolute left-0 top-1/2 h-px w-full bg-cyan-300/70" />
      <pre className="absolute left-2 top-16 whitespace-pre rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-cyan-200">{text}</pre>
    </div>
  );
}

export default function PrisonScene({ runtime, view, highlight, onPickMachine }: { runtime: SceneRuntime; view: ClientView; highlight: Point | null; onPickMachine?: (machineId: string) => void }) {
  const me = view.players.find((p) => p.id === view.meId);
  const [debug] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugCamera") === "1");
  // mobile: thanh địa chỉ / bàn phím đổi vùng nhìn thấy -> báo canvas đo lại kích thước
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => window.dispatchEvent(new Event("resize"));
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
  return (
    <div className="absolute inset-0" style={{ width: "100dvw", height: "100dvh" }}>
      <Canvas
        orthographic
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        // rotation BẮT BUỘC: không có thì react-three-fiber gọi camera.lookAt(0,0,0) -> camera nghiêng về góc trên-trái bản đồ
        camera={{ position: [me?.x ?? W / 2, -(me?.y ?? H / 2) + SPRITE_LIFT, 50], rotation: [0, 0, 0], zoom: 32, near: 0.1, far: 200 }}
        style={{ background: PALETTE.ink }}
      >
        <MapPlane ventOpen={view.meta.routes.ventOpen} fenceKey={view.meta.routes.fenceGaps.join("|")} />
        <FloorStuff view={view} onPickMachine={onPickMachine} />
        <DigLayer view={view} />
        <Highlight tile={highlight} />
        <Entities runtime={runtime} view={view} />
        <NightOverlay view={view} />
        {debug && <MapBounds />}
      </Canvas>
      {debug && <CameraDebug runtime={runtime} />}
    </div>
  );
}

/** Viền sáng quanh món đồ gần nhất trong bán kính nhặt — không tooltip giữa màn hình */
function NearestFloorGlow({ view }: { view: ClientView }) {
  const me = view.players.find((p) => p.id === view.meId);
  if (!me) return null;
  let best: { x: number; y: number } | null = null;
  let bd = FLOOR.pickupRadiusTiles;
  for (const f of view.meta.floorItems) {
    const d = Math.hypot(f.x - me.x, f.y - me.y);
    if (d <= bd) {
      bd = d;
      best = f;
    }
  }
  if (!best) return null;
  return (
    <mesh position={[best.x, -best.y, 0.59]}>
      <ringGeometry args={[0.22, 0.3, 20]} />
      <meshBasicMaterial color="#fde68a" transparent opacity={0.9} />
    </mesh>
  );
}
