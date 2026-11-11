"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { useAppSelector } from "@/redux/hooks";
import { INITIAL_PLAYERS } from "@/types/game.types";
import {
  JoinResult,
  MONOPOLY_MAX_PLAYERS,
  RoomInfo,
} from "@/types/monopoly-room";
import PlayerAvatar from "../PlayerAvatar";

const CODE_LENGTH = 6;

export default function LobbyBrowser() {
  const router = useRouter();
  const { user, loading } = useAppSelector((state) => state.auth);

  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [myRoom, setMyRoom] = useState<RoomInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const connected = await waitForSocket();
    if (!connected) {
      setRefreshing(false);
      return;
    }
    const [list, mine] = await Promise.all([
      monoEmit<RoomInfo[]>("mono:list"),
      monoEmit<RoomInfo | null>("mono:myRoom"),
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
    const res = await monoEmit<JoinResult>("mono:create");
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Không tạo được phòng");
      return;
    }
    router.push(`/games/monopoly/room/${res.data.room.code}`);
  };

  const joinByCode = (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== CODE_LENGTH) {
      toast.error(`Mã phòng gồm ${CODE_LENGTH} ký tự`);
      return;
    }
    router.push(`/games/monopoly/room/${normalized}`);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1c2b] p-4 text-white">
        {loading ? (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        ) : (
          <div className="space-y-4 text-center">
            <div className="text-5xl">🔐</div>
            <p className="text-gray-300">Bạn cần đăng nhập để chơi online</p>
            <Link
              href="/login"
              className="inline-block rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 px-6 py-3 font-bold"
            >
              Đăng nhập
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1c2b] p-4 text-white md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/games"
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Khu vực trò chơi
            </Link>
            <h1 className="mt-1 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-3xl font-extrabold text-transparent">
              🎩 Cờ Tỷ Phú Online
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Tạo phòng, mời bạn bè bằng mã và cùng nhau trở thành tỷ phú (2 - 4
              người)
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#262a40] px-4 py-2">
            <PlayerAvatar name={user.name} avatar={user.avatar} size={36} />
            <div className="text-sm">
              <div className="text-xs text-gray-400">Chơi với tên</div>
              <div className="font-bold">{user.name}</div>
            </div>
          </div>
        </div>

        {/* ĐANG Ở PHÒNG KHÁC */}
        {myRoom && (
          <div className="flex flex-col gap-3 rounded-3xl border border-amber-400/40 bg-amber-500/10 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              Bạn đang ở phòng{" "}
              <span className="font-mono font-bold tracking-widest text-amber-300">
                {myRoom.code}
              </span>{" "}
              ({myRoom.status === "playing" ? "đang chơi" : "đang chờ"})
            </div>
            <div className="flex gap-2">
              <Link
                href={`/games/monopoly/room/${myRoom.code}`}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900"
              >
                Quay lại phòng
              </Link>
              <button
                onClick={async () => {
                  await monoEmit("mono:leave");
                  void refresh();
                }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Rời phòng
              </button>
            </div>
          </div>
        )}

        {/* CREATE / JOIN */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-3xl border border-white/10 bg-[#262a40] p-6">
            <h2 className="text-lg font-bold">🏠 Tạo phòng mới</h2>
            <p className="text-sm text-gray-400">
              Bạn sẽ là chủ phòng: mời bạn bè bằng mã, chỉnh luật chơi và kick
              người chơi.
            </p>
            <button
              disabled={busy}
              onClick={() => void createRoom()}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 py-3 font-bold transition hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {busy ? "Đang tạo..." : "Tạo phòng"}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinByCode(code);
            }}
            className="space-y-3 rounded-3xl border border-white/10 bg-[#262a40] p-6"
          >
            <h2 className="text-lg font-bold">🔑 Vào phòng bằng mã</h2>
            <input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, CODE_LENGTH),
                )
              }
              placeholder="VD: K7M2QX"
              className="w-full rounded-2xl border border-cyan-400/60 bg-[#1d2032] px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={code.length !== CODE_LENGTH}
              className="w-full rounded-2xl bg-white/10 py-3 font-bold transition hover:bg-white/20 disabled:opacity-40"
            >
              Vào phòng
            </button>
          </form>
        </div>

        {/* PUBLIC ROOMS */}
        <div className="rounded-3xl border border-white/10 bg-[#262a40] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">🌐 Phòng đang chờ người chơi</h2>
            <button
              onClick={() => void refresh()}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              {refreshing ? "Đang tải..." : "🔄 Làm mới"}
            </button>
          </div>

          {rooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Chưa có phòng công khai nào. Hãy tạo phòng đầu tiên! 🎲
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rooms.map((r) => {
                const host = r.players.find((p) => p.userId === r.hostId);
                return (
                  <div
                    key={r.code}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1d2032] p-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold">
                        Phòng của {host?.name ?? "?"}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        <span className="font-mono">{r.code}</span> · $
                        {r.settings.startingMoney.toLocaleString()}
                      </div>
                      <div className="mt-2 flex -space-x-2">
                        {r.players.map((p) => (
                          <PlayerAvatar
                            key={p.userId}
                            name={p.name}
                            avatar={p.avatar}
                            color={INITIAL_PLAYERS[p.seat]?.color}
                            size={26}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-400">
                        {r.players.length}/{MONOPOLY_MAX_PLAYERS}
                      </span>
                      <button
                        onClick={() => joinByCode(r.code)}
                        className="rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-2 text-sm font-bold"
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
