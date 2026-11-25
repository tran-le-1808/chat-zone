"use client";

import { ROLE_INFO } from "../_lib/engine/config";
import type { Difficulty, Role } from "../_lib/engine/types";

export const ROLES: Role[] = ["HACKER", "FIGHTER", "MECHANIC", "SCOUT"];
export const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: "NORMAL", label: "Thường", hint: "4 lính gác" },
  { value: "HARD", label: "Khó", hint: "5 lính, nhìn xa hơn" },
  { value: "HARDCORE", label: "Địa ngục", hint: "6 lính, biệt giam 5 phút" },
];

export function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r)}
          className={`rounded-2xl border p-2.5 text-left transition disabled:opacity-50 ${value === r ? "border-[#f4b942]/70 bg-[#f4b942]/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
        >
          <p className="text-sm font-bold" style={{ color: ROLE_INFO[r].color }}>
            {ROLE_INFO[r].name}
          </p>
          <p className="text-[11px] leading-snug text-slate-400">{ROLE_INFO[r].perk}</p>
        </button>
      ))}
    </div>
  );
}

export function DifficultyPicker({ value, onChange, disabled }: { value: Difficulty; onChange: (d: Difficulty) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DIFFICULTIES.map((d) => (
        <button
          key={d.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(d.value)}
          className={`rounded-2xl border p-2 text-center transition disabled:opacity-50 ${value === d.value ? "border-[#f4b942]/70 bg-[#f4b942]/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
        >
          <p className="text-sm font-bold">{d.label}</p>
          <p className="text-[10px] text-slate-400">{d.hint}</p>
        </button>
      ))}
    </div>
  );
}
