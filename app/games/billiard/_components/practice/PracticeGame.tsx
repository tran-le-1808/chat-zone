"use client";

/**
 * TỰ LUYỆN & ĐẤU BOT (Bida Carom) — chạy hoàn toàn trên máy, không ảnh hưởng xếp hạng / trận online.
 * Dùng lại bàn 3D, điều khiển cơ và luật của trận thật (qua BilliardGameCore + trận cục bộ).
 * Tự luyện: kéo thả bi tuỳ ý, đánh lại cú vừa rồi, khai cuộc / ngẫu nhiên / thế bi mẫu, chọn bi cái.
 */
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bot, Dices, Hand, RotateCcw, Settings, Target, Trophy, Undo2 } from "lucide-react";
import RotateDeviceOverlay from "../../../monopoly/_components/ui/RotateDeviceOverlay";
import { BilliardGameCore, useBilliard } from "../../_context/BilliardGameContext";
import { initialPositions, type CaromMode } from "../../_lib/physics";
import { BOT_LEVELS, type BotLevel } from "../../_lib/practice/bot";
import { randomLayout, SCENARIO_LIBRARY } from "../../_lib/studio/library";
import { BALL_COLORS, MODE_LABEL } from "../../_lib/types";
import BilliardScene from "../game/BilliardScene";
import ShotControls, { useCaromStatus } from "../game/ShotControls";
import SettingsPanel from "../game/SettingsPanel";
import BallEditor from "./BallEditor";
import { createLocalSession, type LocalSession, type LocalSessionOptions } from "./localSession";

const ME = "me";
const TARGETS: Record<CaromMode, number[]> = { free: [5, 10, 15, 20], three: [3, 5, 10] };

export default function PracticeGame() {
  const [cfg, setCfg] = useState<LocalSessionOptions | null>(null);
  if (!cfg) return <SetupScreen onStart={setCfg} />;
  return <PracticeTable cfg={cfg} onExit={() => setCfg(null)} />;
}

// ------------------------------------------------------------------ chọn chế độ

function SetupScreen({ onStart }: { onStart: (c: LocalSessionOptions) => void }) {
  const [kind, setKind] = useState<"practice" | "bot">("practice");
  const [mode, setMode] = useState<CaromMode>("free");
  const [level, setLevel] = useState<BotLevel>("medium");
  const [target, setTarget] = useState(10);
  const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-sm font-bold transition ${on ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"}`;
  return (
    <div className="min-h-dvh bg-[#0b0d1a] text-slate-100">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href="/games/billiard" className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Về sảnh bida">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-black">Luyện tập · Bida Carom</h1>
      </header>
      <main className="mx-auto max-w-xl space-y-5 p-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <button type="button" className={`${chip(kind === "practice")} flex flex-col items-start gap-1 p-4 text-left`} onClick={() => setKind("practice")}>
            <span className="flex items-center gap-2 text-base"><Hand className="h-5 w-5" /> Tự luyện tập</span>
            <span className="text-xs font-medium text-slate-400">Đặt bi tuỳ ý, đánh lại cú vừa rồi, thử thế bi mẫu. Không giới hạn điểm.</span>
          </button>
          <button type="button" className={`${chip(kind === "bot")} flex flex-col items-start gap-1 p-4 text-left`} onClick={() => setKind("bot")}>
            <span className="flex items-center gap-2 text-base"><Bot className="h-5 w-5" /> Đấu với bot</span>
            <span className="text-xs font-medium text-slate-400">Bot tính cú đánh bằng vật lý thật của game. Bạn cầm bi trắng, bot cầm bi vàng.</span>
          </button>
        </section>
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Luật</p>
          <div className="flex flex-wrap gap-2">
            {(["free", "three"] as CaromMode[]).map((m) => (
              <button key={m} type="button" className={chip(mode === m)} onClick={() => {
                setMode(m);
                setTarget(TARGETS[m][1]);
              }}>{MODE_LABEL[m]}</button>
            ))}
          </div>
        </section>
        {kind === "bot" && (
          <>
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Độ khó bot</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BOT_LEVELS) as BotLevel[]).map((l) => (
                  <button key={l} type="button" className={chip(level === l)} onClick={() => setLevel(l)}>{BOT_LEVELS[l].name}</button>
                ))}
              </div>
            </section>
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Chạm tới (điểm)</p>
              <div className="flex flex-wrap gap-2">
                {TARGETS[mode].map((t) => (
                  <button key={t} type="button" className={chip(target === t)} onClick={() => setTarget(t)}>{t}</button>
                ))}
              </div>
            </section>
          </>
        )}
        <button type="button" className="w-full rounded-2xl bg-[#ffd166] py-3 text-base font-black text-[#1a1206]" onClick={() => onStart({ kind, mode, target, level, me: ME })}>
          Bắt đầu
        </button>
        <p className="text-center text-xs text-slate-500">Chế độ này chạy trên máy bạn, không tính vào xếp hạng.</p>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ bàn chơi

