"use client";

import { useState } from "react";
import {
  CircleDot,
  Flag,
  Globe,
  Lock,
  Target,
  Timer,
  UserX,
} from "lucide-react";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { VoiceBadge } from "../../../monopoly/_components/VoiceControls";
import WaitingRoomShell, {
  OptionGroup,
  RuleChip,
  SeatStatus,
} from "../../../_shared/WaitingRoomShell";
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

/** Viên bi vẽ bằng CSS (bi cái của mỗi ghế) */
function BallPreview({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <span
      className={`block aspect-square h-[min(42%,112px)] min-h-12 shrink rounded-full shadow-[inset_-6px_-8px_14px_rgba(0,0,0,0.35),0_10px_24px_rgba(0,0,0,0.45)] ${dim ? "opacity-40 grayscale" : ""}`}
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const seats = (
    <div className="relative grid h-full grid-cols-2 gap-2 sm:gap-3">
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
              className="group flex min-h-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-3 text-center transition hover:border-[#f4b942]/40 hover:bg-[#f4b942]/[0.04]"
            >
              <BallPreview color={BALL_COLORS[seat]} dim />
              <span className="text-sm font-bold text-slate-400">
                Ghế trống
              </span>
              <span className="text-[11px] text-slate-500">
                Bấm để cầm {BALL_NAMES[seat].toLowerCase()}
              </span>
            </button>
          );
        }

        return (
          <div
            key={seat}
            className={`relative flex min-h-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border bg-[#11132a]/85 p-3 text-center ${
              isMe ? "shadow-[0_0_0_2px_rgba(244,185,66,0.55)]" : ""
            }`}
            style={{ borderColor: `${BALL_COLORS[seat]}77` }}
          >
            {/* Nỉ xanh mờ phía sau viên bi */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-30"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 35%, #11704f, transparent 70%)",
              }}
            />
            <BallPreview color={BALL_COLORS[seat]} dim={!player.connected} />
            <div className="relative flex w-full min-w-0 items-center justify-center gap-1.5">
              <PlayerAvatar
                name={player.name}
                avatar={player.avatar}
                size={20}
              />
              <span className="truncate text-sm font-bold sm:text-base">
                {player.name}
              </span>
              <VoiceBadge userId={player.userId} />
              {isMe && (
                <span className="shrink-0 rounded-md bg-[#f4b942]/20 px-1.5 text-[10px] font-bold text-[#ffd166]">
                  Bạn
                </span>
              )}
            </div>
            <div className="relative text-[11px] text-slate-400">
              {BALL_NAMES[seat]} · {seat === 0 ? "khai cuộc" : "đánh sau"}
            </div>
            <div className="relative">
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

      {/* Huy hiệu VS ở giữa */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0d0f1e] bg-linear-to-br from-[#c81d25] to-[#e8772e] text-sm font-black italic shadow-[0_0_20px_rgba(232,119,46,0.5)] sm:h-14 sm:w-14 sm:text-base">
        VS
      </span>
    </div>
  );

  const summary = (
    <>
      <RuleChip icon={CircleDot}>{settings.mode === "free" ? "Phăng" : "3 băng"}</RuleChip>
      <RuleChip icon={Flag}>Chạm {settings.target}</RuleChip>
      <RuleChip icon={settings.isPrivate ? Lock : Globe}>
        {settings.isPrivate ? "Riêng tư" : "Công khai"}
      </RuleChip>
    </>
  );

  const settingsBody = (
    <>
      <OptionGroup
        label="Chế độ"
        icon={CircleDot}
        disabled={!isHost}
        value={settings.mode}
        options={(Object.keys(MODE_LABEL) as CaromMode[]).map((m) => ({
          value: m,
          label: m === "free" ? "Phăng" : "3 băng",
          hint: m === "free" ? "Bi cái chạm 2 bi" : "≥ 3 băng trước bi thứ 2",
        }))}
        onChange={(v) => void updateSettings({ mode: v })}
      />
      <OptionGroup
        label="Điểm thắng"
        icon={Target}
        cols={4}
        disabled={!isHost}
        value={settings.target}
        options={ALLOWED_TARGETS[settings.mode].map((t) => ({
          value: t,
          label: `Chạm ${t}`,
        }))}
        onChange={(v) => void updateSettings({ target: v })}
      />
      <OptionGroup
        label="Chế độ phòng"
        icon={Lock}
        disabled={!isHost}
        value={settings.isPrivate ? "private" : "public"}
        options={[
          { value: "public", label: "Công khai", hint: "Hiện trong sảnh" },
          { value: "private", label: "Riêng tư", hint: "Chỉ vào bằng mã" },
        ]}
        onChange={(v) => void updateSettings({ isPrivate: v === "private" })}
      />
      <p className="flex gap-2 rounded-2xl bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-400">
        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-[#f4b942]" />
        <span>
          {settings.mode === "free"
            ? "Phăng: bi cái chạm được cả 2 bi còn lại là ghi 1 điểm."
            : "3 băng: bi cái phải chạm ít nhất 3 lần vào băng trước khi chạm bi mục tiêu thứ hai."}{" "}
          Ghi điểm thì được đánh tiếp. Mỗi lượt tối đa {BILLIARD_TURN_SECONDS}{" "}
          giây.
        </span>
      </p>
    </>
  );

  return (
    <WaitingRoomShell
      gameName="Bida Carom"
      gameIcon={CircleDot}
      code={code}
      invitePath={`/games/billiard/room/${code}`}
      playerCount={room.players.length}
      maxPlayers={BILLIARD_MAX_PLAYERS}
      onLeave={() => void leaveRoom()}
      seats={seats}
      summary={summary}
      settingsTitle="Luật thi đấu"
      settings={settingsBody}
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
