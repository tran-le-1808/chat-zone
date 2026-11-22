"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Thanh thời gian lượt: chạy mượt bằng CSS (width tuyến tính tới 0 trong đúng số giây còn lại),
 * chỉ đặt lại khi hạn lượt đổi / tạm dừng — không còn nhảy bậc mỗi 250 ms. Số giây cập nhật riêng.
 */
function TurnTimer({
  deadline,
  paused,
  seconds = BILLIARD_TURN_SECONDS,
}: {
  deadline: number;
  paused: boolean;
  seconds?: number;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const r = paused ? seconds : Math.max(0, (deadline - Date.now()) / 1000);
    el.style.transition = "none";
    el.style.width = `${Math.min(100, (r / seconds) * 100)}%`;
    void el.offsetWidth; // ép trình duyệt áp vị trí đầu rồi mới chạy hiệu ứng
    if (!paused && r > 0) {
      el.style.transition = `width ${r}s linear`;
      el.style.width = "0%";
    }
  }, [deadline, paused, seconds]);
  const remain = paused ? seconds : Math.max(0, (deadline - now) / 1000);
  const urgent = remain <= 10 && !paused;
  return (
    <div className="flex w-full items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div ref={barRef} className={`h-full rounded-full ${urgent ? "bg-rose-500" : "bg-emerald-400"}`} />
      </div>
      <span className={`w-7 text-right text-[11px] tabular-nums [@media(max-height:500px)]:text-[10px] ${urgent ? "text-rose-300" : "text-gray-300"}`}>{Math.ceil(remain)}s</span>
    </div>
  );
}

/** Tên hiển thị tối đa 25 ký tự */
const NAME_MAX = 25;
function shortName(name: string): string {
  const chars = [...name];
  return chars.length > NAME_MAX ? `${chars.slice(0, NAME_MAX).join("")}…` : name;
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
        className={`flex w-full items-center gap-1.5 rounded-lg border px-1.5 py-0.5 transition ${
          active
            ? "border-emerald-400/70 bg-emerald-500/15 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
            : "border-white/10 bg-black/40 opacity-75"
        } ${i === 1 ? "flex-row-reverse text-right" : ""}`}
      >
        <div className="relative shrink-0">
          <PlayerAvatar
            name={p?.name ?? "?"}
            avatar={p?.avatar}
            size={isLandscape ? 20 : 24}
          />
          {/* Bi cái của người chơi */}
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black/40"
            style={{ background: BALL_COLORS[i] }}
            title={BALL_NAMES[i]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex items-center gap-1 text-[11px] font-bold sm:text-xs ${i === 1 ? "justify-end" : ""}`}
          >
            <span className="whitespace-nowrap">
              {shortName(p?.name ?? "Người chơi")}
              {myIndex === i ? " (bạn)" : ""}
            </span>
            <VoiceBadge userId={uid} size="xs" />
            {p && !p.connected && (
              <span title="Mất kết nối" className="text-[10px]">
                📴
              </span>
            )}
          </div>
          {st.currentRun > 1 && <div className="text-[10px] text-amber-300">chuỗi {st.currentRun}</div>}
        </div>
        <div className="flex shrink-0 items-baseline gap-0.5">
          <span className="text-base font-black tabular-nums">{displayScores[i]}</span>
          <span className="text-[10px] text-gray-400">/{match.target}</span>
        </div>
      </div>
    );
  });

  return (
    <div className="ml-auto w-fit max-w-full space-y-0.5">
      {/* 2 cột 1fr: hai thẻ luôn dài bằng nhau (bằng thẻ có tên dài hơn) */}
      <div className="grid grid-cols-2 items-stretch sm:grid-cols-[1fr_auto_1fr] gap-2">
        {cards[0]}
        <div className="hidden flex-col items-center justify-center px-1 text-center sm:flex">
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
        <TurnTimer
          deadline={turnDeadlineLocal}
          paused={animating}
          seconds={match?.turnSeconds ?? BILLIARD_TURN_SECONDS}
        />
      )}
    </div>
  );
}
