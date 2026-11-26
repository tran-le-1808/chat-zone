"use client";

import { useState } from "react";
import { ITEM_DEFS } from "../_lib/engine/items";
import type { InventoryItem } from "../_lib/engine/types";

/** Một ô vật phẩm kiểu Minecraft: viền lõm, biểu tượng lớn, số lượng góc dưới phải, thanh độ bền */
export function Slot({
  item,
  label,
  disabled,
  onClick,
  onContext,
  onHover,
  large,
  ghost,
}: {
  item?: InventoryItem;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  onContext?: () => void;
  onHover?: (i: InventoryItem | null) => void;
  large?: boolean;
  /** Hiện mờ biểu tượng gợi ý khi ô trống */
  ghost?: string;
}) {
  const def = item ? ITEM_DEFS[item.itemId] : null;
  const dur = item && def?.maxDurability ? item.durability !== undefined && item.durability / def.maxDurability : null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext?.();
      }}
      onMouseEnter={() => onHover?.(item ?? null)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(item ?? null)}
      title={def ? `${def.name}${item!.quantity > 1 ? ` ×${item!.quantity}` : ""}` : label}
      className={`relative flex aspect-square w-full select-none items-center justify-center border-2 border-b-[#6b7194] border-l-[#07080f] border-r-[#6b7194] border-t-[#07080f] bg-[#252842] transition ${item && !disabled ? "cursor-pointer hover:bg-[#3a3f6b]" : ""} ${disabled && !item ? "opacity-60" : ""} ${large ? "text-4xl" : "text-2xl"}`}
    >
      {def ? (
        <>
          <span className="leading-none drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">{def.glyph}</span>
          {item!.quantity > 1 && <span className="absolute bottom-0 right-0.5 text-[11px] font-extrabold leading-none text-white [text-shadow:1px_1px_0_#000]">{item!.quantity}</span>}
          {dur !== null && dur !== false && (
            <span className="absolute inset-x-1 bottom-0.5 h-[3px] bg-black/70">
              <span className="block h-full" style={{ width: `${Math.max(8, dur * 100)}%`, background: dur > 0.5 ? "#4ade80" : dur > 0.25 ? "#facc15" : "#ef4444" }} />
            </span>
          )}
          {def.contraband && <span className="absolute left-0.5 top-0.5 h-1.5 w-1.5 bg-[#c81d25]" />}
        </>
      ) : ghost ? (
        <span className="text-xl opacity-20 grayscale">{ghost}</span>
      ) : null}
    </button>
  );
}

/** Lưới ô nhiều cột. Bấm ô để chuyển; chuột phải chuyển theo chế độ ngược lại (cả ô ↔ 1 món). */
export default function SlotGrid({
  items,
  slots,
  cols = 9,
  onMove,
}: {
  items: InventoryItem[];
  slots: number;
  cols?: number;
  /** `all` = chuyển cả ô, ngược lại chuyển 1 món */
  onMove: (index: number, item: InventoryItem, all: boolean) => void;
}) {
  const [hover, setHover] = useState<InventoryItem | null>(null);
  return (
    <div>
      <div className="grid gap-[3px] rounded-lg bg-[#07080f] p-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }, (_, i) => {
          const it = items[i];
          return <Slot key={i} item={it} disabled={!it} onHover={setHover} onClick={it ? () => onMove(i, it, true) : undefined} onContext={it ? () => onMove(i, it, false) : undefined} />;
        })}
      </div>
      <p className="mt-1 min-h-8 text-[11px] leading-snug text-slate-400">
        {hover ? (
          <>
            <b className="text-slate-200">
              {ITEM_DEFS[hover.itemId].glyph} {ITEM_DEFS[hover.itemId].name}
            </b>
            {ITEM_DEFS[hover.itemId].contraband && <span className="ml-1 text-[#ff8a7a]">(đồ cấm)</span>} — {ITEM_DEFS[hover.itemId].description}
          </>
        ) : (
          "Bấm một ô để chuyển cả ô · chuột phải để chuyển 1 món"
        )}
      </p>
    </div>
  );
}
