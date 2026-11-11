"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGame } from "../_context/GameContext";
import { CoinIcon } from "./MoneyDisplay";
import { toyFont } from "./ui/ToyUI";
import { useIsCompact } from "./ui/useScreen";

/** Thời gian 1 popup tiền tồn tại (ms) */
const POPUP_MS = 2400;
/** Tối đa số popup xếp chồng cho mỗi người chơi */
const MAX_STACK = 3;

// Vị trí popup: ngay dưới thẻ hàng trên / ngay trên thẻ hàng dưới (cùng góc với thẻ người chơi)
const DESKTOP_ANCHORS = [
  "top-[100px] left-4 items-start",
  "top-[100px] right-4 items-end",
  "bottom-[100px] left-4 items-start",
  "bottom-[100px] right-4 items-end",
];
const COMPACT_ANCHORS = [
  "top-[46px] left-1.5 items-start",
  "top-[46px] right-1.5 items-end",
  "bottom-[46px] left-1.5 items-start",
  "bottom-[46px] right-1.5 items-end",
];

interface Popup {
  id: number;
  amount: number;
}

/**
 * Popup "+$ / −$" mỗi khi tiền của người chơi thay đổi (thuê nhà, qua ô Bắt đầu,
 * thuế, thẻ Cơ hội, mini game...). Tính từ chênh lệch số dư nên MỌI máy trong phòng
 * đều thấy giống nhau, không cần thêm sự kiện đồng bộ.
 */
export default function MoneyPopups() {
  const { players } = useGame();
  const isCompact = useIsCompact();
  const anchors = isCompact ? COMPACT_ANCHORS : DESKTOP_ANCHORS;

  // Lần đầu (vào phòng / tải lại): chỉ ghi nhận số dư, không hiện popup
  const [prevPlayers, setPrevPlayers] = useState(players);
  const [seq, setSeq] = useState(0);
  const [popups, setPopups] = useState<Record<number, Popup[]>>({});

  // So sánh số dư ngay khi render (mẫu "điều chỉnh state khi props đổi" của React)
  if (players !== prevPlayers) {
    const before = new Map(prevPlayers.map((p) => [p.id, p.money] as const));
    setPrevPlayers(players);
    let nextSeq = seq;
    const added: Record<number, Popup> = {};
    for (const p of players) {
      const old = before.get(p.id);
      if (old === undefined || old === p.money) continue;
      added[p.id] = { id: ++nextSeq, amount: p.money - old };
    }
    if (nextSeq !== seq) {
      setSeq(nextSeq);
      setPopups((cur) => {
        const out = { ...cur };
        for (const [pid, pop] of Object.entries(added)) {
          const k = Number(pid);
          out[k] = [...(out[k] ?? []).slice(-(MAX_STACK - 1)), pop];
        }
        return out;
      });
    }
  }

  const removePopup = (pid: number, popupId: number) =>
    setPopups((cur) => ({
      ...cur,
      [pid]: (cur[pid] ?? []).filter((x) => x.id !== popupId),
    }));

  return (
    <>
      <style>{`
        @keyframes money-pop {
          0% { transform: translateY(var(--from)) scale(.4); opacity: 0; }
          14% { transform: translateY(0) scale(1.18); opacity: 1; }
          24% { transform: translateY(0) scale(1); }
          78% { opacity: 1; }
          100% { transform: translateY(var(--to)) scale(.95); opacity: 0; }
        }
        @keyframes money-shine {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        .money-pop { animation: money-pop ${POPUP_MS}ms cubic-bezier(.2,1.1,.4,1) forwards; }
        .money-shine { animation: money-shine .9s ease-out .15s both; }
      `}</style>
      {players.map((p, idx) => {
        const list = popups[p.id];
        if (!list?.length || !anchors[idx]) return null;
        const isTopRow = idx < 2;
        return (
          <div
            key={p.id}
            className={`${toyFont.className} pointer-events-none absolute z-[130] flex gap-1 ${anchors[idx]} ${
              isTopRow ? "flex-col" : "flex-col-reverse"
            }`}
          >
            {list.map((pop) => (
              <MoneyPop
                key={pop.id}
                amount={pop.amount}
                color={p.color}
                compact={isCompact}
                fromAbove={isTopRow}
                onDone={() => removePopup(p.id, pop.id)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function MoneyPop({
  amount,
  color,
  compact,
  fromAbove,
  onDone,
}: {
  amount: number;
  color: string;
  compact: boolean;
  /** Thẻ hàng trên: popup trồi xuống rồi trôi lên; hàng dưới: ngược lại */
  fromAbove: boolean;
  onDone: () => void;
}) {
  // Giữ onDone mới nhất mà không phải đặt lại timer
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), POPUP_MS);
    return () => clearTimeout(t);
  }, []);

  const gain = amount > 0;
  return (
    <span
      className={`money-pop relative flex items-center overflow-hidden whitespace-nowrap rounded-full border-2 text-white ${
        compact ? "gap-1 px-2 py-0.5 text-sm" : "gap-1.5 px-3 py-1 text-xl"
      }`}
      style={
        {
          "--from": fromAbove ? "-14px" : "14px",
          "--to": fromAbove ? "-10px" : "-22px",
          background: gain
            ? "linear-gradient(180deg,#34d399,#059669)"
            : "linear-gradient(180deg,#fb7185,#e11d48)",
          borderColor: gain ? "#a7f3d0" : "#fecdd3",
          boxShadow: `0 3px 0 ${gain ? "#047857" : "#9f1239"}, 0 8px 18px rgba(0,0,0,0.35), 0 0 0 2px ${color}`,
          textShadow: "0 1px 0 rgba(0,0,0,0.3)",
        } as React.CSSProperties
      }
    >
      <span className="money-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40" />
      <CoinIcon size={compact ? 14 : 20} />
      <span className="tabular-nums">
        {gain ? "+" : "−"}${Math.abs(amount).toLocaleString("vi-VN")}
      </span>
    </span>
  );
}
