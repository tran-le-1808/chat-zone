"use client";

import React from "react";
import { RENT_NOTICE_MS, useGame } from "../_context/GameContext";
import PlayerAvatar from "./PlayerAvatar";
import { TOY_COLORS, toyFont } from "./ui/ToyUI";
import { useIsCompact } from "./ui/useScreen";

/**
 * Banner "trả tiền thuê": hiện cho cả phòng khi 1 người đi vào ô của người khác.
 * Không chặn thao tác (người trả tiền vẫn bấm được modal mua lại phía dưới).
 */
export default function RentNotification() {
  const { rentNotice, players, myPlayer, isMyTurn, showBuyModal } = useGame();
  const isCompact = useIsCompact();

  if (!rentNotice) return null;

  const payer = players.find((p) => p.id === rentNotice.payerId);
  const owner = players.find((p) => p.id === rentNotice.ownerId);
  if (!payer || !owner) return null;
  // Người trả tiền đang có modal mua lại (đã ghi "Bạn đã trả tiền thuê") -> không che modal
  if (isMyTurn && showBuyModal && myPlayer?.id === payer.id) return null;

  const iAmPayer = myPlayer?.id === payer.id;
  const iAmOwner = myPlayer?.id === owner.id;
  const amountText = `$${rentNotice.amount.toLocaleString("vi-VN")}`;
  // Góc nhìn của mình: người trả thấy số âm (đỏ), chủ nhà thấy số dương (xanh)
  const amountColor = iAmOwner ? TOY_COLORS.green : TOY_COLORS.red;
  const amountSign = iAmOwner ? "+" : iAmPayer ? "−" : "";

  const title = iAmPayer
    ? `Bạn trả tiền thuê cho ${owner.name}`
    : iAmOwner
      ? `${payer.name} trả tiền thuê cho bạn`
      : `${payer.name} trả tiền thuê cho ${owner.name}`;

  const avatarSize = isCompact ? 26 : 40;

  return (
    <div
      key={rentNotice.seq}
      className={`${toyFont.className} pointer-events-none absolute left-1/2 z-[140] -translate-x-1/2 ${
        isCompact
          ? "top-[48px] w-[min(320px,calc(100%-16px))] [@media(max-height:500px)]:top-[30%] [@media(max-height:500px)]:w-[300px]"
          : "top-4 w-[420px]"
      }`}
    >
      <style>{`
        @keyframes rent-in {
          0% { transform: translateY(-24px) scale(.85); opacity: 0; }
          60% { transform: translateY(3px) scale(1.03); opacity: 1; }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes rent-coin {
          0% { transform: translateX(-120%) translateY(0) scale(.7); opacity: 0; }
          20% { opacity: 1; }
          50% { transform: translateX(0) translateY(-8px) scale(1); }
          80% { opacity: 1; }
          100% { transform: translateX(120%) translateY(0) scale(.7); opacity: 0; }
        }
        @keyframes rent-progress { from { width: 100% } to { width: 0% } }
        .rent-in { animation: rent-in .45s cubic-bezier(.2,1.3,.4,1) both; }
        .rent-coin { animation: rent-coin 1s ease-in-out infinite; }
      `}</style>

      <div
        className={`rent-in overflow-hidden text-center ${
          isCompact
            ? "rounded-2xl px-2.5 pb-2 pt-1.5"
            : "rounded-[26px] px-4 pb-3 pt-2.5"
        }`}
        style={{
          background: "linear-gradient(180deg,#fffaf0 0%,#fff1dc 100%)",
          border: `${isCompact ? 3 : 4}px solid ${TOY_COLORS.gold.main}`,
          boxShadow: `0 ${isCompact ? 4 : 6}px 0 ${TOY_COLORS.gold.dark}, 0 14px 30px rgba(0,0,0,0.3)`,
          color: "#2b2f48",
        }}
      >
        <div
          className={`truncate ${isCompact ? "text-[11px]" : "text-sm"}`}
          style={{ color: TOY_COLORS.gold.text }}
        >
          🏠 {title}
        </div>

        <div
          className={`flex items-center justify-center ${isCompact ? "mt-1 gap-2" : "mt-2 gap-3"}`}
        >
          {/* Người trả -> đồng xu bay -> chủ nhà */}
          <PlayerAvatar
            name={payer.name}
            avatar={payer.avatar}
            color={payer.color}
            pawnType={payer.type}
            size={avatarSize}
          />
          <div
            className={`relative overflow-hidden ${isCompact ? "h-6 w-10" : "h-8 w-16"}`}
          >
            <span
              className={`rent-coin absolute inset-0 flex items-center justify-center ${isCompact ? "text-base" : "text-xl"}`}
            >
              🪙
            </span>
          </div>
          <PlayerAvatar
            name={owner.name}
            avatar={owner.avatar}
            color={owner.color}
            pawnType={owner.type}
            size={avatarSize}
          />

          <span
            className={`ml-1 rounded-2xl ${isCompact ? "px-2.5 py-0.5 text-lg" : "px-4 py-1 text-2xl"}`}
            style={{
              background: amountColor.soft,
              color: amountColor.dark,
              boxShadow: `inset 0 -3px 0 ${amountColor.main}55`,
            }}
          >
            {amountSign}
            {amountText}
          </span>
        </div>

        {/* Ô đất & hệ số nhân */}
        <div
          className={`flex flex-wrap items-center justify-center gap-1 ${isCompact ? "mt-1 text-[10px]" : "mt-2 text-xs"}`}
          style={{ color: "#6b7085" }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: rentNotice.tileColor ?? "#9aa3b5" }}
          />
          <span className="truncate">{rentNotice.tileName}</span>
          {rentNotice.monopoly && (
            <span
              className="rounded-full px-1.5"
              style={{
                background: TOY_COLORS.orange.soft,
                color: TOY_COLORS.orange.text,
              }}
            >
              ×2 Đủ bộ
            </span>
          )}
          {rentNotice.festival && (
            <span
              className="rounded-full px-1.5"
              style={{
                background: TOY_COLORS.pink.soft,
                color: TOY_COLORS.pink.text,
              }}
            >
              ×2 Lễ hội
            </span>
          )}
        </div>

        {/* Thanh thời gian tự ẩn */}
        <div
          className={`overflow-hidden rounded-full ${isCompact ? "mt-1.5 h-1" : "mt-2 h-1.5"}`}
          style={{ background: TOY_COLORS.gold.soft }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${TOY_COLORS.gold.main}, ${TOY_COLORS.gold.dark})`,
              animation: `rent-progress ${RENT_NOTICE_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
