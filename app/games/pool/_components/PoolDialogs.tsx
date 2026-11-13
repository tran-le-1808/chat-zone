"use client";

import { useEffect, useState } from "react";
import { Bot, RotateCcw, Trophy, X } from "lucide-react";
import { ui } from "@/components/ui/styles";
import { POOL_TABLE as T } from "../_lib/physics/table";
import { decisionOptions } from "../_lib/rules/engine";
import { MiniBall } from "./PoolControls";
import { usePool } from "./PoolContext";

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 [@media(max-height:500px)]:items-center [@media(max-height:500px)]:p-2">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#f4b942]/20 bg-[#11132a] p-4 text-white shadow-2xl sm:rounded-3xl [@media(max-height:500px)]:rounded-3xl [@media(max-height:500px)]:p-3">
        {children}
      </div>
    </div>
  );
}

/** Lựa chọn theo luật: phá không hợp lệ, bi 8 vào khi phá, phản hồi push out */
export function DecisionDialog() {
  const { rack, setup, decide, phase, online } = usePool();
  const d = rack.decision;
  if (!d || (phase !== "idle" && phase !== "thinking")) return null;
  const who = setup.config.players[d.by];
  const title = {
    illegalBreak: "Phá bi không hợp lệ",
    eightOnBreak: "Bi 8 vào lỗ khi phá",
    eightOnBreakScratch: "Bi 8 vào lỗ kèm bi cái rơi khi phá",
    pushOutResponse: "Đối thủ vừa push out",
  }[d.kind];
  if (who.ai || (online && online.mySeat !== d.by))
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm">
          <Bot className="h-4 w-4 text-sky-300" /> {who.name} đang chọn: {title.toLowerCase()}…
        </div>
      </div>
    );
  return (
    <Modal>
      <h2 className="text-lg font-extrabold text-[#ffd166]">{title}</h2>
      <p className="mt-1 text-sm text-slate-300">{who.name}, hãy chọn theo luật WPA:</p>
      <div className="mt-3 flex flex-col gap-2">
        {decisionOptions(rack).map((o) => (
          <button key={o.choice} type="button" onClick={() => decide(o.choice)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-left transition hover:border-[#f4b942]/50 hover:bg-[#f4b942]/10">
            <div className="font-bold">{o.label}</div>
            <div className="text-xs text-slate-400">{o.hint}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Chọn bi + lỗ để gọi (8 bi) */
export function CallPicker({ onClose }: { onClose: () => void }) {
  const { targets, effectiveCall, setDecl } = usePool();
  const [ball, setBall] = useState<number | null>(effectiveCall?.ball ?? targets[0] ?? null);
  const [pocket, setPocket] = useState<number | null>(effectiveCall?.pocket ?? null);
  const top = T.pockets.filter((p) => p.axisY > 0);
  const bottom = T.pockets.filter((p) => p.axisY < 0);
  const PocketBtn = ({ id }: { id: number }) => (
    <button
      type="button"
      onClick={() => setPocket(id)}
      aria-label={T.pockets[id].name}
      className={`h-9 w-9 rounded-full border-2 text-sm font-black transition ${pocket === id ? "border-[#ffd166] bg-[#f4b942] text-[#1a1206]" : "border-white/30 bg-black/70 text-white hover:border-[#ffd166]"}`}
    >
      {T.pockets[id].short}
    </button>
  );
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[#ffd166]">Gọi bi</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">Chọn bi định đưa vào và lỗ. Bi gọi vào đúng lỗ thì được đánh tiếp.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {targets.map((n) => (
          <button key={n} type="button" onClick={() => setBall(n)} className={`rounded-full p-1 transition ${ball === n ? "bg-[#f4b942] ring-2 ring-[#ffd166]" : "bg-white/5 hover:bg-white/15"}`}>
            <MiniBall n={n} size={30} />
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border-[6px] border-[#5b2e14] bg-[#0f6b52] p-2">
        <div className="flex justify-between">{top.map((p) => <PocketBtn key={p.id} id={p.id} />)}</div>
        <div className="h-16" />
        <div className="flex justify-between">{bottom.map((p) => <PocketBtn key={p.id} id={p.id} />)}</div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setDecl({ manual: false, call: null });
            onClose();
          }}
          className={`${ui.btnGhost} flex-1 px-3! py-2! text-sm`}
        >
          Tự động
        </button>
        <button
          type="button"
          disabled={ball === null || pocket === null}
          onClick={() => {
            setDecl({ manual: true, call: { ball: ball!, pocket: pocket! }, safety: false });
            onClose();
          }}
          className={`${ui.btnPrimary} flex-1 px-3! py-2! text-sm`}
        >
          Gọi {ball !== null && pocket !== null ? `bi ${ball} → ${T.pockets[pocket].short}` : ""}
        </button>
      </div>
    </Modal>
  );
}

/** Kết thúc ván / trận */
export function RackOverDialog({ onExit }: { onExit: () => void }) {
  const { rackOver, match, setup, continueAfterRack, rematch, online } = usePool();
  if (!rackOver) return null;
  const winner = setup.config.players[rackOver.winner];
  const matchDone = match.matchWinner !== null;
  return (
    <Modal>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_4px_0_#7f1118]">
          <Trophy className="h-7 w-7" />
        </span>
        <h2 className="mt-3 text-xl font-extrabold text-[#ffd166]">
          {matchDone ? `${winner.name} thắng trận!` : `${winner.name} thắng ván ${match.rackNo}`}
        </h2>
        <p className="mt-1 text-sm text-slate-300">{rackOver.reason}</p>
        {matchDone && online?.eloChange && online.ranked && online.mySeat >= 0 && (
          <p className={`mt-1 text-sm font-bold ${online.eloChange[online.mySeat] >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            ELO {online.eloChange[online.mySeat] >= 0 ? "+" : ""}
            {online.eloChange[online.mySeat]}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-2xl font-black tabular-nums">
          <span>{setup.config.players[0].name}</span>
          <span className="text-[#ffd166]">
            {match.score[0]} – {match.score[1]}
          </span>
          <span>{setup.config.players[1].name}</span>
        </div>
        <div className="mt-4 flex w-full gap-2">
          <button type="button" onClick={onExit} className={`${ui.btnGhost} flex-1 px-3! py-2! text-sm`}>
            Thoát
          </button>
          {matchDone ? (
            online && !online.isHost ? (
              <span className="flex flex-1 items-center justify-center text-xs text-slate-400">Chờ chủ phòng mở ván mới…</span>
            ) : (
              <button type="button" onClick={rematch} className={`${ui.btnPrimary} flex-1 px-3! py-2! text-sm`}>
                <RotateCcw className="h-4 w-4" /> Đấu lại
              </button>
            )
          ) : (
            <button type="button" onClick={continueAfterRack} className={`${ui.btnPrimary} flex-1 px-3! py-2! text-sm`}>
              Ván tiếp theo
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
