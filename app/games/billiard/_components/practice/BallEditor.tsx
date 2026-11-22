"use client";

/**
 * Kéo thả bi trên bàn 3D (tự luyện). Mặt phẳng bắt thao tác nằm trên mặt ngắm nên chặn việc ngắm khi đang bật;
 * vị trí được trận cục bộ kiểm tra (trong bàn, không chồng bi) — không hợp lệ thì bi giữ chỗ cũ.
 */
import { useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { DEFAULT_PHYSICS, type BallId, type BallPositions } from "../../_lib/physics";
import { BALL_COLORS } from "../../_lib/types";

const R = DEFAULT_PHYSICS.ballRadius;
/** Bán kính bắt bi khi chạm (lớn hơn bi để dễ chạm trên điện thoại) */
const GRAB = R * 3;

export default function BallEditor({ balls, onMove }: { balls: BallPositions; onMove: (id: BallId, x: number, y: number) => void }) {
  const drag = useRef<{ id: BallId; pointer: number; dx: number; dy: number } | null>(null);
  const [active, setActive] = useState<BallId | null>(null);
  const at = (e: ThreeEvent<PointerEvent>) => ({ x: e.point.x, y: -e.point.z });
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const p = at(e);
          let best: BallId | null = null;
          let bd = GRAB;
          balls.forEach(([x, y], i) => {
            const d = Math.hypot(x - p.x, y - p.y);
            if (d < bd) {
              bd = d;
              best = i as BallId;
            }
          });
          // chặn ngắm / đánh khi đang ở chế độ đặt bi
          e.stopPropagation();
          if (best === null) return;
          const id: BallId = best;
          drag.current = { id, pointer: e.pointerId, dx: balls[id][0] - p.x, dy: balls[id][1] - p.y };
          setActive(id);
          (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointer !== e.pointerId) return;
          e.stopPropagation();
          const p = at(e);
          onMove(d.id, p.x + d.dx, p.y + d.dy);
        }}
        onPointerUp={(e) => {
          if (drag.current?.pointer !== e.pointerId) return;
          e.stopPropagation();
          drag.current = null;
          setActive(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setActive(null);
        }}
      >
        <planeGeometry args={[4, 2.4]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* vòng sáng quanh từng bi: báo hiệu kéo được */}
      {balls.map(([x, y], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, -y]}>
          <ringGeometry args={[R * 1.25, R * (active === i ? 1.75 : 1.5), 32]} />
          <meshBasicMaterial color={active === i ? "#ffd166" : BALL_COLORS[i]} transparent opacity={active === i ? 0.95 : 0.6} />
        </mesh>
      ))}
    </group>
  );
}
