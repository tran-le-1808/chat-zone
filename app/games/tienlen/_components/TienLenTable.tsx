"use client";

/**
 * BÀN TIẾN LÊN (dùng chung cho chơi với máy và online). Nhận "góc nhìn" của người chơi (chỉ bài của mình).
 * Ghế xếp ngược chiều kim đồng hồ: mình ở dưới, người kế tiếp bên phải, rồi trên, rồi trái.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Lightbulb, X } from "lucide-react";
import { toast } from "sonner";
import { beats, comboLabel, comboOf, PLACE_VI, TL_ERROR_VI, type TablePlay, type TLEvent } from "../_lib/cards";
import { allCombos } from "../_lib/bot";
import { tlSound } from "../_lib/sound";
import { CardBack, CardFace } from "./PlayingCard";
import { display, FELT_BG, TL } from "./theme";

export interface TableView {
  /** Đổi mỗi khi có nước mới (để phát âm thanh) */
  step: number;
  games: number;
  n: number;
  mySeat: number;
  names: string[];
  bots: boolean[];
  connected?: boolean[];
  counts: number[];
  hand: number[];
  turn: number;
  table: TablePlay | null;
  passed: boolean[];
  finished: number[];
  mustPlay: number;
  over: boolean;
  instant: { seat: number; reason: string } | null;
  events: TLEvent[];
  /** Thời điểm hết lượt (giờ máy mình), null = không giới hạn */
  deadline: number | null;
  turnSeconds: number;
  scores: number[];
  lastScores: number[] | null;
  revealed: number[][] | null;
}

