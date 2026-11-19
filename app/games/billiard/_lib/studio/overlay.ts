/**
 * LỚP CHÚ THÍCH vẽ lên video (Canvas 2D) — tách khỏi physics. Mọi điểm đều lấy từ quỹ đạo / sự kiện mô phỏng
 * và chiếu qua CAMERA CỦA CHÍNH KHUNG HÌNH ĐANG RENDER (nên bám đúng bi khi camera di chuyển / đổi kích thước).
 * Dự kiến (nét đứt) và thực tế (nét liền) phân biệt rõ; không ép đường thực tế khớp đường dự kiến.
 */
import { BALL_VI } from "./narration";
import { pathUntil, type DirectorFrame } from "./director";
import type { VideoMode } from "./sequence";
import type { ContactMark, NarrationSegment, ShotAnalysis } from "./types";
import type { ShotCommand } from "../physics";

export type Projector = (x: number, y: number) => { x: number; y: number } | null;

export const PATH_COLORS = ["#f8fafc", "#facc15", "#ef4444"] as const;

export interface OverlayInput {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  project: Projector;
  frame: DirectorFrame;
  predicted: ShotAnalysis;
  actual: ShotAnalysis;
  shot: ShotCommand;
  mode: VideoMode;
  annotate: boolean;
  captions: boolean;
  caption: NarrationSegment | null;
  title: string;
  subtitle: string;
  difficulty: string;
  tags: string[];
  /** Nhãn kỹ thuật đã xác minh (FOLLOW, DRAW, LEFT ENGLISH…) */
  techniqueLabels: string[];
  mismatch: string | null;
}

const DIFF_VI: Record<string, string> = { BEGINNER: "Cơ bản", INTERMEDIATE: "Trung bình", ADVANCED: "Nâng cao", EXPERT: "Chuyên gia" };

function polyline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function arrowHead(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, size: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - size * Math.cos(ang - 0.45), b.y - size * Math.sin(ang - 0.45));
  ctx.lineTo(b.x - size * Math.cos(ang + 0.45), b.y - size * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
}

function projectPath(project: Projector, pts: [number, number][]) {
  return pts.map(([x, y]) => project(x, y)).filter((p): p is { x: number; y: number } => !!p);
}

/** Vẽ đường bi (dự kiến: nét đứt, mờ; thực tế: nét liền) kèm mũi tên hướng mỗi ~0,5 m */
function drawPaths(o: OverlayInput, a: ShotAnalysis, upTo: number, style: "pred" | "actual", alpha: number, s: number) {
  const { ctx } = o;
  for (let id = 0; id < 3; id++) {
    const pts = projectPath(o.project, pathUntil(a, id, upTo));
    if (pts.length < 2) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = PATH_COLORS[id];
    ctx.fillStyle = PATH_COLORS[id];
    ctx.lineWidth = (style === "actual" ? 3 : 2) * s;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (style === "pred") ctx.setLineDash([8 * s, 7 * s]);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4 * s;
    polyline(ctx, pts);
    ctx.setLineDash([]);
    // mũi tên hướng
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc > 90 * s) {
        acc = 0;
        arrowHead(ctx, pts[i - 1], pts[i], 9 * s);
      }
    }
    ctx.restore();
  }
}

