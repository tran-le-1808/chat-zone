"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AlertTriangle, HelpCircle, LogOut, type LucideIcon } from "lucide-react";
import DongSonDrum from "@/components/ui/DongSonDrum";
import { ui } from "@/components/ui/styles";

export type ConfirmTone = "danger" | "warning" | "default";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** danger: hành động mất mát (rời trận, xin thua, mời ra) — nút xác nhận đỏ, mặc định focus nút Huỷ */
  tone?: ConfirmTone;
  icon?: LucideIcon;
}

interface Request extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

// ---- Kho trạng thái nhỏ (ngoài React) để gọi được từ bất cứ đâu, như window.confirm ----
let queue: Request[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getCurrent = () => queue[0] ?? null;
const getServer = () => null;

/**
 * Hộp thoại xác nhận thay cho window.confirm. Trả về true nếu người dùng đồng ý.
 *   if (!(await confirmDialog({ title: "Rời phòng?", tone: "danger" }))) return;
 * Cần <ConfirmHost /> trong layout gốc. Nhiều yêu cầu cùng lúc sẽ hiện lần lượt.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    queue = [...queue, { ...options, id: nextId++, resolve }];
    emit();
  });
}

function settle(id: number, ok: boolean) {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  queue = queue.filter((r) => r.id !== id);
  emit();
  req.resolve(ok);
}

const TONE: Record<ConfirmTone, { icon: LucideIcon; badge: string; confirm: string }> = {
  danger: {
    icon: LogOut,
    badge: "bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_4px_0_#7f1118] text-white",
    confirm: ui.btnPrimary,
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-[#f4b942]/15 text-[#ffd166] ring-1 ring-[#f4b942]/40",
    confirm: ui.btnGold,
  },
  default: {
    icon: HelpCircle,
    badge: "bg-[#f4b942]/15 text-[#ffd166] ring-1 ring-[#f4b942]/40",
    confirm: ui.btnPrimary,
  },
};

/** Gắn 1 lần ở layout gốc */
export function ConfirmHost() {
  const req = useSyncExternalStore(subscribe, getCurrent, getServer);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus nút an toàn khi mở; trả focus về chỗ cũ khi đóng
  useEffect(() => {
    if (!req) return;
    const prev = document.activeElement as HTMLElement | null;
    const target = (req.tone ?? "default") === "danger" ? cancelRef.current : confirmRef.current;
    target?.focus();
    return () => prev?.focus?.();
  }, [req]);

  // Esc = huỷ, Tab xoay vòng trong hộp thoại
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        settle(req.id, false);
      } else if (e.key === "Tab") {
        const items = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        const i = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length]?.focus();
      }
      // Không cho phím tắt của game (Space = đánh, mũi tên…) lọt xuống dưới
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [req]);

  if (!req) return null;
  const tone = TONE[req.tone ?? "default"];
  const Icon = req.icon ?? tone.icon;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm animate-overlay-in sm:items-center sm:p-4 [@media(max-height:500px)]:items-center [@media(max-height:500px)]:p-3"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) settle(req.id, false);
      }}
    >
      <div
        ref={dialogRef}
        key={req.id}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`confirm-title-${req.id}`}
        aria-describedby={req.message ? `confirm-msg-${req.id}` : undefined}
        className={`relative w-full max-w-sm overflow-hidden rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white animate-dialog-in sm:rounded-3xl [@media(max-height:500px)]:rounded-3xl [@media(max-height:500px)]:p-4 ${ui.card} border-[#f4b942]/25 bg-[#11132a]`}
      >
        {/* Hoạ tiết trống đồng mờ */}
        <DongSonDrum className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 text-[#ffd166]/[0.06]" />
        <div className="relative flex flex-col items-center text-center">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl [@media(max-height:500px)]:h-10 [@media(max-height:500px)]:w-10 ${tone.badge}`}>
            <Icon className="h-6 w-6 [@media(max-height:500px)]:h-5 [@media(max-height:500px)]:w-5" />
          </span>
          <h2 id={`confirm-title-${req.id}`} className="mt-3 text-lg font-extrabold leading-snug text-[#ffd166] [@media(max-height:500px)]:mt-2 [@media(max-height:500px)]:text-base">
            {req.title}
          </h2>
          {req.message && (
            <div id={`confirm-msg-${req.id}`} className="mt-1.5 text-sm leading-relaxed text-slate-300">
              {req.message}
            </div>
          )}
        </div>
        <div className="relative mt-5 flex gap-2.5 [@media(max-height:500px)]:mt-3">
          <button ref={cancelRef} type="button" onClick={() => settle(req.id, false)} className={`${ui.btnGhost} flex-1 border border-white/10 px-3! py-2.5!`}>
            {req.cancelText ?? "Huỷ"}
          </button>
          <button ref={confirmRef} type="button" onClick={() => settle(req.id, true)} className={`${tone.confirm} flex-1 px-3! py-2.5!`}>
            {req.confirmText ?? "Đồng ý"}
          </button>
        </div>
      </div>
    </div>
  );
}
