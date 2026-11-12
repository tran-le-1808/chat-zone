"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import GameChat from "../../../monopoly/_components/GameChat";
import VoiceControls from "../../../monopoly/_components/VoiceControls";
import RotateDeviceOverlay from "../../../monopoly/_components/ui/RotateDeviceOverlay";
import { useBilliard } from "../../_context/BilliardGameContext";
import { BALL_COLORS, BALL_NAMES } from "../../_lib/types";
import { useIsPhoneLandscape } from "../../../monopoly/_components/ui/useScreen";
import ElevationControl from "./ElevationControl";
import BilliardScene from "./BilliardScene";
import Scoreboard from "./Scoreboard";
import ShotControls from "./ShotControls";
import ResultModal from "./ResultModal";
import SettingsPanel from "./SettingsPanel";

/** Thông tin đồng bộ / vật lý cho chế độ debug */
function DebugPanel() {
  const { match, animating, clockOffset } = useBilliard();
  const last = match?.lastShot;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[260px] rounded-xl bg-black/70 p-2 font-mono text-[10px] leading-relaxed text-emerald-200">
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
  const {
    match,
    lastVerdict,
    prefs,
    myIndex,
    aim,
    setAim,
    canShoot,
    displayTurn,
  } = useBilliard();
  const isLandscape = useIsPhoneLandscape();
  const [showSettings, setShowSettings] = useState(false);

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

  const handleLeave = () => {
    if (
      match &&
      match.winner === null &&
      myIndex >= 0 &&
      !window.confirm("Rời phòng giữa trận sẽ bị xử thua. Bạn chắc chắn chứ?")
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
      <header className="flex shrink-0 items-start gap-2 p-2 sm:p-3 [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:p-1">
        <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5 [@media(max-height:500px)]:gap-0.5 [@media(max-height:500px)]:rounded-xl [@media(max-height:500px)]:p-0.5">
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-xl px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
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
            className="rounded-xl px-2 py-1 text-sm hover:bg-white/10"
          >
            ⚙️
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <Scoreboard />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Điện thoại xoay ngang: cột trái hẹp chứa góc cơ + voice + nút chat (ở đáy) */}
        {isLandscape && (
          <aside className="flex min-h-0 w-16 shrink-0 flex-col items-center gap-1.5 overflow-hidden border-r border-white/10 bg-[#181a24] px-1 pb-[54px] pt-1.5">
            <ElevationControl
              orientation="vertical"
              value={aim.elevation}
              disabled={!canShoot}
              ballColor={BALL_COLORS[displayTurn]}
              onChange={(elevation) => setAim({ elevation })}
            />
            <VoiceControls variant="stack" />
          </aside>
        )}

        {/* Bàn bida: chiếm toàn bộ phần còn lại, camera tự canh vừa khung */}
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <BilliardScene />
          </div>
          {prefs.debug && <DebugPanel />}
        </div>

        {/* Cột điều khiển bên phải (không che bàn) */}
        <aside className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-[#181a24] p-3 [@media(max-height:500px)]:w-40 [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:p-1.5">
          {myIndex >= 0 && !isLandscape && (
            <div className="text-center text-[11px] text-gray-300">
              Bi cái của bạn: <b>{BALL_NAMES[myIndex]}</b>
            </div>
          )}
          <ShotControls showElevation={!isLandscape} />
          {!isLandscape && (
            <div className="mt-auto">
              <VoiceControls variant="lobby" />
            </div>
          )}
        </aside>
      </div>

      {/* Chat dạng modal (nút 💬 ở góc dưới bên trái bàn) */}
      <GameChat
        variant="modal"
        fabClassName="bottom-3 left-3 [@media(max-height:500px)]:bottom-2 [@media(max-height:500px)]:left-2 [@media(max-height:500px)]:h-11 [@media(max-height:500px)]:w-11 [@media(max-height:500px)]:text-xl"
      />

      <ResultModal />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
