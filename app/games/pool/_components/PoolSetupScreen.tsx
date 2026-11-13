"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Dumbbell,
  Globe2,
  Play,
  Target,
  Users,
} from "lucide-react";
import PoolOnlineLobby from "./online/PoolOnlineLobby";
import { ui } from "@/components/ui/styles";
import DongSonDrum from "@/components/ui/DongSonDrum";
import type { AiLevel, GameType } from "../_lib/rules/types";
import { POCKET_PRESETS, type PocketPreset } from "../_lib/physics/config";
import type { GameMode, PoolSetup } from "./PoolContext";

function Chips<T extends string | number>({
  value,
  onChange,
  options,
  cols = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; hint?: string }[];
  cols?: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-xl border px-2 py-2 text-sm font-bold transition ${value === o.v ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"}`}
        >
          {o.label}
          {o.hint && (
            <span className="block text-[10px] font-normal text-slate-400">
              {o.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <fieldset className="space-y-2">
    <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
      {title}
    </legend>
    {children}
  </fieldset>
);

export default function PoolSetupScreen({
  myName,
  myUserId,
  onStart,
}: {
  myName: string;
  myUserId: string | null;
  onStart: (s: PoolSetup) => void;
}) {
  const [type, setType] = useState<GameType>("eight");
  const [mode, setMode] = useState<GameMode | "ai" | "online">("ai");
  const [level, setLevel] = useState<AiLevel>("medium");
  const [raceTo, setRaceTo] = useState(3);
  const [breakRule, setBreakRule] = useState<"alternate" | "winner">(
    "alternate",
  );
  const [autoCall, setAutoCall] = useState(true);
  const [pocketPreset, setPocketPreset] = useState<PocketPreset>("wpa");
  // Tên tài khoản có thể tải xong sau lần render đầu -> để trống, dùng làm gợi ý
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("Người chơi 2");

  const start = () => {
    const LEVEL_NAME: Record<AiLevel, string> = {
      easy: "Máy (Dễ)",
      medium: "Máy (Vừa)",
      hard: "Máy (Khó)",
    };
    onStart({
      mode: mode === "practice" ? "practice" : "match",
      config: {
        type,
        raceTo: mode === "practice" ? 1 : raceTo,
        breakRule,
        autoCall,
        pocketPreset,
        allowFullGuide: true,
        seed: (Date.now() >>> 0) % 1e9,
        players: [
          {
            name: (p1.trim() || myName || "Người chơi 1").slice(0, 20),
            ai: null,
          },
          mode === "ai"
            ? { name: LEVEL_NAME[level], ai: level }
            : { name: (p2 || "Người chơi 2").slice(0, 20), ai: null },
        ],
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-5 text-white sm:px-6 sm:py-8">
      <div>
        <Link
          href="/games"
          className={`${ui.btnGhost} -ml-2 mb-2 px-3! py-1.5! text-sm`}
        >
          <ArrowLeft className="h-4 w-4" /> Khu trò chơi
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_4px_0_#7f1118]">
            <Target className="h-6 w-6" />
          </span>
          <span className={ui.goldText}>Bida Lỗ (Pool)</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Bàn 9 feet, vật lý thật (xoáy, throw, squirt, rung mép lỗ) và trọng
          tài tự động theo luật WPA.
        </p>
      </div>

      <div className={`relative overflow-hidden p-4 sm:p-6 ${ui.card}`}>
        <DongSonDrum className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 text-[#ffd166]/[0.05]" />
        <div className="relative space-y-5">
          {mode !== "online" && (
            <Section title="Thể loại">
              <Chips
                value={type}
                onChange={setType}
                cols={2}
                options={[
                  {
                    v: "eight",
                    label: "8 bi",
                    hint: "Chia nhóm trơn / sọc, gọi bi",
                  },
                  {
                    v: "nine",
                    label: "9 bi",
                    hint: "Chạm bi nhỏ nhất, bi 9 thắng",
                  },
                ]}
              />
            </Section>
          )}

          <Section title="Chế độ">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["online", "Online", Globe2],
                  ["ai", "Đấu với máy", Bot],
                  ["match", "2 người", Users],
                  ["practice", "Tập luyện", Dumbbell],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMode(v)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-bold transition ${mode === v ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"}`}
                >
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>
          </Section>

          {mode !== "online" && (
            <Section title="Độ khó lỗ">
              <Chips
                value={pocketPreset}
                onChange={setPocketPreset}
                options={(Object.keys(POCKET_PRESETS) as PocketPreset[]).map(
                  (k) => ({
                    v: k,
                    label: POCKET_PRESETS[k].label,
                    hint: `Góc ${(POCKET_PRESETS[k].corner * 100).toFixed(2)} · giữa ${(POCKET_PRESETS[k].side * 100).toFixed(2)} cm`,
                  }),
                )}
              />
              <p className="text-xs text-slate-500">
                {POCKET_PRESETS[pocketPreset].note}
              </p>
            </Section>
          )}

          {mode === "online" ? (
            <PoolOnlineLobby myUserId={myUserId} />
          ) : (
            <>
              {mode === "ai" && (
                <Section title="Độ khó của máy">
                  <Chips
                    value={level}
                    onChange={setLevel}
                    options={[
                      { v: "easy", label: "Dễ" },
                      { v: "medium", label: "Vừa" },
                      { v: "hard", label: "Khó" },
                    ]}
                  />
                </Section>
              )}

              <Section
                title={mode === "match" ? "Tên người chơi" : "Tên của bạn"}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className={ui.field}>
                    <input
                      value={p1}
                      onChange={(e) => setP1(e.target.value)}
                      placeholder={myName || "Người chơi 1"}
                      maxLength={20}
                      aria-label="Tên người chơi 1"
                      className="w-full min-w-0 bg-transparent text-white outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {mode === "match" && (
                    <div className={ui.field}>
                      <input
                        value={p2}
                        onChange={(e) => setP2(e.target.value)}
                        maxLength={20}
                        aria-label="Tên người chơi 2"
                        className="w-full min-w-0 bg-transparent text-white outline-none"
                      />
                    </div>
                  )}
                </div>
              </Section>

              {mode !== "practice" && (
                <>
                  <Section title="Thắng chung cuộc">
                    <Chips
                      value={raceTo}
                      onChange={setRaceTo}
                      cols={4}
                      options={[1, 3, 5, 7].map((n) => ({
                        v: n,
                        label: `Chạm ${n}`,
                      }))}
                    />
                  </Section>
                  <Section title="Luật phá">
                    <Chips
                      value={breakRule}
                      onChange={setBreakRule}
                      cols={2}
                      options={[
                        { v: "alternate", label: "Luân phiên" },
                        { v: "winner", label: "Thắng ván phá" },
                      ]}
                    />
                  </Section>
                  {type === "eight" && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
                      <span>
                        <b>Tự gọi cú hiển nhiên</b>
                        <span className="block text-xs text-slate-400">
                          Gọi bi & lỗ theo đường ngắm, vẫn đổi tay được
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={autoCall}
                        onChange={(e) => setAutoCall(e.target.checked)}
                        className="h-5 w-5 accent-[#f4b942]"
                      />
                    </label>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={start}
                className={`${ui.btnPrimary} w-full`}
              >
                <Play className="h-4 w-4 fill-current" /> Vào bàn
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
