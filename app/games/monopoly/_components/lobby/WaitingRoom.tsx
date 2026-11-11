"use client";

import React from "react";
import { toast } from "sonner";
import { INITIAL_PLAYERS } from "@/types/game.types";
import {
  MONOPOLY_MAX_PLAYERS,
  MONOPOLY_MIN_PLAYERS,
  STARTING_MONEY_OPTIONS,
  TURN_SECONDS,
} from "@/types/monopoly-room";
import { useRoom } from "../../_context/RoomContext";
import PlayerAvatar from "../PlayerAvatar";
import PawnPreview from "../PawnPreview";
import GameChat from "../GameChat";
import { useIsCompact } from "../ui/useScreen";
import VoiceControls, { VoiceBadge } from "../VoiceControls";

/**
 * Bố cục "gọn" cho điện thoại: màn hình dọc hẹp (< sm) hoặc điện thoại xoay ngang (thấp).
 * Ghế người chơi chuyển sang thẻ dọc (quân cờ ở trên, tên ở dưới).
 */
const SEAT_COMPACT =
  "max-sm:flex-col max-sm:justify-center max-sm:gap-1.5 max-sm:p-2.5 max-sm:pt-3 max-sm:text-center [@media(max-height:500px)]:flex-col [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:p-2 [@media(max-height:500px)]:text-center";
const PAWN_COMPACT =
  "max-sm:h-24 max-sm:w-20 [@media(max-height:500px)]:h-20 [@media(max-height:500px)]:w-16";

