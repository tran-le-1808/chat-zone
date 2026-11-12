"use client";

import { useRoom } from "../../../monopoly/_context/RoomContext";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { useBilliard } from "../../_context/BilliardGameContext";
import { BALL_COLORS, MODE_LABEL } from "../../_lib/types";

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Kết quả trận: người thắng, điểm & thống kê từng người */
export default function ResultModal() {
  const { room, isHost, resetToLobby, leaveRoom } = useRoom();
  const { match, animating, myIndex } = useBilliard();
  if (!match || match.winner === null || animating || !room) return null;

  const winnerId = match.players[match.winner];
  const winner = room.players.find((p) => p.userId === winnerId);
  const iWon = myIndex === match.winner;
  const duration = (match.endedAt ?? match.startedAt) - match.startedAt;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1d2032] text-white shadow-2xl [@media(max-height:500px)]:max-w-xl">
        <div className="bg-gradient-to-r from-amber-500/30 to-emerald-500/20 px-6 py-5 text-center [@media(max-height:500px)]:py-3">
          <div className="text-4xl [@media(max-height:500px)]:text-2xl">
            {iWon ? "🏆" : myIndex >= 0 ? "🎱" : "🏁"}
          </div>
          <h2 className="mt-1 text-xl font-black">
            {iWon ? "Bạn đã thắng!" : `${winner?.name ?? "Đối thủ"} thắng!`}
          </h2>
          <p className="text-xs text-gray-300">
            {MODE_LABEL[match.mode]} · Chạm {match.target} · {fmtTime(duration)}
            {match.endReason ? ` · ${match.endReason}` : ""}
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left font-semibold">Người chơi</th>
              <th className="px-2 py-2 font-semibold">Điểm</th>
              <th className="px-2 py-2 font-semibold">Cú đánh</th>
              <th className="px-2 py-2 font-semibold">Chuỗi</th>
              <th
                className="px-2 py-2 font-semibold"
                title="Điểm trung bình mỗi lượt"
              >
                TB/lượt
              </th>
            </tr>
          </thead>
          <tbody>
            {match.players.map((uid, i) => {
              const p = room.players.find((rp) => rp.userId === uid);
              const st = match.stats[i];
              const avg = st.innings
                ? (st.points / st.innings).toFixed(2)
                : "0";
              return (
                <tr
                  key={uid}
                  className={`border-t border-white/5 ${i === match.winner ? "bg-amber-500/10" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar
                        name={p?.name ?? "?"}
                        avatar={p?.avatar}
                        size={26}
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: BALL_COLORS[i] }}
                      />
                      <span className="truncate font-semibold">
                        {p?.name ?? "Người chơi"}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-lg font-black">
                    {match.scores[i]}
                  </td>
                  <td className="px-2 py-2 text-center">{st.shots}</td>
                  <td className="px-2 py-2 text-center">{st.bestRun}</td>
                  <td className="px-2 py-2 text-center">{avg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex gap-2 p-4">
          {isHost ? (
            <button
              type="button"
              onClick={() => void resetToLobby()}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 font-black text-slate-900"
            >
              🔄 Chơi lại (về phòng chờ)
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl bg-white/5 py-3 text-xs text-gray-300">
              Chờ chủ phòng mở ván mới…
            </div>
          )}
          <button
            type="button"
            onClick={() => void leaveRoom()}
            className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold"
          >
            Rời phòng
          </button>
        </div>
      </div>
    </div>
  );
}
