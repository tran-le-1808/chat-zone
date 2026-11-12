"use client";

import { useEffect, type ReactNode } from "react";
import {
  CircleCheck,
  Copy,
  Crown,
  Hourglass,
  Link2,
  LogOut,
  MessageCircle,
  Play,
  Settings2,
  Undo2,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import DongSonDrum from "@/components/ui/DongSonDrum";
import { ui } from "@/components/ui/styles";
import GameChat from "../monopoly/_components/GameChat";
import VoiceControls from "../monopoly/_components/VoiceControls";
import { useMediaQuery } from "../monopoly/_components/ui/useScreen";

/** Màn hình đủ rộng & cao để đặt khung chat thành cột bên (desktop / laptop) */
const WIDE_QUERY = "(min-width: 1024px) and (min-height: 600px)";

/** Kích thước nút hành động chính (dùng `!` để thắng padding của ui.btn*) */
const ACTION = `w-full max-w-md py-3.5! text-base sm:text-lg [@media(max-height:500px)]:w-auto [@media(max-height:500px)]:min-w-64 [@media(max-height:500px)]:py-2.5! [@media(max-height:500px)]:text-base`;

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  } catch {
    toast.error("Không sao chép được, hãy copy thủ công");
  }
}

/* ------------------------------------------------------------------ */
/* Nhãn trạng thái của ghế                                             */
/* ------------------------------------------------------------------ */
export function SeatStatus({
  connected,
  host,
  ready,
}: {
  connected: boolean;
  host: boolean;
  ready: boolean;
}) {
  const base =
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-[11px]";
  if (!connected)
    return (
      <span className={`${base} bg-white/10 text-slate-400`}>
        <WifiOff className="h-3 w-3" /> Mất kết nối
      </span>
    );
  if (host)
    return (
      <span className={`${base} bg-[#f4b942]/15 text-[#ffd166]`}>
        <Crown className="h-3 w-3" /> Chủ phòng
      </span>
    );
  if (ready)
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-300`}>
        <CircleCheck className="h-3 w-3" /> Sẵn sàng
      </span>
    );
  return (
    <span className={`${base} bg-white/10 text-slate-300`}>
      <Hourglass className="h-3 w-3" /> Chưa sẵn sàng
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Nút chọn dạng "chip" dùng trong modal cài đặt                       */
/* ------------------------------------------------------------------ */
export function OptionGroup<T extends string | number>({
  label,
  icon: Icon,
  value,
  options,
  disabled,
  onChange,
  cols = 2,
}: {
  label: string;
  icon: LucideIcon;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
  cols?: 2 | 3 | 4;
}) {
  const grid = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  }[cols];
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5 text-[#f4b942]" /> {label}
      </legend>
      <div className={`grid gap-2 ${grid}`}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => !active && onChange(o.value)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition disabled:cursor-not-allowed ${
                active
                  ? "border-[#f4b942]/70 bg-[#f4b942]/15 text-[#ffd166] shadow-[0_0_0_3px_rgba(244,185,66,0.1)]"
                  : "border-white/10 bg-white/[0.03] text-slate-300 enabled:hover:border-white/25 enabled:hover:text-white disabled:opacity-50"
              }`}
            >
              {o.label}
              {o.hint && (
                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                  {o.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Modal cài đặt                                                       */
/* ------------------------------------------------------------------ */
function SettingsModal({
  title,
  isHost,
  onClose,
  children,
}: {
  title: string;
  isHost: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="wr-sheet-in relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[#f4b942]/15 bg-[#11132a] shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-[#c81d25] to-[#e8772e]">
            <Settings2 className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold">{title}</h2>
            <p className="text-xs text-slate-400">
              {isHost
                ? "Thay đổi được áp dụng ngay cho cả phòng"
                : "Chỉ chủ phòng được thay đổi"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {children}
        </div>
        <div className="border-t border-white/10 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className={`${ui.btnPrimary} w-full`}
          >
            Xong
          </button>
        </div>
      </div>
      <style>{`
        @keyframes wr-sheet-in { from { transform: translateY(32px); opacity: 0 } to { transform: none; opacity: 1 } }
        .wr-sheet-in { animation: wr-sheet-in .22s ease-out both }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Khung phòng chờ                                                     */
/* ------------------------------------------------------------------ */
export interface WaitingRoomShellProps {
  gameName: string;
  gameIcon: LucideIcon;
  code: string;
  invitePath: string;
  playerCount: number;
  maxPlayers: number;
  onLeave: () => void;
  /** Lưới ghế (tự co giãn để vừa khung hình) */
  seats: ReactNode;
  /** Các "chip" tóm tắt luật đang chọn */
  summary: ReactNode;
  settingsTitle: string;
  settings: ReactNode;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  isHost: boolean;
  canStart: boolean;
  startHint: string;
  ready: boolean;
  onStart: () => void;
  onToggleReady: () => void;
}

export default function WaitingRoomShell(props: WaitingRoomShellProps) {
  const {
    gameName,
    gameIcon: GameIcon,
    code,
    invitePath,
    playerCount,
    maxPlayers,
    onLeave,
    seats,
    summary,
    settingsTitle,
    settings,
    settingsOpen,
    onSettingsOpenChange,
    isHost,
    canStart,
    startHint,
    ready,
    onStart,
    onToggleReady,
  } = props;
  const wide = useMediaQuery(WIDE_QUERY);

  const inviteLink = () => `${window.location.origin}${invitePath}`;
  const iconBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-[#f4b942]/40 hover:text-[#ffd166] active:scale-95 sm:h-10 sm:w-10";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0d0f1e] text-white">
      {/* Nền */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#c81d25]/20 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-[480px] w-[480px] rounded-full bg-[#f4b942]/10 blur-[140px]" />
        <DongSonDrum className="absolute left-1/2 top-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 text-[#f4b942]/[0.035]" />
      </div>

      {/* THANH TIÊU ĐỀ (không dùng backdrop-blur: modal chat bên trong dùng position: fixed) */}
      <header className="relative z-10 shrink-0 border-b border-[#f4b942]/15 bg-[#11132a]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 [@media(max-height:500px)]:py-1.5">
          <button
            type="button"
            onClick={onLeave}
            aria-label="Rời phòng"
            title="Rời phòng"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#c81d25]/40 bg-[#c81d25]/10 px-2.5 text-sm font-bold text-[#ff8a7a] transition hover:bg-[#c81d25]/25 active:scale-95 sm:h-10 sm:px-3"
          >
            <LogOut className="h-4 w-4 rotate-180" />
            <span className="max-sm:hidden">Rời phòng</span>
          </button>

          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_3px_0_#7f1118] max-[359px]:hidden sm:h-10 sm:w-10`}
          >
            <GameIcon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
              {gameName}
              <span className="max-sm:hidden"> · Phòng chờ</span>
            </p>
            <button
              type="button"
              onClick={() => void copy(code, "mã phòng")}
              title="Sao chép mã phòng"
              className="group flex items-center gap-1.5"
            >
              <span className="font-mono text-lg font-black tracking-[0.2em] text-[#ffd166] sm:text-2xl sm:tracking-[0.3em]">
                {code}
              </span>
              <Copy className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-[#ffd166]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void copy(inviteLink(), "link mời")}
            aria-label="Sao chép link mời"
            title="Sao chép link mời"
            className={iconBtn}
          >
            <Link2 className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => onSettingsOpenChange(true)}
            aria-label="Cài đặt trận đấu"
            title="Cài đặt trận đấu"
            className={iconBtn}
          >
            <Settings2 className="h-4.5 w-4.5" />
          </button>
          {!wide && (
            <GameChat
              variant="modal"
              trigger={({ onClick, unread }) => (
                <button
                  type="button"
                  onClick={onClick}
                  aria-label="Mở khung chat"
                  title="Chat phòng"
                  className={`${iconBtn} relative`}
                >
                  <MessageCircle className="h-4.5 w-4.5" />
                  {unread > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c81d25] px-1 text-[10px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              )}
            />
          )}
        </div>
      </header>

      {/* NỘI DUNG */}
      <div
        className={`relative z-0 mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-5 px-3 pt-3 sm:px-5 sm:pt-4 lg:pt-6 [@media(max-height:500px)]:pt-2`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 sm:gap-3">
          {/* Voice + số người */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <VoiceControls variant="lobby" />
            <span className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-slate-300">
              <Users className="h-3.5 w-3.5 text-[#f4b942]" />
              {playerCount}/{maxPlayers} người
            </span>
          </div>

          {/* Ghế: chiếm phần còn lại, không cuộn trang */}
          <div className="min-h-0 flex-1">{seats}</div>

          {/* Tóm tắt luật -> bấm mở modal */}
          <button
            type="button"
            onClick={() => onSettingsOpenChange(true)}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-[#11132a]/85 px-3 py-2 text-left transition hover:border-[#f4b942]/40 sm:px-4 sm:py-2.5"
          >
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {summary}
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#ffd166]">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="max-[380px]:hidden">
                {isHost ? "Chỉnh luật" : "Xem luật"}
              </span>
            </span>
          </button>

          {/* Hành động */}
          <div
            className={`flex shrink-0 flex-col items-center gap-1 pb-[max(10px,env(safe-area-inset-bottom))] sm:pb-5 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:gap-3 [@media(max-height:500px)]:pb-2`}
          >
            {isHost ? (
              <>
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={onStart}
                  className={`${ui.btnPrimary} ${ACTION}`}
                >
                  <Play className="h-5 w-5 fill-current" /> Bắt đầu trận đấu
                </button>
                <span className="text-[11px] text-slate-400 sm:text-xs">
                  {startHint}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={onToggleReady}
                className={`${ACTION} ${
                  ready
                    ? "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] font-bold text-slate-200 transition hover:bg-white/10 active:translate-y-[2px]"
                    : ui.btnPrimary
                }`}
              >
                {ready ? (
                  <>
                    <Undo2 className="h-5 w-5" /> Huỷ sẵn sàng
                  </>
                ) : (
                  <>
                    <CircleCheck className="h-5 w-5" /> Sẵn sàng
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Desktop: chat là cột bên */}
        {wide && (
          <aside className="w-[340px] shrink-0 pb-5 xl:w-[360px]">
            <GameChat variant="inline" />
          </aside>
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          title={settingsTitle}
          isHost={isHost}
          onClose={() => onSettingsOpenChange(false)}
        >
          {settings}
        </SettingsModal>
      )}
    </div>
  );
}

/** "Chip" nhỏ tóm tắt 1 luật (hiển thị ở thanh luật phía dưới) */
export function RuleChip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-200 sm:text-xs">
      <Icon className="h-3.5 w-3.5 text-[#f4b942]" />
      {children}
    </span>
  );
}
