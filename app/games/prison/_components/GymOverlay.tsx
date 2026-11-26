"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { agilitySpeed, GYM, GYM_KINDS, STAT_MAX } from "../_lib/engine/gymStats";
import type { GymKind, PlayerAction } from "../_lib/engine/types";
import { PRISON_CONFIG as C } from "../_lib/engine/config";

const STAMINA_COST = C.stamina.gymStaminaCost;
const LOW = C.stamina.lowThreshold;
import type { ClientView, PrisonSession } from "../_lib/session/types";

const KIND_LABEL: Record<GymKind, { name: string; icon: string; stat: string }> = {
  pressBench: { name: GYM.machines.pressBench.name, icon: "🏋️", stat: GYM.machines.pressBench.statName },
  treadmill: { name: GYM.machines.treadmill.name, icon: "🏃", stat: GYM.machines.treadmill.statName },
};

const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* không hỗ trợ */
  }
}

/** Bấm một nhịp trái (0) / phải (1). Rung nhẹ khi đúng, rung mạnh hơn khi mất đà. */
export async function gymPressAndBuzz(session: PrisonSession, side: 0 | 1) {
  const r = await session.act({ type: "gymPress", side });
  if (r.ok && r.data?.miss) vibrate([60, 30, 60]);
  else if (r.ok) vibrate(r.data?.rep ? 40 : 8);
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px] text-slate-300">
        <span>{label}</span>
        <span>
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </div>
    </div>
  );
}