export default function WaitingRoom() {
  const {
    code,
    room,
    me,
    isHost,
    myUserId,
    leaveRoom,
    kickPlayer,
    setReady,
    changeSeat,
    updateSettings,
    startGame,
  } = useRoom();
  const isCompact = useIsCompact();

  if (!room) return null;

  const others = room.players.filter((p) => p.userId !== room.hostId);
  const allReady = others.every((p) => p.ready && p.connected);
  const enoughPlayers = room.players.length >= MONOPOLY_MIN_PLAYERS;
  const canStart = isHost && enoughPlayers && allReady;

  const startHint = !enoughPlayers
    ? `Cần ít nhất ${MONOPOLY_MIN_PLAYERS} người chơi`
    : !allReady
      ? "Đang chờ mọi người sẵn sàng"
      : "Mọi người đã sẵn sàng!";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${label}`);
    } catch {
      toast.error("Không sao chép được, hãy copy thủ công");
    }
  };

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/games/monopoly/room/${code}`
      : "";

  return (
    <div className="min-h-dvh bg-[#1a1c2b] p-3 text-white sm:p-4 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-4 sm:gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 sm:space-y-6">
          {/* HEADER */}
          <div className="rounded-3xl border border-white/10 bg-[#262a40] p-4 sm:p-5 [@media(max-height:500px)]:p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 sm:text-xs">
                  🎩 Cờ Tỷ Phú · Phòng chờ
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-mono text-2xl font-black tracking-[0.2em] text-cyan-300 sm:text-4xl sm:tracking-[0.3em]">
                    {code}
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      onClick={() => copy(code, "mã phòng")}
                      className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20 sm:px-3"
                    >
                      📋 Mã
                    </button>
                    <button
                      onClick={() => copy(inviteLink, "link mời")}
                      className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20 sm:px-3"
                    >
                      🔗 Link mời
                    </button>
                  </span>
                </div>
              </div>
              <button
                onClick={() => void leaveRoom()}
                className="shrink-0 whitespace-nowrap rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 sm:px-4 sm:text-sm"
              >
                🚪 Rời phòng
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400 sm:text-xs">
              Gửi mã hoặc link cho bạn bè để cùng vào phòng ·{" "}
              <b className="text-gray-200">
                {room.players.length}/{MONOPOLY_MAX_PLAYERS}
              </b>{" "}
              người
            </p>
            {/* Voice chat: bật ở đây thì vào game vẫn giữ */}
            <div className="mt-2.5 border-t border-white/10 pt-2.5">
              <VoiceControls variant="lobby" />
            </div>
          </div>

          {/* SEATS: điện thoại dọc 2 cột thẻ dọc, điện thoại ngang 4 cột */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 [@media(max-height:500px)]:grid-cols-4 [@media(max-height:500px)]:gap-2">
            {Array.from({ length: MONOPOLY_MAX_PLAYERS }, (_, seat) => {
              const preset = INITIAL_PLAYERS[seat];
              const player = room.players.find((p) => p.seat === seat);
              const isMe = player?.userId === myUserId;
              const isPlayerHost = player?.userId === room.hostId;

              if (!player) {
                return (
                  <button
                    key={seat}
                    onClick={() => void changeSeat(seat)}
                    className={`group flex min-h-36 items-center gap-3 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-white/30 max-sm:min-h-0 [@media(max-height:500px)]:min-h-0 ${SEAT_COMPACT}`}
                  >
                    <PawnPreview
                      type={preset.type}
                      className={`h-32 w-28 shrink-0 opacity-50 grayscale transition group-hover:opacity-100 group-hover:grayscale-0 ${PAWN_COMPACT}`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-400 sm:text-base">
                        Ghế trống
                      </div>
                      <div className="text-[11px] text-gray-500 sm:text-xs">
                        Bấm để chọn quân{" "}
                        <span style={{ color: preset.color }}>
                          {preset.name}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              }

              const status = !player.connected ? (
                <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-gray-300">
                  📴 Mất kết nối
                </span>
              ) : isPlayerHost ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
                  👑 Chủ phòng
                </span>
              ) : player.ready ? (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                  ✅ Sẵn sàng
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-gray-300">
                  ⏳ Chưa sẵn sàng
                </span>
              );

              return (
                <div
                  key={seat}
                  className={`relative flex min-h-36 items-center gap-3 rounded-3xl border bg-[#262a40] p-3 max-sm:min-h-0 [@media(max-height:500px)]:min-h-0 ${SEAT_COMPACT} ${
                    isMe ? "ring-2 ring-cyan-400/60" : ""
                  }`}
                  style={{ borderColor: `${preset.color}66` }}
                >
                  <PawnPreview
                    type={preset.type}
                    state={
                      !player.connected
                        ? "loser"
                        : player.ready || isPlayerHost
                          ? "moving"
                          : "idle"
                    }
                    className={`h-32 w-28 shrink-0 ${PAWN_COMPACT} ${player.connected ? "" : "opacity-50 grayscale"}`}
                  />
                  <div className="w-full min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5 max-sm:justify-center [@media(max-height:500px)]:justify-center">
                      <PlayerAvatar
                        name={player.name}
                        avatar={player.avatar}
                        color={preset.color}
                        size={22}
                      />
                      <span className="truncate text-sm font-bold sm:text-base">
                        {player.name}
                      </span>
                      <VoiceBadge userId={player.userId} />
                      {isMe && (
                        <span className="shrink-0 rounded-md bg-cyan-500/20 px-1.5 text-[10px] text-cyan-300">
                          Bạn
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[11px] sm:text-xs"
                      style={{ color: preset.color }}
                    >
                      Quân: {preset.name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold max-sm:justify-center sm:mt-2 sm:text-[11px] [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:justify-center">
                      {status}
                    </div>
                  </div>

                  {isHost && !isMe && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Mời ${player.name} ra khỏi phòng?`))
                          void kickPlayer(player.userId);
                      }}
                      className="absolute right-2 top-2 rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300 transition hover:bg-rose-500/30 sm:right-3 sm:top-3"
                      title="Kick khỏi phòng"
                      aria-label={`Kick ${player.name}`}
                    >
                      ✕
                      <span className="max-sm:hidden [@media(max-height:500px)]:hidden">
                        {" "}
                        Kick
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* SETTINGS */}
          <div className="rounded-3xl border border-white/10 bg-[#262a40] p-4 sm:p-5 [@media(max-height:500px)]:p-3">
            <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
              <h3 className="text-sm font-bold sm:text-base">
                ⚙️ Cài đặt trận đấu
              </h3>
              {!isHost && (
                <span className="text-right text-[11px] text-gray-400 sm:text-xs">
                  Chỉ chủ phòng được thay đổi
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <label className="min-w-0 space-y-1.5 text-xs sm:text-sm">
                <span className="text-gray-400">💰 Tiền khởi điểm</span>
                <select
                  disabled={!isHost}
                  value={room.settings.startingMoney}
                  onChange={(e) =>
                    void updateSettings({
                      startingMoney: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#1d2032] px-2.5 py-2 text-sm outline-none disabled:opacity-60 sm:px-3"
                >
                  {STARTING_MONEY_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      ${m.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 space-y-1.5 text-xs sm:text-sm">
                <span className="text-gray-400">🔒 Chế độ phòng</span>
                <select
                  disabled={!isHost}
                  value={room.settings.isPrivate ? "private" : "public"}
                  onChange={(e) =>
                    void updateSettings({
                      isPrivate: e.target.value === "private",
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#1d2032] px-2.5 py-2 text-sm outline-none disabled:opacity-60 sm:px-3"
                >
                  <option value="public">Công khai</option>
                  <option value="private">Riêng tư (chỉ vào bằng mã)</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-[11px] text-gray-500 sm:text-xs">
              Mỗi lượt tối đa {TURN_SECONDS} giây. Hết giờ, hệ thống sẽ tự động
              lắc xúc xắc (hoặc bỏ qua lựa chọn mua nhà / lễ hội).
            </p>
          </div>

          {/* ACTION — điện thoại: dính đáy màn hình để luôn bấm được */}
          <div className="z-20 flex flex-col items-center gap-1.5 max-lg:sticky max-lg:bottom-0 [@media(max-height:500px)]:static max-lg:-mx-3 max-lg:bg-gradient-to-t max-lg:from-[#1a1c2b] max-lg:via-[#1a1c2b]/95 max-lg:to-transparent max-lg:px-3 max-lg:pb-[max(12px,env(safe-area-inset-bottom))] max-lg:pt-4 sm:gap-2">
            {isHost ? (
              <>
                <button
                  disabled={!canStart}
                  onClick={() => void startGame()}
                  className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 py-3 text-base font-black shadow-xl transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:py-4 sm:text-lg [@media(max-height:500px)]:py-2.5"
                >
                  🎲 Bắt đầu trận đấu
                </button>
                <span className="text-[11px] text-gray-400 sm:text-xs">
                  {startHint}
                </span>
              </>
            ) : (
              <button
                onClick={() => void setReady(!me?.ready)}
                className={`w-full max-w-sm rounded-2xl py-3 text-base font-black shadow-xl transition active:scale-95 sm:py-4 sm:text-lg [@media(max-height:500px)]:py-2.5 ${
                  me?.ready
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90"
                }`}
              >
                {me?.ready ? "↩️ Huỷ sẵn sàng" : "✅ Sẵn sàng"}
              </button>
            )}
          </div>
        </div>

        {/* CHAT: điện thoại -> nút 💬 nổi + modal (như trong game); iPad / desktop -> cột bên */}
        {isCompact ? (
          <GameChat variant="modal" />
        ) : (
          <div className="h-[60dvh] min-h-[360px] lg:sticky lg:top-8 lg:h-[70vh]">
            <GameChat variant="inline" />
          </div>
        )}
      </div>
    </div>
  );
}
