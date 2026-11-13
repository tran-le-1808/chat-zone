"use client";

import { useState } from "react";
import { Hand, Move, Shield, Target, TrendingUp, Undo2 } from "lucide-react";
import { POOL_PHYSICS as C } from "../_lib/physics/config";
import { computeStrike, sanitizeShot } from "../_lib/physics/cue";
import { PREVIEW_POWER } from "../../_shared/shot/shotMath";
import { ballCss } from "../_lib/ballArt";
import { groupCleared } from "../_lib/rules/common";
import ShotHud, { ToolButton, ToolPopover } from "../../_shared/shot/ShotHud";
import VoiceControls from "../../monopoly/_components/VoiceControls";
import { usePool } from "./PoolContext";

export function MiniBall({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[9px] font-black text-[#151515] shadow"
      style={{ width: size, height: size, ...ballCss(n) }}
    >
      {n > 0 && <span className="flex h-[60%] w-[60%] items-center justify-center rounded-full bg-[#fbf8ef] leading-none">{n}</span>}
    </span>
  );
}

/**
 * Dòng gợi ý trạng thái ("Chạm bàn để ngắm · kéo cơ để đánh", "Bi đang lăn…"…): hiển thị trên thanh trên (header)
 * để không phủ lên bàn.
 */
export function usePoolStatus(): string {
  const p = usePool();
  const { canShoot, rack, phase, placing } = p;
  const status =
    phase === "rolling"
      ? "Bi đang lăn…"
      : phase === "replay"
        ? "Đang xem lại cú đánh…"
        : phase === "thinking"
          ? p.online
            ? p.online.spectator
              ? "Đang xem trận đấu"
              : "Đối thủ đang ngắm…"
            : "Máy đang tính cú đánh…"
          : rack.decision
            ? "Chờ lựa chọn theo luật"
            : placing
              ? rack.ballInHand === "kitchen"
                ? "Kéo / chạm để đặt bi cái sau vạch đầu bàn"
                : "Kéo / chạm để đặt bi cái ở bất kỳ đâu"
              : p.arrange
                ? "Kéo bi bất kỳ để sắp thế bi"
                : canShoot
                  ? "Chạm bàn để ngắm · kéo cơ để đánh"
                  : "";
  return status;
}

/**
 * Điều khiển đánh bi Bida Lỗ (kiểu 8 Ball Pool): kéo cơ ở thanh bên rồi thả để đánh,
 * chạm bi cái nhỏ để chỉnh điểm chạm. Công cụ phụ (góc cơ, gọi bi, phòng thủ…) ở thanh đáy.
 */
export default function PoolControls({ onOpenCall }: { onOpenCall: () => void }) {
  const p = usePool();
  const { aim, setAim, canShoot, rack, phase, decl, setDecl, effectiveCall, needsCall, placing, setPlacing, practice, isHumanTurn, physics, table, clearance } = p;
  const [elevOpen, setElevOpen] = useState(false);

  const showCall = needsCall && isHumanTurn;
  const canSafety = !practice && rack.type === "eight" && !rack.isBreak && isHumanTurn;
  const canPush = !practice && rack.type === "nine" && rack.pushOutAvailable && !rack.isBreak && isHumanTurn && !rack.decision;
  const callingEight = rack.type === "eight" && !rack.openTable && groupCleared(rack, rack.turn);
  const idle = phase === "idle";
  // Cú đánh này có phải JUMP SHOT không (góc chúi đủ lớn để bi bật khỏi mặt bàn)?
  const willJump = canShoot && computeStrike(sanitizeShot({ ...aim, power: aim.power > 0.04 ? aim.power : PREVIEW_POWER }, physics), physics).jump;
  const blocked = !!clearance && !clearance.ok;
  const notice =
    blocked && canShoot ? (
      <div className="flex max-w-sm items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-950/85 px-3 py-1.5 text-xs text-amber-100 backdrop-blur">
        <span>⚠️ {clearance?.reason}</span>
        {clearance?.minElevation !== null && clearance?.minElevation !== undefined && (
          <button type="button" onClick={() => setAim({ elevation: clearance.minElevation ?? 80 })} className="min-h-9 shrink-0 rounded-lg bg-amber-400 px-2 font-bold text-slate-900">
            Nâng cơ tới {clearance.minElevation}°
          </button>
        )}
      </div>
    ) : undefined;

  const tools = (
    <>
      {rack.ballInHand && isHumanTurn && !rack.decision && idle && (
        <ToolButton label={placing ? "Xong — bắt đầu ngắm" : "Đặt lại bi cái"} active={placing} onClick={() => setPlacing(!placing)}>
          <Hand className="h-5 w-5" />
          {placing && <span>Xong</span>}
        </ToolButton>
      )}
      {showCall && (
        <ToolButton label={effectiveCall ? `Gọi bi ${effectiveCall.ball} → ${table.pockets[effectiveCall.pocket].name}` : callingEight ? "Gọi lỗ cho bi 8" : "Gọi bi"} disabled={!idle} onClick={onOpenCall} badge={decl.manual ? "✓" : undefined}>
          <Target className="h-5 w-5 text-[#ffd166]" />
          {effectiveCall ? <MiniBall n={effectiveCall.ball} size={20} /> : <span className="text-amber-300">?</span>}
        </ToolButton>
      )}
      {canSafety && (
        <ToolButton label="Phòng thủ (bi vào không được đánh tiếp)" active={decl.safety} disabled={!canShoot} onClick={() => setDecl({ safety: !decl.safety })}>
          <Shield className="h-5 w-5" />
        </ToolButton>
      )}
      {canPush && (
        <ToolButton label="Push out" active={decl.pushOut} disabled={!canShoot} onClick={() => setDecl({ pushOut: !decl.pushOut })}>
          <Move className="h-5 w-5" />
          <span>Push</span>
        </ToolButton>
      )}
      <div className="relative">
        <ToolButton label={willJump ? "Góc nâng cơ — cú đánh này là JUMP SHOT (bi sẽ bay)" : "Góc nâng cơ"} active={elevOpen} disabled={!canShoot} onClick={() => setElevOpen((v) => !v)} badge={willJump ? "Nhảy" : undefined}>
          <TrendingUp className="h-5 w-5" />
          <span className="tabular-nums">{aim.elevation.toFixed(0)}°</span>
        </ToolButton>
        <ToolPopover open={elevOpen} onClose={() => setElevOpen(false)}>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex justify-between">
              Góc nâng cơ <span className="tabular-nums text-white">{aim.elevation.toFixed(0)}°</span>
            </span>
            <input type="range" min={0} max={C.maxElevation} step={1} value={aim.elevation} onChange={(e) => setAim({ elevation: Number(e.target.value) })} className="h-8 w-full accent-[#f4b942]" />
          </label>
        </ToolPopover>
      </div>
      {practice && (
        <>
          {(["eight", "nine"] as const).map((t) => (
            <ToolButton key={t} label={`Xếp ${t === "eight" ? 8 : 9} bi`} disabled={!idle} onClick={() => p.practiceRerack(t)}>
              {t === "eight" ? "8" : "9"} bi
            </ToolButton>
          ))}
          <ToolButton label={p.arrange ? "Xong sắp bi" : "Sắp bi"} active={p.arrange} disabled={!idle} onClick={() => p.setArrange(!p.arrange)}>
            <Move className="h-5 w-5" />
          </ToolButton>
          <ToolButton label="Hoàn tác" disabled={!idle || !p.canUndo} onClick={p.undo}>
            <Undo2 className="h-5 w-5" />
          </ToolButton>
        </>
      )}
      {p.online && !p.online.spectator && <VoiceControls variant="stack" />}
    </>
  );

  return (
    <ShotHud
      shot={p.shot}
      enabled={canShoot}
      settings={p.shotSettings}
      power={aim.power}
      tipX={aim.tipX}
      tipY={aim.tipY}
      onTip={(tipX, tipY) => setAim({ tipX, tipY })}
      // Vòng an toàn = ngưỡng trượt cơ của engine (miscueOffset·R); engine cho phép tới maxTipOffset·R
      limits={{ maxFrac: physics.maxTipOffset, safeFrac: physics.miscueOffset }}
      ballColor="#f4efe1"
      onAimNudge={p.rotateAim}
      tools={tools}
      notice={notice}
    />
  );
}
