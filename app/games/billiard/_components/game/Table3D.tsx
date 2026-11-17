"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { diamondLayout, type CaromTableConfig } from "../../_lib/physics";
import { buildCushionPositions } from "../../_lib/tableMesh";

/**
 * BÀN BIDA CAROM 3D (không lỗ) — mọi kích thước lấy từ cấu hình trung tâm `physics/table.ts` (đơn vị mét).
 * Toạ độ: physics (x, y) -> three (x, −y) trên mặt phẳng XZ, trục Y hướng lên, mặt vải ở Y = 0.
 *
 * Hình hiển thị và va chạm tách riêng: vật lý chỉ dùng mặt thi đấu + bán kính bi + độ cao mũi băng;
 * hình băng (profile cao su) được dựng sao cho MŨI BĂNG nằm đúng mép thi đấu ở độ cao mũi băng.
 */
export const CLOTH_COLOR = "#1d6b45";
const CUSHION_COLOR = "#175a3a";
const WOOD_COLOR = "#4a230d";

/** Vải có vân nhẹ, lặp theo mét (không bị kéo giãn khi đổi kích thước bàn) */
function makeClothTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const n = 232 + Math.floor(rnd() * 23);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const CLOTH_TILE_M = 0.2;

/** Khung gỗ: hình vành chữ nhật bo góc ngoài, mép trong áp sát lưng băng */
function railShape(cfg: CaromTableConfig): THREE.Shape {
  const ol = cfg.outerDimensions.length / 2;
  const ow = cfg.outerDimensions.width / 2;
  const r = Math.min(cfg.frame.cornerRadius, ol, ow);
  const s = new THREE.Shape();
  s.moveTo(-ol + r, -ow);
  s.lineTo(ol - r, -ow);
  s.absarc(ol - r, -ow + r, r, -Math.PI / 2, 0, false);
  s.lineTo(ol, ow - r);
  s.absarc(ol - r, ow - r, r, 0, Math.PI / 2, false);
  s.lineTo(-ol + r, ow);
  s.absarc(-ol + r, ow - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-ol, -ow + r);
  s.absarc(-ol + r, -ow + r, r, Math.PI, Math.PI * 1.5, false);
  const il = cfg.playingSurface.length / 2 + cfg.cushion.width;
  const iw = cfg.playingSurface.width / 2 + cfg.cushion.width;
  const hole = new THREE.Path();
  hole.moveTo(-il, -iw);
  hole.lineTo(-il, iw);
  hole.lineTo(il, iw);
  hole.lineTo(il, -iw);
  hole.lineTo(-il, -iw);
  s.holes.push(hole);
  return s;
}

export default function Table3D({ config: cfg }: { config: CaromTableConfig }) {
  const L = cfg.playingSurface.length;
  const W = cfg.playingSurface.width;
  const cw = cfg.cushion.width;
  const top = cfg.cushion.height;
  const slate = cfg.slate.thickness;
  const apronBottom = -slate - cfg.frame.apronDepth;
  const floorY = -cfg.surfaceHeight;

  const cushionGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(buildCushionPositions(cfg), 3));
    g.computeVertexNormals();
    return g;
  }, [cfg]);
  const railGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(railShape(cfg), { depth: top - apronBottom, bevelEnabled: false, curveSegments: 6 });
    // shape nằm trên mặt XY, đùn theo +Z -> xoay để đùn theo +Y (mặt trên ở độ cao mặt băng)
    g.rotateX(-Math.PI / 2);
    g.translate(0, apronBottom, 0);
    return g;
  }, [cfg, top, apronBottom]);
  const clothTex = useMemo(() => {
    const t = makeClothTexture();
    t?.repeat.set((L + 2 * cw) / CLOTH_TILE_M, (W + 2 * cw) / CLOTH_TILE_M);
    return t;
  }, [L, W, cw]);
  useEffect(
    () => () => {
      cushionGeo.dispose();
      railGeo.dispose();
      clothTex?.dispose();
    },
    [cushionGeo, railGeo, clothTex],
  );

  const diamonds = useMemo(() => diamondLayout(cfg), [cfg]);
  const legs = useMemo(() => {
    const ix = cfg.outerDimensions.length / 2 - cfg.frame.legSize;
    const iz = cfg.outerDimensions.width / 2 - cfg.frame.legSize;
    const xs = cfg.frame.legCount === 6 ? [-ix, 0, ix] : [-ix, ix];
    return xs.flatMap((x) => [
      [x, iz],
      [x, -iz],
    ]);
  }, [cfg]);
  const legHeight = apronBottom - floorY;

  return (
    <group>
      {/* Mặt vải: phủ kín mặt thi đấu (và phần dưới băng), mặt trên đúng Y = 0 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[L + 2 * cw, W + 2 * cw]} />
        <meshStandardMaterial color={CLOTH_COLOR} map={clothTex} roughness={0.92} metalness={0} />
      </mesh>

      {/* Mặt đá (slate) ngay dưới vải, cùng tâm với bàn */}
      <mesh position={[0, -slate / 2 - 0.0005, 0]} receiveShadow>
        <boxGeometry args={[L + 2 * cw - 0.002, slate - 0.001, W + 2 * cw - 0.002]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.8} />
      </mesh>

      {/* Băng cao su bọc vải — một khối liền quanh bàn, mũi băng đúng mép thi đấu */}
      <mesh geometry={cushionGeo} castShadow receiveShadow>
        <meshStandardMaterial color={CUSHION_COLOR} roughness={0.75} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Khung gỗ: mặt trên ngang mặt băng, yếm bàn che mặt đá */}
      <mesh geometry={railGeo} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.42} metalness={0.06} />
      </mesh>

      {/* Kim cương khảm trên khung (tính theo mặt thi đấu) */}
      {diamonds.map((d, i) => (
        <mesh key={i} position={[d.x, top + 0.0008, -d.y]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[cfg.diamonds.size, cfg.diamonds.size]} />
          <meshStandardMaterial color="#f3ead7" roughness={0.25} metalness={0.1} />
        </mesh>
      ))}

      {/* Thân dưới mặt đá */}
      <mesh position={[0, (apronBottom - slate) / 2, 0]}>
        <boxGeometry args={[L + 2 * cw - 0.004, Math.max(0.01, -apronBottom - slate - 0.002), W + 2 * cw - 0.004]} />
        <meshStandardMaterial color="#2a1408" roughness={0.7} />
      </mesh>

      {/* Chân bàn */}
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, apronBottom - legHeight / 2, z]} castShadow>
          <boxGeometry args={[cfg.frame.legSize, legHeight, cfg.frame.legSize]} />
          <meshStandardMaterial color={WOOD_COLOR} roughness={0.5} />
        </mesh>
      ))}

      {/* Sàn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#20232f" roughness={1} />
      </mesh>
    </group>
  );
}
