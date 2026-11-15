"use client";

import { AlertTriangle, Bot, CheckCircle2, Info, Trophy, XCircle } from "lucide-react";
import { SOLIDS, STRIPES } from "../_lib/rules/rack";
import { GROUP_LABEL, lowestBall } from "../_lib/rules/common";
import type { PlayerIndex } from "../_lib/rules/types";
import { MiniBall } from "./PoolControls";
import { usePool } from "./PoolContext";
import { useIsCompact } from "../../monopoly/_components/ui/useScreen";

function PlayerCard({ i }: { i: PlayerIndex }) {
  const { setup, rack, match, practice } = usePool();
  const compact = useIsCompact();
  const pl = setup.config.players[i];
  const active = rack.turn === i && rack.winner === null;
  const group = rack.groups[i];
  const on = new Set(rack.balls.map((b) => b.n));
  const fouls = rack.fouls[i];
  const low = lowestBall(rack.balls);

  // Mobile: gọn một dòng — tên · nhóm bi (chữ) · lỗi liên tiếp · điểm. Không có danh sách bi.
  if (compact) {
    return (
      <div
        className={`flex min-w-0 flex-1 items-center gap-1 rounded-lg border px-1.5 py-px transition ${active ? "border-[#f4b942]/70 bg-[#f4b942]/12" : "border-white/10 bg-black/30"} ${i === 1 ? "flex-row-reverse text-right" : ""}`}
      >
        {pl.ai && <Bot className="h-3 w-3 shrink-0 text-sky-300" />}
        <span className="min-w-0 truncate text-[11px] font-bold leading-tight">{pl.name}</span>
        {active && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#ffd166]" />}
        {!practice && rack.type === "eight" && group && (
          <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] font-bold text-slate-300">{group === "solids" ? "Trơn" : "Sọc"}</span>
        )}
        {!practice && rack.type === "nine" && fouls > 0 && (
          <span className="flex shrink-0 items-center gap-0.5" title="Lỗi liên tiếp">
            {[0, 1, 2].map((k) => (
              <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < fouls ? (fouls >= 2 ? "bg-rose-500" : "bg-amber-400") : "bg-white/15"}`} />
            ))}
          </span>
        )}
        {!practice && <span className={`shrink-0 text-sm font-black tabular-nums leading-tight text-[#ffd166] ${i === 1 ? "mr-auto" : "ml-auto"}`}>{match.score[i]}</span>}
        {group && <span className="sr-only">{GROUP_LABEL[group]}</span>}
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 py-0.5 transition [@media(max-height:500px)]:py-0.5 ${active ? "border-[#f4b942]/70 bg-[#f4b942]/12 shadow-[0_0_18px_rgba(244,185,66,0.18)]" : "border-white/10 bg-black/30"} ${i === 1 ? "flex-row-reverse text-right" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1 text-xs font-bold sm:text-sm ${i === 1 ? "justify-end" : ""}`}>
          {pl.ai && <Bot className="h-3.5 w-3.5 shrink-0 text-sky-300" />}
          <span className="truncate">{pl.name}</span>
          {active && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#ffd166]" />}
        </div>
        <div className={`mt-0.5 flex min-h-[18px] flex-wrap items-center gap-0.5 ${i === 1 ? "justify-end" : ""}`}>
          {!practice && rack.type === "eight" &&
            (group ? (
              (group === "solids" ? SOLIDS : STRIPES).map((n) => (
                <span key={n} className={on.has(n) ? "" : "opacity-20"}>
                  <MiniBall n={n} size={14} />
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-400">{rack.isBreak ? "Chờ phá bi" : "Bàn mở"}</span>
            ))}
          {!practice && rack.type === "nine" && (
            <>
              {active && low !== null && (
                <span className="flex items-center gap-1 text-[10px] text-slate-300">
                  Chạm trước <MiniBall n={low} size={14} />
                </span>
              )}
              <span className={`flex items-center gap-0.5 ${i === 1 ? "order-first" : ""}`} title="Lỗi liên tiếp">
                {[0, 1, 2].map((k) => (
                  <span key={k} className={`h-2 w-2 rounded-full ${k < fouls ? (fouls >= 2 ? "bg-rose-500" : "bg-amber-400") : "bg-white/15"}`} />
                ))}
              </span>
            </>
          )}
        </div>
        {group && <span className="sr-only">{GROUP_LABEL[group]}</span>}
      </div>
      {!practice && (
        <div className="shrink-0 rounded-lg bg-black/40 px-1.5 text-center">
          <div className="text-base font-black tabular-nums leading-tight text-[#ffd166]">{match.score[i]}</div>
        </div>
      )}
    </div>
  );
}

export function Scoreboard() {
  const { practice, match, setup, rack } = usePool();
  const compact = useIsCompact();
  if (practice)
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-black/30 px-2 py-0.5 text-xs font-bold sm:rounded-2xl sm:px-3 sm:py-1.5 sm:text-sm">
        Tập luyện · {rack.type === "eight" ? "8 bi" : "9 bi"}
      </div>
    );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <PlayerCard i={0} />
      {compact ? (
        <div className="shrink-0 text-center text-[9px] font-bold leading-none text-slate-400">
          {setup.config.type === "eight" ? "8 bi" : "9 bi"}
          <span className="block text-slate-500">
            {match.rackNo}/{setup.config.raceTo}
          </span>
        </div>
      ) : (
        <div className="shrink-0 text-center leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{setup.config.type === "eight" ? "8 bi" : "9 bi"}</div>
          <div className="text-[11px] text-slate-300">Chạm {setup.config.raceTo}</div>
          <div className="text-[10px] text-slate-500">Ván {match.rackNo}</div>
        </div>
      )}
      <PlayerCard i={1} />
    </div>
  );
}

const TONE = {
  info: { cls: "border-white/15 bg-[#11132a]/90 text-slate-100", Icon: Info },
  good: { cls: "border-emerald-400/40 bg-emerald-950/85 text-emerald-100", Icon: CheckCircle2 },
  foul: { cls: "border-rose-400/50 bg-rose-950/90 text-rose-100", Icon: XCircle },
  warn: { cls: "border-amber-400/50 bg-amber-950/90 text-amber-100", Icon: AlertTriangle },
  win: { cls: "border-[#f4b942]/60 bg-[#3a2706]/90 text-[#ffd166]", Icon: Trophy },
} as const;

/** Thông báo của trọng tài nổi trên bàn (không chặn thao tác) */
export function Banners() {
  const { banners } = usePool();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex flex-col items-center gap-1.5 px-3">
      {banners.map((b) => {
        const t = TONE[b.tone];
        return (
          <div key={b.id} className={`flex max-w-md items-start gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md sm:text-sm ${t.cls}`}>
            <t.Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{b.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Bi đã vào lỗ (khay dưới bàn) */
export function PocketTray() {
  const { rack, practice } = usePool();
  const compact = useIsCompact();
  const all = rack.type === "eight" ? Array.from({ length: 15 }, (_, i) => i + 1) : Array.from({ length: 9 }, (_, i) => i + 1);
  const on = new Set(rack.balls.map((b) => b.n));
  const gone = all.filter((n) => !on.has(n));
  // Mobile: bỏ khay bi đã vào lỗ cho gọn (đỡ che bàn)
  if (!gone.length || practice || compact) return null;
  return (
    <div className="pointer-events-none absolute left-24 top-2 z-10 flex items-center gap-0.5 rounded-full border border-white/10 bg-black/50 px-2 py-1 backdrop-blur">
      {gone.map((n) => (
        <MiniBall key={n} n={n} size={16} />
      ))}
    </div>
  );
}
