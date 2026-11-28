"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { vdSound } from "../_lib/sound";

/** Nút bật / tắt tiếng (lưu trên trình duyệt) */
export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(() => vdSound.muted);
  return (
    <button
      type="button"
      title={muted ? "Bật tiếng" : "Tắt tiếng"}
      aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
      onClick={() => {
        vdSound.setMuted(!muted);
        setMuted(!muted);
        if (muted) {
          vdSound.unlock();
          vdSound.play("pop");
        }
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/15 text-white hover:bg-white/25 ${className}`}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
