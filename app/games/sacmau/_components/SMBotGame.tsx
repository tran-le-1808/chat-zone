"use client";

/** CHƠI VỚI MÁY (chạy trên máy): mình ở ghế 0. Điểm cộng dồn qua các ván. */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { deal, draw, pass, play, playable, scoreOf, type SMState } from "../_lib/cards";
import { botAction, SM_BOT_LEVELS, type SMBotLevel } from "../_lib/bot";
import SMTable, { type SMView } from "./SMTable";
import SoundToggle from "./SoundToggle";

export interface BotSetup {
  level: SMBotLevel;
  players: number;
  stack: boolean;
}

const BOT_NAMES = ["Máy Hoả", "Máy Thuỷ", "Máy Mộc"];

export default function SMBotGame({ setup, onExit }: { setup: BotSetup; onExit: () => void }) {
  const n = setup.players;
  const [s, setS] = useState<SMState>(() => deal(n, 0, { stack: setup.stack }));
  const [step, setStep] = useState(0);
  const [games, setGames] = useState(1);
  const [scores, setScores] = useState<number[]>(() => new Array<number>(n).fill(0));
  const [last, setLast] = useState<number[] | null>(null);
  const names = useMemo(() => ["Bạn", ...BOT_NAMES.slice(0, n - 1)], [n]);

  const apply = (next: SMState) => {
    setS(next);
    setStep((x) => x + 1);
    if (next.over) {
      const pts = scoreOf(next);
      setLast(pts);
      setScores((sc) => sc.map((v, i) => v + pts[i]));
    }
  };

  useEffect(() => {
    if (s.over || s.turn === 0) return;
    const t = setTimeout(
      () => {
        const a = botAction(s, s.turn, setup.level);
        const r = a.kind === "play" ? play(s, s.turn, a.card, a.color, a.call) : a.kind === "draw" ? draw(s, s.turn) : pass(s, s.turn);
        if (r.ok) apply(r.state);
      },
      s.drawn !== null ? 500 : 700 + Math.random() * 600,
    );
    return () => clearTimeout(t);
     
  }, [s, setup.level]);

  const next = () => {
    setS(deal(n, s.winner ?? 0, { stack: setup.stack }));
    setGames((g) => g + 1);
    setStep(0);
    setLast(null);
  };

  const view: SMView = {
    step,
    games,
    n,
    mySeat: 0,
    names,
    bots: names.map((_, i) => i > 0),
    counts: s.hands.map((h) => h.length),
    hand: s.hands[0],
    top: s.discard[s.discard.length - 1],
    color: s.color,
    dir: s.dir,
    turn: s.turn,
    pending: s.pending,
    drawn: s.turn === 0 ? s.drawn : null,
    playable: playable(s, 0),
    pileCount: s.pile.length,
    called: s.called,
    over: s.over,
    winner: s.winner,
    events: s.events,
    deadline: null,
    turnSeconds: 0,
    scores,
    lastScores: last,
    revealed: s.over ? s.hands : null,
  };

  return (
    <SMTable
      view={view}
      onPlay={(card, color, call) => {
        const r = play(s, 0, card, color, call);
        if (r.ok) apply(r.state);
        return r.ok;
      }}
      onDraw={() => {
        const r = draw(s, 0);
        if (r.ok) apply(r.state);
      }}
      onPass={() => {
        const r = pass(s, 0);
        if (r.ok) apply(r.state);
      }}
      onNext={next}
      header={
        <header className="flex items-center gap-2 px-3 py-2" style={{ background: "linear-gradient(90deg,#2a2468,#120f2b)", borderBottom: "1px solid rgba(255,209,102,.3)" }}>
          <button type="button" onClick={onExit} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Thoát
          </button>
          <span className="text-sm font-extrabold">Sắc Màu · đấu máy {SM_BOT_LEVELS[setup.level]}</span>
          <span className="ml-auto text-xs font-bold text-white/70">
            Ván {games}
            {setup.stack ? " · cộng dồn" : ""}
          </span>
          <SoundToggle />
        </header>
      }
    />
  );
}
