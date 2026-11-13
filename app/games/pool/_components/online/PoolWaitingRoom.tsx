"use client";

import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { Eye, Flag, Globe, Lock, Target, Timer, Trophy, UserX, Users } from "lucide-react";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { VoiceBadge } from "../../../monopoly/_components/VoiceControls";
import WaitingRoomShell, { OptionGroup, RuleChip, SeatStatus } from "../../../_shared/WaitingRoomShell";
import { POCKET_PRESETS, type PocketPreset } from "../../_lib/physics/config";
import { MiniBall } from "../PoolControls";

export interface PoolRoomSettingsUI {
  isPrivate: boolean;
  type: "eight" | "nine";
  raceTo: number;
  breakRule: "alternate" | "winner";
  pocketPreset: PocketPreset;
  shotClock: boolean;
  allowFullGuide: boolean;
  autoCall: boolean;
  ranked: boolean;
  spectators: boolean;
}

export default function PoolWaitingRoom() {
  const { code, room, me, isHost, myUserId, leaveRoom, kickPlayer, setReady, changeSeat, updateSettings, startGame } = useRoom();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!room) return null;
  const s = room.settings as unknown as PoolRoomSettingsUI;
  const others = room.players.filter((p) => p.userId !== room.hostId);
  const full = room.players.length >= 2;
  const allReady = others.every((p) => p.ready && p.connected);
  const canStart = isHost && full && allReady;
  const startHint = !full ? "Cần 2 người chơi — gửi mã / link mời cho bạn bè" : !allReady ? "Đang chờ đối thủ sẵn sàng" : "Tung đồng xu chọn người phá!";
  const host = isHost && !s.ranked;

  const seats = (
    <div className="relative grid h-full grid-cols-2 gap-2 sm:gap-3">
      {[0, 1].map((seat) => {
        const p = room.players.find((x) => x.seat === seat);
        const isMe = p?.userId === myUserId;
        if (!p)
          return (
            <button
              key={seat}
              type="button"
              onClick={() => void changeSeat(seat)}
              className="flex min-h-0 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-3 text-center transition hover:border-[#f4b942]/40"
            >
              <span className="opacity-40">
                <MiniBall n={seat === 0 ? 1 : 9} size={56} />
              </span>
              <span className="text-sm font-bold text-slate-400">Ghế trống</span>
            </button>
          );
        return (
          <div
            key={seat}
            className={`relative flex min-h-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-[#0f6b52]/60 bg-[#11132a]/85 p-3 text-center ${isMe ? "shadow-[0_0_0_2px_rgba(244,185,66,0.55)]" : ""}`}
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-30" style={{ background: "radial-gradient(ellipse at 50% 35%, #0f6b52, transparent 70%)" }} />
            <span className={p.connected ? "" : "opacity-40 grayscale"}>
              <MiniBall n={seat === 0 ? 1 : 9} size={56} />
            </span>
            <div className="relative flex w-full min-w-0 items-center justify-center gap-1.5">
              <PlayerAvatar name={p.name} avatar={p.avatar} size={20} />
              <span className="truncate text-sm font-bold sm:text-base">{p.name}</span>
              <VoiceBadge userId={p.userId} />
              {isMe && <span className="shrink-0 rounded-md bg-[#f4b942]/20 px-1.5 text-[10px] font-bold text-[#ffd166]">Bạn</span>}
            </div>
            <div className="relative">
              <SeatStatus connected={p.connected} host={p.userId === room.hostId} ready={p.ready} />
            </div>
            {isHost && !isMe && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: `Mời ${p.name} ra khỏi phòng?`,
                      message: "Người chơi sẽ bị đưa ra khỏi phòng chờ.",
                      confirmText: "Mời ra",
                      tone: "danger",
                      icon: UserX,
                    })
                  )
                    void kickPlayer(p.userId);
                }}
                aria-label={`Kick ${p.name}`}
                className="absolute right-2 top-2 rounded-lg bg-[#c81d25]/15 p-1.5 text-[#ff8a7a] hover:bg-[#c81d25]/35"
              >
                <UserX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0d0f1e] bg-linear-to-br from-[#c81d25] to-[#e8772e] text-sm font-black italic sm:h-14 sm:w-14 sm:text-base">
        VS
      </span>
    </div>
  );

  const summary = (
    <>
      <RuleChip icon={Target}>{s.type === "eight" ? "8 bi" : "9 bi"}</RuleChip>
      <RuleChip icon={Flag}>Chạm {s.raceTo}</RuleChip>
      <RuleChip icon={Timer}>{s.shotClock ? "30 giây/cú" : "Không giới hạn"}</RuleChip>
      {s.ranked && <RuleChip icon={Trophy}>Xếp hạng</RuleChip>}
      <RuleChip icon={s.isPrivate ? Lock : Globe}>{s.isPrivate ? "Riêng tư" : "Công khai"}</RuleChip>
    </>
  );

  const settingsBody = (
    <>
      <OptionGroup
        label="Thể loại"
        icon={Target}
        disabled={!host}
        value={s.type}
        options={[
          { value: "eight", label: "8 bi", hint: "Chia nhóm, gọi bi" },
          { value: "nine", label: "9 bi", hint: "Chạm bi nhỏ nhất" },
        ]}
        onChange={(v) => void updateSettings({ type: v })}
      />
      <OptionGroup
        label="Thắng chung cuộc"
        icon={Flag}
        cols={4}
        disabled={!host}
        value={s.raceTo}
        options={[1, 3, 5, 7].map((n) => ({ value: n, label: `Chạm ${n}` }))}
        onChange={(v) => void updateSettings({ raceTo: v })}
      />
      <OptionGroup
        label="Luật phá"
        icon={Users}
        disabled={!host}
        value={s.breakRule}
        options={[
          { value: "alternate", label: "Luân phiên" },
          { value: "winner", label: "Thắng ván phá" },
        ]}
        onChange={(v) => void updateSettings({ breakRule: v })}
      />
      <OptionGroup
        label="Độ khó lỗ"
        icon={Target}
        cols={3}
        disabled={!host}
        value={s.pocketPreset}
        options={(Object.keys(POCKET_PRESETS) as PocketPreset[]).map((k) => ({
          value: k,
          label: POCKET_PRESETS[k].label,
          hint: `${(POCKET_PRESETS[k].corner * 100).toFixed(2)} / ${(POCKET_PRESETS[k].side * 100).toFixed(2)} cm`,
        }))}
        onChange={(v) => void updateSettings({ pocketPreset: v })}
      />
      <OptionGroup
        label="Đồng hồ"
        icon={Timer}
        disabled={!host}
        value={s.shotClock ? "on" : "off"}
        options={[
          { value: "on", label: "30 giây/cú", hint: "60 s sau phá / bi trong tay, +30 s 1 lần" },
          { value: "off", label: "Tắt" },
        ]}
        onChange={(v) => void updateSettings({ shotClock: v === "on" })}
      />
      <OptionGroup
        label="Đường dự đoán đầy đủ"
        icon={Eye}
        disabled={!host}
        value={s.allowFullGuide ? "on" : "off"}
        options={[
          { value: "off", label: "Tắt", hint: "Chỉ hướng bi cái & bi ma" },
          { value: "on", label: "Cho phép" },
        ]}
        onChange={(v) => void updateSettings({ allowFullGuide: v === "on" })}
      />
      <OptionGroup
        label="Chế độ phòng"
        icon={Lock}
        disabled={!host}
        value={s.isPrivate ? "private" : "public"}
        options={[
          { value: "public", label: "Công khai", hint: "Hiện trong sảnh, có khán giả" },
          { value: "private", label: "Riêng tư", hint: "Chỉ vào bằng mã / link" },
        ]}
        onChange={(v) => void updateSettings({ isPrivate: v === "private" })}
      />
    </>
  );

  return (
    <WaitingRoomShell
      gameName="Bida Lỗ"
      gameIcon={Target}
      code={code}
      invitePath={`/games/pool/room/${code}`}
      playerCount={room.players.length}
      maxPlayers={2}
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
