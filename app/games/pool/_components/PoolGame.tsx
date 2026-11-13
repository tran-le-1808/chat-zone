"use client";

import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { useEffect } from "react";
import { Camera, Eye, Flag, History, LogOut, MessageCircle, Settings2, Timer, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import GameChat from "../../monopoly/_components/GameChat";
import RotateDeviceOverlay from "../../monopoly/_components/ui/RotateDeviceOverlay";
import ShotSettingsFields from "../../_shared/shot/ShotSettingsFields";
import PoolScene from "./PoolScene";
import PoolControls, { usePoolStatus } from "./PoolControls";
import { Banners, PocketTray, Scoreboard } from "./PoolHud";
import { CallPicker, DecisionDialog, RackOverDialog } from "./PoolDialogs";
import { PoolProvider, PoolValueProvider, usePool, type PoolController, type CameraMode, type GuideMode, type PoolSetup, type Prefs } from "./PoolContext";
import { POCKET_PRESETS } from "../_lib/physics/config";

const CAMERA_LABEL: Record<CameraMode, string> = { top: "Trên xuống", angle: "Nghiêng", behind: "Sau cơ" };
const GUIDE_LABEL: Record<GuideMode, string> = { basic: "Cơ bản", ghost: "Bi ma", full: "Đầy đủ" };
const NEXT_CAMERA: Record<CameraMode, CameraMode> = { top: "angle", angle: "behind", behind: "top" };
const NEXT_GUIDE: Record<GuideMode, GuideMode> = { basic: "ghost", ghost: "full", full: "basic" };

function IconBtn({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-40 [@media(max-height:500px)]:px-1 [@media(max-height:500px)]:py-0.5"
    >
      {children}
    </button>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-xl border px-2 py-1.5 text-xs font-bold transition ${value === v ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/5 text-slate-300"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Cài đặt hiển thị trong trận */
function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { prefs, setPrefs, setup } = usePool();
  const preset = POCKET_PRESETS[setup.config.pocketPreset ?? "wpa"];
  const set = <K extends keyof Prefs>(k: K) => (v: Prefs[K]) => setPrefs({ [k]: v } as Partial<Prefs>);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center [@media(max-height:500px)]:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-t-3xl border border-[#f4b942]/20 bg-[#11132a] p-4 text-white sm:rounded-3xl [@media(max-height:500px)]:rounded-3xl [@media(max-height:500px)]:p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#ffd166]">Cài đặt</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Màu nỉ</div>
          <Seg value={prefs.cloth} onChange={set("cloth")} options={[["green", "Xanh lá"], ["blue", "Xanh thi đấu"]]} />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chất lượng đồ hoạ</div>
          <Seg value={prefs.quality} onChange={set("quality")} options={[["low", "Thấp"], ["medium", "Trung bình"], ["high", "Cao"]]} />
          <p className="text-[11px] text-slate-500">Cao: bóng mềm 2048, ambient occlusion (GTAO), bloom nhẹ.</p>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <span>
            Camera theo bi cái khi đánh
            <span className="block text-[11px] text-slate-400">Góc nghiêng / sau cơ; xong lượt tự trở về góc mặc định</span>
          </span>
          <input type="checkbox" checked={prefs.followCam} onChange={(e) => setPrefs({ followCam: e.target.checked })} className="h-5 w-5 accent-[#f4b942]" />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <span>
            Debug hình học lỗ
            <span className="block text-[11px] text-slate-400">Vẽ đè mũi băng, điểm mũi lỗ, hố rơi</span>
          </span>
          <input type="checkbox" checked={prefs.debugPockets} onChange={(e) => setPrefs({ debugPockets: e.target.checked })} className="h-5 w-5 accent-[#f4b942]" />
        </label>
        <ShotSettingsFields />
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          Lỗ: <b className="text-white">{preset.label}</b> — góc {(preset.corner * 100).toFixed(2)} cm, giữa {(preset.side * 100).toFixed(2)} cm
          <span className="block text-[11px] text-slate-500">{preset.note}</span>
        </div>
      </div>
    </div>
  );
}

/** Đồng hồ cú đánh (server giữ giờ chuẩn, client chỉ hiển thị) */
function ShotClock() {
  const { online, phase } = usePool();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!online || !online.deadline) return null;
  const left = online.paused ? null : Math.max(0, Math.ceil((online.deadline - now) / 1000));
  const urgent = left !== null && left <= 10 && phase !== "rolling";
  return (
    <div className={`flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-black tabular-nums ${urgent ? "animate-pulse bg-rose-500/25 text-rose-200" : "bg-white/10 text-slate-200"}`} title="Thời gian còn lại của cú đánh">
      <Timer className="h-3.5 w-3.5" />
      {left === null ? "Tạm dừng" : `${left}s`}
    </div>
  );
}

function GameLayout({ onExit }: { onExit: () => void }) {
  const p = usePool();
  const [callOpen, setCallOpen] = useState(false);
  const status = usePoolStatus();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { prefs, setPrefs, practice, rack } = p;

  const online = p.online;
  const leave = async () => {
    if (online) {
      if (
        !online.spectator &&
        p.match.matchWinner === null &&
        !(await confirmDialog({
          title: "Rời phòng giữa trận?",
          message: "Rời phòng lúc này sẽ bị xử thua.",
          confirmText: "Rời phòng",
          cancelText: "Ở lại",
          tone: "danger",
        }))
      )
        return;
      online.leave();
      return;
    }
    if (
      !practice &&
      p.match.matchWinner === null &&
      rack.shotNo > 0 &&
      !(await confirmDialog({
        title: "Thoát giữa trận?",
        message: "Kết quả trận đang chơi sẽ không được lưu.",
        confirmText: "Thoát",
        cancelText: "Chơi tiếp",
        tone: "warning",
      }))
    )
      return;
    onExit();
  };
  const oppSeat = online ? 1 - Math.max(0, online.mySeat) : 0;
  const myTurnOnline = online && !online.spectator && p.isHumanTurn;

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[#0d0f1e] text-white select-none">
      <RotateDeviceOverlay />
      <header className="flex shrink-0 items-center gap-1.5 px-1.5 py-1 [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:py-0.5">
        <div className="flex shrink-0 items-center gap-0 rounded-xl border border-white/10 bg-black/40 p-0.5">
          <IconBtn onClick={() => void leave()} label="Thoát">
            <LogOut className="h-4 w-4 text-rose-300" />
          </IconBtn>
          <IconBtn onClick={() => setPrefs({ camera: NEXT_CAMERA[prefs.camera] })} label={`Góc nhìn: ${CAMERA_LABEL[prefs.camera]}`}>
            <Camera className="h-4 w-4" />
            <span className="hidden lg:inline">{CAMERA_LABEL[prefs.camera]}</span>
          </IconBtn>
          <IconBtn onClick={() => setPrefs({ guide: NEXT_GUIDE[prefs.guide] })} label={`Đường ngắm: ${GUIDE_LABEL[prefs.guide]}`}>
            <Eye className="h-4 w-4" />
            <span className="hidden lg:inline">{GUIDE_LABEL[prefs.guide]}</span>
          </IconBtn>
          <IconBtn onClick={p.replay} label="Xem lại cú vừa đánh" disabled={!p.hasReplay || p.phase !== "idle"}>
            <History className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => setSettingsOpen(true)} label="Cài đặt">
            <Settings2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => setPrefs({ sound: !prefs.sound })} label={prefs.sound ? "Tắt âm thanh" : "Bật âm thanh"}>
            {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </IconBtn>
        </div>
        {online && (
          <GameChat
            variant="modal"
            trigger={({ onClick, unread }) => (
              <button type="button" onClick={onClick} aria-label="Mở chat" className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-slate-200 hover:bg-white/10">
                <MessageCircle className="h-4 w-4" />
                {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c81d25] px-1 text-[9px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
              </button>
            )}
          />
        )}
        {status && (
          <span title={status} className="hidden min-w-0 max-w-[34vw] shrink truncate rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-300 sm:block">
            {status}
          </span>
        )}
        <Scoreboard />
        {online && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/10 bg-black/40 p-0.5">
            <ShotClock />
            {myTurnOnline && online.deadline > 0 && online.extensions[online.mySeat] > 0 && (
              <IconBtn onClick={online.extend} label="Gia hạn +30 giây (1 lần mỗi ván)">
                <span className="text-xs font-black text-[#ffd166]">+30s</span>
              </IconBtn>
            )}
            {!online.spectator && p.match.matchWinner === null && (
              <IconBtn onClick={online.resign} label="Xin thua">
                <Flag className="h-4 w-4 text-rose-300" />
              </IconBtn>
            )}
            <span className="hidden px-1 text-[10px] tabular-nums text-slate-500 lg:inline" title="Độ trễ mạng">{online.ping} ms</span>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <PoolScene />
          </div>
          <Banners />
          <PocketTray />
          <PoolControls onOpenCall={() => setCallOpen(true)} />
          {online && !online.connected[oppSeat] && !online.spectator && (
            <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center">
              <span className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-950/85 px-3 py-1.5 text-xs font-bold text-amber-100">
                <WifiOff className="h-4 w-4" /> Đối thủ mất kết nối — đang chờ kết nối lại (tối đa 60 giây)
              </span>
            </div>
          )}
          {online?.spectator && (
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-sky-200">👁 Đang xem</span>
          )}
        </div>
      </div>

      <DecisionDialog />
      {callOpen && <CallPicker onClose={() => setCallOpen(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      <RackOverDialog onExit={online ? online.leave : onExit} />
    </div>
  );
}

/** Bàn chơi online: bộ điều khiển do server điều phối */
export function PoolOnlineView({ controller }: { controller: PoolController }) {
  return (
    <PoolValueProvider value={controller}>
      <GameLayout onExit={controller.online?.leave ?? (() => {})} />
    </PoolValueProvider>
  );
}

export default function PoolGame({ setup, onExit }: { setup: PoolSetup; onExit: () => void }) {
  return (
    <PoolProvider setup={setup}>
      <GameLayout onExit={onExit} />
    </PoolProvider>
  );
}
