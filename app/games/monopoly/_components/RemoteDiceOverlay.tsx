"use client";

/** Xúc xắc của người khác đang lắc: xoay ở giữa màn hình rồi hiện số nút */
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import SingleDice from "./Dice3D";
import { toyFont } from "./ui/ToyUI";
import { onDiceShow, type DiceShow } from "./board/anim/diceBus";
import { playDiceResult, playDiceRoll } from "./board/anim/stepSound";

export default function RemoteDiceOverlay() {
  const [show, setShow] = useState<DiceShow | null>(null);
  const [done, setDone] = useState(false);
  const endedRef = useRef(0);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = onDiceShow((d) => {
      if (hideRef.current) clearTimeout(hideRef.current);
      endedRef.current = 0;
      setDone(false);
      setShow(d);
      playDiceRoll();
      // Dự phòng: luôn tự ẩn (vd. tab bị ẩn làm dừng hiệu ứng)
      hideRef.current = setTimeout(() => setShow(null), 3200);
    });
    return () => {
      off();
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  const onEnd = () => {
    endedRef.current += 1;
    if (endedRef.current < 2) return;
    setDone(true);
    if (show) playDiceResult(show.d1 === show.d2);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setShow(null), 1000);
  };

  if (!show) return null;
  const total = show.d1 + show.d2;
  return (
    <div
      className={`${toyFont.className} pointer-events-none fixed inset-0 z-50 flex items-center justify-center`}
      aria-live="polite"
    >
      <div className="relative h-64 w-64 sm:h-80 sm:w-80">
        <Canvas
          key={show.id}
          camera={{ position: [0, 4.5, 3.2], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, powerPreference: "high-performance" }}
        >
          <ambientLight intensity={1.3} />
          <directionalLight position={[5, 10, 5]} intensity={1.8} />
          <pointLight position={[-5, -2, -2]} intensity={0.5} />
          <SingleDice
            position={[-1.3, 0, 0]}
            rollRequest={{ value: show.d1, id: show.id }}
            onRollEnd={onEnd}
          />
          <SingleDice
            position={[1.3, 0, 0]}
            rollRequest={{ value: show.d2, id: show.id }}
            onRollEnd={onEnd}
          />
        </Canvas>

        <div
          className="toy-pop absolute left-1/2 top-0 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-base text-white sm:text-lg"
          style={{
            background: done
              ? "linear-gradient(180deg,#ffc23d,#d99500)"
              : "linear-gradient(180deg,#3fa9f5,#1f7fc4)",
            boxShadow: `0 5px 0 ${done ? "#a87200" : "#16609a"}, 0 10px 20px rgba(0,0,0,0.3)`,
            textShadow: "0 2px 0 rgba(0,0,0,0.2)",
            border: "4px solid #fffaf0",
          }}
        >
          <span className="max-w-[9rem] truncate">{show.name}</span>
          {done ? (
            <>
              : 🎲 {total} nút
              {show.d1 === show.d2 && (
                <span
                  className="rounded-full bg-white/90 px-2 text-sm text-[#d4621a]"
                  style={{ textShadow: "none" }}
                >
                  Đôi!
                </span>
              )}
            </>
          ) : (
            " đang đổ xúc xắc..."
          )}
        </div>
      </div>
    </div>
  );
}
