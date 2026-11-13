"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Hash, History, Loader2, Plus, RefreshCw, Swords, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import API from "@/lib/api";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { ui } from "@/components/ui/styles";
import { POCKET_PRESETS } from "../../_lib/physics/config";
import type { PoolRoomSettingsUI } from "./PoolWaitingRoom";

interface PublicRoom {
  code: string;
  status: "lobby" | "playing" | "finished";
  settings: PoolRoomSettingsUI;
  players: { userId: string; name: string }[];
  spectators: number;
}
interface Rating {
  eight: { elo: number; games: number; wins: number };
  nine: { elo: number; games: number; wins: number };
}
interface MatchRow {
  _id: string;
  type: string;
  ranked: boolean;
  players: { userId: string; name: string; seat: number }[];
  score: number[];
  winner: number;
  eloChange?: number[];
  endedAt: string;
}

/** Sảnh online: ghép trận nhanh (ELO), tạo phòng, vào bằng mã, phòng công khai, lịch sử */
export default function PoolOnlineLobby({ myUserId }: { myUserId: string | null }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<{ type: "eight" | "nine"; elo: number; since: number } | null>(null);
  const [me, setMe] = useState<{ rating: Rating; history: MatchRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowTs, setNowTs] = useState(0);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<PublicRoom[]>("pool:list");
    if (r.ok) setRooms(r.data ?? []);
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    API.get("/pool/me")
      .then((r) => setMe(r.data))
      .catch(() => {});
    const t = setInterval(() => void refresh(), 8000);
    const onMatched = ({ code }: { code: string }) => {
      setQueue(null);
      toast.success("Đã tìm thấy đối thủ!");
      router.push(`/games/pool/room/${code}`);
    };
    socket.on("pool:matched", onMatched);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      socket.off("pool:matched", onMatched);
    };
  }, [refresh, router]);

  useEffect(() => {
    if (!queue) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = useCallback(async (type: "eight" | "nine") => {
    const r = await monoEmit<{ elo: number }>("pool:quick", { type });
    if (!r.ok) {
      toast.error(r.error ?? "Không vào hàng chờ được");
      return;
    }
    const since = Date.now();
    setNowTs(since);
    setQueue({ type, elo: r.data?.elo ?? 1200, since });
  }, []);
  const cancel = async () => {
    await monoEmit("pool:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("pool:create", { type: "eight", raceTo: 3, isPrivate: false });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/pool/room/${r.data.room.code}`);
  };

  const elo = (t: "eight" | "nine") => me?.rating[t];
  const waited = queue ? Math.max(0, (nowTs - queue.since) / 1000) : 0;
  return (
    <div className="space-y-4">
      {/* Ghép trận nhanh */}
      <div className="grid gap-2 sm:grid-cols-2">
        {(["eight", "nine"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={!!queue}
            onClick={() => void quick(t)}
            className="flex items-center gap-3 rounded-2xl border border-[#f4b942]/30 bg-[#f4b942]/10 p-3 text-left transition hover:bg-[#f4b942]/20 disabled:opacity-50"
          >
            <Swords className="h-8 w-8 shrink-0 text-[#ffd166]" />
            <span className="min-w-0">
              <b className="block">Ghép trận {t === "eight" ? "8 bi" : "9 bi"}</b>
              <span className="text-xs text-slate-400">
                Xếp hạng · chạm 3 · lỗ WPA · ELO {elo(t)?.elo ?? 1200}
                {elo(t)?.games ? ` (${elo(t)!.wins}/${elo(t)!.games} thắng)` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
      {queue && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#ffd166]" />
          <span className="flex-1">
            Đang tìm đối thủ {queue.type === "eight" ? "8 bi" : "9 bi"} (ELO {queue.elo} ±{Math.round(100 + 25 * waited)})… {Math.round(waited)}s
          </span>
          <button type="button" onClick={() => void cancel()} className={`${ui.btnGhost} px-2! py-1! text-xs`}>
            <X className="h-4 w-4" /> Huỷ
          </button>
        </div>
      )}

      {/* Phòng riêng */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => void create()} disabled={busy} className={`${ui.btnPrimary} sm:flex-1`}>
          <Plus className="h-4 w-4" /> Tạo phòng riêng
        </button>
        <form
          className={`${ui.field} py-1.5! sm:flex-1`}
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c.length === 6) router.push(`/games/pool/room/${c}`);
            else toast.error("Mã phòng gồm 6 ký tự");
          }}
        >
          <Hash className="h-4 w-4 shrink-0 text-[#f4b942]" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Nhập mã phòng"
            aria-label="Mã phòng"
            className="w-full min-w-0 bg-transparent font-mono tracking-widest text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500"
          />
          <button type="submit" className="shrink-0 rounded-lg bg-[#f4b942] px-3 py-1 text-sm font-bold text-[#1a1206]">
            Vào
          </button>
        </form>
      </div>

      {/* Phòng công khai */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Phòng công khai</span>
          <button type="button" onClick={() => void refresh()} aria-label="Làm mới" className="rounded-lg p-1 text-slate-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Chưa có phòng nào — hãy tạo phòng hoặc ghép trận nhanh</p>
        ) : (
          <ul className="space-y-1.5">
            {rooms.map((r) => (
              <li key={r.code} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <span className="font-mono text-xs tracking-widest text-[#ffd166]">{r.code}</span>
                <span className="min-w-0 flex-1 truncate">
                  {r.settings.type === "eight" ? "8 bi" : "9 bi"} · chạm {r.settings.raceTo} · {POCKET_PRESETS[r.settings.pocketPreset]?.label} ·{" "}
                  {r.players.map((p) => p.name).join(" vs ")}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" /> {r.players.length}/2
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/games/pool/room/${r.code}`)}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold hover:bg-white/20"
                >
                  {r.status === "lobby" ? "Vào chơi" : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Xem
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lịch sử */}
      {!!me?.history.length && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <History className="h-4 w-4" /> Trận gần đây
          </div>
          <ul className="space-y-1">
            {me.history.slice(0, 8).map((m) => {
              const mine = m.players.find((p) => p.userId === myUserId);
              const won = mine && m.winner === mine.seat;
              const opp = m.players.find((p) => p.userId !== myUserId);
              return (
                <li key={m._id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-1.5 text-xs">
                  <span className={`w-10 font-black ${won ? "text-emerald-300" : "text-rose-300"}`}>{won ? "Thắng" : "Thua"}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {m.type === "eight" ? "8 bi" : "9 bi"} vs {opp?.name ?? "?"} · {m.score.join("–")}
                  </span>
                  {m.ranked && mine && m.eloChange && (
                    <span className="flex items-center gap-0.5 font-bold text-[#ffd166]">
                      <Trophy className="h-3 w-3" />
                      {m.eloChange[mine.seat] >= 0 ? "+" : ""}
                      {m.eloChange[mine.seat]}
                    </span>
                  )}
                  <span className="text-slate-500">{new Date(m.endedAt).toLocaleDateString("vi-VN")}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
