"use client";

import React from "react";
import { useOptionalVoice } from "../_context/VoiceContext";

/**
 * Nút điều khiển voice chat.
 * - lobby: thanh nút trong phòng chờ
 * - game: cụm nút tròn nổi trên bàn cờ (dưới nút chat)
 */
export default function VoiceControls({
  variant,
}: {
  variant: "lobby" | "game";
}) {
  const voice = useOptionalVoice();
  if (!voice) return null;
  const {
    supported,
    enabled,
    connecting,
    muted,
    users,
    audioBlocked,
    join,
    leave,
    toggleMute,
    resumeAudio,
  } = voice;
  const count = Object.keys(users).length;

  if (variant === "lobby") {
    if (!supported) {
      return (
        <span className="text-[11px] text-gray-500">
          🎙️ Trình duyệt không hỗ trợ voice chat
        </span>
      );
    }
    if (!enabled) {
      return (
        <button
          type="button"
          disabled={connecting}
          onClick={() => void join()}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
        >
          {connecting ? "⏳ Đang bật mic..." : "🎙️ Bật voice chat"}
          {count > 0 && !connecting && (
            <span className="rounded-full bg-emerald-500/25 px-1.5 text-[10px]">
              {count} đang nói chuyện
            </span>
          )}
        </button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Voice · {count} người
        </span>
        <button
          type="button"
          onClick={toggleMute}
          className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
            muted
              ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {muted ? "🔇 Mở mic" : "🎙️ Tắt mic"}
        </button>
        {audioBlocked && (
          <button
            type="button"
            onClick={resumeAudio}
            className="rounded-xl bg-amber-500/20 px-2.5 py-1.5 text-xs font-bold text-amber-300"
          >
            🔊 Bật âm thanh
          </button>
        )}
        <button
          type="button"
          onClick={leave}
          className="rounded-xl bg-white/5 px-2.5 py-1.5 text-xs font-bold text-gray-300 transition hover:bg-white/15"
        >
          📵 Rời voice
        </button>
      </div>
    );
  }

  // ===== Trong game: nút tròn nổi =====
  if (!supported) return null;
  const round =
    "relative flex h-10 w-10 items-center justify-center rounded-full text-lg text-white shadow-xl transition active:scale-95 md:h-12 md:w-12 md:text-xl [@media(max-height:500px)]:h-10 [@media(max-height:500px)]:w-10 [@media(max-height:500px)]:text-lg";

  return (
    <div // Điện thoại: cột trái dưới nút chat; desktop: hàng ngang dưới thanh mã phòng (bên trái, không đè khung chat)
      className="absolute left-1.5 top-[132px] z-40 flex flex-col gap-2 md:left-4 md:top-[148px] md:flex-row [@media(max-height:500px)]:left-1.5 [@media(max-height:500px)]:top-[132px] [@media(max-height:500px)]:flex-col"
    >
      {!enabled ? (
        <button
          type="button"
          disabled={connecting}
          onClick={() => void join()}
          aria-label="Bật voice chat"
          title="Bật voice chat"
          className={`${round} bg-gradient-to-br from-emerald-400 to-emerald-600 disabled:opacity-60`}
        >
          {connecting ? "⏳" : "🎙️"}
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-300 px-1 text-[10px] font-bold text-emerald-900">
              {count}
            </span>
          )}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Mở mic" : "Tắt mic"}
            title={muted ? "Mở mic" : "Tắt mic"}
            className={`${round} ${
              muted
                ? "bg-gradient-to-br from-rose-400 to-rose-600"
                : "bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-emerald-300/60"
            }`}
          >
            {muted ? "🔇" : "🎙️"}
          </button>
          {audioBlocked && (
            <button
              type="button"
              onClick={resumeAudio}
              aria-label="Bật âm thanh"
              title="Bấm để nghe mọi người"
              className={`${round} animate-pulse bg-gradient-to-br from-amber-400 to-amber-600`}
            >
              🔊
            </button>
          )}
          <button
            type="button"
            onClick={leave}
            aria-label="Rời voice chat"
            title="Rời voice chat"
            className={`${round} bg-slate-700/90`}
          >
            📵
          </button>
        </>
      )}
    </div>
  );
}

/** Biểu tượng mic nhỏ cạnh tên người chơi: 🎙️ (sáng khi đang nói) / 🔇 */
export function VoiceBadge({
  userId,
  size = "sm",
}: {
  userId?: string;
  size?: "xs" | "sm";
}) {
  const voice = useOptionalVoice();
  if (!voice || !userId) return null;
  const u = voice.users[userId];
  if (!u) return null;
  const talking = !u.muted && !!voice.speaking[userId];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition ${
        size === "xs" ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[11px]"
      } ${
        u.muted
          ? "bg-rose-500/25"
          : talking
            ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.35),0_0_12px_rgba(52,211,153,0.8)]"
            : "bg-emerald-500/25"
      }`}
      title={u.muted ? "Đang tắt mic" : talking ? "Đang nói" : "Trong voice"}
    >
      {u.muted ? "🔇" : "🎙️"}
    </span>
  );
}
