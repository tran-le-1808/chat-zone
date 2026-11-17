"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw, X } from "lucide-react";
import { useLobby } from "../../_context/BilliardLobbyContext";

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
export const fmtDuration = (ms: number | null) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} giờ ${m} phút` : m ? `${m} phút ${s % 60}s` : `${s}s`;
};

/** Huy hiệu rank (màu / biểu tượng lấy từ cấu hình server) */
export function RankBadge({ rankId, size = "md", showName = true }: { rankId: string; size?: "sm" | "md" | "lg"; showName?: boolean }) {
  const { rankOf } = useLobby();
  const r = rankOf(rankId);
  const color = r?.color ?? "#94a3b8";
  const dim = size === "lg" ? "h-14 w-14 text-3xl" : size === "sm" ? "h-6 w-6 text-sm" : "h-9 w-9 text-lg";
  return (
    <span className="inline-flex items-center gap-1.5" title={r?.name ?? rankId}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${dim}`}
        style={{ background: `radial-gradient(circle at 30% 25%, ${color}66, ${color}22)`, boxShadow: `0 0 0 2px ${color}88, 0 0 14px ${color}55` }}
      >
        {r?.icon ?? "🎱"}
      </span>
      {showName && <span className="font-bold" style={{ color }}>{r?.name ?? rankId}</span>}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-[#f4b942]/20 bg-[#11132a] text-white shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-md"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#11132a]/95 px-5 py-3.5 backdrop-blur">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#11132a]/80 p-4 shadow-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Loading({ text = "Đang tải…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#f4b942] border-t-transparent" />
      {text}
    </div>
  );
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-400">
      <Inbox className="h-7 w-7 opacity-60" />
      {text}
      {children}
    </div>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-red-200">
      <AlertTriangle className="h-7 w-7" />
      {text}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15">
          <RefreshCw className="h-3.5 w-3.5" /> Thử lại
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg bg-white/10 px-3 py-1.5 font-bold disabled:opacity-40">
        ‹
      </button>
      <span className="text-slate-300">
        Trang {page}/{pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg bg-white/10 px-3 py-1.5 font-bold disabled:opacity-40">
        ›
      </button>
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#f4b942]/60";
export const labelCls = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400";
