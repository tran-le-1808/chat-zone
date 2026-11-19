"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Crown, Flame, History, Loader2, Medal, Swords, Trophy, Users, Zap } from "lucide-react";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { useLobby } from "../../_context/BilliardLobbyContext";
import { bidaEmit } from "../../_lib/lobbyApi";
import { DISCIPLINES, GAME_MODE_LABEL, TABLE_MODE_NAME, TOURNAMENT_STATUS_LABEL, type Discipline, type LadderView, type RuleSet, type LeaderboardRow, type MatchRecord, type OnlinePlayer, type Page, type TournamentView } from "../../_lib/lobbyTypes";
import CasualModal from "./CasualModal";
import { Empty, ErrorBox, fmtDate, Loading, Modal, RankBadge, Section } from "./ui";

/** Tải dữ liệu một khối, có loading / lỗi / thử lại */
function useLoad<T>(event: string, payload?: unknown, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(payload ?? null);
  const load = useCallback(async () => {
    const res = await bidaEmit<T>(event, key === "null" ? undefined : JSON.parse(key));
    if (res.ok) {
      setData(res.data ?? null);
      setError(null);
    } else setError(res.error ?? "Không tải được dữ liệu");
  }, [event, key]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    if (!refreshMs) return;
    const id = setInterval(() => void load(), refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);
  return { data, error, reload: load, loading: data === null && error === null };
}

/** Thang hạng của một thể loại: rank, rating, vị trí, tiến độ tới rank kế */
export function LadderCard({ ladder }: { ladder: LadderView }) {
  const { rankOf } = useLobby();
  const next = ladder.nextRankId ? rankOf(ladder.nextRankId) : null;
  const total = ladder.ranked.wins + ladder.ranked.losses;
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-300">{TABLE_MODE_NAME[ladder.discipline]}</p>
        {ladder.position && <span className="rounded-md bg-white/10 px-1.5 text-[11px] font-bold">#{ladder.position}</span>}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <RankBadge rankId={ladder.rankId} />
        <span className="ml-auto text-2xl font-black text-[#ffd166]">{ladder.rating}</span>
      </div>
      <div className="mt-2 mb-1 flex justify-between text-[11px] text-slate-400">
        <span>
          {ladder.ranked.wins}T – {ladder.ranked.losses}B {total ? `(${ladder.ranked.winRate}%)` : ""}
        </span>
        <span>{next ? `Tới ${next.name}: ${next.min - ladder.rating}` : "Rank cao nhất"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full bg-linear-to-r from-[#f4b942] to-[#ff6b4a]" style={{ width: `${Math.round(ladder.rankProgress * 100)}%` }} />
      </div>
    </div>
  );
}

function ProfileCard() {
  const { profile } = useLobby();
  if (!profile) return null;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#f4b942]/25 bg-linear-to-br from-[#123b2a] via-[#0f2a20] to-[#111827] p-4 shadow-2xl sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <PlayerAvatar name={profile.name} avatar={profile.avatar} size={72} />
          <div className="min-w-0">
            <p className="truncate text-xl font-black">{profile.name}</p>
            <p className="text-sm text-slate-300">
              Cấp {profile.level} · {profile.season.name}
            </p>
            <p className="text-xs text-slate-400">
              {profile.totalMatches} trận · {profile.totalWins} thắng · {profile.totalLosses} thua · {profile.winRate}%
            </p>
          </div>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          {DISCIPLINES.map((d) => (
            <LadderCard key={d} ladder={profile.ladders[d]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModeCard({ title, desc, icon, accent, stat, onClick, loading, disabled, disabledText, cta }: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
  stat?: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  disabledText?: string;
  cta: string;
}) {
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#11132a]/90 p-4 shadow-xl transition duration-200 hover:-translate-y-1 hover:border-[#f4b942]/40 hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] ${disabled ? "opacity-60" : ""}`}>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-xl ${accent}`} />
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${accent}`}>{icon}</div>
      <h3 className="text-lg font-black tracking-tight">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-400">{desc}</p>
      {stat && <p className="mt-2 text-xs font-bold text-emerald-300">{stat}</p>}
      <button type="button" disabled={disabled || loading} onClick={onClick} className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-2.5 font-bold shadow-[0_4px_0_#7f1118] transition active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {disabled && disabledText ? disabledText : cta}
      </button>
    </div>
  );
}

/** Chọn thể loại bida (Libre / 3 băng) */
function DisciplinePicker({ value, onChange }: { value: Discipline; onChange: (d: Discipline) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DISCIPLINES.map((d) => (
        <button key={d} type="button" onClick={() => onChange(d)} className={`rounded-2xl border px-3 py-2.5 text-sm font-bold ${value === d ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.04]"}`}>
          {TABLE_MODE_NAME[d]}
        </button>
      ))}
    </div>
  );
}

/** Số điểm của trận: chỉ hiện nút chọn khi có nhiều mức; hiện tại Quick / Ranked chỉ đánh 15 điểm */
function TargetChoice({ rules, selected, onPick, accent }: { rules: RuleSet[]; selected: string; onPick: (t: number) => void; accent: "emerald" | "gold" }) {
  const current = rules.find((r) => r.id === selected);
  if (rules.length <= 1)
    return <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-center text-sm text-slate-300">Luật trận: chạm <b className="text-[#ffd166]">{current?.target ?? 15} điểm</b></p>;
  const on = accent === "emerald" ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]";
  return (
    <>
      <p className="mb-1.5 mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Số điểm</p>
      <div className="grid grid-cols-2 gap-2">
        {rules.map((r) => (
          <button key={r.id} type="button" onClick={() => onPick(r.target)} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${selected === r.id ? on : "border-white/10 bg-white/[0.04]"}`}>
            Chạm {r.target} điểm
          </button>
        ))}
      </div>
    </>
  );
}

function QuickMatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, findMatch, busy } = useLobby();
  const [discipline, setDiscipline] = useState<Discipline>("free");
  // nhớ SỐ ĐIỂM (mặc định 15), đổi thể loại vẫn giữ nguyên số điểm
  const [target, setTarget] = useState<number | null>(null);
  const rules = config?.ruleSets.filter((r) => r.mode === discipline) ?? [];
  const want = target ?? config?.defaultTarget ?? 15;
  const selected = (rules.find((r) => r.target === want) ?? rules[0])?.id ?? "";
  return (
    <Modal open={open} onClose={onClose} title="Tìm trận nhanh">
      <p className="mb-3 text-sm text-slate-400">Chọn thể loại bida (trận chạm 15 điểm). Hệ thống ghép bạn với người có trình độ tương đương ở thể loại đó; không ảnh hưởng điểm xếp hạng.</p>
      <DisciplinePicker value={discipline} onChange={setDiscipline} />
      <TargetChoice rules={rules} selected={selected} onPick={setTarget} accent="emerald" />
      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void findMatch("QUICK", { ruleSet: selected }).then((ok) => ok && onClose())}
        className="mt-4 w-full rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 py-3 font-bold shadow-[0_4px_0_#065f46] disabled:opacity-50"
      >
        Find Match
      </button>
    </Modal>
  );
}

/** Đấu xếp hạng: chọn thể loại — mỗi thể loại một thang hạng & luật xếp hạng riêng */
function RankedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, findMatch, busy, profile } = useLobby();
  const [discipline, setDiscipline] = useState<Discipline>("free");
  const [target, setTarget] = useState<number | null>(null);
  const ladder = profile?.ladders[discipline];
  const rules = (config?.rankedRuleSets[discipline] ?? []).map((id) => config!.ruleSets.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  const want = target ?? config?.defaultTarget ?? 15;
  const selected = (rules.find((r) => r.target === want) ?? rules[0])?.id ?? "";
  return (
    <Modal open={open} onClose={onClose} title="Đấu xếp hạng">
      <p className="mb-3 text-sm text-slate-400">Libre và 3 băng có bảng xếp hạng riêng. Thắng / thua chỉ tính điểm ở thể loại bạn chọn.</p>
      <DisciplinePicker value={discipline} onChange={setDiscipline} />
      {ladder && (
        <div className="mt-3">
          <LadderCard ladder={ladder} />
        </div>
      )}
      <TargetChoice rules={rules} selected={selected} onPick={setTarget} accent="gold" />
      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void findMatch("RANKED", { discipline, ruleSet: selected }).then((ok) => ok && onClose())}
        className="mt-4 w-full rounded-xl bg-linear-to-r from-[#c8941d] to-[#e8772e] py-3 font-bold shadow-[0_4px_0_#7a5410] disabled:opacity-50"
      >
        Tìm trận xếp hạng {TABLE_MODE_NAME[discipline]}
      </button>
    </Modal>
  );
}

function GameModes() {
  const router = useRouter();
  const { summary, mm, profile } = useLobby();
  const [quick, setQuick] = useState(false);
  const [ranked, setRanked] = useState(false);
  const [casual, setCasual] = useState(false);
  const searching = mm.state !== "idle";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModeCard
          title="QUICK MATCH"
          desc="Tìm đối thủ tự động theo trình độ, chơi ngay."
          icon={<Zap className="h-6 w-6" />}
          accent="bg-emerald-600"
          stat={summary ? `${summary.queue.QUICK} người đang tìm trận` : undefined}
          onClick={() => setQuick(true)}
          disabled={searching}
          disabledText="Đang tìm trận…"
          cta="Tìm trận"
        />
        <ModeCard
          title="RANKED MATCH"
          desc="Đấu xếp hạng Libre hoặc 3 băng — mỗi thể loại một bảng xếp hạng riêng."
          icon={<Crown className="h-6 w-6" />}
          accent="bg-[#c8941d]"
          stat={summary ? `${summary.queue.RANKED} người đang tìm · Libre ${profile?.ladders.free.rating ?? "—"} · 3 băng ${profile?.ladders.three.rating ?? "—"}` : undefined}
          onClick={() => setRanked(true)}
          disabled={searching}
          disabledText="Đang tìm trận…"
          cta="Đấu xếp hạng"
        />
        <ModeCard
          title="CASUAL MATCH"
          desc="Tạo phòng riêng, mời bạn bè, vào bằng mã phòng. Không tính Rating."
          icon={<Users className="h-6 w-6" />}
          accent="bg-sky-600"
          stat={summary ? `${summary.playing} trận đang diễn ra` : undefined}
          onClick={() => setCasual(true)}
          cta="Vào phòng"
        />
        <ModeCard
          title="TOURNAMENT"
          desc="Tạo hoặc tham gia giải đấu loại trực tiếp 4–64 người."
          icon={<Trophy className="h-6 w-6" />}
          accent="bg-[#b4532a]"
          stat={summary ? `${summary.tournamentsOpen} giải đang mở · ${summary.tournamentsLive} giải đang đấu` : undefined}
          onClick={() => router.push("/games/billiard/tournaments")}
          cta="Xem giải đấu"
        />
        <ModeCard
          title="AI SHOT STUDIO"
          desc="AI tìm cú đánh Libre đẹp, tự đánh, quay video có chú thích đường bi và thuyết minh tiếng Việt."
          icon={<Clapperboard className="h-6 w-6" />}
          accent="bg-violet-600"
          onClick={() => router.push("/games/billiard/studio")}
          cta="Mở studio"
        />
      </div>
      <QuickMatchModal open={quick} onClose={() => setQuick(false)} />
      <RankedModal open={ranked} onClose={() => setRanked(false)} />
      <CasualModal open={casual} onClose={() => setCasual(false)} />
    </>
  );
}

function UpcomingTournaments() {
  const { data, error, reload, loading } = useLoad<Page<TournamentView>>("bida:tournament:list", { page: 1, pageSize: 4, filter: "upcoming" }, 30000);
  return (
    <Section title="Giải đấu sắp diễn ra" icon={<Trophy className="h-5 w-5 text-[#ffd166]" />} action={<Link href="/games/billiard/tournaments" className="text-xs font-bold text-[#ffd166]">Xem tất cả</Link>}>
      {loading ? <Loading /> : error ? <ErrorBox text={error} onRetry={reload} /> : !data?.items.length ? (
        <Empty text="Chưa có giải nào đang mở đăng ký">
          <Link href="/games/billiard/tournaments?create=1" className="text-xs font-bold text-[#ffd166]">Tạo giải đấu</Link>
        </Empty>
      ) : (
        <div className="space-y-2">
          {data.items.map((t) => (
            <Link key={t.tournamentId} href={`/games/billiard/tournament/${t.tournamentId}`} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2 hover:bg-white/[0.08]">
              <Trophy className="h-5 w-5 shrink-0 text-[#ffd166]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{t.name}</span>
                <span className="block text-xs text-slate-400">
                  {t.participants.length}/{t.maxParticipants} · {t.ruleName} · {fmtDate(t.startAt)}
                </span>
              </span>
              <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">{TOURNAMENT_STATUS_LABEL[t.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function TopRanking() {
  const [discipline, setDiscipline] = useState<Discipline>("free");
  const { data, error, reload, loading } = useLoad<Page<LeaderboardRow>>("bida:ranked:get-leaderboard", { page: 1, pageSize: 5, discipline }, 60000);
  return (
    <Section title="Top xếp hạng" icon={<Medal className="h-5 w-5 text-[#ffd166]" />} action={<Link href={`/games/billiard/leaderboard?d=${discipline}`} className="text-xs font-bold text-[#ffd166]">Bảng xếp hạng</Link>}>
      <div className="mb-2 flex gap-1.5">
        {DISCIPLINES.map((d) => (
          <button key={d} type="button" onClick={() => setDiscipline(d)} className={`flex-1 rounded-lg px-2 py-1 text-xs font-bold ${discipline === d ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5 text-slate-300"}`}>
            {TABLE_MODE_NAME[d]}
          </button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorBox text={error} onRetry={reload} /> : !data?.items.length ? <Empty text="Chưa có ai đấu xếp hạng mùa này — hãy là người đầu tiên!" /> : (
        <ol className="space-y-1.5">
          {data.items.map((r) => (
            <li key={r.userId} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.05]">
              <span className={`w-6 text-center font-black ${r.position <= 3 ? "text-[#ffd166]" : "text-slate-400"}`}>{r.position}</span>
              <PlayerAvatar name={r.name} avatar={r.avatar} size={30} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{r.name}</span>
              <RankBadge rankId={r.rankId} size="sm" showName={false} />
              <span className="w-12 text-right text-sm font-black text-[#ffd166]">{r.rating}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function RecentMatches() {
  const { data, error, reload, loading } = useLoad<MatchRecord[]>("bida:match:recent", undefined, 30000);
  return (
    <Section title="Trận gần đây" icon={<History className="h-5 w-5 text-[#ffd166]" />}>
      {loading ? <Loading /> : error ? <ErrorBox text={error} onRetry={reload} /> : !data?.length ? <Empty text="Chưa có trận nào kết thúc" /> : (
        <ul className="space-y-1.5">
          {data.map((m) => {
            const w = m.players.indexOf(m.winnerId ?? "");
            return (
              <li key={m.matchId} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <span className="rounded-md bg-white/10 px-1.5 text-[10px] font-bold">{GAME_MODE_LABEL[m.gameMode]}</span>
                <span className={`min-w-0 flex-1 truncate ${w === 0 ? "font-bold text-[#ffd166]" : ""}`}>{m.names[0]}</span>
                <span className="font-black">
                  {m.score[0]} – {m.score[1]}
                </span>
                <span className={`min-w-0 flex-1 truncate text-right ${w === 1 ? "font-bold text-[#ffd166]" : ""}`}>{m.names[1]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

const STATUS_LABEL: Record<OnlinePlayer["status"], [string, string]> = {
  playing: ["Đang đấu", "bg-red-400"],
  searching: ["Đang tìm trận", "bg-amber-400"],
  "in-room": ["Trong phòng", "bg-sky-400"],
  idle: ["Rảnh", "bg-emerald-400"],
};

function OnlinePlayers() {
  const { summary } = useLobby();
  const { data, error, reload, loading } = useLoad<OnlinePlayer[]>("bida:lobby:online", undefined, 20000);
  return (
    <Section title={`Đang online${summary ? ` (${summary.online})` : ""}`} icon={<Flame className="h-5 w-5 text-[#ffd166]" />}>
      {loading ? <Loading /> : error ? <ErrorBox text={error} onRetry={reload} /> : !data?.length ? <Empty text="Chưa có ai trong sảnh" /> : (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {data.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
              <PlayerAvatar name={p.name} avatar={p.avatar} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{p.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_LABEL[p.status][1]}`} />
                  {STATUS_LABEL[p.status][0]} · Lv.{p.level}
                </span>
              </span>
              {DISCIPLINES.map((d) => (
                <span key={d} title={`${TABLE_MODE_NAME[d]}: ${p.ratings[d].rating}`}>
                  <RankBadge rankId={p.ratings[d].rankId} size="sm" showName={false} />
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Trang sảnh chính */
export default function LobbyHome() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <ProfileCard />
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-300">
          <Swords className="h-4 w-4" /> Chế độ chơi
        </h2>
        <GameModes />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <UpcomingTournaments />
          <RecentMatches />
        </div>
        <div className="space-y-4">
          <TopRanking />
          <OnlinePlayers />
        </div>
      </div>
    </div>
  );
}
