"use client";

import React from "react";
import { TileData, Player } from "@/types/game.types";
import { TOY_COLORS, ToyButton, ToyOverlay, ToyPanel } from "./ui/ToyUI";

// Giá trị thu hồi khi bán 1 ô đất (50% giá trị đầu tư)
export const getTileSellValue = (tile: TileData) => {
  if (tile.type === "STATION") return 100;
  if (tile.hasVilla)
    return Math.round((tile.landPrice + tile.villaPrice) * 0.5);

  let totalInvested = tile.landPrice;
  if (tile.houses === 1) totalInvested = tile.house1Price;
  else if (tile.houses === 2) totalInvested = tile.house2Price;
  else if (tile.houses === 3) totalInvested = tile.house3Price;

  return Math.round(totalInvested * 0.5);
};

interface SellPropertyModalProps {
  currPlayer: Player;
  board: TileData[];
  onSellTile: (tileId: number) => void;
  onAutoSellAll: () => void;
  onDeclareBankrupt?: () => void;
}

export default function SellPropertyModal({
  currPlayer,
  board,
  onSellTile,
  onAutoSellAll,
  onDeclareBankrupt,
}: SellPropertyModalProps) {
  // Lấy danh sách các ô đất người chơi đang sở hữu
  const ownedTiles = board.filter((t) => t.ownerId === currPlayer.id);

  return (
    <ToyOverlay z={140}>
      <ToyPanel color="red" icon="💸" title="Âm Tiền Rồi!" maxWidth={420}>
        <p className="mt-2 text-sm" style={{ color: "#5b6078" }}>
          {currPlayer.name} đang nợ{" "}
          <span className="text-lg" style={{ color: TOY_COLORS.red.dark }}>
            −${Math.abs(currPlayer.money).toLocaleString("vi-VN")}
          </span>
          . Hãy bán bớt nhà đất để trả nợ!
        </p>

        {/* Danh sách nhà có thể bán */}
        {ownedTiles.length > 0 ? (
          <div className="mt-4 max-h-56 space-y-2.5 overflow-y-auto px-1 pb-2">
            {ownedTiles.map((tile) => {
              const sellValue = getTileSellValue(tile);
              return (
                <div
                  key={tile.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-2.5 text-left"
                  style={{
                    border: "3px solid #f0e3cc",
                    boxShadow: "0 4px 0 #e3d3b5",
                  }}
                >
                  <span
                    className="h-10 w-3 shrink-0 rounded-full"
                    style={{
                      background: tile.color,
                      boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{tile.name}</span>
                    <span className="text-xs" style={{ color: "#7a7f95" }}>
                      {tile.hasVilla
                        ? "🏨 Khách sạn"
                        : tile.houses > 0
                          ? `🏠 ${tile.houses} Nhà`
                          : "🚩 Đất trống"}
                    </span>
                  </span>
                  <ToyButton
                    color="orange"
                    size="sm"
                    block={false}
                    onClick={() => onSellTile(tile.id)}
                  >
                    <span>Bán +${sellValue.toLocaleString("vi-VN")}</span>
                  </ToyButton>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="mt-4 rounded-2xl p-3 text-xs"
            style={{
              background: TOY_COLORS.red.soft,
              color: TOY_COLORS.red.text,
            }}
          >
            Bạn không còn tài sản nào để bán — buộc phải phá sản.
          </div>
        )}

        {/* Các nút hành động */}
        <div className="mt-3 space-y-3">
          {ownedTiles.length > 0 && (
            <ToyButton color="gold" onClick={onAutoSellAll}>
              <span className="mx-auto">⚡ Bán tự động đến khi hết nợ</span>
            </ToyButton>
          )}

          {onDeclareBankrupt && (
            <ToyButton color="gray" onClick={onDeclareBankrupt}>
              <span
                className="mx-auto"
                style={{ color: "#3b4258", textShadow: "none" }}
              >
                🏴 Tuyên bố phá sản ngay
              </span>
            </ToyButton>
          )}
        </div>
      </ToyPanel>
    </ToyOverlay>
  );
}
