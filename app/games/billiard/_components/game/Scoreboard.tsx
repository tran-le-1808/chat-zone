"use client";

import { useEffect, useState } from "react";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { VoiceBadge } from "../../../monopoly/_components/VoiceControls";
import { useBilliard } from "../../_context/BilliardGameContext";
import { useIsPhoneLandscape } from "../../../monopoly/_components/ui/useScreen";
import {
  BALL_COLORS,
  BALL_NAMES,
  BILLIARD_TURN_SECONDS,
  MODE_LABEL,
} from "../../_lib/types";

/** Đồng hồ lượt (đếm theo giờ server đã quy đổi) */
function TurnTimer({
  deadline,
  paused,
}: {
  deadline: number;
  paused: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remain = paused
    ? BILLIARD_TURN_SECONDS
    : Math.max(0, (deadline - now) / 1000);
  const pct = Math.min(100, (remain / BILLIARD_TURN_SECONDS) * 100);
  const urgent = remain <= 10 && !paused;
  return (
    <div className="flex w-full items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 [@media(max-height:500px)]:h-1">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${urgent ? "bg-rose-500" : "bg-emerald-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-8 text-right text-xs tabular-nums [@media(max-height:500px)]:text-[10px] ${urgent ? "text-rose-300" : "text-gray-300"}`}
      >
        {Math.ceil(remain)}s
      </span>
    </div>
  );
}

export default function Scoreboard() {
  const { room } = useRoom();
  const isLandscape = useIsPhoneLandscape();
  const {
    match,
    animating,
    myIndex,
    turnDeadlineLocal,
    displayTurn,
    displayScores,
  } = useBilliard();
  if (!match || !room) return null;

  const cards = match.players.map((uid, i) => {
    const p = room.players.find((rp) => rp.userId === uid);
    const active = displayTurn === i && (match.winner === null || animating);
    const st = match.stats[i];
    return (
      <div
        key={uid}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-2.5 py-1.5 transition sm:px-3 sm:py-2 [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:rounded-xl [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:py-0.5 ${
          active
            ? "border-emerald-400/70 bg-emerald-500/15 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
            : "border-white/10 bg-black/40 opacity-75"
        } ${i === 1 ? "flex-row-reverse text-right" : ""}`}
      >
        <div className="relative shrink-0">
          <PlayerAvatar
            name={p?.name ?? "?"}
            avatar={p?.avatar}
            size={isLandscape ? 22 : 32}
          />
          {/* Bi cái của người chơi */}
          <span
            className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-black/40 [@media(max-height:500px)]:h-2.5 [@media(max-height:500px)]:w-2.5"
            style={{ background: BALL_COLORS[i] }}
            title={BALL_NAMES[i]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex items-center gap-1 text-xs font-bold sm:text-sm ${i === 1 ? "justify-end" : ""}`}
          >
            <span className="truncate">
              {p?.name ?? "Người chơi"}
              {myIndex === i ? " (bạn)" : ""}
            </span>
            <VoiceBadge userId={uid} size="xs" />
            {p && !p.connected && (
              <span title="Mất kết nối" className="text-[10px]">
                📴
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 sm:text-[11px] [@media(max-height:500px)]:hidden">
            {active ? "Đang đánh" : "Chờ lượt"}
            {st.currentRun > 1 ? ` · chuỗi ${st.currentRun}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-center [@media(max-height:500px)]:flex [@media(max-height:500px)]:items-baseline [@media(max-height:500px)]:gap-0.5">
          <div className="text-xl font-black tabular-nums sm:text-2xl [@media(max-height:500px)]:text-base">
            {displayScores[i]}
          </div>
          <div className="text-[10px] text-gray-400">/{match.target}</div>
        </div>
      </div>
    );
  });

  return (
    <div className="w-full space-y-1 [@media(max-height:500px)]:space-y-0.5">
      <div className="flex items-stretch gap-2">
        {cards[0]}
        <div className="hidden shrink-0 flex-col items-center justify-center px-1 text-center sm:flex">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 [@media(max-height:500px)]:hidden">
            {MODE_LABEL[match.mode]}
          </span>
          <span className="text-xs font-bold text-amber-300">
            Chạm {match.target}
          </span>
        </div>
        {cards[1]}
      </div>
      {match.winner === null && (
        <TurnTimer deadline={turnDeadlineLocal} paused={animating} />
      )}
    </div>
  );
}
