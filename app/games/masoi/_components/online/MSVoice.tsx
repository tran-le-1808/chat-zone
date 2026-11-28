"use client";

/** Nút voice trong bàn Ma Sói: bật / tắt mic / rời voice + nhãn kênh đang nghe theo luật (đêm chỉ Sói…) */
import { Mic, MicOff, Moon, PhoneOff, Volume2 } from "lucide-react";
import { useOptionalVoice } from "../../../monopoly/_context/VoiceContext";

export default function MSVoiceControls() {
  const voice = useOptionalVoice();
  if (!voice?.supported) return null;
  const { enabled, connecting, muted, users, audioBlocked, gate, join, leave, toggleMute, resumeAudio } = voice;
  const count = Object.keys(users).length;
  const btn = "flex h-9 items-center justify-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition";
  if (!enabled)
    return (
      <button type="button" disabled={connecting} onClick={() => void join()} title="Nói chuyện bằng giọng nói" className={`${btn} border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60`}>
        <Mic className="h-4 w-4" />
        <span className="hidden sm:inline">{connecting ? "Đang bật…" : "Voice"}</span>
        {count > 0 && <span className="rounded-full bg-emerald-500/30 px-1.5 text-[10px]">{count}</span>}
      </button>
    );
  const asleep = gate ? !gate.mic : false;
  return (
    <div className="flex items-center gap-1">
      {audioBlocked && (
        <button type="button" onClick={resumeAudio} className={`${btn} border-amber-300/60 bg-amber-400/20 text-amber-100`}>
          <Volume2 className="h-4 w-4" /> Bấm để nghe
        </button>
      )}
      {gate && (
        <span title={gate.label} className="hidden max-w-[180px] truncate rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/80 md:inline">
          {gate.label}
        </span>
      )}
      <button
        type="button"
        onClick={toggleMute}
        title={asleep ? gate?.label : muted ? "Bật mic" : "Tắt mic"}
        aria-label={muted ? "Bật mic" : "Tắt mic"}
        className={`${btn} w-9 px-0 ${asleep ? "border-white/20 bg-white/5 text-white/50" : muted ? "border-rose-400/60 bg-rose-500/20 text-rose-200" : "border-emerald-400/60 bg-emerald-500/25 text-emerald-100"}`}
      >
        {asleep ? <Moon className="h-4 w-4" /> : muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <button type="button" onClick={leave} title="Rời voice" aria-label="Rời voice" className={`${btn} w-9 border-white/20 bg-white/10 px-0 text-white/80 hover:bg-rose-500/25`}>
        <PhoneOff className="h-4 w-4" />
      </button>
    </div>
  );
}