/** Màn hình tập: máy đang dùng, chỉ số /50, tiến trình lần hiện tại, đà, mệt, hai nút TRÁI/PHẢI lớn, Nghỉ */
export function GymOverlay({ view, session }: { view: ClientView; session: PrisonSession }) {
  const g = view.me?.gym;
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = session.onEvent((e) => {
      if (e.playerId !== view.meId) return;
      if (e.type === "gym:milestone" || e.type === "gym:miss") {
        setFlash(e.type === "gym:miss" ? "Mất đà!" : (e.text ?? "").replace(/^✨\s*/, ""));
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setFlash(null), e.type === "gym:miss" ? 500 : 1600);
      }
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [session, view.meId]);
  if (!view.me) return null;
  if (!g) {
    if (!view.me.gymQueued) return null;
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-36 z-20 flex justify-center sm:bottom-28">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#11132a]/90 px-4 py-2 text-sm">
          ⏳ Đang chờ máy — sẽ tự lên khi máy trống
          <button type="button" className={`${btn} bg-white/10`} onClick={() => void session.act({ type: "gymStop" })}>
            Bỏ chờ
          </button>
        </div>
      </div>
    );
  }
  const label = KIND_LABEL[g.kind];
  const nextSide = g.lastSide === 0 ? 1 : g.lastSide === 1 ? 0 : -1;
  const press = (side: 0 | 1) => void gymPressAndBuzz(session, side);
  const stamina = view.me.stats.energy;
  const act = (a: PlayerAction) => void session.act(a);
  return (
    <div className="pointer-events-auto absolute bottom-24 right-2 z-30 flex w-[min(78vw,260px)] flex-col gap-1.5 sm:bottom-24 sm:right-3" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      {g.request && (
        <div className={`rounded-xl border p-2 text-[11px] ${g.request.aggressive ? "border-red-500/50 bg-red-950/90" : "border-sky-400/40 bg-[#0d1530]/95"}`}>
          <p className="font-bold">
            {g.request.aggressive ? `😠 ${g.request.npcName} đòi máy` : `🙋 ${g.request.npcName} xin dùng máy`} <span className="text-slate-400">({Math.ceil(g.request.remaining)}s)</span>
          </p>
          <div className="mt-1 flex gap-1.5">
            <button type="button" className={`${btn} flex-1 bg-white/10 py-1 text-xs`} onClick={() => act({ type: "gymAnswer", yield: true })}>
              Nhường
            </button>
            <button type="button" className={`${btn} flex-1 bg-[#c81d25]/60 py-1 text-xs`} onClick={() => act({ type: "gymAnswer", yield: false })}>
              Từ chối
            </button>
          </div>
        </div>
      )}
      {/* khung nhỏ ở góc: chỉ số, thanh nhịp lần hiện tại, thể lực — thanh tiến trình chính vẽ ngay trên máy trong scene */}
      <div className="rounded-xl border border-[#f4b942]/30 bg-[#11132a]/90 p-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{label.icon}</span>
          <span className="min-w-0 flex-1 truncate font-bold">
            {label.stat} <b className="text-[#ffd166]">{g.value}/{g.max}</b> · {g.reps} lần
          </span>
          <button type="button" className={`${btn} bg-white/10 px-2 py-0.5 text-[11px]`} onClick={() => act({ type: "gymStop" })}>
            Nghỉ
          </button>
        </div>
        <div className="mt-1 space-y-1">
          <Bar label={`${g.beats}/${g.need} nhịp`} value={g.beats} max={g.need} color="#4ade80" />
          <Bar label={`Thể lực −${STAMINA_COST}/lần`} value={stamina} max={view.me.stats.maxEnergy} color={stamina < LOW ? "#ef4444" : "#38bdf8"} />
        </div>
        {flash && <p className={`mt-0.5 text-center text-xs font-extrabold ${flash === "Mất đà!" ? "text-red-400" : "text-[#ffd166]"}`}>{flash}</p>}
      </div>
      <div className="flex gap-1.5">
        {([0, 1] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-label={side === 0 ? "Trái" : "Phải"}
            onPointerDown={(e) => {
              e.preventDefault();
              press(side);
            }}
            className={`flex h-14 flex-1 touch-none select-none items-center justify-center rounded-xl border-2 text-sm font-extrabold active:scale-95 ${nextSide === side ? "border-[#ffd166] bg-[#f4b942]/25 text-[#ffd166]" : "border-white/15 bg-white/[0.06] text-white"}`}
          >
            {side === 0 ? "◀ TRÁI" : "PHẢI ▶"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bảng chọn máy: N máy đẩy tạ + N máy chạy bộ (N = số tù nhân) */
export function GymPanelBody({ view, act }: { view: ClientView; act: (a: PlayerAction) => unknown }) {
  const gym = view.meta.gym;
  const me = view.me;
  return (
    <>
      <div className="rounded-2xl bg-white/[0.04] p-3 text-xs">
        <p className={`font-bold ${gym.open ? "text-emerald-300" : "text-slate-400"}`}>
          {gym.open ? "🟢 Mở cả ngày (24/24)" : "🔴 Đóng cửa"}
        </p>
        <p className="mt-0.5 text-slate-400">
          Mỗi loại {gym.perKind} máy — bằng số tù nhân trong trại. Mỗi máy một người; máy có người thì bấm để xếp hàng chờ (1 người).
        </p>
        {me && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <p>
              💪 Sức mạnh <b className="text-[#ffd166]">{me.stats.strength}/{STAT_MAX.strength}</b>
              <span className="block text-[10px] text-slate-400">
                HP tối đa {me.stats.maxHealth} · tấn công ×{(1 + me.stats.strength * GYM.strength.attackPerPoint).toFixed(2)}
              </span>
            </p>
            <p>
              🏃 Nhanh nhẹn <b className="text-[#ffd166]">{me.stats.agility}/{STAT_MAX.agility}</b>
              <span className="block text-[10px] text-slate-400">tốc độ ×{agilitySpeed(me.stats.agility).toFixed(2)}</span>
            </p>
          </div>
        )}
      </div>
      {GYM_KINDS.map((kind) => (
        <div key={kind}>
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400">
            <Dumbbell className="h-3.5 w-3.5" /> {KIND_LABEL[kind].icon} {KIND_LABEL[kind].name} → {KIND_LABEL[kind].stat}
          </h3>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {gym.machines
              .filter((m) => m.kind === kind)
              .map((m) => {
                const mine = m.occupantId === view.meId;
                const queuedMe = me?.gymQueued === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!gym.open || mine || (!!m.occupant && !!m.queued && !queuedMe)}
                    onClick={() => act({ type: "gymStart", machineId: m.id })}
                    title={m.occupant ? `${m.occupant} đang dùng${m.queued ? ` · ${m.queued} đang chờ` : ""}` : "Trống"}
                    className={`rounded-xl border px-1 py-1.5 text-center text-[10px] leading-tight disabled:opacity-50 ${mine ? "border-[#f4b942] bg-[#f4b942]/20" : m.occupant ? "border-white/10 bg-black/30" : "border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20"}`}
                  >
                    <span className="block text-base">{KIND_LABEL[kind].icon}</span>
                    <span className="block font-bold">#{m.index + 1}</span>
                    <span className="block truncate text-slate-400">{mine ? "Bạn" : (m.occupant ?? "Trống")}</span>
                    {m.queued && <span className="block truncate text-amber-300">⏳ {queuedMe ? "Bạn" : m.queued}</span>}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </>
  );
}
