import * as THREE from "three";

/**
 * Texture tạo bằng thủ tục (không tải file): normal map vải nỉ dệt mịn, vân gỗ, da bọc lỗ.
 * Dùng PRNG cố định để ảnh luôn giống nhau.
 */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, THREE.Texture>();

/** Normal map nỉ worsted: sợi dệt chéo rất mịn + nhiễu nhẹ (không lông tuyết) */
export function clothNormalMap(): THREE.Texture {
  const hit = cache.get("cloth");
  if (hit) return hit;
  const S = 256;
  const h = new Float32Array(S * S);
  const rand = prng(7);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // Dệt chéo (twill) chu kỳ 4 px + nhiễu
      const weave = Math.sin(((x + y) * Math.PI) / 2) * 0.5 + Math.sin((x * Math.PI) / 2) * 0.25;
      h[y * S + x] = weave * 0.35 + (rand() - 0.5) * 0.6;
    }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const l = h[y * S + ((x + S - 1) % S)];
      const r = h[y * S + ((x + 1) % S)];
      const u = h[((y + S - 1) % S) * S + x];
      const d = h[((y + 1) % S) * S + x];
      const nx = (l - r) * 0.5;
      const ny = (u - d) * 0.5;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 12);
  tex.needsUpdate = true;
  cache.set("cloth", tex);
  return tex;
}

/** Vân gỗ (albedo) + bản đồ độ nhám: thớ dọc lượn sóng, mắt gỗ */
export function woodTextures(): { map: THREE.Texture; roughness: THREE.Texture } {
  const hit = cache.get("wood");
  if (hit) return { map: hit, roughness: cache.get("woodR")! };
  const W = 1024;
  const H = 256;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const rv = document.createElement("canvas");
  rv.width = W;
  rv.height = H;
  const gr = rv.getContext("2d")!;
  const rand = prng(3);
  const img = g.createImageData(W, H);
  const rimg = gr.createImageData(W, H);
  const knots = Array.from({ length: 4 }, () => [rand() * W, rand() * H, 20 + rand() * 30]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = y / H;
      for (const [kx, ky, kr] of knots) {
        const d = Math.hypot((x - kx) / 3, y - ky);
        v += (kr / (d + kr)) * 0.025 * Math.sin(d * 0.25);
      }
      const ring = Math.sin(v * 120 + Math.sin(x * 0.012) * 3 + Math.sin(x * 0.003) * 6);
      const fine = (rand() - 0.5) * 0.08;
      const t = 0.55 + ring * 0.18 + fine;
      const i = (y * W + x) * 4;
      img.data[i] = 92 * t + 30;
      img.data[i + 1] = 44 * t + 12;
      img.data[i + 2] = 20 * t + 6;
      img.data[i + 3] = 255;
      const r = 120 + ring * 30 + fine * 200;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r;
      rimg.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  gr.putImageData(rimg, 0, 0);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const roughness = new THREE.CanvasTexture(rv);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  cache.set("wood", map);
  cache.set("woodR", roughness);
  return { map, roughness };
}

/** Bóng tiếp xúc tròn đậm ngay chân bi */
export function contactShadowTexture(): THREE.Texture {
  const hit = cache.get("shadow");
  if (hit) return hit;
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.85)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.5)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  cache.set("shadow", tex);
  return tex;
}
