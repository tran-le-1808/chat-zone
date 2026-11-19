"use client";

import { useState } from "react";
import { useBilliard } from "../../_context/BilliardGameContext";
import { BALL_COLORS } from "../../_lib/types";
import { DEFAULT_PHYSICS } from "../../_lib/physics";
import ShotHud, { ToolButton, ToolPopover } from "../../../_shared/shot/ShotHud";
import ElevationControl from "./ElevationControl";

/** Icon cây cơ bida chúc lên — nghiêng đúng theo góc nâng cơ hiện tại (0° nằm ngang, 90° dựng đứng) */
function CueTiltIcon({ deg }: { deg: number }) {
  const a = (Math.max(8, Math.min(85, deg)) * Math.PI) / 180;
  // đầu cơ chạm sát bi ở góc dưới phải, đuôi cơ chúc lên phía trên trái theo góc nâng
  const tip = { x: 17, y: 18 };
  const len = 17;
  const butt = { x: tip.x - Math.cos(a) * len, y: tip.y - Math.sin(a) * len };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <circle cx={20} cy={20.5} r={2.8} fill="#ffffff" />
      <line x1={butt.x} y1={butt.y} x2={tip.x} y2={tip.y} stroke="#f5c77e" strokeWidth={2.6} strokeLinecap="round" />
      <line x1={butt.x} y1={butt.y} x2={butt.x + (tip.x - butt.x) * 0.35} y2={butt.y + (tip.y - butt.y) * 0.35} stroke="#c0803c" strokeWidth={3.2} strokeLinecap="round" />
      <line x1={tip.x - Math.cos(a) * 1.6} y1={tip.y - Math.sin(a) * 1.6} x2={tip.x} y2={tip.y} stroke="#7dd3fc" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}

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
            ? "" // lượt đối thủ: chỉ còn thanh thời gian, không hiện chữ chờ
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
        <ToolButton label="Góc nâng cơ" bright active={elevOpen} disabled={!canShoot} onClick={() => setElevOpen((v) => !v)}>
          <CueTiltIcon deg={aim.elevation} />
          <span className="tabular-nums">{aim.elevation.toFixed(aim.elevation % 1 ? 1 : 0)}°</span>
        </ToolButton>
        <ToolPopover open={elevOpen} onClose={() => setElevOpen(false)} side="center" title="Góc nâng cơ">
          <ElevationControl value={aim.elevation} disabled={!canShoot} ballColor={cueColor} onChange={(elevation) => setAim({ elevation })} />
        </ToolPopover>
      </div>
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
      toolsAbove
      notice={notice}
    />
  );
}
