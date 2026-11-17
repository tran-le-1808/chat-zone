"use client";

import { useCallback, useEffect, useState } from "react";
import { Medal, Search } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { bidaEmit } from "../../_lib/lobbyApi";
import { DISCIPLINES, TABLE_MODE_NAME, type Discipline, type LeaderboardRow, type Page, type SeasonInfo } from "../../_lib/lobbyTypes";
import { useSearchParams } from "next/navigation";
import { Empty, ErrorBox, Loading, Pagination, RankBadge } from "./ui";

type LbData = Page<LeaderboardRow> & { seasonId: string; me: { position: number | null; rating: number; rankId: string }; seasons: (SeasonInfo & { standings: number })[] };

/** Bảng xếp hạng: server sắp xếp & phân trang (không tải toàn bộ người chơi về client) */
export default function Leaderboard() {
  const { user } = useAppSelector((s) => s.auth);
  const params = useSearchParams();
  const [discipline, setDiscipline] = useState<Discipline>(params.get("d") === "three" ? "three" : "free");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [seasonId, setSeasonId] = useState<string>("");
  const [data, setData] = useState<LbData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const res = await bidaEmit<LbData>("bida:ranked:get-leaderboard", { discipline, page, pageSize: 20, ...(debounced ? { search: debounced } : {}), ...(seasonId ? { seasonId } : {}) });
    if (res.ok && res.data) {
      setData(res.data);
      setError(null);
    } else setError(res.error ?? "Không tải được bảng xếp hạng");
  }, [page, debounced, seasonId, discipline]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Medal className="h-7 w-7 text-[#ffd166]" /> Bảng xếp hạng
        </h1>
        {data?.me && (
          <span className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-sm font-bold text-emerald-200">
            Bạn: {data.me.position ? `#${data.me.position}` : "chưa xếp hạng"} · {data.me.rating}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {DISCIPLINES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDiscipline(d);
              setPage(1);
            }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold sm:flex-none ${discipline === d ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5 text-slate-300"}`}
          >
            {TABLE_MODE_NAME[d]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm người chơi…" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
        <select value={seasonId} onChange={(e) => { setSeasonId(e.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-[#1a1d36] px-3 text-sm">
          <option value="">Mùa hiện tại</option>
          {data?.seasons.filter((s) => s.status === "ENDED").map((s) => (
            <option key={s.seasonId} value={s.seasonId}>{s.name} (đã kết thúc)</option>
          ))}
        </select>
      </div>
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#11132a]/85">
        {data === null && !error ? <Loading /> : error ? <ErrorBox text={error} onRetry={() => void load()} /> : !data?.items.length ? <Empty text="Chưa có người chơi nào trong bảng xếp hạng" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">#</th>
                  <th className="px-2 py-3">Người chơi</th>
                  <th className="px-2 py-3">Rank</th>
                  <th className="px-2 py-3 text-right">Rating</th>
                  <th className="px-2 py-3 text-right">Thắng</th>
                  <th className="px-4 py-3 text-right">Tỉ lệ thắng</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.userId} className={`border-t border-white/5 ${r.userId === user?._id ? "bg-emerald-500/10" : ""}`}>
                    <td className={`px-4 py-2.5 font-black ${r.position <= 3 ? "text-[#ffd166]" : "text-slate-400"}`}>{r.position <= 3 ? ["🥇", "🥈", "🥉"][r.position - 1] : r.position}</td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <PlayerAvatar name={r.name} avatar={r.avatar} size={28} />
                        <span className="font-bold">{r.name}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <RankBadge rankId={r.rankId} size="sm" />
                    </td>
                    <td className="px-2 py-2.5 text-right font-black text-[#ffd166]">{r.rating}</td>
                    <td className="px-2 py-2.5 text-right">{r.wins}</td>
                    <td className="px-4 py-2.5 text-right">{r.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </div>
  );
}
