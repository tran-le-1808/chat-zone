"use client";

/** CHƠI VỚI BOT (chạy trên máy): bot nghĩ trong Web Worker; đi lại, gợi ý, ván mới, đổi bên, tỉ số. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FlipVertical2, Lightbulb, RefreshCw, Repeat, Undo2 } from "lucide-react";
import { applyMove, END_REASON_VI, inCheck, newGame, replay, SIDE_VI, type Side, type XqState } from "../_lib/rules";
import { XQ_BOT_LEVELS, type XqBotLevel } from "../_lib/engine/search";
import { botMove } from "../_lib/engine/client";
import { soundForMove, xqSound } from "../_lib/sound";
import XiangqiBoard from "./XiangqiBoard";
import SoundToggle from "./SoundToggle";
import { btnCls, capturedBy, CheckBanner, LabelToggle, MoveList, PlayerCard, usePieceLabel } from "./ui";
import { serif, XQ } from "./theme";

export interface BotSetup {
  level: XqBotLevel;
  /** Bên người chơi cầm: 1 = Đỏ (đi trước), -1 = Đen */
  human: Side;
}

export default function XiangqiBotGame({ setup, onExit }: { setup: BotSetup; onExit: () => void }) {
  const [human, setHuman] = useState<Side>(setup.human);
  const [g, setG] = useState<XqState>(() => newGame());
  const [score, setScore] = useState({ me: 0, bot: 0, draw: 0 });
  const [counted, setCounted] = useState(false);
  const [flipped, setFlipped] = useState(setup.human === -1);
  const [label, setLabel] = usePieceLabel();
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [thinking, setThinking] = useState(false);
  const bot = (-human) as Side;
  const over = g.winner !== null || g.draw;
  const botTurn = !over && g.turn === bot;

  // lượt bot
  useEffect(() => {
    if (!botTurn) return;
    let cancelled = false;
    const snap = g;
    const t = setTimeout(async () => {
      setThinking(true);
      const r = await botMove(snap, { level: setup.level });
      if (cancelled) return;
      setThinking(false);
      if (!r) return;
      setG((cur) => {
        if (cur.moves.length !== snap.moves.length || cur.turn !== bot || cur.winner !== null || cur.draw) return cur;
        const res = applyMove(cur, r.move[0], r.move[1]);
        return res.ok ? res.state : cur;
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [botTurn, bot, setup.level, g]);

  // âm thanh + băng rôn chiếu tướng
  const heard = useRef({ moves: 0, over: false });
  const [checkFlash, setCheckFlash] = useState(0);
  useEffect(() => {
    const h = heard.current;
    const n = g.moves.length;
    if (n > h.moves) {
      soundForMove(g.captures[n - 1], g.checks[n - 1]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (g.checks[n - 1] && !over) setCheckFlash(n);
    }
    if (over && !h.over) setTimeout(() => xqSound.play(g.draw ? "draw" : g.winner === human ? "win" : "lose"), 200);
    h.moves = n;
    h.over = over;
  }, [g, over, human]);
  useEffect(() => {
    if (!checkFlash) return;
    const t = setTimeout(() => setCheckFlash(0), 1100);
    return () => clearTimeout(t);
  }, [checkFlash]);

  // tỉ số
  useEffect(() => {
    if (!over || counted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCounted(true);
    setScore((s) => (g.draw ? { ...s, draw: s.draw + 1 } : g.winner === human ? { ...s, me: s.me + 1 } : { ...s, bot: s.bot + 1 }));
  }, [over, counted, g.draw, g.winner, human]);

  const play = (from: number, to: number) => {
    if (over || g.turn !== human) return;
    const r = applyMove(g, from, to);
    if (r.ok) {
      setG(r.state);
      setHint(null);
    }
  };
  const undo = () => {
    const moves = g.moves.slice();
    if (!moves.length) return;
    moves.pop();
    if (replay(moves).turn !== human && moves.length) moves.pop();
    setG(replay(moves));
    setCounted(false);
    setHint(null);
  };
  const restart = (swap: boolean) => {
    const h = swap ? ((-human) as Side) : human;
    setHuman(h);
    setFlipped(h === -1);
    setG(newGame());
    setCounted(false);
    setHint(null);
  };
  const askHint = async () => {
    if (over || g.turn !== human) return;
    const r = await botMove(g, { level: "hard", timeMs: 700 });
    if (r) setHint(r.move);
  };

  const last = g.moves.length ? g.moves[g.moves.length - 1] : null;
  const caps = capturedBy(g.moves, g.captures);
  const status = useMemo(() => {
    if (g.draw) return `Hoà — ${END_REASON_VI[g.endReason!]}`;
    if (g.winner !== null) return `${g.winner === human ? "🎉 Bạn thắng" : `Bot ${XQ_BOT_LEVELS[setup.level]} thắng`} — ${END_REASON_VI[g.endReason!]}`;
    if (g.turn === human) return inCheck(g.board, human) ? "Bạn đang bị chiếu!" : "Lượt của bạn";
    return "Bot đang nghĩ…";
  }, [g, human, setup.level]);

  return (
    <div className="flex min-h-dvh flex-col text-[#f4e7c9]" style={{ background: `radial-gradient(circle at 50% 0%, #3a1d14, ${XQ.bg} 60%)` }}>
      <header className="flex flex-wrap items-center gap-2 border-b border-[#c99a2e]/25 px-3 py-2">
        <button type="button" onClick={onExit} className={btnCls}>
          <ArrowLeft className="h-4 w-4" /> Thoát
        </button>
        <span className={`${serif.className} text-base font-extrabold`}>Cờ Tướng · đấu máy {XQ_BOT_LEVELS[setup.level]}</span>
        <span className="ml-auto rounded-lg bg-white/5 px-2 py-1 text-xs font-bold tabular-nums">
          Bạn {score.me} – {score.bot} Máy{score.draw ? ` · hoà ${score.draw}` : ""}
        </span>
        <LabelToggle label={label} onChange={setLabel} />
        <SoundToggle />
      </header>
      <main className="flex flex-1 flex-col items-center gap-3 p-3 lg:flex-row lg:items-start lg:justify-center">
        <div className="relative w-full max-w-[min(94vw,calc((100dvh-140px)*0.906))]" style={{ aspectRatio: "580 / 640" }}>
          <XiangqiBoard board={g.board} flipped={flipped} mySide={human} canMove={!over && g.turn === human} lastMove={hint ?? last} label={label} onMove={play} />
          <CheckBanner show={checkFlash > 0} />
        </div>
        <aside className="w-full max-w-sm space-y-2.5">
          <PlayerCard side={bot} name={`Máy · ${XQ_BOT_LEVELS[setup.level]}`} active={botTurn} captured={caps[bot]} label={label} note={thinking ? <span className="text-[11px] text-[#e9c86b]">đang nghĩ…</span> : undefined} />
          <PlayerCard side={human} name={`Bạn (${SIDE_VI[human]})`} active={!over && g.turn === human} captured={caps[human]} label={label} />
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className={`text-sm font-bold ${g.winner === human ? "text-emerald-300" : g.winner !== null ? "text-rose-300" : ""}`}>{status}</p>
            {hint && <p className="mt-1 text-[11px] text-emerald-300">💡 Gợi ý: nước được tô xanh trên bàn</p>}
          </div>
          <MoveList moves={g.moves} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnCls} disabled={!g.moves.length || botTurn} onClick={undo}>
              <Undo2 className="h-4 w-4" /> Đi lại
            </button>
            <button type="button" className={btnCls} disabled={over || g.turn !== human} onClick={() => void askHint()}>
              <Lightbulb className="h-4 w-4" /> Gợi ý
            </button>
            <button type="button" className={btnCls} onClick={() => setFlipped((f) => !f)}>
              <FlipVertical2 className="h-4 w-4" /> Lật bàn
            </button>
            <button type="button" className={btnCls} onClick={() => restart(false)}>
              <RefreshCw className="h-4 w-4" /> Ván mới
            </button>
            <button type="button" className={btnCls} onClick={() => restart(true)}>
              <Repeat className="h-4 w-4" /> Ván mới, đổi bên
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