function PracticeTable({ cfg, onExit }: { cfg: LocalSessionOptions; onExit: () => void }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  useEffect(() => {
    const s = createLocalSession(cfg);
    // tạo phiên trong effect để dọn đúng (bot, hẹn giờ) khi rời trang
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(s);
    return () => s.dispose();
  }, [cfg]);
  if (!session) return null;
  return (
    <BilliardGameCore transport={session.transport} myUserId={ME}>
      <PracticeScreen session={session} cfg={cfg} onExit={onExit} />
    </BilliardGameCore>
  );
}

const noop = () => () => {};

function PracticeScreen({ session, cfg, onExit }: { session: LocalSession; cfg: LocalSessionOptions; onExit: () => void }) {
  const { match, lastVerdict, myIndex, animating, displayScores, displayTurn } = useBilliard();
  const status = useCaromStatus();
  const [placing, setPlacing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const thinking = useSyncExternalStore(session.onThinking ?? noop, session.thinking, () => false);
  const engine = session.engine;
  const practice = cfg.kind === "practice";

  useEffect(() => {
    if (!lastVerdict) return;
    const who = practice || lastVerdict.by === myIndex ? "Bạn" : "Bot";
    const v = lastVerdict.verdict;
    if (v.scored) toast.success(`🎯 ${who} +1 điểm — ${v.reason}`, { duration: 2200 });
    else toast(`${who} hụt: ${v.reason}`, { icon: "💨", duration: 2200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVerdict?.seq]);

  if (!match) return null;
  const busy = animating || thinking;
  const sum = (k: "shots" | "points" | "bestRun") => match.stats.reduce((a, s) => a + s[k], 0);
  const shots = sum("shots");
  const points = sum("points");
  const tool = "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] font-bold text-slate-100 backdrop-blur-sm hover:bg-white/10 disabled:opacity-40";
  const level = BOT_LEVELS[cfg.level];

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[#14161f] text-white select-none">
      <RotateDeviceOverlay />
      <header className="flex shrink-0 items-center gap-1.5 px-1.5 py-1">
        <button type="button" onClick={onExit} className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10" title="Đổi chế độ">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Thoát</span>
        </button>
        <button type="button" onClick={() => setShowSettings(true)} className="rounded-lg border border-white/10 bg-black/40 p-1.5 text-slate-200 hover:bg-white/10" title="Cài đặt" aria-label="Cài đặt">
          <Settings className="h-4 w-4" />
        </button>
        <span className="truncate text-xs font-bold text-slate-300">
          {practice ? "Tự luyện" : `Đấu bot · ${level.name}`} · {MODE_LABEL[match.mode]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {practice ? (
            <span className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-bold tabular-nums">
              {points}/{shots} cú trúng{shots ? ` · ${Math.round((points / shots) * 100)}%` : ""} · chuỗi tốt nhất {sum("bestRun")}
            </span>
          ) : (
            ([0, 1] as const).map((i) => (
              <div key={i} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${displayTurn === i && match.winner === null ? "border-emerald-400/70 bg-emerald-500/15" : "border-white/10 bg-black/40 opacity-80"}`}>
                <span className="h-3 w-3 rounded-full border border-black/40" style={{ background: BALL_COLORS[i] }} />
                <span className="font-bold">{i === 0 ? "Bạn" : `Bot ${level.name}`}</span>
                <span className="text-base font-black tabular-nums">{displayScores[i]}</span>
                <span className="text-[10px] text-gray-400">/{match.target}</span>
              </div>
            ))
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <BilliardScene extra={placing ? <BallEditor balls={match.balls} onMove={(id, x, y) => engine.placeBall(id, x, y)} /> : null} />
        </div>
        {!placing && <ShotControls />}

        {/* thanh công cụ tự luyện */}
        {practice && (
          <div className="pointer-events-auto absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            <button type="button" disabled={busy} className={`${tool} ${placing ? "border-[#ffd166] text-[#ffd166]" : ""}`} onClick={() => setPlacing((p) => !p)}>
              <Hand className="h-3.5 w-3.5" /> {placing ? "Xong đặt bi" : "Đặt bi"}
            </button>
            <button type="button" disabled={busy || !engine.canUndo} className={tool} onClick={() => engine.undo()}>
              <Undo2 className="h-3.5 w-3.5" /> Đánh lại
            </button>
            <button type="button" disabled={busy} className={tool} onClick={() => engine.setLayout(initialPositions())}>
              <RotateCcw className="h-3.5 w-3.5" /> Khai cuộc
            </button>
            <button type="button" disabled={busy} className={tool} onClick={() => engine.setLayout(randomLayout(Math.floor(Math.random() * 1e6)))}>
              <Dices className="h-3.5 w-3.5" /> Ngẫu nhiên
            </button>
            <select
              disabled={busy}
              value=""
              className={`${tool} max-w-[150px]`}
              onChange={(e) => {
                const t = SCENARIO_LIBRARY.find((x) => x.id === e.target.value);
                if (t) engine.setLayout(t.positions);
              }}
            >
              <option value="">Thế bi mẫu…</option>
              {SCENARIO_LIBRARY.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <select disabled={busy} value={match.turn} className={tool} title="Bi cái" onChange={(e) => engine.setCueBall(Number(e.target.value) as 0 | 1)}>
              <option value={0}>Bi cái: trắng</option>
              <option value={1}>Bi cái: vàng</option>
            </select>
          </div>
        )}
        {placing && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-[#ffd166]">
            Kéo bi để đặt lại vị trí · bấm «Xong đặt bi» để đánh
          </p>
        )}
        {!practice && thinking && (
          <p className="pointer-events-none absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-sky-200">
            <Bot className="h-4 w-4 animate-pulse" /> Bot đang tính cú đánh…
          </p>
        )}
        {!practice && !thinking && status && match.winner === null && (
          <p className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] text-slate-200">
            {match.turn === 0 ? status : "Lượt của bot"}
          </p>
        )}

        {/* kết thúc trận đấu bot */}
        {!practice && match.winner !== null && !animating && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xs space-y-3 rounded-2xl border border-white/10 bg-[#11132a] p-5 text-center">
              <Trophy className={`mx-auto h-10 w-10 ${match.winner === 0 ? "text-[#ffd166]" : "text-slate-500"}`} />
              <p className="text-lg font-black">{match.winner === 0 ? "Bạn thắng!" : `Bot ${level.name} thắng`}</p>
              <p className="text-sm text-slate-300">
                {match.scores[0]} – {match.scores[1]} · chuỗi tốt nhất của bạn {match.stats[0].bestRun}
              </p>
              <div className="flex gap-2">
                <button type="button" className="flex-1 rounded-xl bg-[#ffd166] py-2 text-sm font-black text-[#1a1206]" onClick={() => engine.restart()}>
                  <Target className="mr-1 inline h-4 w-4" /> Chơi lại
                </button>
                <button type="button" className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold" onClick={onExit}>
                  Đổi chế độ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
