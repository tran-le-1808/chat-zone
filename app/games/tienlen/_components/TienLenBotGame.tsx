"use client";

/** CHƠI VỚI MÁY (chạy trên máy): mình ở ghế 0, các ghế còn lại là máy. Điểm cộng dồn qua các ván. */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { deal, pass, play, scoreOf, type TLState } from "../_lib/cards";
import { botAction, TL_BOT_LEVELS, type TLBotLevel } from "../_lib/bot";
import TienLenTable, { type TableView } from "./TienLenTable";
import SoundToggle from "./SoundToggle";
import { TL } from "./theme";

export interface BotSetup {
  level: TLBotLevel;
  /** Tổng số người ở bàn (2..4) */
  players: number;
  name: string;
}

const BOT_NAMES = ["Máy Ba", "Máy Tư", "Máy Năm"];

export default function TienLenBotGame({ setup, onExit }: { setup: BotSetup; onExit: () => void }) {
  const n = setup.players;
  const [s, setS] = useState<TLState>(() => deal(n, null));
  const [step, setStep] = useState(0);
  const [games, setGames] = useState(1);
  const [scores, setScores] = useState<number[]>(() => new Array<number>(n).fill(0));
  const [last, setLast] = useState<number[] | null>(null);
  const names = useMemo(() => [setup.name || "Bạn", ...BOT_NAMES.slice(0, n - 1)], [setup.name, n]);

  const apply = (next: TLState) => {
    setS(next);
    setStep((x) => x + 1);
    if (next.over) {
      const pts = scoreOf(next);
      setLast(pts);
      setScores((sc) => sc.map((v, i) => v + pts[i]));
    }
  };

  // tới trắng ngay khi chia
  useEffect(() => {
    if (s.over && step === 0 && !last) {
      const pts = scoreOf(s);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLast(pts);
      setScores((sc) => sc.map((v, i) => v + pts[i]));
    }
  }, [s, step, last]);

  // lượt máy
  useEffect(() => {
    if (s.over || s.turn === 0) return;
    const t = setTimeout(
      () => {
        const a = botAction(s, s.turn, setup.level);
        const r = a.kind === "play" ? play(s, s.turn, a.cards) : pass(s, s.turn);
        if (r.ok) apply(r.state);
        else {
          const p = pass(s, s.turn);
          if (p.ok) apply(p.state);
        }
      },
      650 + Math.random() * 650,
    );
    return () => clearTimeout(t);
     
  }, [s, setup.level]);

  const next = () => {
    const starter = s.instant ? s.instant.seat : s.finished[0];
    setS(deal(n, starter));
    setGames((g) => g + 1);
    setStep(0);
    setLast(null);
  };

  const view: TableView = {
    step,
    games,
    n,
    mySeat: 0,
    names,
    bots: names.map((_, i) => i > 0),
    counts: s.hands.map((h) => h.length),
    hand: s.hands[0],
    turn: s.turn,
    table: s.table,
    passed: s.passed,
    finished: s.finished,
    mustPlay: s.mustPlay,
    over: s.over,
    instant: s.instant,
    events: s.events,
    deadline: null,
    turnSeconds: 0,
    scores,
    lastScores: last,
    revealed: s.over ? s.hands : null,
  };

  return (
    <TienLenTable
      view={view}
      onPlay={(cards) => {
        const r = play(s, 0, cards);
        if (r.ok) apply(r.state);
        return r.ok;
      }}
      onPass={() => {
        const r = pass(s, 0);
        if (r.ok) apply(r.state);
      }}
      onNext={next}
      header={
        <header className="flex items-center gap-2 px-3 py-2" style={{ background: `linear-gradient(90deg, ${TL.redDeep}, #2a0707)`, borderBottom: `1px solid ${TL.gold}55` }}>
          <button type="button" onClick={onExit} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Thoát
          </button>
          <span className="text-sm font-black">Tiến Lên Miền Nam · đấu máy {TL_BOT_LEVELS[setup.level]}</span>
          <span className="ml-auto text-xs font-bold text-white/70">Ván {games}</span>
          <SoundToggle />
        </header>
      }
    />
  );
}
