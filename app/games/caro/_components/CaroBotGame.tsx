"use client";

/** CHƠI VỚI BOT (chạy trên máy): bot tính nước theo luật đang chọn; có đi lại, ván mới, đổi bên, tỉ số. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, RefreshCw, Repeat, Undo2 } from "lucide-react";
import { applyMove, newGame, other, RULE_HINT, RULE_LABEL, type CaroGameState, type CaroRule, type Stone } from "../_lib/rules";
import { CARO_BOT_LEVELS, chooseCaroMove, type CaroBotLevel } from "../_lib/bot";
import { masterMove, submitGame } from "../_lib/engine/client";
import type { EngineResult } from "../_lib/engine/search";

const SOURCE_VI: Record<EngineResult["source"], (r: EngineResult) => string> = {
  win: () => "Bot thấy nước thắng",
  block: () => "Bot chặn nước thắng của bạn",
  vcf: () => "⚡ Bot tìm ra chuỗi ép thắng",
  defend: () => "🛡️ Bot phá chuỗi ép thắng của bạn",
  book: (r) => `📖 Nước từ sách khai cuộc (thắng ${Math.round(r.score * 100)}% các ván trước)`,
  search: (r) => `🧠 Bot tính trước ${r.depth} nước`,
  only: () => "",
};
import CaroBoard, { STONE_COLOR, STONE_LABEL } from "./CaroBoard";
import SoundToggle from "./SoundToggle";
import { caroSound } from "../_lib/sound";

export interface BotSetup {
  rule: CaroRule;
  level: CaroBotLevel;
  /** Quân của người chơi: 1 = X (đi trước), 2 = O */
  human: Stone;
}

/** Dựng lại ván từ danh sách nước đi (dùng cho "đi lại") */
function replay(rule: CaroRule, moves: [number, number][]): CaroGameState {
  let g = newGame(rule);
  for (const [x, y] of moves) {
    const r = applyMove(g, x, y);
    if (r.ok) g = r.state;
  }
  return g;
}

