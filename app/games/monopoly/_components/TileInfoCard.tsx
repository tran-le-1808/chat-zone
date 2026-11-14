"use client";

import { X } from "lucide-react";
import type { TileData } from "@/types/game.types";
import { SPECIAL_TILES } from "./board/theme";

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Thẻ thông tin ô: hiện khi chạm vào một ô trên bàn cờ (chạm ra ngoài / nút X để đóng) */
export default function TileInfoCard({
  tile,
  rent,
  ownerName,
  onClose,
}: {
  tile: TileData;
  rent: number;
  ownerName?: string;
  onClose: () => void;
}) {
  const special = SPECIAL_TILES[tile.type];
  const buyable = tile.type === "PROPERTY" || tile.type === "STATION";
  const title = buyable ? tile.name : (special?.label ?? tile.name);
  const accent =
    tile.type === "PROPERTY" ? tile.color : special?.accent;
  const level = tile.hasVilla
    ? "Biệt thự"
    : tile.houses > 0
      ? `${tile.houses} nhà`
      : "Đất trống";

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Thông tin ô ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 text-white shadow-2xl [@media(max-height:500px)]:max-w-[15rem]"
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-2"
          style={{ background: accent ?? "#475569" }}
        >
          <span className="text-sm font-extrabold drop-shadow">{title}</span>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full bg-black/25 p-1 hover:bg-black/40"
          >
            <X size={16} />
          </button>
        </div>
        {buyable ? (
          <dl className="space-y-1 px-3 py-2 text-xs">
            <Row k="Giá mua" v={fmt(tile.landPrice)} />
            <Row k="Tiền thuê hiện tại" v={fmt(rent)} />
            {tile.type === "PROPERTY" && (
              <>
                <Row
                  k="Xây nhà 1 / 2 / 3"
                  v={`${fmt(tile.house1Price)} / ${fmt(tile.house2Price)} / ${fmt(tile.house3Price)}`}
                />
                <Row k="Biệt thự" v={fmt(tile.villaPrice)} />
                <Row k="Công trình" v={level} />
              </>
            )}
            <Row k="Chủ sở hữu" v={ownerName ?? "Chưa có"} />
          </dl>
        ) : (
          <p className="px-3 py-2 text-xs text-slate-300">
            Ô đặc biệt: {title}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right font-bold">{v}</dd>
    </div>
  );
}
