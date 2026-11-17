"use client";

/**
 * Trạng thái sảnh Bida: cấu hình (rank / luật từ server), hồ sơ, thống kê sảnh, tìm trận, thông báo.
 * Vào sảnh = `bida:lobby:enter` (cũng chạy lại khi socket kết nối lại để khôi phục trạng thái tìm trận).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { useAppSelector } from "@/redux/hooks";
import { bidaEmit } from "../_lib/lobbyApi";
import { ruleSetName, type Discipline, type LobbyConfig, type LobbySummary, type MatchmakingState, type Opponent, type ProfileView, type QueueMode, type RankTier, type TournamentView } from "../_lib/lobbyTypes";

export interface LobbyNotification {
  id: string;
  text: string;
  at: number;
  href?: string;
}

interface LobbyContextValue {
  ready: boolean;
  error: string | null;
  config: LobbyConfig | null;
  profile: ProfileView | null;
  summary: LobbySummary | null;
  mm: MatchmakingState;
  busy: boolean;
  notifications: LobbyNotification[];
  unread: number;
  markRead: () => void;
  rankOf: (id: string) => RankTier | undefined;
  ruleName: (id: string) => string;
  refreshProfile: () => Promise<void>;
  retry: () => void;
  /** Quick: ruleSet (đã gồm thể loại); Ranked: discipline (thang hạng) + ruleSet (15 / 20 điểm) */
  findMatch: (mode: QueueMode, opts: { ruleSet?: string; discipline?: Discipline }) => Promise<boolean>;
  cancelSearch: () => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
}

const Ctx = createContext<LobbyContextValue | null>(null);

export function useLobby(): LobbyContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLobby phải nằm trong BilliardLobbyProvider");
  return v;
}

interface EnterData {
  config: LobbyConfig;
  profile: ProfileView;
  matchmaking: MatchmakingState;
  summary: LobbySummary;
}