function label(o: OverlayInput, text: string, at: { x: number; y: number }, color: string, alpha: number, s: number) {
  const { ctx, W, H } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${Math.round(13 * s)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  const w = ctx.measureText(text).width + 14 * s;
  const h = 22 * s;
  // đặt nhãn phía trên-phải điểm chạm; gần mép thì lật vào trong (không che bi)
  let x = at.x + 14 * s;
  let y = at.y - 30 * s;
  if (x + w > W - 8) x = at.x - w - 14 * s;
  if (y < 8) y = at.y + 14 * s;
  x = Math.max(8, Math.min(W - 8 - w, x));
  y = Math.max(8, Math.min(H - 8 - h, y));
  ctx.fillStyle = "rgba(10,12,22,0.82)";
  roundRect(ctx, x, y, w, h, 6 * s);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 7 * s, y + h / 2 + 0.5);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function marker(o: OverlayInput, c: ContactMark, age: number, s: number) {
  const p = o.project(c.at.x, c.at.y);
  if (!p) return;
  const { ctx } = o;
  const pulse = age < 0.6 ? 1 + (0.6 - age) * 1.2 : 1;
  ctx.save();
  ctx.lineWidth = 2 * s;
  if (c.kind === "ball") {
    ctx.strokeStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13 * s * pulse, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#a78bfa";
    const r = 9 * s * pulse;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x + r, p.y);
    ctx.lineTo(p.x, p.y + r);
    ctx.lineTo(p.x - r, p.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function contactText(c: ContactMark, cue: number, firstDone: boolean): string | null {
  if (c.ball !== cue) return null;
  if (c.kind === "ball") return firstDone ? `2ND CONTACT · ${BALL_VI[c.other ?? 1].toUpperCase()}` : `1ST CONTACT · ${BALL_VI[c.other ?? 1].toUpperCase()}`;
  return c.cushionIndex ? `CUSHION ${c.cushionIndex}` : null;
}

/** Điểm chạm & nhãn tới thời điểm physics `pt`; nhãn chỉ hiện ~2,4 s (tối đa 3 cái cùng lúc) */
function drawContacts(o: OverlayInput, a: ShotAnalysis, pt: number, rate: number, s: number, withLabels: boolean) {
  const cue = o.shot.cue;
  let firstDone = false;
  const visible: { c: ContactMark; text: string | null; age: number }[] = [];
  for (const c of a.contacts) {
    if (c.t > pt) break;
    const text = contactText(c, cue, firstDone);
    if (c.kind === "ball" && c.ball === cue) firstDone = true;
    if (c.ball !== cue && c.kind === "cushion") continue;
    visible.push({ c, text, age: (pt - c.t) / rate });
  }
  for (const v of visible) marker(o, v.c, v.age, s);
  if (!withLabels) return;
  const recent = visible.filter((v) => v.text && v.age < 2.4).slice(-3);
  for (const v of recent) {
    const p = o.project(v.c.at.x, v.c.at.y);
    if (!p) continue;
    const alpha = v.age < 0.2 ? v.age / 0.2 : v.age > 1.9 ? Math.max(0, (2.4 - v.age) / 0.5) : 1;
    label(o, v.text!, p, v.c.kind === "ball" ? "#22d3ee" : "#a78bfa", alpha, s);
  }
}

function drawFinal(o: OverlayInput, a: ShotAnalysis, s: number) {
  a.final.forEach(([x, y], id) => {
    const p = o.project(x, y);
    if (!p) return;
    o.ctx.save();
    o.ctx.strokeStyle = PATH_COLORS[id];
    o.ctx.lineWidth = 2 * s;
    o.ctx.setLineDash([4 * s, 4 * s]);
    o.ctx.beginPath();
    o.ctx.arc(p.x, p.y, 16 * s, 0, Math.PI * 2);
    o.ctx.stroke();
    o.ctx.restore();
  });
  const p = o.project(a.final[o.shot.cue][0], a.final[o.shot.cue][1]);
  if (p) label(o, "FINAL POSITION", p, "#f8fafc", 1, s);
}

function chips(o: OverlayInput, items: string[], x: number, y: number, s: number) {
  const { ctx } = o;
  ctx.save();
  ctx.font = `800 ${Math.round(12 * s)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  let cx = x;
  for (const t of items) {
    const w = ctx.measureText(t).width + 16 * s;
    if (cx + w > o.W - 12) break;
    ctx.fillStyle = "rgba(255,209,102,0.92)";
    roundRect(ctx, cx, y, w, 22 * s, 11 * s);
    ctx.fill();
    ctx.fillStyle = "#1a1206";
    ctx.textBaseline = "middle";
    ctx.fillText(t, cx + 8 * s, y + 11 * s + 0.5);
    cx += w + 6 * s;
  }
  ctx.restore();
}

/** Sơ đồ điểm chạm đầu cơ + thanh lực (góc dưới trái) */
function tipDiagram(o: OverlayInput, s: number) {
  const { ctx, shot } = o;
  const r = 30 * s;
  const cx = 16 * s + r;
  const cy = o.H - 16 * s - r - (o.captions ? 56 * s : 0);
  ctx.save();
  ctx.fillStyle = "rgba(10,12,22,0.75)";
  roundRect(ctx, cx - r - 8 * s, cy - r - 8 * s, 2 * r + 16 * s + 70 * s, 2 * r + 16 * s, 10 * s);
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.arc(cx + shot.tipX * r * 0.8, cy - shot.tipY * r * 0.8, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  // lực
  const bx = cx + r + 14 * s;
  const bh = 2 * r;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(bx, cy - r, 10 * s, bh);
  ctx.fillStyle = shot.power > 0.75 ? "#ef4444" : shot.power > 0.45 ? "#f59e0b" : "#22c55e";
  ctx.fillRect(bx, cy + r - bh * shot.power, 10 * s, bh * shot.power);
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 ${Math.round(11 * s)}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(shot.power * 100)}%`, bx + 16 * s, cy);
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCaption(o: OverlayInput, s: number) {
  if (!o.captions || !o.caption) return;
  const { ctx } = o;
  ctx.save();
  ctx.font = `700 ${Math.round(20 * s)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  const lines = wrap(ctx, o.caption.text, o.W * 0.86).slice(0, 3);
  const lh = 28 * s;
  const h = lines.length * lh + 14 * s;
  const y = o.H - h - 14 * s;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28 * s;
  ctx.fillStyle = "rgba(0,0,0,0.68)";
  roundRect(ctx, (o.W - w) / 2, y, w, h, 10 * s);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, o.W / 2, y + 7 * s + i * lh));
  ctx.restore();
}

function titleCard(o: OverlayInput, alpha: number, s: number, lines: { big: string; small: string; chips: string[] }) {
  const { ctx, W, H } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(8,10,20,0.85)");
  g.addColorStop(1, "rgba(8,10,20,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.font = `800 ${Math.round(15 * s)}px system-ui, sans-serif`;
  ctx.fillText("AI BILLIARD COACH · LIBRE", W / 2, H * 0.36);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(38 * s)}px system-ui, sans-serif`;
  const big = wrap(ctx, lines.big, W * 0.86);
  big.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.36 + (48 + i * 44) * s));
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `600 ${Math.round(18 * s)}px system-ui, sans-serif`;
  ctx.fillText(lines.small, W / 2, H * 0.36 + (60 + big.length * 44) * s);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${Math.round(12 * s)}px system-ui, sans-serif`;
  const total = lines.chips.reduce((a, t) => a + ctx.measureText(t).width + 22 * s, 0);
  chips(o, lines.chips, Math.max(12, (W - total) / 2), H * 0.36 + (84 + big.length * 44) * s, s);
  ctx.restore();
}

function resultPanel(o: OverlayInput, alpha: number, s: number) {
  const { ctx, actual } = o;
  const scored = actual.verdict.scored;
  const w = Math.min(o.W - 24, 360 * s);
  const x = o.W - w - 14 * s;
  const y = 14 * s;
  const rows = [
    `Kết quả: ${scored ? "GHI ĐIỂM ✓" : "KHÔNG GHI ĐIỂM"}`,
    `Chạm đầu: ${actual.verdict.firstBall !== null ? BALL_VI[actual.verdict.firstBall] : "—"} · ${actual.cutAngleDeg !== null ? `góc cắt ${Math.round(actual.cutAngleDeg)}°` : ""}`,
    `Băng trước bi thứ hai: ${actual.cushionsBeforeSecond} · tổng băng bi trắng: ${actual.cueCushions}`,
    `Khoảng cách TB 3 bi khi dừng: ${actual.finalSpread.toFixed(2)} m`,
  ];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(10,12,22,0.86)";
  roundRect(ctx, x, y, w, (rows.length * 22 + 20) * s, 12 * s);
  ctx.fill();
  ctx.strokeStyle = scored ? "#22c55e" : "#ef4444";
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 ${Math.round(13 * s)}px system-ui, sans-serif`;
  ctx.textBaseline = "top";
  rows.forEach((r, i) => ctx.fillText(r, x + 12 * s, y + (10 + i * 22) * s, w - 24 * s));
  ctx.restore();
}

export function drawOverlay(o: OverlayInput): void {
  const { frame } = o;
  const scene = frame.scene;
  if (!scene) return;
  const s = Math.min(o.W, o.H) / 720;
  const local = frame.t - scene.start;
  const fadeIn = Math.min(1, local / 0.6);
  const pt = frame.physicsT ?? 0;
  const ann = o.annotate && o.mode !== "CLEAN";
  if (ann) {
    switch (scene.id) {
      case "setup":
        o.actual.start.forEach(([x, y], id) => {
          const p = o.project(x, y);
          if (p) label(o, BALL_VI[id as 0 | 1 | 2].toUpperCase(), p, PATH_COLORS[id], fadeIn, s);
        });
        break;
      case "aim":
        drawPaths(o, o.predicted, o.predicted.duration, "pred", 0.9 * fadeIn, s);
        drawContacts(o, o.predicted, o.predicted.duration, 1, s, false);
        chips(o, o.techniqueLabels, 14 * s, 14 * s, s);
        tipDiagram(o, s);
        break;
      case "shot":
        drawPaths(o, o.predicted, o.predicted.duration, "pred", 0.22, s);
        drawPaths(o, o.actual, pt, "actual", 1, s);
        drawContacts(o, o.actual, pt, 1, s, true);
        chips(o, o.techniqueLabels, 14 * s, 14 * s, s);
        break;
      case "replay":
        drawPaths(o, o.actual, pt, "actual", 1, s);
        drawContacts(o, o.actual, pt, scene.playbackRate ?? 0.5, s, true);
        chips(o, [`REPLAY ×${(scene.playbackRate ?? 0.5).toFixed(2)}`, ...o.techniqueLabels], 14 * s, 14 * s, s);
        break;
      case "result":
        drawPaths(o, o.actual, o.actual.duration, "actual", 0.85, s);
        drawContacts(o, o.actual, o.actual.duration, 1, s, false);
        drawFinal(o, o.actual, s);
        resultPanel(o, fadeIn, s);
        break;
      default:
        break;
    }
    if ((scene.id === "shot" || scene.id === "aim") && o.mode !== "CLEAN") legend(o, s, scene.id === "shot");
  }
  if (scene.id === "intro") titleCard(o, scene.end - frame.t < 0.5 ? (scene.end - frame.t) / 0.5 : fadeIn, s, { big: o.title, small: o.subtitle, chips: [DIFF_VI[o.difficulty] ?? o.difficulty, ...o.tags.slice(0, 4)] });
  if (o.mismatch && (scene.id === "result" || scene.id === "shot")) label(o, `⚠ ${o.mismatch}`, { x: 20, y: o.H * 0.5 }, "#ef4444", 1, s);
  drawCaption(o, s);
}

function legend(o: OverlayInput, s: number, both: boolean) {
  const { ctx } = o;
  const x = 14 * s;
  const y = 44 * s;
  ctx.save();
  ctx.font = `700 ${Math.round(11 * s)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(10,12,22,0.7)";
  roundRect(ctx, x, y, 170 * s, (both ? 40 : 22) * s, 8 * s);
  ctx.fill();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 2 * s;
  ctx.setLineDash([6 * s, 5 * s]);
  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y + 11 * s);
  ctx.lineTo(x + 38 * s, y + 11 * s);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "middle";
  ctx.fillText("Đường dự kiến (mô phỏng)", x + 44 * s, y + 11 * s);
  if (both) {
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, y + 29 * s);
    ctx.lineTo(x + 38 * s, y + 29 * s);
    ctx.stroke();
    ctx.fillText("Đường thực tế", x + 44 * s, y + 29 * s);
  }
  ctx.restore();
}

/** Nhãn kỹ thuật chỉ gồm những gì ĐÃ XÁC MINH trong mô phỏng */
export function techniqueLabels(shot: ShotCommand, a: ShotAnalysis): string[] {
  const out: string[] = [];
  if (a.spinEffect === "FOLLOW" && shot.tipY >= 0.3) out.push("FOLLOW");
  if (a.spinEffect === "DRAW" && shot.tipY <= -0.3) out.push("DRAW");
  if (a.spinEffect === "STUN") out.push("STUN");
  if (a.english === "LEFT") out.push("LEFT ENGLISH");
  if (a.english === "RIGHT") out.push("RIGHT ENGLISH");
  if (a.cutAngleDeg !== null) out.push(a.cutAngleDeg <= 12 ? "FULL HIT" : `CUT ${Math.round(a.cutAngleDeg)}°`);
  if (a.cushionsBeforeSecond > 0) out.push(`${a.cushionsBeforeSecond} CUSHION${a.cushionsBeforeSecond > 1 ? "S" : ""}`);
  return out;
}
