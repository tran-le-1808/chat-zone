"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Segment, TableGeometry } from "../_lib/physics/table";
import { clothNormalMap, woodTextures } from "../_lib/textures";
import { usePool } from "./PoolContext";

/**
 * BÀN BIDA LỖ 3D — dựng trực tiếp từ hình học vật lý (cùng mũi băng, mũi lỗ bo tròn, hố)
 * nên thứ người chơi thấy khớp đúng với thứ engine tính.
 * Kích thước bàn 9 feet: thành rộng 14 cm (tính cả băng), mặt bàn cao 78 cm so với sàn.
 * Toạ độ: physics (x, y) -> three (x, −y) trên mặt XZ; Shape vẽ theo (x, y) rồi xoay −90° quanh X.
 */
export const CUSHION_W = 0.05;
export const RAIL_W = 0.09;
export const CUSHION_H = 0.044;
export const RAIL_TOP = 0.048;
export const FLOOR_Y = -0.78;
export const CLOTH_COLORS = { green: "#1E6B3A", blue: "#1F5FA8" } as const;
/** Khoảng cách mắt bàn tính từ mũi băng */
const DIAMOND_OFFSET = 0.094;

export function outerSize(t: TableGeometry) {
  return { w: t.L + 2 * (CUSHION_W + RAIL_W), h: t.W + 2 * (CUSHION_W + RAIL_W) };
}

const angle = (x: number, y: number) => Math.atan2(y, x);

/** Cung ngắn quanh tâm (cx, cy) từ điểm A tới điểm B */
function shortArc(cx: number, cy: number, A: [number, number], B: [number, number], n = 6): [number, number][] {
  const r = Math.hypot(A[0] - cx, A[1] - cy);
  const a0 = angle(A[0] - cx, A[1] - cy);
  let d = angle(B[0] - cx, B[1] - cy) - a0;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const out: [number, number][] = [];
  for (let i = 1; i < n; i++) out.push([cx + r * Math.cos(a0 + (d * i) / n), cy + r * Math.sin(a0 + (d * i) / n)]);
  return out;
}

/** Đa giác 1 băng: mặt vát -> mũi bo tròn -> mũi băng -> mũi bo tròn -> mặt vát -> mặt sau */
function cushionShape(rail: Segment, t: TableGeometry): THREE.Shape | null {
  const horizontal = Math.abs(rail.ay - rail.by) < 1e-9;
  const ox = horizontal ? 0 : Math.sign(rail.ax);
  const oy = horizontal ? Math.sign(rail.ay) : 0;
  const jaws = t.segments.filter((s) => s.kind === "jaw");
  const near = (x: number, y: number) => {
    let best: { j: Segment; nose: (typeof t.noses)[number] } | null = null;
    let bd = 0.02;
    for (const j of jaws) {
      const d = Math.hypot(j.ax - x, j.ay - y);
      if (d < bd) {
        const nose = t.noses.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a));
        best = { j, nose };
        bd = d;
      }
    }
    return best;
  };
  const A = near(rail.ax, rail.ay);
  const B = near(rail.bx, rail.by);
  if (!A || !B) return null;
  const back = (horizontal ? Math.abs(rail.ay) : Math.abs(rail.ax)) + CUSHION_W;
  const toBack = (x: number, y: number): [number, number] => {
    const d = back - (x * ox + y * oy);
    return [x + ox * d, y + oy * d];
  };
  const pts: [number, number][] = [
    [A.j.bx, A.j.by],
    [A.j.ax, A.j.ay],
    ...shortArc(A.nose.x, A.nose.y, [A.j.ax, A.j.ay], [rail.ax, rail.ay]),
    [rail.ax, rail.ay],
    [rail.bx, rail.by],
    ...shortArc(B.nose.x, B.nose.y, [rail.bx, rail.by], [B.j.ax, B.j.ay]),
    [B.j.ax, B.j.ay],
    [B.j.bx, B.j.by],
    toBack(B.j.bx, B.j.by),
    toBack(A.j.bx, A.j.by),
  ];
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  return s;
}

