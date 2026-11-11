"use client";

import React from "react";
import { useGame } from "../_context/GameContext";
import {
  TOY_COLORS,
  ToyButton,
  ToyOverlay,
  ToyPanel,
  ToyPrice,
} from "./ui/ToyUI";

/** Chọn ô đất để tổ chức Lễ Hội (tiền thuê ô đó x2) */
export default function FestivalModal() {
  const {
    showFestivalModal,
    board,
    currPlayer,
    calculateTileRent,
    handleFestivalSelect,
    handleFestivalSkip,
  } = useGame();

  if (!showFestivalModal) return null;

  // Sắp xếp theo tiền thuê (giá hiển thị) từ cao đến thấp; bằng nhau thì theo giá đất
  const owned = board
    .filter(
      (tile) => tile.type === "PROPERTY" && tile.ownerId === currPlayer.id,
    )
    .map((tile) => ({ tile, rent: calculateTileRent(tile) }))
    .sort((a, b) => b.rent - a.rent || b.tile.landPrice - a.tile.landPrice)
    .map((x) => x.tile);
  const c = TOY_COLORS.pink;

  return (
    <ToyOverlay z={100}>
      <ToyPanel
        color="pink"
        icon={<span className="toy-wiggle inline-block">🏮</span>}
        title="Lễ Hội"
        subtitle="Chọn 1 ô đất của bạn để mở hội — tiền thuê ô đó tăng ×2!"
        maxWidth={460}
      >
        {/* Dây đèn lồng trang trí */}
        <div className="mt-3 flex justify-center gap-3 text-lg">
          {["🏮", "🎊", "🏮", "🎊", "🏮"].map((e, i) => (
            <span
              key={i}
              className="toy-bob inline-block"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {e}
            </span>
          ))}
        </div>

        <div className="mt-4 max-h-[46vh] space-y-2.5 overflow-y-auto px-1 pb-2 [@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-2 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:space-y-0 [@media(max-height:500px)]:max-h-[58vh]">
          {owned.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleFestivalSelect(tile.id)}
              className="group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-transform duration-75 active:translate-y-[3px]"
              style={{
                background: tile.isFestival ? c.soft : "#ffffff",
                border: `3px solid ${tile.isFestival ? c.main : "#f0e3cc"}`,
                boxShadow: `0 4px 0 ${tile.isFestival ? c.dark : "#e3d3b5"}`,
              }}
            >
              {/* Dải màu nhóm đất */}
              <span
                className="h-11 w-3 shrink-0 rounded-full"
                style={{
                  background: tile.color,
                  boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)",
                }}
              />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-base"
                  style={{ color: "#2b2f48" }}
                >
                  {tile.name}
                </span>
                <span
                  className="mt-0.5 flex items-center gap-1.5 text-xs"
                  style={{ color: "#7a7f95" }}
                >
                  Thuê{" "}
                  <ToyPrice amount={calculateTileRent(tile)} color="gold" />
                </span>
              </span>
              <span
                className="shrink-0 rounded-xl px-3 py-1.5 text-sm text-white"
                style={{
                  background: tile.isFestival ? c.dark : c.main,
                  boxShadow: `0 3px 0 ${c.dark}`,
                }}
              >
                {tile.isFestival ? "Đang ×2" : "Mở hội"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <ToyButton color="gray" onClick={handleFestivalSkip}>
            <span
              className="mx-auto"
              style={{ color: "#3b4258", textShadow: "none" }}
            >
              Bỏ qua
            </span>
          </ToyButton>
        </div>
      </ToyPanel>
    </ToyOverlay>
  );
}
