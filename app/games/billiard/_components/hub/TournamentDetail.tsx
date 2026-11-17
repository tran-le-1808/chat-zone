"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Copy, Crown, LogOut, Play, Send, Trophy, UserPlus, Users, XCircle } from "lucide-react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { socket } from "@/lib/socket";
import { useAppSelector } from "@/redux/hooks";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { bidaEmit } from "../../_lib/lobbyApi";
import { TOURNAMENT_STATUS_LABEL, type BracketMatch, type OnlinePlayer, type TournamentView } from "../../_lib/lobbyTypes";
import { Empty, ErrorBox, fmtCountdown, fmtDate, inputCls, Loading, Modal, RankBadge } from "./ui";

const TABS = [
  ["overview", "Tổng quan"],
  ["participants", "Người tham gia"],
  ["bracket", "Nhánh đấu"],
  ["rules", "Luật"],
  ["results", "Kết quả"],
] as const;
type Tab = (typeof TABS)[number][0];

const MATCH_STATUS: Record<BracketMatch["status"], string> = {
  PENDING: "Chờ",
  READY: "Sẵn sàng",
  PLAYING: "Đang đấu",
  COMPLETED: "Xong",
  BYE: "Miễn đấu",
};

/** Cây nhánh đấu: mỗi vòng một cột; cuộn ngang trên màn nhỏ */
export function TournamentBracket({ t, myId }: { t: TournamentView; myId: string | null }) {
  const byId = useMemo(() => new Map(t.participants.map((p) => [p.userId, p])), [t.participants]);
  if (!t.bracket) return <Empty text="Nhánh đấu sẽ được tạo khi giải bắt đầu" />;
  const champion = t.championId ? byId.get(t.championId) : null;
  const slot = (id: string | null, m: BracketMatch, i: 0 | 1) => {
    const p = id ? byId.get(id) : null;
    const win = m.winner && m.winner === id;
    const score = m.score?.[i];
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1.5 ${win ? "bg-[#f4b942]/20 font-bold text-[#ffd166]" : m.winner && id ? "opacity-50" : ""} ${id === myId ? "ring-1 ring-inset ring-emerald-400/60" : ""}`}>
        {p ? <PlayerAvatar name={p.name} avatar={p.avatar} size={20} /> : <span className="h-5 w-5 rounded-full bg-white/10" />}
        <span className="min-w-0 flex-1 truncate text-xs">{p?.name ?? (m.status === "BYE" ? "—" : "Chờ xác định")}</span>
        {p && <RankBadge rankId={p.rankId} size="sm" showName={false} />}
        <span className="w-5 text-right text-xs font-black">{score ?? ""}</span>
      </div>
    );
  };
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {t.bracket.rounds.map((round, r) => (
          <div key={r} className="flex w-52 flex-col">
            <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">{t.roundNames[r]}</p>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.map((m) => (
                <div key={m.id} className={`overflow-hidden rounded-xl border bg-[#11132a] ${m.status === "PLAYING" ? "border-emerald-400/60" : "border-white/10"}`}>
                  {slot(m.playerA, m, 0)}
                  <div className="h-px bg-white/10" />
                  {slot(m.playerB, m, 1)}
                  <div className="flex items-center justify-between bg-black/30 px-2 py-0.5 text-[10px] text-slate-400">
                    <span>{MATCH_STATUS[m.status]}</span>
                    {m.status === "PLAYING" && m.roomCode && (m.playerA === myId || m.playerB === myId) && (
                      <Link href={`/games/billiard/room/${m.roomCode}`} className="font-bold text-emerald-300">
                        Vào trận ›
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex w-40 flex-col items-center justify-center text-center">
          <Trophy className="h-10 w-10 text-[#ffd166]" />
          <p className="mt-1 text-xs font-extrabold uppercase text-slate-400">Vô địch</p>
          <p className="font-black text-[#ffd166]">{champion?.name ?? "?"}</p>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ t, open, onClose }: { t: TournamentView; open: boolean; onClose: () => void }) {
  const [list, setList] = useState<OnlinePlayer[] | null>(null);
  useEffect(() => {
    if (!open) return;
    void bidaEmit<OnlinePlayer[]>("bida:lobby:online").then((r) => setList(r.ok ? (r.data ?? []) : []));
  }, [open]);
  const ids = new Set(t.participants.map((p) => p.userId));
  return (
    <Modal open={open} onClose={onClose} title="Mời người chơi">
      {list === null ? <Loading /> : !list.filter((p) => !ids.has(p.userId)).length ? <Empty text="Không có ai online để mời — hãy gửi đường dẫn giải đấu" /> : (
        <ul className="space-y-1.5">
          {list.filter((p) => !ids.has(p.userId)).map((p) => (
            <li key={p.userId} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
              <PlayerAvatar name={p.name} avatar={p.avatar} size={28} />
              <span className="flex-1 truncate text-sm font-bold">{p.name}</span>
              <button
                type="button"
                onClick={() => void bidaEmit("bida:tournament:invite", { tournamentId: t.tournamentId, userId: p.userId }).then((r) => (r.ok ? toast.success(`Đã mời ${p.name}`) : toast.error(r.error ?? "Không mời được")))}
                className="inline-flex items-center gap-1 rounded-lg bg-[#f4b942]/15 px-2 py-1 text-xs font-bold text-[#ffd166]"
              >
                <Send className="h-3.5 w-3.5" /> Mời
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function TournamentDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const myId = user?._id ?? null;
  const [t, setT] = useState<TournamentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [askPass, setAskPass] = useState(false);
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await bidaEmit<TournamentView>("bida:tournament:get-detail", { tournamentId: id });
    if (res.ok && res.data) {
      setT(res.data);
      setError(null);
    } else setError(res.error ?? "Không tải được giải đấu");
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onUpdate = (d: { tournament: TournamentView }) => {
      if (d.tournament.tournamentId === id) setT(d.tournament);
    };
    const events = ["bida:tournament:updated", "bida:tournament:bracket-updated", "bida:tournament:started", "bida:tournament:completed", "bida:tournament:cancelled"];
    for (const e of events) socket.on(e, onUpdate);
    const onReconnect = () => void load();
    socket.on("connect", onReconnect);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      for (const e of events) socket.off(e, onUpdate);
      socket.off("connect", onReconnect);
      clearInterval(tick);
      void bidaEmit("bida:tournament:unwatch", { tournamentId: id });
    };
  }, [id, load]);

  if (!t) return error ? <ErrorBox text={error} onRetry={() => void load()} /> : <Loading />;

  const me = t.participants.find((p) => p.userId === myId);
  const isOrganizer = t.organizerId === myId;
  const open = t.status === "REGISTRATION";
  const myMatch = t.bracket?.rounds.flat().find((m) => m.status === "PLAYING" && m.roomCode && (m.playerA === myId || m.playerB === myId));

  const act = async (event: string, payload: Record<string, unknown> = {}, ok?: string): Promise<boolean> => {
    setBusy(true);
    const res = await bidaEmit<TournamentView>(event, { tournamentId: t.tournamentId, ...payload });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Không thực hiện được");
      return false;
    }
    if (res.data) setT(res.data);
    if (ok) toast.success(ok);
    return true;
  };

  const join = () => (t.hasPassword ? setAskPass(true) : void act("bida:tournament:join", {}, "Đã đăng ký tham gia"));
  const countdownTo = t.status === "CHECK_IN" ? t.startAt : t.status === "REGISTRATION" || t.status === "FULL" ? t.checkInAt : null;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-[#f4b942]/25 bg-[#11132a]/90 shadow-2xl">
        <div className="relative h-36 bg-linear-to-br from-emerald-800 via-[#0f2a20] to-[#111827] sm:h-44">
          {t.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.thumbnail} alt="" className="h-full w-full object-cover opacity-60" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-[#11132a] to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <span className="rounded-lg bg-black/50 px-2 py-0.5 text-xs font-bold">{TOURNAMENT_STATUS_LABEL[t.status]}</span>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{t.name}</h1>
            <p className="text-sm text-slate-300">
              Tổ chức: {t.organizerName} · {t.participants.length}/{t.maxParticipants} người · {t.ruleName} · Bắt đầu {fmtDate(t.startAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          {countdownTo && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <CalendarClock className="h-4 w-4 text-[#ffd166]" />
              {t.status === "CHECK_IN" ? "Bắt đầu sau" : "Check-in mở sau"} {fmtCountdown(countdownTo - now)}
            </span>
          )}
          {myMatch && (
            <Link href={`/games/billiard/room/${myMatch.roomCode}`} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold shadow-[0_3px_0_#065f46]">
              <Play className="h-4 w-4" /> Vào trận của bạn
            </Link>
          )}
          {!me && open && (
            <button type="button" disabled={busy} onClick={join} className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-4 py-2 font-bold shadow-[0_3px_0_#7f1118] disabled:opacity-50">
              <UserPlus className="h-4 w-4" /> Tham gia
            </button>
          )}
          {me && ["REGISTRATION", "FULL", "CHECK_IN"].includes(t.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmDialog({ title: "Rời giải đấu?", tone: "danger", confirmText: "Rời giải" }).then((ok) => { if (ok) void act("bida:tournament:leave", {}, "Đã rời giải"); })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 font-bold disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> Rời giải
            </button>
          )}
          {me && t.status === "CHECK_IN" && !me.checkedIn && (
            <button type="button" disabled={busy} onClick={() => void act("bida:tournament:check-in", {}, "Đã check-in")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Check-in
            </button>
          )}
          {me?.checkedIn && t.status === "CHECK_IN" && <span className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-bold text-emerald-300">✓ Đã check-in</span>}
          {(me || isOrganizer) && ["REGISTRATION", "FULL", "CHECK_IN"].includes(t.status) && (
            <button type="button" onClick={() => setInvite(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 font-bold">
              <Users className="h-4 w-4" /> Mời người chơi
            </button>
          )}
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Đã sao chép đường dẫn giải đấu"))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 font-bold"
          >
            <Copy className="h-4 w-4" /> Sao chép link
          </button>
          {isOrganizer && (t.status === "REGISTRATION" || t.status === "FULL") && (
            <button type="button" disabled={busy} onClick={() => void act("bida:tournament:open-check-in", {}, "Đã mở check-in")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#f4b942]/15 px-4 py-2 font-bold text-[#ffd166] disabled:opacity-50">
              Mở check-in ngay
            </button>
          )}
          {isOrganizer && t.status === "CHECK_IN" && (
            <button type="button" disabled={busy} onClick={() => void confirmDialog({ title: "Bắt đầu giải ngay?", message: "Người chưa check-in sẽ bị loại khỏi giải." }).then((ok) => { if (ok) void act("bida:tournament:start", {}, "Giải đấu bắt đầu!"); })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold disabled:opacity-50">
              <Play className="h-4 w-4" /> Bắt đầu giải
            </button>
          )}
          {isOrganizer && ["REGISTRATION", "FULL", "CHECK_IN"].includes(t.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmDialog({ title: "Huỷ giải đấu?", message: "Mọi người tham gia sẽ được thông báo.", tone: "danger", confirmText: "Huỷ giải" }).then((ok) => { if (ok) void act("bida:tournament:cancel", {}, "Đã huỷ giải"); })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-4 py-2 font-bold text-red-300 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Huỷ giải
            </button>
          )}
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${tab === k ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5 text-slate-300"}`}>
            {l}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-white/10 bg-[#11132a]/80 p-4 sm:p-5">
        {tab === "overview" && (
          <div className="space-y-3 text-sm">
            {t.description ? <p className="whitespace-pre-line text-slate-200">{t.description}</p> : <p className="text-slate-400">Không có mô tả.</p>}
            <dl className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["Thể thức", "Loại trực tiếp (Single Elimination)"],
                  ["Xếp cặp", t.seeding === "rating" ? "Theo Rating" : "Ngẫu nhiên"],
                  ["Hạn đăng ký", fmtDate(t.registrationDeadline)],
                  ["Mở check-in", fmtDate(t.checkInAt)],
                  ["Bắt đầu", fmtDate(t.startAt)],
                  ["Thời gian mỗi trận (dự kiến)", `${t.matchDurationMinutes} phút`],
                  ["Hiển thị", t.visibility === "PUBLIC" ? "Công khai" : "Riêng tư"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {t.status === "CANCELLED" && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-red-200">Giải đã huỷ: {t.cancelReason}</p>}
          </div>
        )}
        {tab === "participants" &&
          (t.participants.length === 0 ? (
            <Empty text="Chưa có người đăng ký" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {t.participants.map((p, i) => (
                <li key={p.userId} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${p.userId === myId ? "bg-emerald-500/10" : "bg-white/[0.04]"}`}>
                  <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                  <PlayerAvatar name={p.name} avatar={p.avatar} size={30} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {p.name}
                    {p.userId === t.organizerId && <Crown className="ml-1 inline h-3.5 w-3.5 text-[#ffd166]" />}
                  </span>
                  <RankBadge rankId={p.rankId} size="sm" showName={false} />
                  <span className="text-xs text-slate-400">{p.rating}</span>
                  {t.status === "CHECK_IN" && <span className={`text-xs font-bold ${p.checkedIn ? "text-emerald-300" : "text-slate-500"}`}>{p.checkedIn ? "✓" : "…"}</span>}
                </li>
              ))}
            </ul>
          ))}
        {tab === "bracket" && <TournamentBracket t={t} myId={myId} />}
        {tab === "rules" && (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-200">
            <li>Luật: {t.ruleName} — dùng đúng luật Carom của game (không thay đổi khi đấu giải).</li>
            <li>Loại trực tiếp: thua một trận là bị loại. Thiếu người để đủ nhánh thì hạt giống cao được miễn đấu (bye).</li>
            <li>Check-in mở trước giờ bắt đầu; ai không check-in bị loại khỏi giải.</li>
            <li>Khi trận của bạn sẵn sàng, hệ thống gửi thông báo và đường vào phòng. Không vào trận trong thời hạn sẽ bị xử thua.</li>
            <li>Rời trận / mất kết nối quá lâu khi đang đấu bị xử thua. Kết quả do máy chủ xác nhận, không ai sửa được.</li>
          </ul>
        )}
        {tab === "results" &&
          (!t.bracket ? (
            <Empty text="Chưa có kết quả" />
          ) : (
            <div className="space-y-3">
              {t.championId && (
                <p className="rounded-2xl bg-[#f4b942]/15 px-4 py-3 text-center text-lg font-black text-[#ffd166]">
                  🏆 Vô địch: {t.participants.find((p) => p.userId === t.championId)?.name}
                </p>
              )}
              {t.bracket.rounds.map((round, r) => (
                <div key={r}>
                  <p className="mb-1 text-xs font-extrabold uppercase text-slate-400">{t.roundNames[r]}</p>
                  <ul className="space-y-1">
                    {round
                      .filter((m) => m.status === "COMPLETED")
                      .map((m) => {
                        const a = t.participants.find((p) => p.userId === m.playerA);
                        const b = t.participants.find((p) => p.userId === m.playerB);
                        return (
                          <li key={m.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-1.5 text-sm">
                            <span className={m.winner === m.playerA ? "font-bold text-[#ffd166]" : ""}>{a?.name}</span>
                            <span className="font-black">{m.score ? `${m.score[0]} – ${m.score[1]}` : "—"}</span>
                            <span className={m.winner === m.playerB ? "font-bold text-[#ffd166]" : ""}>{b?.name}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
      </section>

      <Modal open={askPass} onClose={() => setAskPass(false)} title="Giải đấu riêng tư">
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu giải đấu" className={inputCls} />
        <button
          type="button"
          disabled={!password || busy}
          onClick={() => void act("bida:tournament:join", { password }, "Đã đăng ký tham gia").then((ok) => { if (ok) setAskPass(false); })}
          className="mt-3 w-full rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold disabled:opacity-50"
        >
          Tham gia
        </button>
      </Modal>
      <InviteModal t={t} open={invite} onClose={() => setInvite(false)} />
      <button type="button" onClick={() => router.push("/games/billiard/tournaments")} className="text-sm text-slate-400 hover:text-white">
        ‹ Danh sách giải đấu
      </button>
    </div>
  );
}
