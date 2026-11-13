"use client";

import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import GameChat from "../../../monopoly/_components/GameChat";
import RotateDeviceOverlay from "../../../monopoly/_components/ui/RotateDeviceOverlay";
import { useBilliard } from "../../_context/BilliardGameContext";
import BilliardScene from "./BilliardScene";
import Scoreboard from "./Scoreboard";
import ShotControls, { useCaromStatus } from "./ShotControls";
import ResultModal from "./ResultModal";
import SettingsPanel from "./SettingsPanel";

/** Thông tin đồng bộ / vật lý cho chế độ debug */
function DebugPanel() {
  const { match, animating, clockOffset } = useBilliard();
  const last = match?.lastShot;
  return (
    <div className="pointer-events-none absolute left-24 top-2 z-20 max-w-[260px] rounded-xl bg-black/70 p-2 font-mono text-[10px] leading-relaxed text-emerald-200">
      <div>
        seq: {match?.seq} · lượt: {match?.turn} · lăn: {String(animating)}
      </div>
      <div>lệch đồng hồ server: {clockOffset} ms</div>
      {last && (
        <>
          <div>
            cú #{last.seq}: {last.duration.toFixed(2)}s · {last.frames.length}{" "}
            khung
          </div>
          <div>
            sự kiện: {last.events.filter((e) => e.type === "ball").length} bi ·{" "}
            {last.events.filter((e) => e.type === "cushion").length} băng
          </div>
          <div>
            luật: {last.verdict.reason} (bi cái {last.verdict.cueCushions} băng)
          </div>
          <div>
            lực {Math.round(last.shot.power * 100)}% · điểm chạm (
            {last.shot.tipX.toFixed(2)}, {last.shot.tipY.toFixed(2)})
          </div>
        </>
      )}
    </div>
  );
}

export default function BilliardGame() {
  const { code, room, leaveRoom } = useRoom();
  const { match, lastVerdict, prefs, myIndex } = useBilliard();
  const [showSettings, setShowSettings] = useState(false);
  const status = useCaromStatus();

  // Thông báo kết quả cú đánh (sau khi bi dừng)
  useEffect(() => {
    if (!lastVerdict || !room) return;
    const by = match?.players[lastVerdict.by];
    const name =
      lastVerdict.by === myIndex
        ? "Bạn"
        : (room.players.find((p) => p.userId === by)?.name ?? "Đối thủ");
    const v = lastVerdict.verdict;
    if (v.scored)
      toast.success(`🎯 ${name} +1 điểm — ${v.reason}`, { duration: 2500 });
    else toast(`${name} hụt: ${v.reason}`, { icon: "💨", duration: 2500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVerdict?.seq]);

  const handleLeave = async () => {
    if (
      match &&
      match.winner === null &&
      myIndex >= 0 &&
      !(await confirmDialog({
        title: "Rời phòng giữa trận?",
        message: "Rời phòng lúc này sẽ bị xử thua.",
        confirmText: "Rời phòng",
        cancelText: "Ở lại",
        tone: "danger",
      }))
    )
      return;
    void leaveRoom();
  };

  if (!match) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[#14161f] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
        <p className="text-sm text-gray-400">Đang tải bàn bida…</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[#14161f] text-white select-none">
      <RotateDeviceOverlay />
      {/* Thông báo trong trận: nhỏ gọn, hơi trong suốt, không chặn thao tác */}
      <style>{`
        [data-sonner-toaster] {
          width: 280px !important;
          opacity: 0.85;
          pointer-events: none;
        }
        [data-sonner-toast] {
          width: 100% !important;
          padding: 8px 12px !important;
          min-height: 0 !important;
          font-size: 12px !important;
          gap: 6px !important;
        }
        [data-sonner-toast] [data-close-button] { display: none !important; }
        @media (max-height: 500px) {
          [data-sonner-toaster] {
            width: 220px !important;
            top: 46px !important;
            right: 172px !important;
          }
          [data-sonner-toast] { padding: 5px 9px !important; font-size: 11px !important; }
        }
      `}</style>

      {/* Thanh trên (không đè lên bàn): phòng / cài đặt + bảng điểm */}
      <header className="flex shrink-0 items-center gap-1.5 px-1.5 py-1 [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-0.5">
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/10 bg-black/40 p-0.5">
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-lg px-1.5 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
            title="Rời phòng"
          >
            🚪<span className="hidden sm:inline"> Rời</span>
          </button>
          <span className="hidden font-mono text-xs tracking-widest text-cyan-300 sm:inline">
            {code}
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Cài đặt"
            className="rounded-lg px-1.5 py-1 text-sm hover:bg-white/10"
          >
            ⚙️
          </button>
        </div>
        <GameChat
          variant="modal"
          trigger={({ onClick, unread }) => (
            <button
              type="button"
              onClick={onClick}
              aria-label="Mở chat"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-slate-200 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c81d25] px-1 text-[9px] font-black text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          )}
        />
        {status && (
          <span title={status} className="hidden min-w-0 max-w-[30vw] shrink truncate rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-300 sm:block">
            {status}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Scoreboard />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Bàn bida: chiếm toàn bộ phần còn lại, camera tự canh vừa khung */}
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <BilliardScene />
          </div>
          {prefs.debug && <DebugPanel />}
          {/* Điều khiển đánh bi phủ lên bàn: thanh kéo cơ, bi cái nhỏ, ngắm tinh */}
          <ShotControls />
        </div>

      </div>

      <ResultModal />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
