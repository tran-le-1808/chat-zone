"use client";

import { setShotSettings, useShotSettings } from "./shotSettings";

const row = "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm";

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`${row} cursor-pointer`}>
      <span>
        {label}
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#f4b942]" />
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className={`${row} flex-col items-stretch gap-1`}>
      <span className="flex justify-between">
        {label}
        <b className="tabular-nums text-[#ffd166]">{value.toFixed(1)}×</b>
      </span>
      <input type="range" min={0.5} max={2} step={0.1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#f4b942]" />
    </label>
  );
}

/** Cài đặt điều khiển đánh bi — dùng chung cho Bida Lỗ và Bida Carom */
export default function ShotSettingsFields() {
  const s = useShotSettings();
  return (
    <div className="space-y-2 text-white">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Điều khiển đánh bi</div>
      <div className={row}>
        <span>Tay thuận</span>
        <div className="flex gap-1">
          {(["left", "right"] as const).map((h) => (
            <button key={h} type="button" onClick={() => setShotSettings({ hand: h })} className={`min-h-10 rounded-lg border px-3 text-xs font-bold ${s.hand === h ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/5 text-slate-300"}`}>
              {h === "left" ? "Trái" : "Phải"}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Độ nhạy kéo cơ" value={s.pullSensitivity} onChange={(v) => setShotSettings({ pullSensitivity: v })} />
      <Slider label="Độ nhạy ngắm" value={s.aimSensitivity} onChange={(v) => setShotSettings({ aimSensitivity: v })} />
      <Toggle label="Rung haptic" hint="Rung nhẹ qua mốc 25% lực và khi đánh" value={s.haptics} onChange={(v) => setShotSettings({ haptics: v })} />
      <Toggle label="Tự reset điểm chạm và góc cơ sau mỗi cú" hint="Điểm chạm về tâm, góc cơ về mặc định — tránh quên và đánh nhầm xoáy / jump" value={s.resetAfterShot} onChange={(v) => setShotSettings({ resetAfterShot: v })} />
      <Toggle label="Kéo cơ trên bàn" hint="Chạm đuôi cây cơ rồi kéo lùi ra sau (thay vì thanh bên cạnh)" value={s.pullOnTable} onChange={(v) => setShotSettings({ pullOnTable: v })} />
    </div>
  );
}
