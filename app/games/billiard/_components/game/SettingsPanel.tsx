"use client";

import { useOptionalVoice } from "../../../monopoly/_context/VoiceContext";
import { useBilliard } from "../../_context/BilliardGameContext";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-gray-300">{label}</span>
      {children}
    </label>
  );
}

/** Cài đặt trong trận: âm thanh, voice, micro, đường ngắm, camera, debug */
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { prefs, setPrefs } = useBilliard();
  const voice = useOptionalVoice();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Cài đặt"
        className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-[#1d2032] p-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">⚙️ Cài đặt</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg px-2 py-1 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <h3 className="mt-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Âm thanh
        </h3>
        <Row label={`Hiệu ứng (${Math.round(prefs.sfxVolume * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.sfxVolume}
            onChange={(e) => setPrefs({ sfxVolume: Number(e.target.value) })}
            className="w-36 accent-cyan-400"
          />
        </Row>
        {voice && (
          <Row label={`Voice (${Math.round(voice.volume * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voice.volume}
              onChange={(e) => voice.setVolume(Number(e.target.value))}
              className="w-36 accent-cyan-400"
            />
          </Row>
        )}
        {voice?.enabled && voice.devices.length > 0 && (
          <Row label="Micro">
            <select
              value={voice.deviceId ?? ""}
              onChange={(e) => void voice.selectDevice(e.target.value)}
              className="w-40 truncate rounded-lg border border-white/10 bg-[#262a40] px-2 py-1 text-xs"
            >
              {voice.devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Micro ${i + 1}`}
                </option>
              ))}
            </select>
          </Row>
        )}

        <h3 className="mt-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Hiển thị
        </h3>
        <Row label="Góc camera">
          <select
            value={prefs.camera}
            onChange={(e) =>
              setPrefs({ camera: e.target.value as "top" | "angle" })
            }
            className="rounded-lg border border-white/10 bg-[#262a40] px-2 py-1 text-xs"
          >
            <option value="angle">Góc nghiêng</option>
            <option value="top">Nhìn từ trên</option>
          </select>
        </Row>
        <Row label="Debug vật lý (vector v / ω)">
          <input
            type="checkbox"
            checked={prefs.debug}
            onChange={(e) => setPrefs({ debug: e.target.checked })}
            className="h-4 w-4 accent-cyan-400"
          />
        </Row>

        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          Chuột trái / 1 ngón: ngắm · Chuột phải / 2 ngón: xoay camera · Lăn
          chuột / chụm 2 ngón: phóng to. Phím ←/→ ngắm (giữ Shift để chỉnh mịn),
          ↑/↓ lực, Space đánh.
        </p>
      </div>
    </div>
  );
}
