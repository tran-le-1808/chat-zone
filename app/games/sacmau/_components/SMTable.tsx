"use client";

/** BÀN SẮC MÀU (dùng chung cho chơi với máy và online) — chỉ thấy bài của mình */
import { useEffect, useRef, useState } from "react";
import { Bot, Megaphone, RotateCcw, RotateCw } from "lucide-react";
import { DRAW2, isWild, REVERSE, SKIP, valueOf, WILD4, type SMEvent } from "../_lib/cards";
import { smSound } from "../_lib/sound";
import { SMCardBack, SMCardFace } from "./SMCard";
import { font, HE, SM, TABLE_BG } from "./theme";

export interface SMView {
  step: number;
  games: number;
  n: number;
  mySeat: number;
  names: string[];
  bots: boolean[];
  connected?: boolean[];
  counts: number[];
  hand: number[];
  top: number;
  color: number;
  dir: 1 | -1;
  turn: number;
  pending: number;
  drawn: number | null;
  playable: number[];
  pileCount: number;
  called: boolean[];
  over: boolean;
  winner: number | null;
  events: SMEvent[];
  deadline: number | null;
  turnSeconds: number;
  scores: number[];
  lastScores: number[] | null;
  revealed: number[][] | null;
}

const POS: Record<number, ("right" | "top" | "left")[]> = { 2: ["top"], 3: ["right", "left"], 4: ["right", "top", "left"] };

