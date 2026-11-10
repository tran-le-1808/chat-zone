"use client";

import React, { useEffect, useState } from "react";
import { RPS_STAKE, RpsChoice, useGame } from "../_context/GameContext";
import PlayerAvatar from "./PlayerAvatar";
import { TOY_COLORS, ToyOverlay, ToyPanel } from "./ui/ToyUI";

const HANDS: Record<
  RpsChoice,
  { icon: string; label: string; color: keyof typeof TOY_COLORS }
> = {
  rock: { icon: "✊", label: "Búa", color: "orange" },
  paper: { icon: "✋", label: "Bao", color: "blue" },
  scissors: { icon: "✌️", label: "Kéo", color: "green" },
};

/** Mini game Oẳn tù tì: hiện cho MỌI người chơi khi có người đi vào ô chơi game */
export default function RpsModal() {
  const {
    rpsGame,
    players,
    myPlayer,
    myRpsChoice,
    handleRpsChoose,
    isOnline,
    currPlayer,
  } = useGame();

  // Đồng hồ đếm ngược (chỉ để hiển thị)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rpsGame || rpsGame.phase !== "choosing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rpsGame]);

  if (!rpsGame) return null;

  const me = isOnline ? myPlayer : currPlayer;
  const challenger = players.find((p) => p.id === rpsGame.challengerId);
  const opponents = rpsGame.participants
    .slice(1)
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as typeof players;
  const amParticipant = !!me && rpsGame.participants.includes(me.id);
  const iAmChallenger = me?.id === rpsGame.challengerId;
  const remaining = Math.max(0, Math.ceil((rpsGame.deadline - now) / 1000));
  const choosing = rpsGame.phase === "choosing";

  return (
    <ToyOverlay z={125}>
      <ToyPanel
        color="pink"
        icon={<span className="toy-wiggle inline-block">✊</span>}
        title="Oẳn Tù Tì!"
        subtitle={
          choosing
            ? `${challenger?.name ?? "?"} thách đấu cả bàn — thắng nhận $${RPS_STAKE.toLocaleString("vi-VN")}, thua trả $${RPS_STAKE.toLocaleString("vi-VN")} mỗi người`
            : "Lật bài!"
        }
        maxWidth={480}
      >
        {/* Người thách đấu vs các đối thủ */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {challenger && (
            <Fighter
              name={challenger.name}
              avatar={challenger.avatar}
              color={challenger.color}
              pawnType={challenger.type}
              chosen={rpsGame.chosen.includes(challenger.id)}
              hand={rpsGame.choices?.[challenger.id]}
              highlight
            />
          )}
          <span className="text-2xl" style={{ color: TOY_COLORS.pink.dark }}>
            VS
          </span>
          <div className="flex gap-2">
            {opponents.map((o) => {
              const result = rpsGame.results?.find(
                (r) => r.opponentId === o.id,
              );
              return (
                <Fighter
                  key={o.id}
                  name={o.name}
                  avatar={o.avatar}
                  color={o.color}
                  pawnType={o.type}
                  chosen={rpsGame.chosen.includes(o.id)}
                  hand={rpsGame.choices?.[o.id]}
                  result={result?.outcome}
                />
              );
            })}
          </div>
        </div>

        {choosing ? (
          <>
            {amParticipant ? (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {(Object.keys(HANDS) as RpsChoice[]).map((k) => {
                  const h = HANDS[k];
                  const c = TOY_COLORS[h.color];
                  const picked = myRpsChoice === k;
                  const locked = !!myRpsChoice;
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={locked}
                      onClick={() => handleRpsChoose(k)}
                      className="flex flex-col items-center rounded-2xl py-3 transition-transform duration-75 active:translate-y-[4px] disabled:cursor-not-allowed"
                      style={{
                        background: picked
                          ? `linear-gradient(180deg, ${c.main}, ${c.dark})`
                          : c.soft,
                        color: picked ? "#fff" : c.text,
                        boxShadow: picked
                          ? `0 2px 0 ${c.dark}`
                          : `0 5px 0 ${c.main}`,
                        transform: picked ? "translateY(3px)" : undefined,
                        opacity: locked && !picked ? 0.45 : 1,
                      }}
                    >
                      <span className="text-4xl">{h.icon}</span>
                      <span className="mt-1 text-sm">{h.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 text-sm" style={{ color: "#7a7f95" }}>
                Bạn đang xem ván đấu…
              </p>
            )}

            <p className="mt-3 text-sm" style={{ color: "#7a7f95" }}>
              {myRpsChoice
                ? "Đã chọn! Chờ mọi người…"
                : amParticipant
                  ? "Chọn nhanh nào! Hết giờ sẽ chọn ngẫu nhiên."
                  : ""}
            </p>

            {/* Đồng hồ đếm ngược */}
            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-3 flex-1 overflow-hidden rounded-full"
                style={{ background: TOY_COLORS.pink.soft }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-200 ease-linear"
                  style={{
                    width: `${Math.min(100, (remaining / 15) * 100)}%`,
                    background: `linear-gradient(90deg, ${TOY_COLORS.pink.main}, ${TOY_COLORS.pink.dark})`,
                  }}
                />
              </div>
              <span
                className="w-8 text-sm tabular-nums"
                style={{ color: TOY_COLORS.pink.dark }}
              >
                {remaining}s
              </span>
            </div>
          </>
        ) : (
          /* Kết quả từng cặp đấu */
          <div className="mt-5 space-y-2">
            {rpsGame.results?.map((r) => {
              const o = players.find((p) => p.id === r.opponentId);
              const cHand = rpsGame.choices?.[rpsGame.challengerId];
              const oHand = rpsGame.choices?.[r.opponentId];
              const col =
                r.outcome === "win"
                  ? "green"
                  : r.outcome === "lose"
                    ? "red"
                    : "gray";
              const c = TOY_COLORS[col];
              const text =
                r.outcome === "draw"
                  ? "Hoà"
                  : r.outcome === "win"
                    ? `${challenger?.name} thắng +$${r.amount.toLocaleString("vi-VN")}`
                    : `${challenger?.name} thua −$${r.amount.toLocaleString("vi-VN")}`;
              const mine = me && (me.id === r.opponentId || iAmChallenger);
              return (
                <div
                  key={r.opponentId}
                  className="toy-pop flex items-center gap-3 rounded-2xl bg-white px-3 py-2"
                  style={{
                    border: `3px solid ${mine ? c.main : "#f0e3cc"}`,
                    boxShadow: `0 4px 0 ${mine ? c.dark : "#e3d3b5"}`,
                  }}
                >
                  <span className="text-3xl">
                    {cHand ? HANDS[cHand].icon : "?"}
                  </span>
                  <span className="text-xs" style={{ color: "#9aa0b5" }}>
                    vs
                  </span>
                  <span className="text-3xl">
                    {oHand ? HANDS[oHand].icon : "?"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-sm">
                    {o?.name}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-sm"
                    style={{ background: c.soft, color: c.text }}
                  >
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ToyPanel>
    </ToyOverlay>
  );
}

function Fighter({
  name,
  avatar,
  color,
  pawnType,
  chosen,
  hand,
  highlight,
  result,
}: {
  name: string;
  avatar?: string;
  color: string;
  pawnType: Parameters<typeof PlayerAvatar>[0]["pawnType"];
  chosen: boolean;
  hand?: RpsChoice;
  highlight?: boolean;
  result?: "win" | "lose" | "draw";
}) {
  // Màu viền theo kết quả (nhìn từ phía người thách đấu: đối thủ thua = người thách đấu thắng)
  const ring =
    result === "win"
      ? TOY_COLORS.red.main
      : result === "lose"
        ? TOY_COLORS.green.main
        : color;
  return (
    <div className="flex w-16 flex-col items-center">
      <div className="relative">
        <PlayerAvatar
          name={name}
          avatar={avatar}
          color={ring}
          pawnType={pawnType}
          size={highlight ? 56 : 44}
        />
        <span
          className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-base"
          style={{ boxShadow: "0 2px 0 #e3d3b5" }}
        >
          {hand ? HANDS[hand].icon : chosen ? "✅" : "🤔"}
        </span>
      </div>
      <span
        className="mt-1 w-full truncate text-center text-[11px]"
        style={{ color: "#5b6078" }}
      >
        {name}
      </span>
    </div>
  );
}
