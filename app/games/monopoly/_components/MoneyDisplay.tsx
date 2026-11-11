"use client";

import React, { useState } from "react";

/** Đồng xu vàng hoạt hình (2D) dùng cạnh số tiền */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-amber-600 bg-gradient-to-br from-yellow-200 via-amber-300 to-amber-500 font-black text-amber-800 shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      $
    </span>
  );
}

/**
 * Số tiền kèm hiệu ứng "nảy" khi số dư thay đổi.
 * Popup "+$ / −$" cho mọi người cùng xem nằm ở MoneyPopups.
 */
export default function MoneyDisplay({ money }: { money: number }) {
  const [prevMoney, setPrevMoney] = useState(money);
  const [bump, setBump] = useState(0);
  if (money !== prevMoney) {
    setPrevMoney(money);
    setBump((b) => b + 1);
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      <style>{`
        @keyframes money-bump {
          0% { transform: scale(1); }
          40% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
      `}</style>
      <CoinIcon />
      <span
        key={bump}
        className={`inline-block tabular-nums ${money < 0 ? "font-bold text-red-400" : "text-gray-100"}`}
        style={bump ? { animation: "money-bump 0.4s ease-out" } : undefined}
      >
        ${money.toLocaleString("vi-VN")}
      </span>
    </span>
  );
}
