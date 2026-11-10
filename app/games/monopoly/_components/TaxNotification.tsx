"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import { TOY_COLORS, ToyOverlay, ToyPanel } from "./ui/ToyUI";

/** Thông báo ô Thuế (tự đóng sau 2–3 giây theo luật hiện tại) */
export default function TaxNotification() {
  const { taxNotification } = useGame();

  if (!taxNotification) return null;

  const hasTax = taxNotification.amount !== undefined;
  // Khớp thời gian tự đóng trong GameContext (có thuế: 3s, miễn thuế: 2s)
  const durationMs = hasTax ? 3000 : 2000;
  const c = TOY_COLORS.green;

  return (
    <ToyOverlay z={130}>
      <ToyPanel
        color="green"
        icon={
          <span className="toy-wiggle inline-block">
            {hasTax ? "💰" : "🎉"}
          </span>
        }
        title={hasTax ? "Nộp Thuế" : "Miễn Thuế"}
        maxWidth={360}
      >
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "#4b5068" }}
        >
          {taxNotification.message}
        </p>

        {hasTax && (
          <div
            className="mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-3xl"
            style={{
              background: TOY_COLORS.red.soft,
              color: TOY_COLORS.red.dark,
              boxShadow: `inset 0 -3px 0 ${TOY_COLORS.red.main}55`,
            }}
          >
            <span>🪙</span>−${taxNotification.amount!.toLocaleString("vi-VN")}
          </div>
        )}

        {/* Thanh thời gian tự đóng */}
        <div
          className="mt-5 h-3 w-full overflow-hidden rounded-full"
          style={{
            background: c.soft,
            boxShadow: `inset 0 2px 0 rgba(0,0,0,0.08)`,
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${c.main}, ${c.dark})`,
              animation: `toy-progress ${durationMs}ms linear forwards`,
            }}
          />
        </div>
      </ToyPanel>
    </ToyOverlay>
  );
}
