"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { smSound } from "../_lib/sound";

/** Nút bật / tắt tiếng (lưu trên trình duyệt) */
export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(() => smSound.muted);
  return (
    <button
      type="button"
      title={muted ? "Bật tiếng" : "Tắt tiếng"}
      aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
      onClick={() => {
        smSound.setMuted(!muted);
        setMuted(!muted);
        if (muted) {
          smSound.unlock();
          smSound.play("play");
        }
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[#ffd166]/40 bg-white/5 text-[#ffd166] hover:bg-white/10 ${className}`}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
