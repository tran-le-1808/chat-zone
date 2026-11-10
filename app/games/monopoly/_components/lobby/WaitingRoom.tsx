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
    <div className="min-h-screen bg-[#1a1c2b] p-4 text-white md:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* HEADER */}
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#262a40] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400">
                🎩 Cờ Tỷ Phú · Phòng chờ
              </p>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-4xl font-black tracking-[0.3em] text-cyan-300">
                  {code}
                </span>
                <button
                  onClick={() => copy(code, "mã phòng")}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  📋 Mã
                </button>
                <button
                  onClick={() => copy(inviteLink, "link mời")}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  🔗 Link mời
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Gửi mã hoặc link cho bạn bè để cùng vào phòng ·{" "}
                {room.players.length}/{MONOPOLY_MAX_PLAYERS} người
              </p>
            </div>
            <button
              onClick={() => void leaveRoom()}
              className="self-start rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-300 transition hover:bg-rose-500/20 md:self-center"
            >
              🚪 Rời phòng
            </button>
          </div>

          {/* SEATS */}
          <div className="grid gap-4 sm:grid-cols-2">
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
                    className="group flex min-h-36 items-center gap-3 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-white/30"
                  >
                    <PawnPreview
                      type={preset.type}
                      className="h-32 w-28 shrink-0 opacity-50 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
                    />
                    <div>
                      <div className="font-bold text-gray-400">Ghế trống</div>
                      <div className="text-xs text-gray-500">
                        Bấm để chọn quân{" "}
                        <span style={{ color: preset.color }}>
                          {preset.name}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              }

              return (
                <div
                  key={seat}
                  className={`relative flex min-h-36 items-center gap-3 rounded-3xl border bg-[#262a40] p-3 ${
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
                    className={`h-32 w-28 shrink-0 ${player.connected ? "" : "opacity-50 grayscale"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <PlayerAvatar
                        name={player.name}
                        avatar={player.avatar}
                        color={preset.color}
                        size={26}
                      />
                      {isPlayerHost && <span title="Chủ phòng">👑</span>}
                      <span className="truncate font-bold">{player.name}</span>
                      {isMe && (
                        <span className="rounded-md bg-cyan-500/20 px-1.5 text-[10px] text-cyan-300">
                          Bạn
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: preset.color }}>
                      Quân: {preset.name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      {!player.connected ? (
                        <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-gray-300">
                          📴 Mất kết nối
                        </span>
                      ) : isPlayerHost ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
                          Chủ phòng
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
                  </div>

                  {isHost && !isMe && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Mời ${player.name} ra khỏi phòng?`))
                          void kickPlayer(player.userId);
                      }}
                      className="absolute right-3 top-3 rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300 transition hover:bg-rose-500/30"
                      title="Kick khỏi phòng"
                    >
                      ✕ Kick
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* SETTINGS */}
          <div className="rounded-3xl border border-white/10 bg-[#262a40] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">⚙️ Cài đặt trận đấu</h3>
              {!isHost && (
                <span className="text-xs text-gray-400">
                  Chỉ chủ phòng được thay đổi
                </span>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="text-gray-400">💰 Tiền khởi điểm</span>
                <select
                  disabled={!isHost}
                  value={room.settings.startingMoney}
                  onChange={(e) =>
                    void updateSettings({
                      startingMoney: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#1d2032] px-3 py-2 outline-none disabled:opacity-60"
                >
                  {STARTING_MONEY_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      ${m.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-gray-400">🔒 Chế độ phòng</span>
                <select
                  disabled={!isHost}
                  value={room.settings.isPrivate ? "private" : "public"}
                  onChange={(e) =>
                    void updateSettings({
                      isPrivate: e.target.value === "private",
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#1d2032] px-3 py-2 outline-none disabled:opacity-60"
                >
                  <option value="public">Công khai (hiện trong sảnh)</option>
                  <option value="private">Riêng tư (chỉ vào bằng mã)</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Mỗi lượt tối đa {TURN_SECONDS} giây. Hết giờ, hệ thống sẽ tự động
              lắc xúc xắc (hoặc bỏ qua lựa chọn mua nhà / lễ hội).
            </p>
          </div>

          {/* ACTION */}
          <div className="flex flex-col items-center gap-2">
            {isHost ? (
              <>
                <button
                  disabled={!canStart}
                  onClick={() => void startGame()}
                  className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 py-4 text-lg font-black shadow-xl transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🎲 Bắt đầu trận đấu
                </button>
                <span className="text-xs text-gray-400">{startHint}</span>
              </>
            ) : (
              <button
                onClick={() => void setReady(!me?.ready)}
                className={`w-full max-w-sm rounded-2xl py-4 text-lg font-black shadow-xl transition active:scale-95 ${
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

        {/* CHAT */}
        <div className="h-[70vh] lg:sticky lg:top-8">
          <GameChat variant="inline" />
        </div>
      </div>
    </div>
  );
}
