"use client";

/** CHƠI VỚI MÁY (chạy trên máy): bạn ở ghế 0, các ghế còn lại là máy. */
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { act, deal, pendingSeats, timeout, viewFor, type MSAction, type MSState, type Role } from "../_lib/game";
import { botAction, MS_BOT_LEVELS, type MSBotLevel } from "../_lib/bot";
import MSTable from "./MSTable";
import SoundToggle from "./SoundToggle";

export interface BotSetup {
  level: MSBotLevel;
  players: number;
  role: Role | "random";
  reveal: boolean;
}

export const BOT_NAMES = ["Tí", "Tèo", "Bà Ba", "Chú Tư", "Cô Năm", "Ông Sáu", "Bé Bảy", "Anh Tám", "Chị Chín", "Lão Mười", "Út Mót"];
const DELAY: Record<string, [number, number]> = { night: [700, 1600], witch: [900, 1600], day: [1600, 3400], vote: [900, 2000], hunter: [1400, 2000] };

function newGame(setup: BotSetup) {
  return deal(setup.players, { reveal: setup.reveal }, Math.random, setup.role === "random" ? {} : { 0: setup.role });
}

export default function MSBotGame({ setup, onExit }: { setup: BotSetup; onExit: () => void }) {
  const [s, setS] = useState<MSState>(() => newGame(setup));
  const [games, setGames] = useState(1);
  const [names] = useState(() => ["Bạn", ...BOT_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, setup.players - 1)]);

  // máy lần lượt hành động (mỗi lần một máy, có độ trễ cho tự nhiên)
  useEffect(() => {
    if (s.phase === "over") return;
    const bots = pendingSeats(s).filter((p) => p !== 0);
    if (!bots.length) return;
    const seat = bots[Math.floor(Math.random() * bots.length)];
    const [a, b] = DELAY[s.phase] ?? [800, 1500];
    const t = setTimeout(() => {
      const action = botAction(s, seat, setup.level);
      const r = action ? act(s, seat, action) : null;
      setS(r && r.ok ? r.state : timeout(s));
    }, a + Math.random() * (b - a));
    return () => clearTimeout(t);
  }, [s, setup.level]);

  const onAct = (a: MSAction) => {
    const r = act(s, 0, a);
    if (r.ok) setS(r.state);
    return r.ok;
  };

  return (
    <MSTable
      key={games}
      view={{ ...viewFor(s, 0), names, bots: names.map((_, i) => i > 0), deadline: null, games }}
      onAct={onAct}
      onNext={() => {
        setS(newGame(setup));
        setGames((g) => g + 1);
      }}
      header={
        <header className="flex items-center gap-2 px-3 py-2" style={{ background: "linear-gradient(90deg,#1a1430,#0b1026)", borderBottom: "1px solid rgba(244,231,191,.25)" }}>
          <button type="button" onClick={onExit} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Thoát
          </button>
          <span className="truncate text-sm font-extrabold">Ma Sói · {setup.players} người · máy {MS_BOT_LEVELS[setup.level]}</span>
          <span className="ml-auto text-xs font-bold text-white/70">Ván {games}</span>
          <SoundToggle />
        </header>
      }
    />
  );
}
