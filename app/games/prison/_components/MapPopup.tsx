"use client";

/** Popup bản đồ (phím M): toàn bộ nhà tù thu nhỏ + tên từng khu, chấm vị trí người chơi nhấp nháy, tô khu đang đứng.
 *  Không vẽ cai ngục / camera (tránh lộ thông tin). */
import { useMemo } from "react";
import { PRISON_MAP, zoneAt } from "../_lib/engine/map";
import { playerColor, type ClientView } from "../_lib/session/types";
import { drawMinimap } from "./mapTexture";
import { SCALE, zoneLabels } from "./mapLabels";

export default function MapPopup({ view, onClose }: { view: ClientView; onClose: () => void }) {
  const base = useMemo(() => (typeof document === "undefined" ? null : drawMinimap(SCALE).toDataURL()), []);
  const labels = useMemo(() => zoneLabels(), []);
  const me = view.players.find((p) => p.id === view.meId);
  const here = me ? zoneAt(PRISON_MAP, me.x, me.y) : null;
  const hereZone = PRISON_MAP.zones.find((z) => z.id === here);
  const W = PRISON_MAP.width * SCALE;
  const H = PRISON_MAP.height * SCALE;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="max-h-full max-w-full overflow-auto rounded-2xl border border-white/10 bg-[#11132a]/95 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between px-1 text-xs font-bold text-slate-300">
          <span>🗺️ {PRISON_MAP.name}</span>
          <span className="text-slate-400">{hereZone ? `Bạn đang ở: ${hereZone.name}` : ""} · M / Esc để đóng</span>
        </div>
        <div className="relative" style={{ width: W, height: H, maxWidth: "92vw" }}>
          {/* ảnh dựng từ canvas (data URL) — next/image không tối ưu được */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {base && <img src={base} alt="Bản đồ nhà tù" width={W} height={H} className="block h-auto w-full [image-rendering:pixelated]" draggable={false} />}
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
            {hereZone?.rects.map((r, i) => (
              <rect key={i} x={r[0] * SCALE} y={r[1] * SCALE} width={(r[2] - r[0] + 1) * SCALE} height={(r[3] - r[1] + 1) * SCALE} fill="rgba(255,209,102,0.22)" stroke="#ffd166" strokeWidth={1.5} />
            ))}
            {labels.map((l) => (
              <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fill={l.restricted ? "#fca5a5" : "#f1f5f9"} stroke="#0b0d16" strokeWidth={2.5} paintOrder="stroke">
                {l.text}
              </text>
            ))}
            {me && me.status !== "ESCAPED" && (
              <circle cx={me.x * SCALE} cy={me.y * SCALE} r={5} fill={playerColor(me.colorIndex)} stroke="#fff" strokeWidth={1.5}>
                <animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
