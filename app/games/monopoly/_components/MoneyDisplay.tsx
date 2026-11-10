"use client";

import React, { useEffect, useRef, useState } from "react";

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

interface Delta {
  id: number;
  amount: number;
}

/**
 * Số tiền kèm hiệu ứng "+$ / -$" bay lên khi số dư thay đổi.
 * Chỉ hiển thị — đọc giá trị `money` có sẵn, không thay đổi dữ liệu.
 */
export default function MoneyDisplay({ money }: { money: number }) {
  const prev = useRef(money);
  const [deltas, setDeltas] = useState<Delta[]>([]);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const diff = money - prev.current;
    prev.current = money;
    if (diff === 0) return;
    const id = Date.now() + Math.random();
    setDeltas((d) => [...d.slice(-2), { id, amount: diff }]);
    setBump((b) => b + 1);
    const timer = setTimeout(
      () => setDeltas((d) => d.filter((x) => x.id !== id)),
      1600,
    );
    return () => clearTimeout(timer);
  }, [money]);

  return (
    <span className="relative inline-flex items-center gap-1">
      <style>{`
        @keyframes money-float {
          0% { transform: translate(-50%, 4px) scale(.8); opacity: 0; }
          15% { transform: translate(-50%, -6px) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -30px) scale(1); opacity: 0; }
        }
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
      {deltas.map((d) => (
        <span
          key={d.id}
          className={`pointer-events-none absolute left-1/2 top-0 whitespace-nowrap text-sm font-black drop-shadow ${
            d.amount > 0 ? "text-emerald-300" : "text-rose-400"
          }`}
          style={{ animation: "money-float 1.6s ease-out forwards" }}
        >
          {d.amount > 0 ? "+" : "−"}${Math.abs(d.amount).toLocaleString("vi-VN")}
        </span>
      ))}
    </span>
  );
}
