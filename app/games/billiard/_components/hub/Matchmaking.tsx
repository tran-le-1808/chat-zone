"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, Swords, X } from "lucide-react";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { useLobby } from "../../_context/BilliardLobbyContext";
import { RankBadge } from "./ui";
import { disciplineOfRule } from "../../_lib/lobbyTypes";

function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** Thanh "Đang tìm trận" nổi + màn "Đã tìm thấy đối thủ" (chấp nhận / từ chối có đếm ngược) */
export default function MatchmakingOverlay() {
  const { mm, cancelSearch, accept, decline, busy, ruleName, profile } = useLobby();
  const now = useNow(mm.state !== "idle");

  if (mm.state === "searching") {
    const wait = Math.max(0, Math.floor((now - mm.joinedAt) / 1000));
    return (
      <div className="fixed inset-x-3 bottom-3 z-[85] mx-auto max-w-md rounded-2xl border border-emerald-400/30 bg-[#0f2a22]/95 p-3 text-white shadow-2xl backdrop-blur sm:bottom-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/30">
              <Search className="h-6 w-6" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">
              {mm.mode === "RANKED" ? "Đấu xếp hạng" : "Tìm trận nhanh"} · Searching…
            </p>
            <p className="text-xs text-emerald-200/80">
              {ruleName(mm.ruleSet)} · Rating {mm.rating} · Tìm đối thủ ±{mm.range}
            </p>
            <p className="text-xs text-slate-300">
              Đã chờ {Math.floor(wait / 60)}:{String(wait % 60).padStart(2, "0")}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => void cancelSearch()} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-50">
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  if (mm.state === "found") {
    const remain = Math.max(0, Math.ceil((mm.deadline - now) / 1000));
    const total = 15;
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#f4b942]/40 bg-[#11132a] text-white shadow-2xl">
          <div className="bg-linear-to-r from-emerald-600/40 to-[#f4b942]/30 px-6 py-4 text-center">
            <Swords className="mx-auto h-8 w-8 text-[#ffd166]" />
            <h2 className="mt-1 text-2xl font-black">Đã tìm thấy đối thủ!</h2>
            <p className="text-xs text-slate-200">{mm.mode === "RANKED" ? "Trận xếp hạng" : "Trận nhanh"} · {ruleName(mm.ruleSet)}</p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-5">
            <div className="flex flex-col items-center gap-1 text-center">
              <PlayerAvatar name={profile?.name ?? "Bạn"} avatar={profile?.avatar} size={56} />
              <p className="truncate text-sm font-bold">{profile?.name ?? "Bạn"}</p>
              {profile && <RankBadge rankId={profile.ladders[disciplineOfRule(mm.ruleSet)].rankId} size="sm" />}
              <p className="text-xs text-slate-400">{profile?.ladders[disciplineOfRule(mm.ruleSet)].rating}</p>
            </div>
            <span className="text-xl font-black text-[#ffd166]">VS</span>
            <div className="flex flex-col items-center gap-1 text-center">
              <PlayerAvatar name={mm.opponent.name} avatar={mm.opponent.avatar} size={56} />
              <p className="truncate text-sm font-bold">{mm.opponent.name}</p>
              <RankBadge rankId={mm.opponent.rankId} size="sm" />
              <p className="text-xs text-slate-400">{mm.opponent.rating}</p>
            </div>
          </div>
          <div className="px-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#ffd166] transition-[width] duration-200" style={{ width: `${Math.min(100, (remain / total) * 100)}%` }} />
            </div>
            <p className="mt-1 text-center text-xs text-slate-400">Xác nhận trong {remain}s — từ chối / không xác nhận sẽ bị khoá tìm trận một lúc</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <button type="button" onClick={() => void decline()} disabled={mm.accepted} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-bold hover:bg-white/15 disabled:opacity-40">
              <X className="h-5 w-5" /> Từ chối
            </button>
            <button type="button" onClick={() => void accept()} disabled={mm.accepted} className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 py-3 font-bold shadow-[0_4px_0_#065f46] disabled:opacity-70">
              {mm.accepted ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {mm.accepted ? "Chờ đối thủ…" : "Chấp nhận"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