export function BilliardLobbyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<LobbyConfig | null>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [summary, setSummary] = useState<LobbySummary | null>(null);
  const [mm, setMm] = useState<MatchmakingState>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<LobbyNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const mmRef = useRef(mm);
  useEffect(() => {
    mmRef.current = mm;
  }, [mm]);

  const notify = useCallback((text: string, href?: string) => {
    setNotifications((l) => [{ id: `${Date.now()}-${Math.random()}`, text, at: Date.now(), href }, ...l].slice(0, 20));
    setUnread((u) => u + 1);
  }, []);

  // ===================== VÀO SẢNH =====================
  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;
    const enter = async () => {
      const res = await bidaEmit<EnterData>("bida:lobby:enter");
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setError(res.error ?? "Không vào được sảnh");
        setReady(true);
        return;
      }
      setError(null);
      setConfig(res.data.config);
      setProfile(res.data.profile);
      setSummary(res.data.summary);
      setMm(res.data.matchmaking);
      setReady(true);
    };
    void enter();
    const onReconnect = () => void enter();
    socket.on("connect", onReconnect);
    return () => {
      cancelled = true;
      socket.off("connect", onReconnect);
      void bidaEmit("bida:lobby:leave");
    };
  }, [user?._id, attempt]);

  const refreshProfile = useCallback(async () => {
    const res = await bidaEmit<ProfileView>("bida:ranked:get-profile", {});
    if (res.ok && res.data) setProfile(res.data);
  }, []);

  // ===================== SỰ KIỆN SERVER =====================
  useEffect(() => {
    const onQueued = (d: { mode: QueueMode; ruleSet: string; rating: number; joinedAt: number; range: number }) =>
      setMm({ state: "searching", ...d });
    const onSearching = (d: { range: number }) =>
      setMm((cur) => (cur.state === "searching" ? { ...cur, range: d.range } : cur));
    const onFound = (d: { pendingId: string; mode: QueueMode; ruleSet: string; deadline: number; accepted: boolean; opponent: Opponent }) => {
      setMm({ state: "found", ...d });
      try {
        navigator.vibrate?.(200);
      } catch {
        /* không hỗ trợ */
      }
    };
    const onAccepted = (d: { pendingId: string; userId: string }) =>
      setMm((cur) => (cur.state === "found" && cur.pendingId === d.pendingId && d.userId === user?._id ? { ...cur, accepted: true } : cur));
    const onCancelled = (d: { reason: string; requeued: boolean }) => {
      if (!d.requeued) setMm({ state: "idle" });
      if (d.reason) toast(d.reason);
    };
    const onFailed = (d: { reason: string }) => {
      setMm({ state: "idle" });
      toast.error(d.reason);
    };
    const onExpired = (d: { reason: string; lockSeconds: number }) => {
      setMm({ state: "idle" });
      toast.error(`${d.reason} — tạm khoá tìm trận ${d.lockSeconds} giây`);
    };
    const onMatched = (d: { code: string }) => {
      setMm({ state: "idle" });
      toast.success("Đã tìm được trận! Đang vào phòng…");
      router.push(`/games/billiard/room/${d.code}`);
    };
    const onMatchReady = (d: { code: string; kind: string; tournamentId: string | null }) => {
      if (d.kind !== "tournament") return;
      const href = `/games/billiard/room/${d.code}`;
      notify("🏆 Trận đấu giải của bạn đã sẵn sàng — vào ngay!", href);
      toast.success("Trận giải đấu của bạn đã sẵn sàng", { action: { label: "Vào trận", onClick: () => router.push(href) }, duration: 20000 });
    };
    const onInvited = (d: { tournament: TournamentView; from: { name: string } }) => {
      const href = `/games/billiard/tournament/${d.tournament.tournamentId}`;
      notify(`✉️ ${d.from.name} mời bạn tham gia giải "${d.tournament.name}"`, href);
      toast(`${d.from.name} mời bạn tham gia giải "${d.tournament.name}"`, { action: { label: "Xem", onClick: () => router.push(href) } });
    };
    const onCheckIn = (d: { tournament: TournamentView }) =>
      notify(`⏰ Giải "${d.tournament.name}" mở check-in`, `/games/billiard/tournament/${d.tournament.tournamentId}`);
    const onTournamentDone = (d: { tournament: TournamentView }) =>
      notify(`🏁 Giải "${d.tournament.name}" đã kết thúc`, `/games/billiard/tournament/${d.tournament.tournamentId}`);
    const onSummary = (d: LobbySummary) => setSummary(d);
    const onRank = (d: { rankAfter: string; promoted: boolean }) => {
      notify(d.promoted ? `🎉 Thăng hạng: ${d.rankAfter}` : `Tụt hạng: ${d.rankAfter}`, "/games/billiard/profile");
      void refreshProfile();
    };
    const handlers: [string, (d: never) => void][] = [
      ["bida:matchmaking:queued", onQueued],
      ["bida:matchmaking:searching", onSearching],
      ["bida:matchmaking:found", onFound],
      ["bida:matchmaking:accepted", onAccepted],
      ["bida:matchmaking:cancelled", onCancelled],
      ["bida:matchmaking:failed", onFailed],
      ["bida:matchmaking:expired", onExpired],
      ["bida:matchmaking:matched", onMatched],
      ["bida:match:ready", onMatchReady],
      ["bida:tournament:invited", onInvited],
      ["bida:tournament:check-in-started", onCheckIn],
      ["bida:tournament:completed", onTournamentDone],
      ["bida:lobby:summary", onSummary],
      ["bida:ranked:rank-updated", onRank],
    ];
    for (const [ev, fn] of handlers) socket.on(ev, fn as (d: unknown) => void);
    return () => {
      for (const [ev, fn] of handlers) socket.off(ev, fn as (d: unknown) => void);
    };
  }, [router, user?._id, notify, refreshProfile]);

  // ===================== HÀNH ĐỘNG =====================
  const findMatch = useCallback(async (mode: QueueMode, opts: { ruleSet?: string; discipline?: Discipline }) => {
    setBusy(true);
    const payload =
      mode === "RANKED"
        ? { mode, discipline: opts.discipline ?? "free", ...(opts.ruleSet ? { ruleSet: opts.ruleSet } : {}) }
        : opts.ruleSet
          ? { mode, ruleSet: opts.ruleSet }
          : { mode };
    const res = await bidaEmit<{ mode: QueueMode; ruleSet: string; rating: number; joinedAt: number; range: number }>("bida:matchmaking:join", payload);
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Không tìm trận được");
      return false;
    }
    setMm({ state: "searching", ...res.data });
    return true;
  }, []);

  const cancelSearch = useCallback(async () => {
    setBusy(true);
    const res = await bidaEmit("bida:matchmaking:cancel");
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Không huỷ được");
    setMm({ state: "idle" });
  }, []);

  const accept = useCallback(async () => {
    const cur = mmRef.current;
    if (cur.state !== "found") return;
    setMm({ ...cur, accepted: true });
    const res = await bidaEmit("bida:matchmaking:accept", { pendingId: cur.pendingId });
    if (!res.ok) {
      toast.error(res.error ?? "Trận không còn hiệu lực");
      setMm({ state: "idle" });
    }
  }, []);

  const decline = useCallback(async () => {
    const cur = mmRef.current;
    if (cur.state !== "found") return;
    setMm({ state: "idle" });
    await bidaEmit("bida:matchmaking:decline", { pendingId: cur.pendingId });
  }, []);

  const rankOf = useCallback((id: string) => config?.ranks.find((r) => r.id === id), [config]);
  const ruleName = useCallback((id: string) => config?.ruleSets.find((r) => r.id === id)?.name ?? ruleSetName(id), [config]);

  const value = useMemo<LobbyContextValue>(
    () => ({
      ready,
      error,
      config,
      profile,
      summary,
      mm,
      busy,
      notifications,
      unread,
      markRead: () => setUnread(0),
      rankOf,
      ruleName,
      refreshProfile,
      retry: () => {
        setReady(false);
        setAttempt((a) => a + 1);
      },
      findMatch,
      cancelSearch,
      accept,
      decline,
    }),
    [ready, error, config, profile, summary, mm, busy, notifications, unread, rankOf, ruleName, refreshProfile, findMatch, cancelSearch, accept, decline],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
