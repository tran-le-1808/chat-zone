import type React from "react";
import * as THREE from "three";

/** Màu bi chuẩn: 1–7 trơn, 8 đen, 9–15 sọc cùng màu với 1–7 */
export const BALL_BASE: Record<number, string> = {
  0: "#f7f4ea",
  1: "#f2b705",
  2: "#1c4fd8",
  3: "#d42a20",
  4: "#5b2a91",
  5: "#f07116",
  6: "#13804a",
  7: "#7c1d1d",
  8: "#141414",
};

export const ballColor = (n: number) => BALL_BASE[n > 8 ? n - 8 : n] ?? "#ffffff";
export const isStripe = (n: number) => n >= 9 && n <= 15;

/** CSS nền cho "viên bi" trong giao diện HTML (HUD, chọn bi) */
export function ballCss(n: number): React.CSSProperties {
  const c = ballColor(n);
  if (n === 0) return { background: "radial-gradient(circle at 35% 30%, #fff, #e8e4d6 60%, #b9b4a4)" };
  if (isStripe(n))
    return {
      background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 45%), linear-gradient(180deg, #f5f2e8 0 26%, ${c} 26% 74%, #f5f2e8 74%)`,
    };
  return { background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), ${c} 45%, ${c})` };
}

/**
 * Texture equirectangular cho quả cầu: nền (trơn) hoặc dải màu (sọc) + 2 vòng tròn trắng có số.
 * Bi cái có chấm đỏ để nhìn thấy xoáy.
 */
export function makeBallTexture(n: number): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const col = ballColor(n);
  if (n === 0) {
    g.fillStyle = BALL_BASE[0];
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#c81d25";
    for (const [x, y] of [[128, 128], [384, 128], [256, 22], [256, 234], [0, 128], [512, 128]]) {
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
    }
  } else if (isStripe(n)) {
    g.fillStyle = "#f5f2e8";
    g.fillRect(0, 0, W, H);
    g.fillStyle = col;
    g.fillRect(0, H * 0.27, W, H * 0.46);
  } else {
    g.fillStyle = col;
    g.fillRect(0, 0, W, H);
  }
  if (n !== 0) {
    for (const cx of [W * 0.25, W * 0.75]) {
      g.fillStyle = "#fbf8ef";
      g.beginPath();
      g.arc(cx, H / 2, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#151515";
      g.font = `bold ${n > 9 ? 36 : 42}px Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(n), cx, H / 2 + 2);
      if (n === 6 || n === 9) {
        g.fillRect(cx - 10, H / 2 + 22, 20, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
