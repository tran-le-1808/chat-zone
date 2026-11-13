"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { useBilliard } from "../../_context/BilliardGameContext";
import { BALL_COLORS } from "../../_lib/types";
import { DEFAULT_PHYSICS } from "../../_lib/physics";
import ShotHud, { ToolButton, ToolPopover } from "../../../_shared/shot/ShotHud";
import VoiceControls from "../../../monopoly/_components/VoiceControls";
import ElevationControl from "./ElevationControl";

/** Dòng gợi ý trạng thái: hiển thị trên thanh trên (header) để không phủ lên bàn */
export function useCaromStatus(): string {
  const { match, canShoot, isMyTurn, animating, shooting } = useBilliard();
  const status = !match
    ? ""
    : match.winner !== null
      ? "Trận đấu đã kết thúc"
      : animating
        ? "Bi đang lăn..."
        : shooting
          ? "Đang gửi cú đánh..."
          : !isMyTurn
            ? "Đang chờ đối thủ đánh"
            : !canShoot
              ? "Chờ bi dừng hẳn..."
              : "Chạm bàn để ngắm · kéo cơ để đánh";
  return status;
}

/**
 * Điều khiển đánh bi Carom (kiểu 8 Ball Pool): kéo cơ ở thanh bên rồi thả để đánh,
 * chạm bi cái nhỏ để chỉnh điểm chạm (xoáy). Không có nút "Đánh".
 */
export default function ShotControls() {
  const { aim, setAim, canShoot, displayTurn, shot, shotSettings, rotateAim, clearance } = useBilliard();
  const [elevOpen, setElevOpen] = useState(false);
  const blocked = !!clearance && !clearance.ok;
  const cueColor = BALL_COLORS[displayTurn];

  const notice =
    blocked && canShoot ? (
      <div className="flex max-w-sm items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-950/85 px-3 py-1.5 text-xs text-amber-100 backdrop-blur">
        <span>⚠️ {clearance?.reason}</span>
        {clearance?.minElevation !== null && clearance?.minElevation !== undefined && (
          <button type="button" onClick={() => setAim({ elevation: clearance.minElevation ?? 90 })} className="min-h-9 shrink-0 rounded-lg bg-amber-400 px-2 font-bold text-slate-900">
            Nâng cơ tới {clearance.minElevation}°
          </button>
        )}
      </div>
    ) : undefined;

  const tools = (
    <>
      <div className="relative">
        <ToolButton label="Góc nâng cơ" active={elevOpen} disabled={!canShoot} onClick={() => setElevOpen((v) => !v)}>
          <TrendingUp className="h-5 w-5" />
          <span className="tabular-nums">{aim.elevation.toFixed(aim.elevation % 1 ? 1 : 0)}°</span>
        </ToolButton>
        <ToolPopover open={elevOpen} onClose={() => setElevOpen(false)}>
          <ElevationControl value={aim.elevation} disabled={!canShoot} ballColor={cueColor} onChange={(elevation) => setAim({ elevation })} />
        </ToolPopover>
      </div>
      <VoiceControls variant="stack" />
    </>
  );

  return (
    <ShotHud
      shot={shot}
      enabled={canShoot}
      settings={shotSettings}
      power={aim.power}
      tipX={aim.tipX}
      tipY={aim.tipY}
      onTip={(tipX, tipY) => setAim({ tipX, tipY })}
      // Carom không có luật trượt cơ: cả đĩa tối đa (0.55R) là vùng an toàn
      limits={{ maxFrac: DEFAULT_PHYSICS.maxTipOffset, safeFrac: DEFAULT_PHYSICS.maxTipOffset }}
      ballColor={cueColor}
      onAimNudge={rotateAim}
      tools={tools}
      notice={notice}
    />
  );
}