/** Cung từ góc a0 tới a1 đi qua góc `via` */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, via: number, n = 16): [number, number][] {
  const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  let d = norm(a1 - a0);
  const dv = norm(via - a0);
  if (Math.sign(dv) !== Math.sign(d) || Math.abs(dv) > Math.abs(d)) d = d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (d * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

/** Mép trong thành gỗ: chữ nhật bị khoét bởi 6 lỗ (bán kính khoét = thành sau lỗ) */
function railInnerPath(t: TableGeometry): [number, number][] {
  const IX = t.L / 2 + CUSHION_W;
  const IY = t.W / 2 + CUSHION_W;
  const pk = t.pockets;
  const cornerArc = (p: (typeof pk)[number], fromEdge: "h" | "v") => {
    const r = p.backR;
    const sx = Math.sign(p.axisX);
    const sy = Math.sign(p.axisY);
    const hx = p.x - sx * Math.sqrt(Math.max(0, r ** 2 - (sy * IY - p.y) ** 2));
    const vy = p.y - sy * Math.sqrt(Math.max(0, r ** 2 - (sx * IX - p.x) ** 2));
    const aH = Math.atan2(sy * IY - p.y, hx - p.x);
    const aV = Math.atan2(vy - p.y, sx * IX - p.x);
    const via = Math.atan2(sy, sx);
    return fromEdge === "h" ? arc(p.x, p.y, r, aH, aV, via) : arc(p.x, p.y, r, aV, aH, via);
  };
  const sideArc = (p: (typeof pk)[number], dir: 1 | -1) => {
    const r = p.backR;
    const sy = Math.sign(p.axisY);
    const dx = Math.sqrt(Math.max(0, r ** 2 - (sy * IY - p.y) ** 2));
    return arc(p.x, p.y, r, Math.atan2(sy * IY - p.y, -dir * dx), Math.atan2(sy * IY - p.y, dir * dx), Math.atan2(sy, 0));
  };
  return [
    ...cornerArc(pk[3], "v"),
    ...sideArc(pk[4], 1),
    ...cornerArc(pk[5], "h"),
    ...cornerArc(pk[2], "v"),
    ...sideArc(pk[1], -1),
    ...cornerArc(pk[0], "h"),
  ];
}

/** Lớp debug: đường mũi băng, điểm mũi lỗ, mũi bo tròn, hố rơi, thành sau lỗ */
function PocketDebug({ t }: { t: TableGeometry }) {
  const y = CUSHION_H + 0.002;
  const v = (x: number, yy: number) => new THREE.Vector3(x, y, -yy);
  const circle = (cx: number, cy: number, r: number, n = 40) =>
    Array.from({ length: n + 1 }, (_, i) => v(cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)));
  return (
    <group>
      {t.segments.map((s, i) => (
        <Line key={`s${i}`} points={[v(s.ax, s.ay), v(s.bx, s.by)]} color={s.kind === "rail" ? "#22d3ee" : "#f472b6"} lineWidth={2} />
      ))}
      {t.noses.map((n, i) => (
        <Line key={`n${i}`} points={circle(n.x, n.y, n.r, 16)} color="#facc15" lineWidth={1.5} />
      ))}
      {t.pockets.map((p) => (
        <group key={p.id}>
          <Line points={circle(p.x, p.y, p.r)} color="#ef4444" lineWidth={2} />
          <Line points={circle(p.x, p.y, p.backR)} color="#a855f7" lineWidth={1} dashed dashSize={0.01} gapSize={0.008} />
          <Line points={[v(...p.tips[0]), v(...p.tips[1])]} color="#ffffff" lineWidth={1} dashed dashSize={0.006} gapSize={0.004} />
          {p.tips.map(([x, yy], i) => (
            <mesh key={i} position={[x, y, -yy]}>
              <sphereGeometry args={[0.004, 10, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function PoolTable3D() {
  const { table: t, prefs } = usePool();
  const clothColor = CLOTH_COLORS[prefs.cloth];
  const { cushions, rail, diamonds, outer } = useMemo(() => {
    const cushions = t.segments
      .filter((s) => s.kind === "rail")
      .map((r) => cushionShape(r, t))
      .filter((s): s is THREE.Shape => !!s)
      .map((s) => new THREE.ExtrudeGeometry(s, { depth: CUSHION_H, bevelEnabled: false, curveSegments: 6 }));

    const o = outerSize(t);
    const shape = new THREE.Shape();
    shape.moveTo(-o.w / 2, -o.h / 2);
    shape.lineTo(o.w / 2, -o.h / 2);
    shape.lineTo(o.w / 2, o.h / 2);
    shape.lineTo(-o.w / 2, o.h / 2);
    shape.closePath();
    const inner = railInnerPath(t);
    const hole = new THREE.Path();
    hole.moveTo(inner[0][0], inner[0][1]);
    for (const p of inner.slice(1)) hole.lineTo(p[0], p[1]);
    hole.closePath();
    shape.holes.push(hole);
    const rail = new THREE.ExtrudeGeometry(shape, {
      depth: RAIL_TOP,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 3,
      curveSegments: 12,
    });
    // UV theo toạ độ để vân gỗ chạy dọc thành
    const uv = rail.attributes.uv as THREE.BufferAttribute;
    const pos = rail.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 0.5 + pos.getZ(i) * 2, pos.getY(i) * 2);

    // 18 mắt bàn: 3 trên mỗi đoạn băng giữa 2 lỗ, cách đều L/8 = 31.75 cm
    const diamonds: [number, number][] = [];
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const x = -t.L / 2 + (t.L * i) / 8;
      diamonds.push([x, t.W / 2 + DIAMOND_OFFSET], [x, -t.W / 2 - DIAMOND_OFFSET]);
    }
    for (let i = 1; i < 4; i++) {
      const y = -t.W / 2 + (t.W * i) / 4;
      diamonds.push([t.L / 2 + DIAMOND_OFFSET, y], [-t.L / 2 - DIAMOND_OFFSET, y]);
    }
    return { cushions, rail, diamonds, outer: o };
  }, [t]);

  const clothMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: clothColor,
        roughness: 0.95,
        sheen: 0.45,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(clothColor).lerp(new THREE.Color("#ffffff"), 0.12),
        normalMap: clothNormalMap(),
        normalScale: new THREE.Vector2(0.35, 0.35),
      }),
    [clothColor],
  );
  const woodMat = useMemo(() => {
    const { map, roughness } = woodTextures();
    return new THREE.MeshPhysicalMaterial({ map, roughnessMap: roughness, roughness: 0.55, clearcoat: 1, clearcoatRoughness: 0.12 });
  }, []);

  return (
    <group>
      {/* Mặt nỉ (tới mép trong thành gỗ) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={clothMat}>
        <planeGeometry args={[t.L + 2 * CUSHION_W, t.W + 2 * CUSHION_W]} />
      </mesh>
      {/* Chấm foot spot, center spot, head spot (không vẽ vạch head string trừ khi đặt bi trong tay) */}
      {[t.footSpot, { x: 0, y: 0 }, t.headSpot].map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.0004, -s.y]}>
          <circleGeometry args={[0.005, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
        </mesh>
      ))}

      {/* Hố rơi: đặt ở cuối thềm (không phải ở mép gỗ) */}
      {t.pockets.map((p) => (
        <group key={p.id}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.0006, -p.y]}>
            <circleGeometry args={[p.r, 48]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
          {/* Lòng lỗ tối + thành da phía sau */}
          <mesh position={[p.x, -0.05, -p.y]}>
            <cylinderGeometry args={[p.r, p.r * 0.85, 0.1, 40, 1, true]} />
            <meshStandardMaterial color="#060606" side={THREE.BackSide} roughness={1} />
          </mesh>
          <mesh position={[p.x, RAIL_TOP / 2, -p.y]}>
            <cylinderGeometry args={[p.backR, p.backR, RAIL_TOP + 0.002, 48, 1, true]} />
            <meshPhysicalMaterial color="#1a120c" roughness={0.55} clearcoat={0.3} side={THREE.BackSide} />
          </mesh>
          {/* Viền da bọc miệng lỗ trên mặt thành */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.x, RAIL_TOP + 0.0055, -p.y]}>
            <ringGeometry args={[p.backR, p.backR + 0.006, 48]} />
            <meshPhysicalMaterial color="#20150e" roughness={0.5} clearcoat={0.4} />
          </mesh>
        </group>
      ))}

      {/* Băng cao su K-66 bọc nỉ (mũi băng cao 36.3 mm) */}
      {cushions.map((g, i) => (
        <mesh key={i} geometry={g} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow material={clothMat} />
      ))}

      {/* Thành gỗ sơn bóng */}
      <mesh geometry={rail} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow material={woodMat} />
      {/* Mắt bàn khảm xà cừ */}
      {diamonds.map(([x, y], i) => (
        <mesh key={i} position={[x, RAIL_TOP + 0.0052, -y]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[0.012, 0.012]} />
          <meshPhysicalMaterial color="#f4efe4" roughness={0.15} iridescence={1} iridescenceIOR={1.6} clearcoat={1} />
        </mesh>
      ))}

      {/* Thân bàn, chân bàn */}
      <mesh position={[0, -0.042, 0]} receiveShadow castShadow material={woodMat}>
        <boxGeometry args={[outer.w, 0.08, outer.h]} />
      </mesh>
      <mesh position={[0, -0.22, 0]} castShadow>
        <boxGeometry args={[outer.w - 0.12, 0.26, outer.h - 0.12]} />
        <meshStandardMaterial color="#2a1307" roughness={0.6} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={`${sx}${sy}`} position={[sx * (outer.w / 2 - 0.2), (FLOOR_Y - 0.35) / 2, sy * (outer.h / 2 - 0.15)]} castShadow>
            <boxGeometry args={[0.16, -FLOOR_Y - 0.35, 0.16]} />
            <meshStandardMaterial color="#2a1307" roughness={0.6} />
          </mesh>
        )),
      )}
      {prefs.debugPockets && <PocketDebug t={t} />}
    </group>
  );
}
