"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { msSound } from "../_lib/sound";

/** Nút bật / tắt tiếng (lưu trên trình duyệt) */
export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(() => msSound.muted);
  return (
    <button
      type="button"
      title={muted ? "Bật tiếng" : "Tắt tiếng"}
      aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
      onClick={() => {
        msSound.setMuted(!muted);
        setMuted(!muted);
        if (muted) {
          msSound.unlock();
          msSound.play("select");
        }
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[#f4e7bf]/40 bg-white/5 text-[#f4e7bf] hover:bg-white/10 ${className}`}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
