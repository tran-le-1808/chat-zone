"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { caroSound } from "../_lib/sound";

/** Nút bật / tắt tiếng (lưu trên trình duyệt) */
export default function SoundToggle() {
  const [muted, setMuted] = useState(() => caroSound.muted);
  return (
    <button
      type="button"
      title={muted ? "Bật tiếng" : "Tắt tiếng"}
      aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
      onClick={() => {
        caroSound.setMuted(!muted);
        setMuted(!muted);
        if (muted) {
          caroSound.unlock();
          caroSound.play("place");
        }
      }}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