function useCardWidth() {
  const [w, setW] = useState(64);
  useEffect(() => {
    const f = () => setW(Math.max(42, Math.min(76, Math.floor((window.innerWidth - 32) / 7))));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

export default function SMTable({
  view,
  onPlay,
  onDraw,
  onPass,
  onNext,
  nextLabel = "Ván tiếp",
  header,
  resultExtra,
}: {
  view: SMView;
  onPlay: (card: number, color: number | undefined, call: boolean) => Promise<boolean> | boolean;
  onDraw: () => void;
  onPass: () => void;
  onNext?: () => void;
  nextLabel?: string;
  header: React.ReactNode;
  resultExtra?: React.ReactNode;
}) {
  const v = view;
  const cw = useCardWidth();
  const [now, setNow] = useState(() => Date.now());
  const [pick, setPick] = useState<number | null>(null);
  const [callArmed, setCallArmed] = useState(false);
  const [flash, setFlash] = useState<{ key: number; text: string; color: string } | null>(null);
  const [showResult, setShowResult] = useState(true);
  const myTurn = !v.over && v.turn === v.mySeat && v.mySeat >= 0;

  useEffect(() => {
    if (v.over || v.deadline === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [v.over, v.deadline]);

  // âm thanh / hiệu ứng theo sự kiện mới
  const seen = useRef({ step: -1, games: -1, myTurn: false });
  /* eslint-disable react-hooks/set-state-in-effect -- hiệu ứng thoáng qua theo nước vừa đánh */
  useEffect(() => {
    const h = seen.current;
    if (v.games !== h.games) {
      smSound.play("deal");
      setShowResult(true);
      setCallArmed(false);
    } else if (v.step !== h.step) {
      const recent = v.events.slice(-3);
      const last = recent[recent.length - 1];
      const played = [...recent].reverse().find((e) => e.kind === "play");
      if (last?.kind === "draw" && (last.count ?? 1) >= 2) {
        smSound.play("chop");
        setFlash({ key: v.step, text: `+${last.count} lá!`, color: "#ff5d5d" });
      } else if (played && played === recent.find((e) => e.kind === "play")) {
        const val = valueOf(played.card!);
        if (val === DRAW2 || val === WILD4) {
          smSound.play("chop");
          setFlash({ key: v.step, text: val === WILD4 ? "+4" : "+2", color: "#ff5d5d" });
        } else if (val === SKIP) {
          smSound.play("skip");
          setFlash({ key: v.step, text: "Chặn!", color: SM.gold });
        } else if (val === REVERSE) {
          smSound.play("skip");
          setFlash({ key: v.step, text: "Đảo chiều!", color: SM.gold });
        } else smSound.play("play");
        if (recent.some((e) => e.kind === "call")) setTimeout(() => smSound.play("call"), 150);
        if (recent.some((e) => e.kind === "penalty")) setFlash({ key: v.step + 0.5, text: "Quên báo! +2", color: "#ff5d5d" });
      } else if (last?.kind === "draw") smSound.play("draw");
      else if (last?.kind === "pass") smSound.play("pass");
    }
    if (v.over && h.step !== v.step && v.mySeat >= 0) setTimeout(() => smSound.play(v.winner === v.mySeat ? "win" : "lose"), 350);
    if (myTurn && !h.myTurn) smSound.play("turn");
    seen.current = { step: v.step, games: v.games, myTurn };
  }, [v.step, v.games, v.events, v.over, v.winner, v.mySeat, myTurn]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1100);
    return () => clearTimeout(t);
  }, [flash]);

  const remain = v.deadline !== null ? Math.max(0, v.deadline - now) / 1000 : null;
  const others = Array.from({ length: v.n - 1 }, (_, k) => (v.mySeat + 1 + k) % v.n);
  const he = HE[v.color];
  const needCall = myTurn && v.hand.length === 2;

  const clickCard = async (card: number) => {
    smSound.unlock();
    if (!myTurn || !v.playable.includes(card)) return;
    if (isWild(card)) {
      setPick(card);
      return;
    }
    if (await onPlay(card, undefined, callArmed)) setCallArmed(false);
  };
  const chooseColor = async (color: number) => {
    const card = pick;
    setPick(null);
    if (card !== null && (await onPlay(card, color, callArmed))) setCallArmed(false);
  };

  const badge = (seat: number) => {
    const active = !v.over && v.turn === seat;
    return (
      <div className="relative flex items-center gap-2 rounded-2xl px-2.5 py-1.5" style={{ background: active ? "rgba(255,209,102,.2)" : "rgba(0,0,0,.35)", border: `1.5px solid ${active ? SM.gold : "rgba(255,255,255,.15)"}`, boxShadow: active ? `0 0 18px ${SM.gold}66` : undefined }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: v.bots[seat] ? "#4b5563" : "#6d4ce0", border: `2px solid ${SM.gold}` }}>
          {v.bots[seat] ? <Bot className="h-4 w-4" /> : (v.names[seat] ?? "?").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="max-w-[7.5rem] truncate text-xs font-bold text-white">{v.names[seat]}</p>
          <p className="text-[11px] text-white/70">
            {v.counts[seat]} lá · {v.scores[seat] > 0 ? "+" : ""}
            {v.scores[seat]} điểm
            {v.connected && !v.connected[seat] && <span className="text-rose-300"> · mất kết nối</span>}
          </p>
        </div>
        {v.counts[seat] === 1 && !v.over && (
          <span className="absolute -top-2 right-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-[#1f1a3d]" style={{ background: v.called[seat] ? SM.gold : "#ff8080" }}>
            {v.called[seat] ? "Báo!" : "1 lá"}
          </span>
        )}
        {active && remain !== null && (
          <span className="absolute inset-x-2 -bottom-1 h-1 overflow-hidden rounded-full bg-black/40">
            <span className={`block h-full ${remain < 5 ? "bg-rose-500" : "bg-[#ffd166]"}`} style={{ width: `${Math.min(100, (remain / v.turnSeconds) * 100)}%` }} />
          </span>
        )}
      </div>
    );
  };

  const opponent = (seat: number, pos: "right" | "top" | "left") => {
    const cls = pos === "top" ? "left-1/2 top-2 -translate-x-1/2 flex-col" : pos === "left" ? "left-2 top-[26%] -translate-y-1/2 flex-col sm:top-1/2 sm:flex-row" : "right-2 top-[26%] -translate-y-1/2 flex-col sm:top-1/2 sm:flex-row-reverse";
    return (
      <div key={seat} className={`absolute z-10 flex items-center gap-2 ${cls}`}>
        {badge(seat)}
        {v.counts[seat] > 0 && (
          <div className="flex">
            {Array.from({ length: Math.min(v.counts[seat], 8) }, (_, i) => (
              <SMCardBack key={i} w={22} style={{ marginLeft: i ? -15 : 0 }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const fanStep = Math.min(cw * 0.66, Math.max(cw * 0.3, (Math.min(typeof window === "undefined" ? 900 : window.innerWidth, 1100) - 40 - cw) / Math.max(1, v.hand.length - 1)));
  const DirIcon = v.dir === 1 ? RotateCcw : RotateCw;

  return (
    <div className={`${font.className} flex h-dvh flex-col overflow-hidden text-white`} style={{ background: SM.bg }}>
      {header}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={TABLE_BG}>
        {/* vòng màu hệ hiện tại */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,380px)] w-[min(70vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-500" style={{ background: `radial-gradient(circle, ${he.main}55 0%, ${he.main}18 45%, transparent 70%)`, border: `2px dashed ${he.main}88` }} />
        {others.map((seat, k) => opponent(seat, POS[v.n][k]))}

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => myTurn && v.drawn === null && onDraw()} disabled={!myTurn || v.drawn !== null} className="relative transition enabled:hover:-translate-y-1" title="Bốc bài">
              <SMCardBack w={Math.min(cw, 64)} />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 text-[10px] font-bold">{v.pileCount}</span>
              {myTurn && v.drawn === null && <span className="absolute inset-0 animate-pulse rounded-[14%]" style={{ boxShadow: `0 0 0 3px ${SM.gold}` }} />}
            </button>
            <div key={v.top} className="sm-in">
              <SMCardFace card={v.top} w={Math.min(cw + 6, 74)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: he.main }}>
              <he.Icon className="h-3.5 w-3.5" /> <span className="whitespace-nowrap">Hệ {he.name}</span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold" title="Chiều đánh">
              <DirIcon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{v.dir === 1 ? "Ngược kim đồng hồ" : "Thuận kim đồng hồ"}</span><span className="sm:hidden">Chiều</span>
            </span>
          </div>
          {v.pending > 0 && <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-extrabold">+{v.pending} đang chờ — chồng tiếp hoặc bốc</span>}
        </div>
        {flash && (
          <div key={flash.key} className="sm-flash pointer-events-none absolute left-1/2 top-[30%] z-20 -translate-x-1/2 whitespace-nowrap text-5xl font-extrabold" style={{ color: flash.color, textShadow: "0 4px 0 rgba(0,0,0,.4), 0 0 24px rgba(0,0,0,.5)" }}>
            {flash.text}
          </div>
        )}
      </div>

      <div className="relative shrink-0 px-2 pb-3 pt-2" style={{ background: "linear-gradient(180deg, #1d1842, #0f0c24)" }}>
        <div className="mb-1 flex flex-wrap items-center justify-center gap-2">
          {v.mySeat >= 0 && badge(v.mySeat)}
          {myTurn && (
            <span className="rounded-full px-3 py-1 text-xs font-extrabold text-[#1f1a3d]" style={{ background: SM.gold }}>
              {v.drawn !== null ? "Đánh lá vừa bốc hoặc bỏ lượt" : v.pending > 0 ? `Chồng +2/+4 hoặc bốc ${v.pending} lá` : v.playable.length ? "Tới lượt bạn" : "Không có lá đánh được — bốc bài"}
              {remain !== null ? ` · ${Math.ceil(remain)}s` : ""}
            </span>
          )}
        </div>
        <div className="flex justify-center overflow-x-auto pb-1 pt-6">
          <div className="flex">
            {v.hand.map((c, i) => {
              const ok = myTurn && v.playable.includes(c);
              return <SMCardFace key={c} card={c} w={cw} glow={ok} lift={ok && c === v.drawn} dim={myTurn && !ok} onClick={ok ? () => void clickCard(c) : undefined} style={{ marginLeft: i ? fanStep - cw : 0 }} />;
            })}
          </div>
        </div>
        {!v.over && v.mySeat >= 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {needCall && (
              <button type="button" onClick={() => setCallArmed((x) => !x)} className={`inline-flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-extrabold ${callArmed ? "" : "animate-pulse"}`} style={{ background: callArmed ? SM.gold : "#ff5d5d", color: callArmed ? SM.ink : "#fff" }}>
                <Megaphone className="h-4 w-4" /> {callArmed ? "Đã báo ✓" : "Báo! (còn 1 lá)"}
              </button>
            )}
            <button type="button" onClick={onDraw} disabled={!myTurn || v.drawn !== null} className="rounded-xl bg-white/90 px-5 py-2.5 text-sm font-extrabold text-[#1f1a3d] disabled:opacity-40">
              {v.pending > 0 ? `Bốc ${v.pending} lá` : "Bốc bài"}
            </button>
            <button type="button" onClick={onPass} disabled={!myTurn || v.drawn === null} className="rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-extrabold disabled:opacity-40">
              Bỏ lượt
            </button>
          </div>
        )}
      </div>

      {pick !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" onClick={() => setPick(null)}>
          <div className="rounded-3xl p-5 text-center" style={{ background: SM.cream, color: SM.ink }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-lg font-extrabold">Chọn hệ</p>
            <div className="grid grid-cols-2 gap-3">
              {HE.map((x, i) => (
                <button key={x.name} type="button" onClick={() => void chooseColor(i)} className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-2xl text-white transition hover:scale-105" style={{ background: `linear-gradient(155deg, ${x.main}, ${x.dark})` }}>
                  <x.Icon className="h-7 w-7" />
                  <span className="text-sm font-extrabold">{x.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {v.over && showResult && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-3xl p-5" style={{ background: SM.cream, color: SM.ink, border: `3px solid ${SM.gold}` }}>
            <h2 className="text-center text-2xl font-extrabold" style={{ color: "#6d4ce0" }}>
              {v.winner === v.mySeat ? "🎉 Bạn thắng!" : v.winner !== null ? `🏆 ${v.names[v.winner]} thắng` : "Ván kết thúc"}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {Array.from({ length: v.n }, (_, i) => i)
                .sort((a, b) => (b === v.winner ? 1 : 0) - (a === v.winner ? 1 : 0) || v.counts[a] - v.counts[b])
                .map((seat) => (
                  <li key={seat} className="rounded-xl px-3 py-2" style={{ background: seat === v.mySeat ? "rgba(255,209,102,.35)" : "rgba(0,0,0,.05)" }}>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="min-w-0 flex-1 truncate">
                        {seat === v.winner ? "👑 " : ""}
                        {v.names[seat]}
                      </span>
                      {v.lastScores && <span className={v.lastScores[seat] >= 0 ? "text-emerald-700" : "text-rose-700"}>{v.lastScores[seat] > 0 ? "+" : ""}{v.lastScores[seat]}</span>}
                      <span className="w-14 text-right text-xs opacity-70">Σ {v.scores[seat]}</span>
                    </div>
                    {v.revealed && v.revealed[seat]?.length > 0 && (
                      <div className="mt-1 flex flex-wrap">
                        {v.revealed[seat].map((c, k) => (
                          <SMCardFace key={c} card={c} w={26} style={{ marginLeft: k ? -9 : 0 }} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-center text-[11px] opacity-70">Người thắng ăn điểm bài còn lại: số = điểm số, chức năng 20, đổi sắc 50.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {onNext && (
                <button type="button" onClick={onNext} className="flex-1 rounded-xl py-3 text-base font-extrabold text-white" style={{ background: "linear-gradient(180deg,#7c5cf0,#5233c7)", boxShadow: `inset 0 0 0 2px ${SM.gold}` }}>
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
      <style>{`.sm-in{animation:smin .28s ease-out}@keyframes smin{from{transform:scale(.6) rotate(-14deg);opacity:0}to{transform:none;opacity:1}}.sm-flash{animation:smf 1.1s ease-out forwards}@keyframes smf{0%{transform:translateX(-50%) scale(.4);opacity:0}20%{transform:translateX(-50%) scale(1.15);opacity:1}70%{opacity:1}100%{transform:translateX(-50%) scale(1);opacity:0}}`}</style>
    </div>
  );
}
