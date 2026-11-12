"use client";

import { useState } from "react";
import { Coins, Dices, Globe, Lock, Timer, UserX } from "lucide-react";
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
import { VoiceBadge } from "../VoiceControls";
import WaitingRoomShell, {
  OptionGroup,
  RuleChip,
  SeatStatus,
} from "../../../_shared/WaitingRoomShell";

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
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Điện thoại dọc / desktop: lưới 2×2 · điện thoại ngang: 1 hàng 4 ghế
  const seats = (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-2 sm:gap-3 [@media(max-height:500px)]:grid-cols-4 [@media(max-height:500px)]:grid-rows-1">
      {Array.from({ length: MONOPOLY_MAX_PLAYERS }, (_, seat) => {
        const preset = INITIAL_PLAYERS[seat];
        const player = room.players.find((p) => p.seat === seat);
        const isMe = player?.userId === myUserId;
        const isPlayerHost = player?.userId === room.hostId;

        if (!player) {
          return (
            <button
              key={seat}
              type="button"
              onClick={() => void changeSeat(seat)}
              className="group flex min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-2 text-center transition hover:border-[#f4b942]/40 hover:bg-[#f4b942]/[0.04]"
            >
              <PawnPreview
                type={preset.type}
                className="min-h-0 w-full max-w-36 flex-1 opacity-45 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
              />
              <span className="shrink-0 text-sm font-bold text-slate-400">
                Ghế trống
              </span>
              <span className="shrink-0 text-[11px] text-slate-500">
                Chọn quân <b style={{ color: preset.color }}>{preset.name}</b>
              </span>
            </button>
          );
        }

        return (
          <div
            key={seat}
            className={`relative flex min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl border bg-[#11132a]/85 p-2 text-center ${
              isMe ? "shadow-[0_0_0_2px_rgba(244,185,66,0.55)]" : ""
            }`}
            style={{ borderColor: `${preset.color}77` }}
          >
            {/* Ánh màu quân cờ */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-25"
              style={{
                background: `radial-gradient(ellipse at 50% 30%, ${preset.color}, transparent 70%)`,
              }}
            />
            <PawnPreview
              type={preset.type}
              state={
                !player.connected
                  ? "loser"
                  : player.ready || isPlayerHost
                    ? "moving"
                    : "idle"
              }
              className={`relative min-h-0 w-full max-w-36 flex-1 ${player.connected ? "" : "opacity-50 grayscale"}`}
            />
            <div className="relative flex w-full min-w-0 shrink-0 items-center justify-center gap-1.5">
              <PlayerAvatar
                name={player.name}
                avatar={player.avatar}
                color={preset.color}
                size={20}
              />
              <span className="truncate text-sm font-bold">{player.name}</span>
              <VoiceBadge userId={player.userId} />
              {isMe && (
                <span className="shrink-0 rounded-md bg-[#f4b942]/20 px-1.5 text-[10px] font-bold text-[#ffd166]">
                  Bạn
                </span>
              )}
            </div>
            <div className="relative flex shrink-0 flex-wrap items-center justify-center gap-1.5">
              <span
                className="text-[11px] font-semibold max-[380px]:hidden"
                style={{ color: preset.color }}
              >
                {preset.name}
              </span>
              <SeatStatus
                connected={player.connected}
                host={isPlayerHost}
                ready={player.ready}
              />
            </div>

            {isHost && !isMe && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Mời ${player.name} ra khỏi phòng?`))
                    void kickPlayer(player.userId);
                }}
                title="Mời ra khỏi phòng"
                aria-label={`Kick ${player.name}`}
                className="absolute right-2 top-2 rounded-lg bg-[#c81d25]/15 p-1.5 text-[#ff8a7a] transition hover:bg-[#c81d25]/35"
              >
                <UserX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const summary = (
    <>
      <RuleChip icon={Coins}>
        ${room.settings.startingMoney.toLocaleString()}
      </RuleChip>
      <RuleChip icon={room.settings.isPrivate ? Lock : Globe}>
        {room.settings.isPrivate ? "Riêng tư" : "Công khai"}
      </RuleChip>
      <RuleChip icon={Timer}>{TURN_SECONDS}s/lượt</RuleChip>
    </>
  );

  const settings = (
    <>
      <OptionGroup
        label="Tiền khởi điểm"
        icon={Coins}
        cols={4}
        disabled={!isHost}
        value={room.settings.startingMoney}
        options={STARTING_MONEY_OPTIONS.map((m) => ({
          value: m,
          label: `$${m.toLocaleString()}`,
        }))}
        onChange={(v) => void updateSettings({ startingMoney: v })}
      />
      <OptionGroup
        label="Chế độ phòng"
        icon={Lock}
        disabled={!isHost}
        value={room.settings.isPrivate ? "private" : "public"}
        options={[
          { value: "public", label: "Công khai", hint: "Hiện trong sảnh" },
          { value: "private", label: "Riêng tư", hint: "Chỉ vào bằng mã" },
        ]}
        onChange={(v) => void updateSettings({ isPrivate: v === "private" })}
      />
      <p className="flex gap-2 rounded-2xl bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-400">
        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-[#f4b942]" />
        Mỗi lượt tối đa {TURN_SECONDS} giây. Hết giờ, hệ thống tự lắc xúc xắc
        (hoặc bỏ qua lựa chọn mua nhà / lễ hội). Giá đất, tiền thuê và tiền qua
        ô Bắt đầu tự điều chỉnh theo tiền khởi điểm.
      </p>
    </>
  );

  return (
    <WaitingRoomShell
      gameName="Cờ Tỷ Phú"
      gameIcon={Dices}
      code={code}
      invitePath={`/games/monopoly/room/${code}`}
      playerCount={room.players.length}
      maxPlayers={MONOPOLY_MAX_PLAYERS}
      onLeave={() => void leaveRoom()}
      seats={seats}
      summary={summary}
      settingsTitle="Cài đặt trận đấu"
      settings={settings}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      isHost={isHost}
      canStart={canStart}
      startHint={startHint}
      ready={!!me?.ready}
      onStart={() => void startGame()}
      onToggleReady={() => void setReady(!me?.ready)}
    />
  );
}
