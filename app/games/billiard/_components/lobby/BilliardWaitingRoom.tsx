"use client";

import { toast } from "sonner";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import GameChat from "../../../monopoly/_components/GameChat";
import VoiceControls, {
  VoiceBadge,
} from "../../../monopoly/_components/VoiceControls";
import { useIsCompact } from "../../../monopoly/_components/ui/useScreen";
import {
  ALLOWED_TARGETS,
  BALL_COLORS,
  BALL_NAMES,
  BILLIARD_MAX_PLAYERS,
  BILLIARD_TURN_SECONDS,
  MODE_LABEL,
  type BilliardSettings,
} from "../../_lib/types";
import type { CaromMode } from "../../_lib/physics";

/** Viên bi vẽ bằng CSS (xem trước bi cái của mỗi ghế) */
function BallPreview({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <span
      className={`block h-14 w-14 shrink-0 rounded-full shadow-[inset_-6px_-8px_14px_rgba(0,0,0,0.35),0_6px_14px_rgba(0,0,0,0.4)] sm:h-16 sm:w-16 ${dim ? "opacity-40 grayscale" : ""}`}
      style={{
        background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${color} 38%, ${color} 70%, #00000066 100%)`,
      }}
    />
  );
}

export default function BilliardWaitingRoom() {
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

  const settings = room.settings as unknown as BilliardSettings;
  const others = room.players.filter((p) => p.userId !== room.hostId);
  const allReady = others.every((p) => p.ready && p.connected);
  const full = room.players.length >= BILLIARD_MAX_PLAYERS;
  const canStart = isHost && full && allReady;
  const startHint = !full
    ? "Cần 2 người chơi — gửi mã phòng cho bạn bè"
    : !allReady
      ? "Đang chờ đối thủ sẵn sàng"
      : "Sẵn sàng thi đấu!";

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
      ? `${window.location.origin}/games/billiard/room/${code}`
      : "";

  return (
    <div className="min-h-dvh bg-[#14161f] p-3 text-white sm:p-4 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-4 sm:gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 sm:space-y-6">
          {/* HEADER */}
          <div className="rounded-3xl border border-white/10 bg-[#1f2230] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 sm:text-xs">
                  🎱 Bida Carom · Phòng chờ
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-mono text-2xl font-black tracking-[0.2em] text-emerald-300 sm:text-4xl sm:tracking-[0.3em]">
                    {code}
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => copy(code, "mã phòng")}
                      className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"
                    >
                      📋 Mã
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(inviteLink, "link mời")}
                      className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"
                    >
                      🔗 Link mời
                    </button>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void leaveRoom()}
                className="shrink-0 whitespace-nowrap rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 sm:text-sm"
              >
                🚪 Rời phòng
              </button>
            </div>
            <div className="mt-2.5 border-t border-white/10 pt-2.5">
              <VoiceControls variant="lobby" />
            </div>
          </div>

          {/* 2 GHẾ */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {Array.from({ length: BILLIARD_MAX_PLAYERS }, (_, seat) => {
              const player = room.players.find((p) => p.seat === seat);
              const isMe = player?.userId === myUserId;
              const isPlayerHost = player?.userId === room.hostId;
              if (!player) {
                return (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => void changeSeat(seat)}
                    className="group flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-4 text-center transition hover:border-white/30"
                  >
                    <BallPreview color={BALL_COLORS[seat]} dim />
                    <div className="text-sm font-bold text-gray-400">
                      Ghế trống
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Bấm để cầm {BALL_NAMES[seat].toLowerCase()}
                    </div>
                  </button>
                );
              }
              return (
                <div
                  key={seat}
                  className={`relative flex flex-col items-center gap-2 rounded-3xl border bg-[#1f2230] p-4 text-center ${isMe ? "ring-2 ring-emerald-400/60" : ""}`}
                  style={{ borderColor: `${BALL_COLORS[seat]}66` }}
                >
                  <BallPreview
                    color={BALL_COLORS[seat]}
                    dim={!player.connected}
                  />
                  <div className="flex min-w-0 max-w-full items-center gap-1.5">
                    <PlayerAvatar
                      name={player.name}
                      avatar={player.avatar}
                      size={22}
                    />
                    <span className="truncate text-sm font-bold sm:text-base">
                      {player.name}
                    </span>
                    <VoiceBadge userId={player.userId} />
                    {isMe && (
                      <span className="shrink-0 rounded-md bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">
                        Bạn
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {BALL_NAMES[seat]} · {seat === 0 ? "khai cuộc" : "đánh sau"}
                  </div>
                  <div className="text-[10px] font-semibold sm:text-[11px]">
                    {!player.connected ? (
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
                    )}
                  </div>
                  {isHost && !isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Mời ${player.name} ra khỏi phòng?`))
                          void kickPlayer(player.userId);
                      }}
                      aria-label={`Kick ${player.name}`}
                      className="absolute right-2 top-2 rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/30"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* CÀI ĐẶT */}
          <div className="rounded-3xl border border-white/10 bg-[#1f2230] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold sm:text-base">
                ⚙️ Luật thi đấu
              </h3>
              {!isHost && (
                <span className="text-[11px] text-gray-400">
                  Chỉ chủ phòng được thay đổi
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <label className="min-w-0 space-y-1.5 text-xs sm:text-sm">
                <span className="text-gray-400">🎱 Chế độ</span>
                <select
                  disabled={!isHost}
                  value={settings.mode}
                  onChange={(e) =>
                    void updateSettings({ mode: e.target.value as CaromMode })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#181a24] px-2.5 py-2 text-sm outline-none disabled:opacity-60"
                >
                  {(Object.keys(MODE_LABEL) as CaromMode[]).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 space-y-1.5 text-xs sm:text-sm">
                <span className="text-gray-400">🏁 Điểm thắng</span>
                <select
                  disabled={!isHost}
                  value={settings.target}
                  onChange={(e) =>
                    void updateSettings({ target: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#181a24] px-2.5 py-2 text-sm outline-none disabled:opacity-60"
                >
                  {ALLOWED_TARGETS[settings.mode].map((t) => (
                    <option key={t} value={t}>
                      Chạm {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 space-y-1.5 text-xs sm:text-sm">
                <span className="text-gray-400">🔒 Chế độ phòng</span>
                <select
                  disabled={!isHost}
                  value={settings.isPrivate ? "private" : "public"}
                  onChange={(e) =>
                    void updateSettings({
                      isPrivate: e.target.value === "private",
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#181a24] px-2.5 py-2 text-sm outline-none disabled:opacity-60"
                >
                  <option value="public">Công khai</option>
                  <option value="private">Riêng tư (chỉ vào bằng mã)</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-500 sm:text-xs">
              {settings.mode === "free"
                ? "Phăng: bi cái chạm được cả 2 bi còn lại là ghi 1 điểm."
                : "3 băng: bi cái phải chạm ít nhất 3 lần vào băng trước khi chạm bi mục tiêu thứ hai."}{" "}
              Ghi điểm thì được đánh tiếp. Mỗi lượt tối đa{" "}
              {BILLIARD_TURN_SECONDS} giây.
            </p>
          </div>

          {/* HÀNH ĐỘNG */}
          <div className="z-20 flex flex-col items-center gap-1.5 max-lg:sticky max-lg:bottom-0 max-lg:-mx-3 max-lg:bg-gradient-to-t max-lg:from-[#14161f] max-lg:via-[#14161f]/95 max-lg:to-transparent max-lg:px-3 max-lg:pb-[max(12px,env(safe-area-inset-bottom))] max-lg:pt-4 [@media(max-height:500px)]:static">
            {isHost ? (
              <>
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={() => void startGame()}
                  className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 text-base font-black text-slate-900 shadow-xl transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:py-4 sm:text-lg"
                >
                  🎱 Bắt đầu trận đấu
                </button>
                <span className="text-[11px] text-gray-400 sm:text-xs">
                  {startHint}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void setReady(!me?.ready)}
                className={`w-full max-w-sm rounded-2xl py-3 text-base font-black shadow-xl transition active:scale-95 sm:py-4 sm:text-lg ${
                  me?.ready
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gradient-to-r from-emerald-400 to-cyan-500 text-slate-900 hover:opacity-90"
                }`}
              >
                {me?.ready ? "↩️ Huỷ sẵn sàng" : "✅ Sẵn sàng"}
              </button>
            )}
          </div>
        </div>

        {/* CHAT */}
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
