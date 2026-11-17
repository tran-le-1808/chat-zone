"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, Swords } from "lucide-react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import type { BilliardRoomExtra } from "../../_lib/lobbyTypes";
import { MODE_LABEL, type BilliardSettings } from "../../_lib/types";

const KIND_LABEL: Record<BilliardRoomExtra["kind"], string> = {
  casual: "Đấu thường",
  quick: "Trận nhanh",
  ranked: "Trận xếp hạng",
  tournament: "Trận giải đấu",
};

/** Phòng của trận ghép tự động / giải đấu: chờ đủ 2 người rồi server tự bắt đầu */
export default function MatchLobbyScreen() {
  const { room, myUserId, leaveRoom } = useRoom();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  if (!room) return null;
  const extra = room as unknown as BilliardRoomExtra;
  const settings = room.settings as unknown as BilliardSettings;
  const deadline = extra.meta?.joinDeadline ?? null;
  const remain = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const leave = async () => {
    const ok = await confirmDialog({
      title: "Rời trận?",
      message: "Rời phòng trận ghép / giải đấu bị tính là thua (và mất điểm xếp hạng nếu là trận xếp hạng).",
      tone: "danger",
      confirmText: "Rời & chịu thua",
    });
    if (ok) await leaveRoom();
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,#14532d_0%,#0b1a14_50%,#070b10_100%)] p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-[#f4b942]/30 bg-[#11132a]/95 p-6 text-center shadow-2xl">
        <Swords className="mx-auto h-9 w-9 text-[#ffd166]" />
        <h1 className="mt-2 text-2xl font-black">{KIND_LABEL[extra.kind]}</h1>
        <p className="text-sm text-slate-400">
          {MODE_LABEL[settings.mode]} · Chạm {settings.target} điểm
        </p>
        <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {room.players
            .slice()
            .sort((a, b) => a.seat - b.seat)
            .map((p, i) => (
              <div key={p.userId} className={`flex flex-col items-center gap-1 ${i === 1 ? "order-3" : ""}`}>
                <PlayerAvatar name={p.name} avatar={p.avatar} size={60} />
                <p className="max-w-full truncate font-bold">
                  {p.name}
                  {p.userId === myUserId ? " (bạn)" : ""}
                </p>
                <p className={`text-xs font-bold ${p.connected ? "text-emerald-300" : "text-slate-500"}`}>{p.connected ? "Đã vào" : "Đang vào…"}</p>
              </div>
            ))}
          <span className="order-2 text-xl font-black text-[#ffd166]">VS</span>
        </div>
        <p className="flex items-center justify-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Trận tự bắt đầu khi cả hai đã vào phòng
        </p>
        {remain !== null && <p className="mt-1 text-xs text-slate-500">Quá {remain}s mà đối thủ chưa vào: bạn được xử thắng</p>}
        <button type="button" onClick={() => void leave()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">
          <LogOut className="h-4 w-4" /> Rời trận
        </button>
      </div>
    </div>
  );
}
