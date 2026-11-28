"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { tlSound } from "../_lib/sound";

/** Nút bật / tắt tiếng (lưu trên trình duyệt) */
export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(() => tlSound.muted);
  return (
    <button
      type="button"
      title={muted ? "Bật tiếng" : "Tắt tiếng"}
      aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
      onClick={() => {
        tlSound.setMuted(!muted);
        setMuted(!muted);
        if (muted) {
          tlSound.unlock();
          tlSound.play("play");
        }
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[#f2c14e]/40 bg-white/5 text-[#f2c14e] hover:bg-white/10 ${className}`}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
