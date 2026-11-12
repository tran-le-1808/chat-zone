"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleDot,
  DoorOpen,
  Globe,
  KeyRound,
  LogIn,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { ui } from "@/components/ui/styles";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { authUrlWithRedirect } from "@/lib/redirect";
import { useAppSelector } from "@/redux/hooks";
import type { RoomInfo } from "@/types/monopoly-room";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import {
  BILLIARD_MAX_PLAYERS,
  MODE_LABEL,
  type BilliardSettings,
} from "../../_lib/types";

const CODE_LENGTH = 6;
const settingsOf = (r: RoomInfo) => r.settings as unknown as BilliardSettings;

/** Sảnh Bida Carom: tạo phòng / vào bằng mã / danh sách phòng công khai */
export default function BilliardLobby() {
  const router = useRouter();
  const { user, loading } = useAppSelector((state) => state.auth);
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [myRoom, setMyRoom] = useState<RoomInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    if (!(await waitForSocket())) {
      setRefreshing(false);
      return;
    }
    const [list, mine] = await Promise.all([
      monoEmit<RoomInfo[]>("bida:list"),
      monoEmit<RoomInfo | null>("bida:myRoom"),
    ]);
    if (list.ok) setRooms(list.data ?? []);
    if (mine.ok) setMyRoom(mine.data ?? null);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(() => void refresh(), 10000);
    return () => clearInterval(id);
  }, [user?._id, refresh]);

  const createRoom = async () => {
    setBusy(true);
    const res = await monoEmit<{ room: RoomInfo }>("bida:create");
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Không tạo được phòng");
      return;
    }
    router.push(`/games/billiard/room/${res.data.room.code}`);
  };

  const joinByCode = (value: string) => {
    const c = value.trim().toUpperCase();
    if (c.length !== CODE_LENGTH) {
      toast.error("Mã phòng gồm 6 ký tự");
      return;
    }
    router.push(`/games/billiard/room/${c}`);
  };

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-20 text-white">
        {loading ? (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4b942] border-t-transparent" />
        ) : (
          <div className={`space-y-4 px-8 py-10 text-center ${ui.card}`}>
            <div className="text-5xl">🔐</div>
            <p className="text-slate-300">Bạn cần đăng nhập để chơi online</p>
            <Link
              href={authUrlWithRedirect("/login", "/games/billiard")}
              className={ui.btnPrimary}
            >
              <LogIn className="h-5 w-5" /> Đăng nhập
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full px-3 py-5 text-white sm:px-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/games"
              className={`${ui.btnGhost} -ml-2 px-3! py-1.5! text-sm`}
            >
              <ArrowLeft className="h-4 w-4" /> Khu vực trò chơi
            </Link>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_4px_0_#7f1118]">
                <CircleDot className="h-6 w-6" />
              </span>
              <span className={ui.goldText}>Bida Carom Online</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Bàn 3 bi không lỗ — đấu 1 vs 1 theo luật Phăng hoặc 3 băng, có
              chat & voice trong phòng
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-[#f4b942]/20 bg-[#11132a]/85 px-4 py-2 md:self-auto">
            <PlayerAvatar name={user.name} avatar={user.avatar} size={36} />
            <div className="text-sm">
              <div className="text-xs text-slate-400">Chơi với tên</div>
              <div className="font-bold">{user.name}</div>
            </div>
          </div>
        </div>

        {myRoom && (
          <div className="flex flex-col gap-3 rounded-3xl border border-[#f4b942]/40 bg-[#f4b942]/10 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              Bạn đang ở phòng{" "}
              <span className="font-mono font-bold tracking-widest text-[#ffd166]">
                {myRoom.code}
              </span>{" "}
              ({myRoom.status === "playing" ? "đang chơi" : "đang chờ"})
            </div>
            <div className="flex gap-2">
              <Link
                href={`/games/billiard/room/${myRoom.code}`}
                className={`${ui.btnPrimary} flex-1 px-4! py-2! text-sm md:flex-none`}
              >
                Quay lại phòng
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await monoEmit("bida:leave");
                  void refresh();
                }}
                className={`${ui.btnGhost} flex-1 border border-white/10 px-4! py-2! text-sm md:flex-none`}
              >
                Rời phòng
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className={`space-y-3 p-5 sm:p-6 ${ui.card}`}>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Plus className="h-5 w-5 text-[#f4b942]" /> Tạo phòng mới
            </h2>
            <p className="text-sm text-slate-400">
              Bạn là chủ phòng: chọn luật chơi, số điểm thắng và mời bạn bè bằng
              mã phòng.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createRoom()}
              className={`${ui.btnPrimary} w-full`}
            >
              <DoorOpen className="h-5 w-5" />
              {busy ? "Đang tạo…" : "Tạo phòng"}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinByCode(code);
            }}
            className={`space-y-3 p-5 sm:p-6 ${ui.card}`}
          >
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <KeyRound className="h-5 w-5 text-[#f4b942]" /> Vào phòng bằng mã
            </h2>
            <input
              value={code}
              aria-label="Mã phòng"
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, CODE_LENGTH),
                )
              }
              placeholder="VD: K7M2QX"
              className="w-full rounded-2xl border border-[#f4b942]/40 bg-white/[0.04] px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-[#ffd166] outline-none transition focus:border-[#f4b942] focus:shadow-[0_0_0_3px_rgba(244,185,66,0.12)] sm:text-2xl placeholder:text-base placeholder:tracking-normal placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={code.length !== CODE_LENGTH}
              className={`${ui.btnGold} w-full disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0`}
            >
              Vào phòng
            </button>
          </form>
        </div>

        <div className={`p-5 sm:p-6 ${ui.card}`}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Globe className="h-5 w-5 text-[#f4b942]" /> Phòng đang chờ
            </h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className={`${ui.btnGhost} border border-white/10 px-3! py-1.5! text-xs`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
          </div>
          {rooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Chưa có phòng công khai nào. Hãy tạo phòng đầu tiên! 🎱
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rooms.map((r) => {
                const host = r.players.find((p) => p.userId === r.hostId);
                const st = settingsOf(r);
                return (
                  <div
                    key={r.code}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#f4b942]/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold">
                        Phòng của {host?.name ?? "?"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        <span className="font-mono">{r.code}</span> ·{" "}
                        {MODE_LABEL[st.mode]} · chạm {st.target}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="h-3.5 w-3.5" />
                        {r.players.length}/{BILLIARD_MAX_PLAYERS}
                      </span>
                      <button
                        type="button"
                        onClick={() => joinByCode(r.code)}
                        className={`${ui.btnPrimary} px-4! py-2! text-sm`}
                      >
                        Vào
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
