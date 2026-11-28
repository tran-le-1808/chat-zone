/** Vẽ các nét lên canvas (trình duyệt). Khung trong 800×600, toạ độ nét 0..1000. */
import { effectiveOps, H, PALETTE, SIZES, W, type DrawOp } from "./draw";

const sx = (v: number) => (v / 1000) * W;
const sy = (v: number) => (v / 1000) * H;

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Đổ màu vùng (BFS theo dòng, chịu sai lệch nhỏ do khử răng cưa) */
export function floodFill(ctx: CanvasRenderingContext2D, x0: number, y0: number, hex: string) {
  const x = Math.min(W - 1, Math.max(0, Math.round(sx(x0))));
  const y = Math.min(H - 1, Math.max(0, Math.round(sy(y0))));
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (i: number) => i * 4;
  const start = at(y * W + x);
  const tr = d[start], tg = d[start + 1], tb = d[start + 2];
  const [fr, fg, fb] = hexRgb(hex);
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 8) return;
  const TOL = 96;
  const match = (p: number) => {
    const i = at(p);
    return Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= TOL;
  };
  const seen = new Uint8Array(W * H);
  const stack = [y * W + x];
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    let px = p % W;
    const py = (p - px) / W;
    while (px > 0 && match(py * W + px - 1) && !seen[py * W + px - 1]) px--;
    let upOpen = false;
    let downOpen = false;
    for (; px < W; px++) {
      const q = py * W + px;
      if (seen[q] || !match(q)) break;
      seen[q] = 1;
      const i = at(q);
      d[i] = fr;
      d[i + 1] = fg;
      d[i + 2] = fb;
      d[i + 3] = 255;
      if (py > 0) {
        const u = q - W;
        const ok = !seen[u] && match(u);
        if (ok && !upOpen) stack.push(u);
        upOpen = ok;
      }
      if (py < H - 1) {
        const dn = q + W;
        const ok = !seen[dn] && match(dn);
        if (ok && !downOpen) stack.push(dn);
        downOpen = ok;
      }
    }
  }
  // tô luôn viền khử răng cưa sát vùng vừa đổ
  for (let yy = 1; yy < H - 1; yy++)
    for (let xx = 1; xx < W - 1; xx++) {
      const q = yy * W + xx;
      if (seen[q]) continue;
      if (seen[q - 1] || seen[q + 1] || seen[q - W] || seen[q + W]) {
        const i = at(q);
        const lum = d[i] + d[i + 1] + d[i + 2];
        if (lum > 200 && Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) < 300) {
          d[i] = Math.round((d[i] + fr) / 2);
          d[i + 1] = Math.round((d[i + 1] + fg) / 2);
          d[i + 2] = Math.round((d[i + 2] + fb) / 2);
        }
      }
    }
  ctx.putImageData(img, 0, 0);
}

export function clearBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
}

export function applyOp(ctx: CanvasRenderingContext2D, op: DrawOp) {
  if (op.k === "x") clearBoard(ctx);
  else if (op.k === "f") floodFill(ctx, op.x, op.y, PALETTE[op.c]);
  else if (op.k === "l") {
    ctx.strokeStyle = PALETTE[op.c];
    ctx.fillStyle = PALETTE[op.c];
    ctx.lineWidth = SIZES[op.s];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const p = op.p;
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(sx(p[0]), sy(p[1]), SIZES[op.s] / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(sx(p[0]), sy(p[1]));
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(sx(p[i]), sy(p[i + 1]));
    ctx.stroke();
  }
}

export function renderAll(ctx: CanvasRenderingContext2D, ops: DrawOp[]) {
  clearBoard(ctx);
  for (const op of effectiveOps(ops)) applyOp(ctx, op);
}
