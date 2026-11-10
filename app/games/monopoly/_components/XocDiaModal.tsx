"use client";

import React, { useEffect, useState } from "react";
import {
  XOC_GUESS_MS,
  XOC_STAKE,
  XocGuess,
  useGame,
} from "../_context/GameContext";
import PlayerAvatar from "./PlayerAvatar";
import { TOY_COLORS, ToyOverlay, ToyPanel } from "./ui/ToyUI";

const GUESS_LABEL: Record<XocGuess | "skip", string> = {
  even: "Chẵn",
  odd: "Lẻ",
  skip: "Không chơi",
};

/** Mini game Xóc đĩa: mọi người đoán chẵn / lẻ, xóc bát, mở ra 4 đồng đỏ / trắng */
export default function XocDiaModal() {
  const { xocGame, players, myPlayer, isOnline, currPlayer, handleXocGuess } =
    useGame();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!xocGame || xocGame.phase !== "guessing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [xocGame]);

  if (!xocGame) return null;

  const me = isOnline ? myPlayer : currPlayer;
  const starter = players.find((p) => p.id === xocGame.starterId);
  const participants = xocGame.participants
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as typeof players;
  const amParticipant = !!me && xocGame.participants.includes(me.id);
  const myGuess = me ? xocGame.guesses[me.id] : undefined;
  const remaining = Math.max(0, Math.ceil((xocGame.deadline - now) / 1000));
  const whites = xocGame.coins?.filter(Boolean).length ?? 0;
  const answer: XocGuess = whites % 2 === 1 ? "odd" : "even";

  return (
    <ToyOverlay z={125}>
      <XocKeyframes />
      <ToyPanel
        color="red"
        icon={<span className="toy-wiggle inline-block">🥣</span>}
        title="Xóc Đĩa — Chẵn hay Lẻ?"
        subtitle={
          xocGame.phase === "guessing"
            ? `${starter?.name ?? "?"} mở sòng! Đoán đúng +$${XOC_STAKE.toLocaleString("vi-VN")}, sai −$${XOC_STAKE.toLocaleString("vi-VN")}`
            : xocGame.phase === "shaking"
              ? "Xóc xóc xóc…"
              : "Mở bát!"
        }
        maxWidth={460}
      >
        {/* Người chơi & dự đoán */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {participants.map((p) => {
            const g = xocGame.guesses[p.id];
            const r = xocGame.results?.find((x) => x.playerId === p.id);
            const badge =
              r && r.outcome !== "skip"
                ? r.outcome === "win"
                  ? {
                      text: `+$${r.amount.toLocaleString("vi-VN")}`,
                      c: TOY_COLORS.green,
                    }
                  : {
                      text: `−$${r.amount.toLocaleString("vi-VN")}`,
                      c: TOY_COLORS.red,
                    }
                : g
                  ? {
                      text: GUESS_LABEL[g],
                      c:
                        g === "even"
                          ? TOY_COLORS.blue
                          : g === "odd"
                            ? TOY_COLORS.red
                            : TOY_COLORS.gray,
                    }
                  : { text: "🤔", c: TOY_COLORS.gray };
            return (
              <div key={p.id} className="flex w-16 flex-col items-center">
                <PlayerAvatar
                  name={p.name}
                  avatar={p.avatar}
                  color={p.color}
                  pawnType={p.type}
                  size={p.id === xocGame.starterId ? 52 : 42}
                />
                <span
                  className="mt-1 w-full truncate text-center text-[11px]"
                  style={{ color: "#5b6078" }}
                >
                  {p.name}
                </span>
                <span
                  className="mt-0.5 rounded-full px-2 text-[11px]"
                  style={{ background: badge.c.soft, color: badge.c.text }}
                >
                  {badge.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bát & đĩa */}
        <XocStage phase={xocGame.phase} coins={xocGame.coins} />

        {xocGame.phase === "guessing" && (
          <>
            {amParticipant && !myGuess ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["even", "odd"] as XocGuess[]).map((g) => {
                    const c = g === "even" ? TOY_COLORS.blue : TOY_COLORS.red;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleXocGuess(g)}
                        className="rounded-2xl py-3 text-2xl text-white transition-transform duration-75 active:translate-y-[4px]"
                        style={{
                          background: `linear-gradient(180deg, ${c.main}, ${c.dark})`,
                          boxShadow: `0 6px 0 ${c.dark}, 0 10px 18px rgba(0,0,0,0.18)`,
                          textShadow: "0 2px 0 rgba(0,0,0,0.2)",
                        }}
                      >
                        {g === "even" ? "CHẴN" : "LẺ"}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleXocGuess("skip")}
                  className="mt-3 text-sm underline"
                  style={{ color: "#8a8fa5" }}
                >
                  Không chơi ván này
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm" style={{ color: "#7a7f95" }}>
                {amParticipant
                  ? `Bạn chọn ${GUESS_LABEL[myGuess!]} — chờ mọi người…`
                  : "Bạn đang xem ván xóc đĩa…"}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <div
                className="h-3 flex-1 overflow-hidden rounded-full"
                style={{ background: TOY_COLORS.red.soft }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-200 ease-linear"
                  style={{
                    width: `${Math.min(100, (remaining * 1000 * 100) / XOC_GUESS_MS)}%`,
                    background: `linear-gradient(90deg, ${TOY_COLORS.red.main}, ${TOY_COLORS.red.dark})`,
                  }}
                />
              </div>
              <span
                className="w-8 text-sm tabular-nums"
                style={{ color: TOY_COLORS.red.dark }}
              >
                {remaining}s
              </span>
            </div>
          </>
        )}

        {xocGame.phase === "reveal" && (
          <div
            className="toy-pop mx-auto mt-1 inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-xl text-white"
            style={{
              background:
                answer === "odd" ? TOY_COLORS.red.main : TOY_COLORS.blue.main,
              boxShadow: `0 5px 0 ${answer === "odd" ? TOY_COLORS.red.dark : TOY_COLORS.blue.dark}`,
              textShadow: "0 2px 0 rgba(0,0,0,0.2)",
              animationDelay: "1.2s",
            }}
          >
            {answer === "odd" ? "LẺ" : "CHẴN"}
          </div>
        )}
      </ToyPanel>
    </ToyOverlay>
  );
}

/** Đĩa sứ + bát úp: rung khi xóc, nhấc lên khi mở để lộ 4 đồng lật mặt */
function XocStage({
  phase,
  coins,
}: {
  phase: "guessing" | "shaking" | "reveal";
  coins?: boolean[];
}) {
  const revealed = phase === "reveal" && coins;
  return (
    <div
      className="relative mx-auto my-3 h-40 w-64"
      style={{ perspective: 600 }}
    >
      {/* Đĩa */}
      <div
        className={`absolute bottom-2 left-1/2 h-20 w-60 -translate-x-1/2 rounded-[50%] ${phase === "shaking" ? "xoc-shake" : ""}`}
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #ffffff 0%, #f3ead8 70%, #e2d3b5 100%)",
          border: "5px solid #dc2626",
          boxShadow: "0 6px 0 #a21b1b, 0 12px 20px rgba(0,0,0,0.25)",
        }}
      >
        {/* 4 đồng */}
        <div className="absolute inset-0 flex items-center justify-center gap-2.5">
          {[0, 1, 2, 3].map((i) => {
            const white = coins?.[i];
            return (
              <div
                key={i}
                className="h-9 w-9 rounded-full"
                style={{
                  transformStyle: "preserve-3d",
                  animation: revealed
                    ? `xoc-flip 0.5s ${0.45 + i * 0.18}s ease-out both`
                    : undefined,
                  background: revealed
                    ? white
                      ? "radial-gradient(circle at 35% 30%, #ffffff, #e9e4da)"
                      : "radial-gradient(circle at 35% 30%, #ff7a6e, #c81e1e)"
                    : "radial-gradient(circle at 35% 30%, #ff7a6e, #c81e1e)",
                  border: `3px solid ${revealed && white ? "#c9c2b3" : "#8f1515"}`,
                  boxShadow: "0 3px 0 rgba(0,0,0,0.25)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bát úp */}
      <div
        className={`absolute left-1/2 top-0 h-32 w-48 -translate-x-1/2 ${phase === "shaking" ? "xoc-shake" : ""} ${revealed ? "xoc-lift" : ""}`}
        style={{
          borderRadius: "50% 50% 18% 18% / 70% 70% 30% 30%",
          background:
            "radial-gradient(ellipse at 35% 25%, #ff8f84 0%, #dc2626 45%, #8f1515 100%)",
          border: "4px solid #fffaf0",
          boxShadow:
            "inset 0 -10px 0 rgba(0,0,0,0.15), 0 10px 18px rgba(0,0,0,0.3)",
        }}
      >
        <div
          className="absolute left-1/2 top-3 h-5 w-14 -translate-x-1/2 rounded-full"
          style={{ background: "rgba(255,255,255,0.35)" }}
        />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs tracking-[0.3em] text-white/80">
          XÓC ĐĨA
        </div>
      </div>
    </div>
  );
}

function XocKeyframes() {
  return (
    <style>{`
      @keyframes xoc-shake-kf {
        0%,100% { transform: translateX(-50%) rotate(0) }
        15% { transform: translateX(calc(-50% - 14px)) translateY(-6px) rotate(-7deg) }
        30% { transform: translateX(calc(-50% + 14px)) translateY(4px) rotate(7deg) }
        45% { transform: translateX(calc(-50% - 10px)) translateY(-8px) rotate(-5deg) }
        60% { transform: translateX(calc(-50% + 10px)) translateY(3px) rotate(6deg) }
        80% { transform: translateX(calc(-50% - 6px)) translateY(-4px) rotate(-3deg) }
      }
      .xoc-shake { animation: xoc-shake-kf .32s ease-in-out infinite; }
      @keyframes xoc-lift-kf {
        0% { transform: translateX(-50%) translateY(0) rotate(0); opacity: 1 }
        40% { transform: translateX(-50%) translateY(-30px) rotate(-6deg); opacity: 1 }
        100% { transform: translateX(-10%) translateY(-120px) rotate(-25deg); opacity: 0 }
      }
      .xoc-lift { animation: xoc-lift-kf .8s ease-in both; }
      @keyframes xoc-flip {
        0% { transform: rotateY(0) scale(.9) }
        60% { transform: rotateY(540deg) scale(1.15) }
        100% { transform: rotateY(720deg) scale(1) }
      }
    `}</style>
  );
}
