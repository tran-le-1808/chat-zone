"use client";

/**
 * BẢNG VẼ: canvas 800×600 co giãn theo khung (4:3). Vẽ lại từ danh sách nét (ops);
 * khi được vẽ thì có bút / tẩy / đổ màu / cỡ nét / bảng màu / hoàn tác / xoá bảng.
 */
import { useEffect, useRef, useState } from "react";
import { Eraser, PaintBucket, Pencil, Trash2, Undo2 } from "lucide-react";
import { H, PALETTE, SIZES, W, type DrawOp } from "../_lib/draw";
import { applyOp, clearBoard, renderAll } from "../_lib/render";
import { VD } from "./theme";

type Tool = "pen" | "eraser" | "fill";

export default function DrawBoard({ ops, canDraw, onOps, overlay }: { ops: DrawOp[]; canDraw: boolean; onOps?: (ops: DrawOp[]) => void; overlay?: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendered = useRef<DrawOp[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(1);
  const [size, setSize] = useState(1);
  const stroke = useRef<{ g: number; x: number; y: number } | null>(null);
  const groupRef = useRef(0);
  /** Mã nhóm mới (lớn hơn mọi nhóm đã có — tải lại trang giữa lượt vẫn không trùng) */
  const nextGroup = () => {
    let max = groupRef.current;
    for (const o of ops) if (o.k !== "u" && o.g > max) max = o.g;
    groupRef.current = max + 1;
    return max + 1;
  };

  // vẽ lại: thêm dần nếu chỉ có nét mới, vẽ lại toàn bộ nếu có hoàn tác / danh sách bị thay
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const prev = rendered.current;
    const fresh = ops.length >= prev.length && prev.every((op, i) => ops[i] === op) ? ops.slice(prev.length) : null;
    if (!fresh || fresh.some((o) => o.k === "u")) renderAll(ctx, ops);
    else for (const op of fresh) applyOp(ctx, op);
    rendered.current = ops;
  }, [ops]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (ctx && !rendered.current.length) clearBoard(ctx);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000);
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000);
    return { x: Math.min(1000, Math.max(0, x)), y: Math.min(1000, Math.max(0, y)) };
  };

  const down = (e: React.PointerEvent) => {
    if (!canDraw || !onOps) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const g = nextGroup();
    if (tool === "fill") {
      onOps([{ k: "f", g, c: color, x, y }]);
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    stroke.current = { g, x, y };
    onOps([{ k: "l", g, c: tool === "eraser" ? 0 : color, s: tool === "eraser" ? Math.max(size, 2) : size, p: [x, y] }]);
  };
  const move = (e: React.PointerEvent) => {
    const s = stroke.current;
    if (!s || !onOps) return;
    const { x, y } = pos(e);
    if (Math.abs(x - s.x) + Math.abs(y - s.y) < 4) return;
    onOps([{ k: "l", g: s.g, c: tool === "eraser" ? 0 : color, s: tool === "eraser" ? Math.max(size, 2) : size, p: [s.x, s.y, x, y] }]);
    stroke.current = { ...s, x, y };
  };
  const up = () => {
    stroke.current = null;
  };

  const btn = (on: boolean) => `flex h-10 w-10 items-center justify-center rounded-xl border-2 transition ${on ? "bg-[#1f2a44] text-white" : "bg-white hover:bg-amber-50"}`;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative w-full overflow-hidden rounded-xl bg-white" style={{ aspectRatio: `${W} / ${H}`, border: `3px solid ${VD.ink}`, boxShadow: `4px 4px 0 ${VD.ink}` }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className={`absolute inset-0 h-full w-full ${canDraw ? (tool === "fill" ? "cursor-cell" : "cursor-crosshair") : "cursor-default"}`}
          style={{ touchAction: canDraw ? "none" : "auto" }}
        />
        {overlay}
      </div>
      {canDraw && onOps && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white p-2" style={{ border: `2.5px solid ${VD.ink}` }}>
          <div className="flex gap-1" style={{ borderColor: VD.ink }}>
            <button type="button" title="Bút" aria-label="Bút" className={btn(tool === "pen")} style={{ borderColor: VD.ink }} onClick={() => setTool("pen")}>
              <Pencil className="h-5 w-5" />
            </button>
            <button type="button" title="Tẩy" aria-label="Tẩy" className={btn(tool === "eraser")} style={{ borderColor: VD.ink }} onClick={() => setTool("eraser")}>
              <Eraser className="h-5 w-5" />
            </button>
            <button type="button" title="Đổ màu" aria-label="Đổ màu" className={btn(tool === "fill")} style={{ borderColor: VD.ink }} onClick={() => setTool("fill")}>
              <PaintBucket className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {SIZES.map((s, i) => (
              <button key={s} type="button" title={`Cỡ ${i + 1}`} aria-label={`Cỡ nét ${i + 1}`} className={btn(size === i)} style={{ borderColor: VD.ink }} onClick={() => setSize(i)}>
                <span className="rounded-full" style={{ width: Math.max(4, s / 1.6), height: Math.max(4, s / 1.6), background: size === i ? "#fff" : VD.ink }} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-10 gap-0.5">
            {PALETTE.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`Màu ${c}`}
                onClick={() => {
                  setColor(i);
                  if (tool === "eraser") setTool("pen");
                }}
                className="h-6 w-6 rounded-md transition hover:scale-110 sm:h-7 sm:w-7"
                style={{ background: c, border: color === i ? `3px solid ${VD.ink}` : "1.5px solid rgba(0,0,0,.25)", transform: color === i ? "scale(1.12)" : undefined }}
              />
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <button type="button" title="Hoàn tác" aria-label="Hoàn tác" className={btn(false)} style={{ borderColor: VD.ink }} onClick={() => onOps([{ k: "u" }])}>
              <Undo2 className="h-5 w-5" />
            </button>
            <button type="button" title="Xoá bảng" aria-label="Xoá bảng" className={btn(false)} style={{ borderColor: VD.ink }} onClick={() => onOps([{ k: "x", g: nextGroup() }])}>
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
