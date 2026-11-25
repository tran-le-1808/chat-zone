"use client";

/** Dữ liệu sảnh online Bida Lỗ: phòng công khai, ELO & lịch sử, ghép trận nhanh, tạo phòng */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import API from "@/lib/api";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import type { PoolRoomSettingsUI } from "./PoolWaitingRoom";

export type PoolType = "eight" | "nine";

export interface PoolPublicRoom {
  code: string;
  status: "lobby" | "playing" | "finished";
  settings: PoolRoomSettingsUI;
  players: { userId: string; name: string }[];
  spectators: number;
}
export interface PoolRating {
  eight: { elo: number; games: number; wins: number };
  nine: { elo: number; games: number; wins: number };
}
export interface PoolMatchRow {
  _id: string;
  type: string;
  ranked: boolean;
  players: { userId: string; name: string; seat: number }[];
  score: number[];
  winner: number;
  eloChange?: number[];
  endedAt: string;
}
export interface PoolQueue {
  type: PoolType;
  elo: number;
  since: number;
}

export function usePoolLobby(enabled: boolean) {
  const router = useRouter();
  const [rooms, setRooms] = useState<PoolPublicRoom[]>([]);
  const [me, setMe] = useState<{ rating: PoolRating; history: PoolMatchRow[] } | null>(null);
  const [queue, setQueue] = useState<PoolQueue | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowTs, setNowTs] = useState(0);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<PoolPublicRoom[]>("pool:list");
    if (r.ok) setRooms(r.data ?? []);
  }, []);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, refresh, router]);

  useEffect(() => {
    if (!queue) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = useCallback(async (type: PoolType) => {
    const r = await monoEmit<{ elo: number }>("pool:quick", { type });
    if (!r.ok) {
      toast.error(r.error ?? "Không vào hàng chờ được");
      return false;
    }
    const since = Date.now();
    setNowTs(since);
    setQueue({ type, elo: r.data?.elo ?? 1200, since });
    return true;
  }, []);

  const cancel = useCallback(async () => {
    await monoEmit("pool:quick:cancel");
    setQueue(null);
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("pool:create", { type: "eight", raceTo: 3, isPrivate: false });
    setBusy(false);
    if (!r.ok || !r.data) {
      toast.error(r.error ?? "Không tạo được phòng");
      return;
    }
    router.push(`/games/pool/room/${r.data.room.code}`);
  }, [router]);

  const join = useCallback(
    (code: string) => {
      const c = code.trim().toUpperCase();
      if (c.length !== 6) {
        toast.error("Mã phòng gồm 6 ký tự");
        return;
      }
      router.push(`/games/pool/room/${c}`);
    },
    [router],
  );

  const waited = queue ? Math.max(0, (nowTs - queue.since) / 1000) : 0;
  return { rooms, me, queue, busy, waited, refresh, quick, cancel, create, join };
}
