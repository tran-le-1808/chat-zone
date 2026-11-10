"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import { TOY_COLORS, ToyButton, ToyOverlay, toyFont } from "./ui/ToyUI";

/** Thẻ Cơ hội (cam) / Khí vận (tím) dạng lá bài lật ra */
export default function CardModal() {
  const { drawnCard, setDrawnCard } = useGame();

  if (!drawnCard) return null;

  const isChance = drawnCard.deck === "CHANCE";
  const color = isChance ? "orange" : "purple";
  const c = TOY_COLORS[color];
  const isGain = drawnCard.effect === "ADD_MONEY";

  return (
    <ToyOverlay z={120}>
      <div
        className={`${toyFont.className} toy-card-flip relative w-full max-w-[340px] rounded-[30px] p-3`}
        style={{
          background: `linear-gradient(160deg, ${c.main} 0%, ${c.dark} 100%)`,
          boxShadow: `0 10px 0 ${c.dark}, 0 26px 50px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Hoạ tiết chấm bi trên nền lá bài */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[30px] opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, #ffffff 2px, transparent 2.5px)",
            backgroundSize: "18px 18px",
          }}
        />

        <div
          className="relative rounded-[22px] px-5 pb-5 pt-4 text-center"
          style={{ background: "linear-gradient(180deg,#fffaf0,#fff1dc)" }}
        >
          {/* Nhãn loại thẻ */}
          <div
            className="mx-auto -mt-1 inline-block rounded-full px-4 py-1 text-xs uppercase tracking-[0.25em] text-white"
            style={{ background: c.main, boxShadow: `0 3px 0 ${c.dark}` }}
          >
            {isChance ? "Thẻ Cơ hội" : "Thẻ Khí vận"}
          </div>

          {/* Biểu tượng lớn */}
          <div
            className="toy-bob mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full text-5xl"
            style={{
              background: `radial-gradient(circle at 35% 30%, #fff 0%, ${c.soft} 50%, ${c.main} 100%)`,
              boxShadow: `0 6px 0 ${c.dark}`,
            }}
          >
            {isChance ? "🎁" : "🔮"}
          </div>

          <h2 className="mt-4 text-2xl leading-tight" style={{ color: c.dark }}>
            {drawnCard.title}
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "#5b6078" }}>
            {drawnCard.description}
          </p>

          {drawnCard.value !== undefined && (
            <div
              className="mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-3xl"
              style={{
                background: isGain
                  ? TOY_COLORS.green.soft
                  : TOY_COLORS.red.soft,
                color: isGain ? TOY_COLORS.green.dark : TOY_COLORS.red.dark,
                boxShadow: `inset 0 -3px 0 ${isGain ? TOY_COLORS.green.main : TOY_COLORS.red.main}55`,
              }}
            >
              <span>🪙</span>
              {isGain ? "+" : "−"}${drawnCard.value.toLocaleString("vi-VN")}
            </div>
          )}

          <div className="mt-5">
            <ToyButton
              color={color}
              size="lg"
              onClick={() => setDrawnCard(null)}
            >
              <span className="mx-auto">Đóng thẻ</span>
            </ToyButton>
          </div>
        </div>
      </div>
    </ToyOverlay>
  );
}
