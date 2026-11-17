"use client";

import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { useLobby } from "../../_context/BilliardLobbyContext";
import { bidaEmit } from "../../_lib/lobbyApi";
import { DISCIPLINES, GAME_MODE_LABEL, TABLE_MODE_NAME, type GameMode, type MatchRecord, type Page } from "../../_lib/lobbyTypes";
import { LadderCard } from "./LobbyHome";
import { Empty, ErrorBox, fmtDate, fmtDuration, Loading, Pagination, RankBadge, Section } from "./ui";

const FILTERS: [GameMode | "", string][] = [
  ["", "Tất cả"],
  ["RANKED", "Xếp hạng"],
  ["CASUAL", "Đấu thường"],
  ["QUICK", "Trận nhanh"],
  ["TOURNAMENT", "Giải đấu"],
];

function MatchHistory() {
  const { user } = useAppSelector((s) => s.auth);
  const { ruleName } = useLobby();
  const [mode, setMode] = useState<GameMode | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<MatchRecord> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await bidaEmit<Page<MatchRecord>>("bida:match:history", { page, ...(mode ? { gameMode: mode } : {}) });
    if (res.ok && res.data) {
      setData(res.data);
      setError(null);
    } else setError(res.error ?? "Không tải được lịch sử");
  }, [page, mode]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const me = user?._id ?? "";
  return (
    <Section title="Lịch sử trận đấu" icon={<History className="h-5 w-5 text-[#ffd166]" />}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map(([k, l]) => (
          <button key={l} type="button" onClick={() => { setMode(k); setPage(1); }} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${mode === k ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5 text-slate-300"}`}>
            {l}
          </button>
        ))}
      </div>
      {data === null && !error ? <Loading /> : error ? <ErrorBox text={error} onRetry={() => void load()} /> : !data?.items.length ? <Empty text="Chưa có trận nào" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-2 py-2">Kết quả</th>
                <th className="px-2 py-2">Đối thủ</th>
                <th className="px-2 py-2">Chế độ</th>
                <th className="px-2 py-2">Tỉ số</th>
                <th className="px-2 py-2">Rating</th>
                <th className="px-2 py-2">Thời lượng</th>
                <th className="px-2 py-2">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => {
                const i = m.players[0] === me ? 0 : 1;
                const won = m.winnerId === me;
                const delta = m.ratingChanges?.[i];
                return (
                  <tr key={m.matchId} className="border-t border-white/5">
                    <td className={`px-2 py-2 font-black ${won ? "text-emerald-300" : "text-red-300"}`}>{won ? "Thắng" : "Thua"}</td>
                    <td className="px-2 py-2 font-bold">{m.names[1 - i]}</td>
                    <td className="px-2 py-2 text-xs">
                      {GAME_MODE_LABEL[m.gameMode]}
                      <span className="block text-slate-500">{ruleName(m.ruleSet)}</span>
                    </td>
                    <td className="px-2 py-2 font-black">
                      {m.score[i]} – {m.score[1 - i]}
                    </td>
                    <td className={`px-2 py-2 font-bold ${delta === undefined || delta === null ? "text-slate-500" : delta >= 0 ? "text-emerald-300" : "text-red-300"}`} title={m.unratedReason ?? undefined}>
                      {delta === undefined || delta === null ? (m.gameMode === "RANKED" ? "Không tính" : "—") : `${delta > 0 ? "+" : ""}${delta}`}
                    </td>
                    <td className="px-2 py-2">{fmtDuration(m.durationMs)}</td>
                    <td className="px-2 py-2 text-xs text-slate-400">{m.completedAt ? fmtDate(m.completedAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </Section>
  );
}

/** Hồ sơ thi đấu: hai thang hạng (Libre / 3 băng), thống kê từng chế độ (casual không tính vào xếp hạng), mùa, lịch sử */
export default function Profile() {
  const { profile, refreshProfile, rankOf } = useLobby();
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);
  if (!profile) return <Loading />;
  const stat = (label: string, wl: { wins: number; losses: number }, extra?: string) => (
    <div className="rounded-2xl bg-white/[0.04] p-3">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="text-lg font-black">
        {wl.wins}T – {wl.losses}B
      </p>
      {extra && <p className="text-xs text-slate-400">{extra}</p>}
    </div>
  );
  const history = DISCIPLINES.flatMap((d) => profile.ladders[d].seasonHistory.map((h) => ({ ...h, discipline: d })));
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#f4b942]/25 bg-linear-to-br from-[#123b2a] to-[#111827] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <PlayerAvatar name={profile.name} avatar={profile.avatar} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black">{profile.name}</h1>
            <p className="text-sm text-slate-300">
              Cấp {profile.level} ({profile.xp}/{profile.nextLevelXp} XP) · {profile.season.name} · kết thúc {fmtDate(profile.season.endAt)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {DISCIPLINES.map((d) => {
            const l = profile.ladders[d];
            const best = rankOf(l.bestRankId);
            return (
              <div key={d}>
                <LadderCard ladder={l} />
                <p className="mt-1 px-1 text-xs text-slate-400">
                  Cao nhất: <b style={{ color: best?.color }}>{best?.name ?? l.bestRankId}</b> · {l.peakRating} · Mùa này {l.season.wins}T–{l.season.losses}B
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {stat("Tổng", { wins: profile.totalWins, losses: profile.totalLosses }, `${profile.totalMatches} trận · ${profile.winRate}%`)}
        {stat("Xếp hạng Libre", profile.ladders.free.ranked, `${profile.ladders.free.ranked.winRate}% thắng`)}
        {stat("Xếp hạng 3 băng", profile.ladders.three.ranked, `${profile.ladders.three.ranked.winRate}% thắng`)}
        {stat("Đấu thường", profile.casual, `Trận nhanh: ${profile.quick.wins}T – ${profile.quick.losses}B`)}
        {stat("Giải đấu", profile.tournament, `${profile.tournament.played} giải · ${profile.tournament.titles} 🏆`)}
      </div>
      {history.length > 0 && (
        <Section title="Các mùa trước">
          <ul className="space-y-1.5 text-sm">
            {history.map((s) => (
              <li key={`${s.discipline}-${s.seasonId}`} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="font-bold">{s.name}</span>
                <span className="rounded-md bg-white/10 px-1.5 text-[10px] font-bold">{TABLE_MODE_NAME[s.discipline]}</span>
                <RankBadge rankId={s.rankId} size="sm" />
                <span className="ml-auto">
                  {s.rating} · {s.wins}T–{s.losses}B {s.position ? `· #${s.position}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <MatchHistory />
    </div>
  );
}
