"use client";

import { useEffect } from "react";
import {
  Copy,
  CornerUpLeft,
  Pencil,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";

export interface MessageMenuState {
  messageId: string;
  /** Vị trí mở menu (toạ độ màn hình) — bỏ qua khi `sheet` */
  x: number;
  y: number;
  /** Mobile: bảng hành động từ dưới lên */
  sheet: boolean;
}

interface Props {
  state: MessageMenuState;
  canCopy: boolean;
  canEdit: boolean;
  canRecall: boolean;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onRecall: () => void;
  onClose: () => void;
}

/** Menu hành động của một tin: Trả lời · Sao chép · Chỉnh sửa · Xoá ở phía bạn · Thu hồi */
export default function MessageMenu({
  state,
  canCopy,
  canEdit,
  canRecall,
  onReply,
  onCopy,
  onEdit,
  onDeleteForMe,
  onRecall,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items: {
    key: string;
    label: string;
    Icon: LucideIcon;
    run: () => void;
    danger?: boolean;
    show: boolean;
  }[] = [
    {
      key: "reply",
      label: "Trả lời",
      Icon: CornerUpLeft,
      run: onReply,
      show: true,
    },
    { key: "copy", label: "Sao chép", Icon: Copy, run: onCopy, show: canCopy },
    {
      key: "edit",
      label: "Chỉnh sửa",
      Icon: Pencil,
      run: onEdit,
      show: canEdit,
    },
    {
      key: "me",
      label: "Xoá ở phía bạn",
      Icon: Trash2,
      run: onDeleteForMe,
      show: true,
    },
    {
      key: "all",
      label: "Thu hồi",
      Icon: Undo2,
      run: onRecall,
      danger: true,
      show: canRecall,
    },
  ];

  const list = (
    <ul role="menu" className="py-1">
      {items
        .filter((i) => i.show)
        .map(({ key, label, Icon, run, danger }) => (
          <li key={key} role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                onClose();
                run();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${
                danger ? "text-rose-300" : "text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          </li>
        ))}
    </ul>
  );

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.sheet ? (
        <div
          className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-[#161833] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
          {list}
        </div>
      ) : (
        <div
          className="absolute w-52 overflow-hidden rounded-xl border border-white/10 bg-[#161833] shadow-2xl"
          style={{
            left: Math.min(state.x, window.innerWidth - 216),
            top: Math.min(state.y, window.innerHeight - 230),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {list}
        </div>
      )}
    </div>
  );
}
