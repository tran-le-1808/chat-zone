"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import SingleDice, { Dice3DRef } from "./Dice3D";
import { ToyKeyframes, toyFont } from "./ui/ToyUI";

const ZONES = [
  {
    id: 0,
    label: "2 - 4",
    range: [2, 3, 4],
    main: "#3fa9f5",
    dark: "#1f7fc4",
    soft: "#d3edff",
  },
  {
    id: 1,
    label: "5 - 7",
    range: [5, 6, 7],
    main: "#4fbf6b",
    dark: "#2f9148",
    soft: "#dff5c4",
  },
  {
    id: 2,
    label: "8 - 9",
    range: [8, 9],
    main: "#ffc23d",
    dark: "#d99500",
    soft: "#fff1c2",
  },
  {
    id: 3,
    label: "10 - 12",
    range: [10, 11, 12],
    main: "#ff5a4e",
    dark: "#cc362c",
    soft: "#ffd9d5",
  },
];

interface DiceRoller3DProps {
  onRollComplete?: (total: number, d1?: number, d2?: number) => void;
}

export default function DiceRoller3D({ onRollComplete }: DiceRoller3DProps) {
  // Kim chỉ lực được di chuyển trực tiếp qua ref (không re-render React mỗi khung hình)
  const markerTrackRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [showCenterCanvas, setShowCenterCanvas] = useState(false);
  const [showResultBadge, setShowResultBadge] = useState(false);
  const [diceValues, setDiceValues] = useState<[number, number]>([1, 1]);
  const [activeZone, setActiveZone] = useState<number>(0);

  const dice1Ref = useRef<Dice3DRef>(null);
  const dice2Ref = useRef<Dice3DRef>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const activeZoneRef = useRef<number>(0);
  const isPressingRef = useRef<boolean>(false);

  // Yêu cầu lắc hiện tại: xúc xắc tự lắc khi đã mount (không phụ thuộc thời gian khởi tạo Canvas)
  const [rollReq, setRollReq] = useState<{
    d1: number;
    d2: number;
    id: number;
  } | null>(null);
  const endedDiceRef = useRef(0);
  const finishedRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Luôn gọi callback mới nhất nhưng KHÔNG để effect lắc chạy lại khi callback
  // đổi tham chiếu (component cha render lại liên tục trong lúc chơi online)
  const onRollCompleteRef = useRef(onRollComplete);
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  const calculateDiceResult = (targetZoneId: number): [number, number] => {
    const weights = ZONES.map((z) => (z.id === targetZoneId ? 0.5 : 0.166));
    let rand = Math.random();
    let selectedIndex = 0;

    for (let i = 0; i < weights.length; i++) {
      if (rand < weights[i]) {
        selectedIndex = i;
        break;
      }
      rand -= weights[i];
    }

    const targetZone = ZONES[selectedIndex] || ZONES[0];
    const targetTotal =
      targetZone.range[Math.floor(Math.random() * targetZone.range.length)];

    const validPairs: [number, number][] = [];
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        if (d1 + d2 === targetTotal) validPairs.push([d1, d2]);
      }
    }

    return validPairs[Math.floor(Math.random() * validPairs.length)];
  };

  const updatePowerRef = useRef<(time: number) => void>(() => {});
  // eslint-disable-next-line react-hooks/refs
  updatePowerRef.current = (time: number) => {
    if (!isPressingRef.current) return;

    // rAF có thể trả thời điểm hơi sớm hơn lúc bấm -> chặn âm để kim không nhảy ra ngoài
    const elapsed = Math.max(0, time - startTimeRef.current);
    const cycle = (elapsed % 1200) / 1200;
    const currentPower = cycle * 100; // số thực -> kim chạy mượt, không giật theo từng 1%

    // Di chuyển kim bằng transform (GPU), không gây tính lại layout & không re-render
    if (markerTrackRef.current) {
      markerTrackRef.current.style.transform = `translate3d(${currentPower}%, 0, 0)`;
    }

    let currentZone = 0;
    if (currentPower < 25) currentZone = 0;
    else if (currentPower < 50) currentZone = 1;
    else if (currentPower < 75) currentZone = 2;
    else currentZone = 3;

    // Chỉ cập nhật state khi đổi vùng (vài lần mỗi vòng thay vì 60 lần/giây)
    if (currentZone !== activeZoneRef.current) {
      activeZoneRef.current = currentZone;
      setActiveZone(currentZone);
    }

    animFrameRef.current = requestAnimationFrame((t) =>
      updatePowerRef.current(t),
    );
  };

  // 1. NHẤN GIỮ NÚT (CHỈ TÍCH LỰC, CHƯA HIỆN CANVAS 3D)
  const handleStart = () => {
    if (isRolling || showCenterCanvas) return;

    isPressingRef.current = true;
    setIsPressing(true);
    activeZoneRef.current = 0;
    setActiveZone(0);
    startTimeRef.current = performance.now();

    animFrameRef.current = requestAnimationFrame((t) =>
      updatePowerRef.current(t),
    );
  };

  // 2. THẢ TAY -> BẮT ĐẦU MỞ CANVAS VÀ LẮC
  const handleEnd = useCallback(() => {
    if (!isPressingRef.current || isRolling) return;

    isPressingRef.current = false;
    setIsPressing(false);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Tính kết quả và lưu vào ref tạm
    const [finalD1, finalD2] = calculateDiceResult(activeZoneRef.current);
    endedDiceRef.current = 0;
    finishedRef.current = false;
    setRollReq({ d1: finalD1, d2: finalD2, id: Date.now() });

    setIsRolling(true);
    setShowResultBadge(false);

    // Mở Canvas 3D
    setShowCenterCanvas(true);
  }, [isRolling]);

  // 3. KẾT THÚC LẮC: chờ CẢ 2 xúc xắc báo đã dừng, hiện kết quả 1 giây rồi báo cho game.
  //    Có hẹn giờ dự phòng để không bao giờ bị kẹt (vd. tab bị ẩn làm dừng hiệu ứng).
  const finishRoll = useCallback(() => {
    if (finishedRef.current || !rollReq) return;
    finishedRef.current = true;
    const { d1, d2 } = rollReq;
    setDiceValues([d1, d2]);
    setIsRolling(false);
    setShowResultBadge(true);
    timersRef.current.push(
      setTimeout(() => {
        setShowCenterCanvas(false);
        setShowResultBadge(false);
        setRollReq(null);
        onRollCompleteRef.current?.(d1 + d2, d1, d2);
      }, 1000),
    );
  }, [rollReq]);

  const handleDiceEnd = useCallback(() => {
    endedDiceRef.current += 1;
    if (endedDiceRef.current >= 2) finishRoll();
  }, [finishRoll]);

  // Hẹn giờ dự phòng cho mỗi lượt lắc
  useEffect(() => {
    if (!rollReq) return;
    const fallback = setTimeout(finishRoll, 4500);
    return () => clearTimeout(fallback);
  }, [rollReq, finishRoll]);

  // Huỷ các hẹn giờ khi component bị gỡ (vd. hết lượt)
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const onGlobalUp = () => {
      if (isPressingRef.current) handleEnd();
    };

    window.addEventListener("mouseup", onGlobalUp);
    window.addEventListener("touchend", onGlobalUp);

    return () => {
      window.removeEventListener("mouseup", onGlobalUp);
      window.removeEventListener("touchend", onGlobalUp);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleEnd]);

  const currentTotal = diceValues[0] + diceValues[1];
  const busy = isRolling || showCenterCanvas;

  return (
    <>
      <ToyKeyframes />

      {/* A. KHUNG XÚC XẮC 3D Ở GIỮA MÀN HÌNH (CHỈ HIỆN KHI LẮC) */}
      {showCenterCanvas && (
        <div
          className={`${toyFont.className} toy-fade pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center`}
          style={{
            background:
              "radial-gradient(circle, rgba(255,240,200,0.35) 0%, rgba(16,24,56,0.55) 70%)",
          }}
        >
          <div className="relative h-80 w-80">
            <Canvas camera={{ position: [0, 4.5, 3.2], fov: 45 }} shadows>
              <ambientLight intensity={1.3} />
              <directionalLight
                position={[5, 10, 5]}
                intensity={1.8}
                castShadow
              />
              <pointLight position={[-5, -2, -2]} intensity={0.5} />

              <SingleDice
                ref={dice1Ref}
                position={[-1.3, 0, 0]}
                initialValue={diceValues[0]}
                rollRequest={
                  rollReq ? { value: rollReq.d1, id: rollReq.id } : null
                }
                onRollEnd={handleDiceEnd}
              />
              <SingleDice
                ref={dice2Ref}
                position={[1.3, 0, 0]}
                initialValue={diceValues[1]}
                rollRequest={
                  rollReq ? { value: rollReq.d2, id: rollReq.id } : null
                }
                onRollEnd={handleDiceEnd}
              />
            </Canvas>

            {/* Kết quả khi xúc xắc dừng */}
            {showResultBadge && (
              <div
                className="toy-pop absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-xl text-white"
                style={{
                  background: "linear-gradient(180deg,#ffc23d,#d99500)",
                  boxShadow: "0 5px 0 #a87200, 0 10px 20px rgba(0,0,0,0.3)",
                  textShadow: "0 2px 0 rgba(0,0,0,0.2)",
                  border: "4px solid #fffaf0",
                }}
              >
                🎲 {currentTotal} nút
                {diceValues[0] === diceValues[1] && (
                  <span
                    className="rounded-full bg-white/90 px-2 text-sm text-[#d4621a]"
                    style={{ textShadow: "none" }}
                  >
                    Đôi!
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. BẢNG ĐIỀU KHIỂN NHẤN GIỮ ĐỂ TÍCH LỰC */}
      <div
        className={`${toyFont.className} w-full select-none space-y-3 rounded-[28px] p-4 text-center`}
        style={{
          background: "linear-gradient(180deg,#fffaf0 0%,#fff1dc 100%)",
          border: "5px solid #26386f",
          boxShadow: "0 8px 0 #1b2a57, 0 18px 36px rgba(0,0,0,0.35)",
          color: "#2b2f48",
        }}
      >
        <div
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: "#8a8fa5" }}
        >
          {isPressing
            ? "Thả tay đúng vùng bạn muốn!"
            : "Chọn lực để đổ xúc xắc"}
        </div>

        {/* 4 vùng điểm dạng viên kẹo */}
        <div className="grid grid-cols-4 gap-2">
          {ZONES.map((zone) => {
            const active = isPressing && activeZone === zone.id;
            return (
              <div
                key={zone.id}
                className="rounded-xl py-1.5 text-sm transition-transform duration-100"
                style={{
                  background: active ? zone.main : zone.soft,
                  color: active ? "#ffffff" : zone.dark,
                  boxShadow: active
                    ? `0 4px 0 ${zone.dark}`
                    : `0 2px 0 ${zone.main}66`,
                  transform: active ? "translateY(-3px) scale(1.06)" : "none",
                  textShadow: active ? "0 1px 0 rgba(0,0,0,0.2)" : "none",
                }}
              >
                {zone.label}
              </div>
            );
          })}
        </div>

        {/* Thanh lực */}
        <div
          className="relative h-7 overflow-hidden rounded-full p-1"
          style={{
            background: "#26386f",
            boxShadow: "inset 0 3px 0 rgba(0,0,0,0.3)",
          }}
        >
          <div className="grid h-full w-full grid-cols-4 gap-1">
            {ZONES.map((zone) => {
              const active = isPressing && activeZone === zone.id;
              return (
                <div
                  key={zone.id}
                  className="h-full rounded-full transition-opacity duration-100"
                  style={{
                    background: `repeating-linear-gradient(-45deg, ${zone.main} 0 8px, ${zone.dark} 8px 14px)`,
                    opacity: active ? 1 : 0.45,
                  }}
                />
              );
            })}
          </div>
          {/* Kim chỉ lực: lớp trượt rộng bằng thanh (trừ lề 10px), dịch bằng translate3d */}
          <div className="pointer-events-none absolute inset-y-0.5 left-[10px] right-[10px] z-10">
            <div
              ref={markerTrackRef}
              className="absolute inset-0"
              style={{
                transform: "translate3d(0%, 0, 0)",
                willChange: "transform",
              }}
            >
              <div
                className="absolute top-0 bottom-0 left-0 w-4 -translate-x-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, #ff5a4e 0 3px, #ffffff 3.5px)",
                  boxShadow: "0 0 0 3px #26386f, 0 2px 6px rgba(0,0,0,0.4)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Nút nhấn giữ */}
        <button
          type="button"
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          disabled={busy}
          className="relative w-full overflow-hidden rounded-2xl py-3.5 text-lg text-white transition-transform duration-75 disabled:cursor-not-allowed"
          style={{
            background: busy
              ? "linear-gradient(180deg,#c9cfdc,#9aa3b5)"
              : "linear-gradient(180deg,#ff8a3d 0%,#d4621a 130%)",
            boxShadow: isPressing
              ? "0 1px 0 #a84a10"
              : busy
                ? "0 3px 0 #8a92a6"
                : "0 6px 0 #a84a10, 0 10px 18px rgba(0,0,0,0.2)",
            transform: isPressing ? "translateY(5px)" : "none",
            textShadow: "0 2px 0 rgba(0,0,0,0.2)",
          }}
        >
          <span
            className="pointer-events-none absolute inset-x-3 top-1 h-[38%] rounded-xl"
            style={{ background: "rgba(255,255,255,0.28)" }}
          />
          <span className="relative inline-flex items-center gap-2">
            <span
              className={
                isPressing ? "toy-wiggle inline-block" : "inline-block"
              }
            >
              🎲
            </span>
            {busy
              ? "Đang lắc xúc xắc..."
              : isPressing
                ? "Thả tay để lắc!"
                : "Nhấn giữ để tích lực"}
          </span>
        </button>
      </div>
    </>
  );
}