const POS: Record<number, ("right" | "top" | "left")[]> = { 2: ["top"], 3: ["right", "left"], 4: ["right", "top", "left"] };

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function useCardWidth() {
  const [w, setW] = useState(64);
  useEffect(() => {
    const f = () => setW(Math.max(40, Math.min(78, Math.floor((window.innerWidth - 32) / 7.6))));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

const placeLabel = (i: number, n: number) => (i === n - 1 ? "Bét" : PLACE_VI[i]);

export default function TienLenTable({
  view,
  onPlay,
  onPass,
  onNext,
  nextLabel = "Ván tiếp",
  header,
  resultExtra,
}: {
  view: TableView;
  onPlay: (cards: number[]) => Promise<boolean> | boolean;
  onPass: () => void;
  onNext?: () => void;
  nextLabel?: string;
  header: React.ReactNode;
  resultExtra?: React.ReactNode;
}) {
  const v = view;
  const [sel, setSel] = useState<number[]>([]);
  const [hintIdx, setHintIdx] = useState(0);
  const [burst, setBurst] = useState<{ key: number; text: string } | null>(null);
  const [showResult, setShowResult] = useState(true);
  const cw = useCardWidth();
  const now = useNow(!v.over && v.deadline !== null);
  const myTurn = !v.over && v.turn === v.mySeat && v.mySeat >= 0;

  // bỏ chọn những lá không còn trên tay (sau khi đánh / ván mới)
  const handKey = v.hand.join(",");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSel((s) => s.filter((c) => v.hand.includes(c)));
    setHintIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey, v.table?.combo.top, v.table?.seat]);

  // âm thanh & hiệu ứng theo nước mới
  const seen = useRef({ step: -1, games: -1, myTurn: false });
  useEffect(() => {
    const h = seen.current;
    if (v.games !== h.games) {
      if (h.games >= 0 || v.events.length === 0) tlSound.play("deal");
       
      setShowResult(true);
    } else if (v.step !== h.step) {
      const e = v.events[v.events.length - 1];
      if (e?.kind === "play" || e?.kind === "finish") {
        const play = [...v.events].reverse().find((x) => x.kind === "play");
        if (play?.chop) {
          tlSound.play("chop");
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBurst({ key: v.step, text: "CHẶT!" });
        } else tlSound.play("play", play?.cards?.length ?? 1);
      } else if (e?.kind === "pass") tlSound.play("pass");
    }
    if (v.over && h.step !== v.step && v.mySeat >= 0) {
      const iWon = v.instant ? v.instant.seat === v.mySeat : v.finished[0] === v.mySeat;
      setTimeout(() => tlSound.play(iWon ? "win" : "lose"), 350);
    }
    if (myTurn && !h.myTurn) tlSound.play("turn");
    seen.current = { step: v.step, games: v.games, myTurn };
  }, [v.step, v.games, v.events, v.over, v.finished, v.instant, v.mySeat, myTurn]);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1200);
    return () => clearTimeout(t);
  }, [burst]);

  const legal = useMemo(() => {
    if (!myTurn) return [];
    let c = allCombos(v.hand);
    if (v.mustPlay >= 0) c = c.filter((x) => x.cards.includes(v.mustPlay));
    if (v.table) c = c.filter((x) => beats(x.combo, v.table!.combo));
    // gợi ý: bộ nhiều lá trước, cùng số lá thì yếu trước
    return c.sort((a, b) => (v.table ? a.combo.top - b.combo.top : b.cards.length - a.cards.length || a.combo.top - b.combo.top));
  }, [myTurn, v.hand, v.mustPlay, v.table]);

  const selCombo = sel.length ? comboOf(sel) : null;
  const canPlay = myTurn && !!selCombo && (!v.table || beats(selCombo, v.table.combo)) && (v.mustPlay < 0 || sel.includes(v.mustPlay));

  const toggle = (c: number) => {
    tlSound.unlock();
    tlSound.play("select");
    setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  };
  const hint = () => {
    if (!legal.length) {
      toast("Không có bộ nào đè được — bỏ lượt nhé");
      return;
    }
    setSel(legal[hintIdx % legal.length].cards);
    setHintIdx((i) => i + 1);
  };
  const doPlay = async () => {
    if (!selCombo) return toast.error(TL_ERROR_VI.BAD_COMBO);
    if (v.mustPlay >= 0 && !sel.includes(v.mustPlay)) return toast.error(TL_ERROR_VI.MUST_PLAY_LOWEST);
    if (v.table && !beats(selCombo, v.table.combo)) return toast.error(TL_ERROR_VI.TOO_WEAK);
    if (await onPlay(sel)) setSel([]);
  };

  const others = Array.from({ length: v.n - 1 }, (_, k) => (v.mySeat + 1 + k) % v.n);
  const remain = v.deadline !== null ? Math.max(0, v.deadline - now) / 1000 : null;

  const seatBadge = (seat: number, compact = false) => {
    const active = !v.over && v.turn === seat;
    const done = v.finished.indexOf(seat);
    return (
      <div className={`relative flex items-center gap-2 rounded-2xl px-2.5 py-1.5 ${compact ? "" : "min-w-[8.5rem]"}`} style={{ background: active ? "rgba(242,193,78,.22)" : "rgba(0,0,0,.35)", border: `1.5px solid ${active ? TL.gold : "rgba(255,255,255,.15)"}`, boxShadow: active ? `0 0 18px ${TL.gold}66` : undefined }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: v.bots[seat] ? "#4b5563" : TL.red, border: `2px solid ${TL.gold}` }}>
          {v.bots[seat] ? <Bot className="h-4 w-4" /> : (v.names[seat] ?? "?").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="max-w-[7.5rem] truncate text-xs font-bold text-white">{v.names[seat]}</p>
          <p className="text-[11px] text-white/70">
            {done >= 0 ? <b className="text-[#f2c14e]">{placeLabel(done, v.n)}</b> : `${v.counts[seat]} lá`} · {v.scores[seat] > 0 ? "+" : ""}
            {v.scores[seat]} điểm
            {v.connected && !v.connected[seat] && <span className="text-rose-300"> · mất kết nối</span>}
          </p>
        </div>
        {v.passed[seat] && !v.over && <span className="absolute -top-2 right-1 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white">Bỏ lượt</span>}
        {active && remain !== null && (
          <span className="absolute inset-x-2 -bottom-1 h-1 overflow-hidden rounded-full bg-black/40">
            <span className={`block h-full ${remain < 5 ? "bg-rose-500" : "bg-[#f2c14e]"}`} style={{ width: `${Math.min(100, (remain / v.turnSeconds) * 100)}%` }} />
          </span>
        )}
      </div>
    );
  };

  const opponent = (seat: number, pos: "right" | "top" | "left") => {
    const backs = Math.min(v.counts[seat], 13);
    const cls = pos === "top" ? "left-1/2 top-2 -translate-x-1/2 flex-col" : pos === "left" ? "left-2 top-[26%] -translate-y-1/2 flex-col sm:top-1/2 sm:flex-row" : "right-2 top-[26%] -translate-y-1/2 flex-col sm:top-1/2 sm:flex-row-reverse";
    return (
      <div key={seat} className={`absolute z-10 flex items-center gap-2 ${cls}`}>
        {seatBadge(seat)}
        {backs > 0 && (
          <div className="flex" aria-label={`${v.counts[seat]} lá`}>
            {Array.from({ length: Math.min(backs, 7) }, (_, i) => (
              <CardBack key={i} w={22} style={{ marginLeft: i ? -14 : 0 }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const t = v.table;
  const fanStep = Math.min(cw * 0.62, Math.max(cw * 0.36, (Math.min(typeof window === "undefined" ? 900 : window.innerWidth, 1100) - 40 - cw) / Math.max(1, v.hand.length - 1)));

  return (
    <div className={`${display.className} flex h-dvh flex-col overflow-hidden text-white`} style={{ background: TL.bg }}>
      {header}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={FELT_BG}>
        {/* viền bàn */}
        <div className="pointer-events-none absolute inset-2 rounded-[40px] sm:inset-4" style={{ border: `3px solid rgba(242,193,78,.35)`, boxShadow: "inset 0 0 60px rgba(0,0,0,.45)" }} />
        {others.map((seat, k) => opponent(seat, POS[v.n][k]))}

        {/* giữa bàn */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          {t ? (
            <>
              <div key={`${t.seat}-${t.cards.join(",")}`} className="tl-in flex">
                {t.cards.map((c, i) => (
                  <CardFace key={c} card={c} w={Math.min(cw, 60)} style={{ marginLeft: i ? -Math.min(cw, 60) * 0.45 : 0 }} />
                ))}
              </div>
              <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-bold">
                {v.names[t.seat]} · {comboLabel(t.combo)}
              </span>
            </>
          ) : (
            !v.over && (
              <span className="rounded-full bg-black/30 px-4 py-1.5 text-sm font-bold text-white/85">
                {v.turn === v.mySeat ? "Bạn cầm cái — đánh bộ bất kỳ" : `${v.names[v.turn]} cầm cái`}
                {v.mustPlay >= 0 && " (phải có lá nhỏ nhất)"}
              </span>
            )
          )}
        </div>
        {burst && (
          <div key={burst.key} className="tl-burst pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 text-5xl font-black sm:text-6xl" style={{ color: TL.gold, textShadow: `0 4px 0 ${TL.redDeep}, 0 0 30px ${TL.red}` }}>
            {burst.text}
          </div>
        )}
      </div>

      {/* khu vực của mình */}
      <div className="relative shrink-0 px-2 pb-3 pt-2" style={{ background: "linear-gradient(180deg, #06402a, #041f15)" }}>
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          {v.mySeat >= 0 && seatBadge(v.mySeat, true)}
          {myTurn && <span className="rounded-full px-3 py-1 text-xs font-black text-[#3a1210]" style={{ background: TL.gold }}>Tới lượt bạn{remain !== null ? ` · ${Math.ceil(remain)}s` : ""}</span>}
        </div>
        <div className="flex justify-center overflow-x-auto pb-1 pt-6">
          <div className="flex">
            {v.hand.map((c, i) => (
              <CardFace key={c} card={c} w={cw} selected={sel.includes(c)} onClick={v.over ? undefined : () => toggle(c)} style={{ marginLeft: i ? fanStep - cw : 0 }} />
            ))}
          </div>
        </div>
        {!v.over && v.mySeat >= 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={hint} disabled={!myTurn} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40">
              <Lightbulb className="h-4 w-4" /> Gợi ý
            </button>
            <button type="button" onClick={() => setSel([])} disabled={!sel.length} className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40">
              <X className="h-4 w-4" /> Bỏ chọn
            </button>
            <button type="button" onClick={onPass} disabled={!myTurn || !v.table} className="rounded-xl px-5 py-2.5 text-sm font-black disabled:opacity-40" style={{ background: "#e5e7eb", color: "#111", boxShadow: "0 3px 0 #9ca3af" }}>
              Bỏ lượt
            </button>
            <button type="button" onClick={() => void doPlay()} disabled={!canPlay} className="rounded-xl px-6 py-2.5 text-sm font-black text-white disabled:opacity-40" style={{ background: `linear-gradient(180deg, ${TL.red}, ${TL.redDeep})`, boxShadow: `0 3px 0 #4a0808, inset 0 0 0 1.5px ${TL.gold}` }}>
              Đánh{selCombo ? ` · ${comboLabel(selCombo)}` : ""}
            </button>
          </div>
        )}
      </div>

      {/* kết quả */}
      {v.over && showResult && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-3xl p-5 text-[#3a1210]" style={{ background: TL.cream, border: `3px solid ${TL.gold}`, boxShadow: "0 20px 50px rgba(0,0,0,.6)" }}>
            <h2 className="text-center text-2xl font-black" style={{ color: TL.red }}>
              {v.instant ? `🎉 ${v.names[v.instant.seat]} tới trắng!` : v.finished[0] === v.mySeat ? "🎉 Bạn về nhất!" : `🏆 ${v.names[v.finished[0]]} về nhất`}
            </h2>
            {v.instant && <p className="text-center text-sm font-bold">{v.instant.reason}</p>}
            <ul className="mt-3 space-y-1.5">
              {(v.instant ? [v.instant.seat, ...Array.from({ length: v.n }, (_, i) => i).filter((i) => i !== v.instant!.seat)] : v.finished).map((seat, i) => (
                <li key={seat} className="rounded-xl px-3 py-2" style={{ background: seat === v.mySeat ? "rgba(242,193,78,.3)" : "rgba(0,0,0,.05)" }}>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="w-10 text-xs" style={{ color: TL.inkSoft }}>{v.instant ? (i === 0 ? "Nhất" : "Thua") : placeLabel(i, v.n)}</span>
                    <span className="min-w-0 flex-1 truncate">{v.names[seat]}{seat === v.mySeat && v.names[seat] !== "Bạn" ? " (bạn)" : ""}</span>
                    {v.lastScores && <span className={v.lastScores[seat] >= 0 ? "text-emerald-700" : "text-rose-700"}>{v.lastScores[seat] > 0 ? "+" : ""}{v.lastScores[seat]}</span>}
                    <span className="w-14 text-right text-xs" style={{ color: TL.inkSoft }}>Σ {v.scores[seat]}</span>
                  </div>
                  {v.revealed && v.revealed[seat]?.length > 0 && (
                    <div className="mt-1 flex flex-wrap">
                      {v.revealed[seat].map((c, k) => (
                        <CardFace key={c} card={c} w={26} style={{ marginLeft: k ? -10 : 0 }} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {onNext && (
                <button type="button" onClick={onNext} className="flex-1 rounded-xl py-3 text-base font-black text-white" style={{ background: `linear-gradient(180deg, ${TL.red}, ${TL.redDeep})`, boxShadow: `inset 0 0 0 2px ${TL.gold}` }}>
                  {nextLabel}
                </button>
              )}
              <button type="button" onClick={() => setShowResult(false)} className="rounded-xl border border-black/15 px-4 py-3 text-sm font-bold">
                Xem bàn
              </button>
              {resultExtra}
            </div>
          </div>
        </div>
      )}
      <style>{`.tl-in{animation:tlin .28s ease-out}@keyframes tlin{from{transform:scale(.7) translateY(30px);opacity:0}to{transform:none;opacity:1}}.tl-burst{animation:tlb 1.2s ease-out forwards}@keyframes tlb{0%{transform:translateX(-50%) scale(.4);opacity:0}20%{transform:translateX(-50%) scale(1.2);opacity:1}70%{opacity:1}100%{transform:translateX(-50%) scale(1);opacity:0}}`}</style>
    </div>
  );
}