export default function CaroBotGame({ setup, onExit }: { setup: BotSetup; onExit: () => void }) {
  const [human, setHuman] = useState<Stone>(setup.human);
  const [g, setG] = useState<CaroGameState>(() => newGame(setup.rule));
  const [score, setScore] = useState({ me: 0, bot: 0, draw: 0 });
  const [counted, setCounted] = useState(false);
  const bot = other(human);
  const over = g.winner !== null || g.draw;
  const botTurn = !over && g.turn === bot;

  // lượt bot: nghĩ một chút rồi đi (Cao thủ: sách khai cuộc trên server + engine trong Web Worker)
  const [botInfo, setBotInfo] = useState<string | null>(null);
  useEffect(() => {
    if (!botTurn) return;
    let cancelled = false;
    const snap = g;
    const t = setTimeout(async () => {
      let m: [number, number] | null = null;
      if (setup.level === "master") {
        const r = await masterMove(snap);
        if (cancelled) return;
        if (r) {
          m = r.move;
          setBotInfo(SOURCE_VI[r.source](r));
        }
      }
      if (!m) m = chooseCaroMove(snap, setup.level);
      if (cancelled || !m) return;
      const mv = m;
      setG((cur) => {
        // người chơi đã đi lại / ván mới trong lúc bot nghĩ -> bỏ nước này
        if (cur.moves.length !== snap.moves.length || cur.winner !== null || cur.draw || cur.turn !== bot) return cur;
        const r = applyMove(cur, mv[0], mv[1]);
        return r.ok ? r.state : cur;
      });
    }, setup.level === "master" ? 120 : 380);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [botTurn, bot, setup.level, g]);

  // âm thanh: đặt quân (mình / bot) và kết quả ván
  const heard = useRef({ moves: 0, over: false });
  useEffect(() => {
    const h = heard.current;
    const n = g.moves.length;
    if (n > h.moves) {
      const [x, y] = g.moves[n - 1];
      caroSound.play(g.board[y * g.size + x] === human ? "place" : "opponent");
    }
    if (over && !h.over) setTimeout(() => caroSound.play(g.draw ? "draw" : g.winner === human ? "win" : "lose"), 180);
    h.moves = n;
    h.over = over;
  }, [g, over, human]);

  // cộng tỉ số khi hết ván (một lần)
  useEffect(() => {
    if (!over || counted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCounted(true);
    setScore((s) => (g.draw ? { ...s, draw: s.draw + 1 } : g.winner === human ? { ...s, me: s.me + 1 } : { ...s, bot: s.bot + 1 }));
    // gửi ván lên server: bot học cả cách đi của người chơi (thắng hay thua đều học)
    submitGame(setup.rule, g.moves);
  }, [over, counted, g.draw, g.winner, g.moves, human, setup.rule]);

  const play = (x: number, y: number) => {
    caroSound.unlock();
    if (over || g.turn !== human) return;
    const r = applyMove(g, x, y);
    if (r.ok) setG(r.state);
  };
  const undo = () => {
    // bỏ nước của bot và nước của mình gần nhất -> lại tới lượt mình
    const moves = g.moves.slice();
    if (!moves.length) return;
    moves.pop();
    if (replay(setup.rule, moves).turn !== human && moves.length) moves.pop();
    setG(replay(setup.rule, moves));
    setCounted(false);
  };
  const restart = (swap: boolean) => {
    if (swap) setHuman((h) => other(h));
    setG(newGame(setup.rule));
    setCounted(false);
    setBotInfo(null);
  };

  const last = g.moves.length ? g.moves[g.moves.length - 1] : null;
  const status = useMemo(() => {
    if (g.draw) return "Hoà — bàn cờ đã kín";
    if (g.winner !== null) return g.winner === human ? "🎉 Bạn thắng!" : `Bot ${CARO_BOT_LEVELS[setup.level]} thắng`;
    return g.turn === human ? "Lượt của bạn" : "Bot đang nghĩ…";
  }, [g.draw, g.winner, g.turn, human, setup.level]);

  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-white/10 disabled:opacity-40";
  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0d1a] text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <button type="button" onClick={onExit} className={btn}>
          <ArrowLeft className="h-4 w-4" /> Thoát
        </button>
        <span className="text-sm font-black">Cờ Caro · đấu bot {CARO_BOT_LEVELS[setup.level]}</span>
        <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300" title={RULE_HINT[setup.rule]}>
          {RULE_LABEL[setup.rule]}
        </span>
        <span className="ml-auto rounded-lg bg-white/5 px-2 py-1 text-xs font-bold tabular-nums">
          Bạn {score.me} – {score.bot} Bot{score.draw ? ` · hoà ${score.draw}` : ""}
        </span>
        <SoundToggle />
      </header>
      <main className="flex flex-1 flex-col items-center gap-3 p-3 lg:flex-row lg:items-start lg:justify-center">
        <div className="aspect-square w-full max-w-[min(94vw,calc(100dvh-150px))]">
          <CaroBoard size={g.size} board={g.board} lastMove={last} winLine={g.winLine} hoverStone={g.turn === human && !over ? human : null} disabled={over || g.turn !== human} onCell={play} />
        </div>
        <aside className="w-full max-w-sm space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#11132a] p-3">
            <p className={`text-base font-black ${g.winner === human ? "text-emerald-300" : g.winner !== null ? "text-rose-300" : ""}`}>
              {botTurn && <Bot className="mr-1 inline h-4 w-4 animate-pulse text-sky-300" />}
              {status}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {([human, bot] as Stone[]).map((s) => (
                <div key={s} className={`rounded-xl border px-2 py-1.5 ${g.turn === s && !over ? "border-[#ffd166] bg-[#ffd166]/10" : "border-white/10"}`}>
                  <span className="font-black" style={{ color: STONE_COLOR[s] }}>{STONE_LABEL[s]}</span> {s === human ? "Bạn" : "Bot"}
                  {s === 1 && <span className="text-slate-400"> · đi trước</span>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{RULE_HINT[setup.rule]} · {g.moves.length} nước</p>
            {setup.level === "master" && botInfo && <p className="mt-1 text-[11px] text-sky-300">{botInfo}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={!g.moves.length || botTurn} onClick={undo}>
              <Undo2 className="h-4 w-4" /> Đi lại
            </button>
            <button type="button" className={btn} onClick={() => restart(false)}>
              <RefreshCw className="h-4 w-4" /> Ván mới
            </button>
            <button type="button" className={btn} onClick={() => restart(true)}>
              <Repeat className="h-4 w-4" /> Ván mới, đổi bên
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
