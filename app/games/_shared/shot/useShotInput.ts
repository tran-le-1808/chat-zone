"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HAPTIC, vibrate } from "./haptics";
import { crossedMilestone } from "./shotMath";
import { transition, type ShotEvent, type ShotState } from "./shotMachine";

export interface ShotInputOptions {
  /** Được phép đánh: đúng lượt, bi đã dừng, không chờ lựa chọn luật… */
  enabled: boolean;
  /** Mức kéo hiện tại (0 = cơ ở vị trí đầu) — game lưu vào aim.power để vẽ cơ lùi / gửi AIM_UPDATE */
  onPower: (d: number) => void;
  /** Thả tay đủ lực: đánh (d = mức kéo 0..1) */
  onShoot: (d: number) => void;
  /** Có cho đánh không (vd. cơ vướng băng)? Trả false thì thả tay = huỷ */
  canRelease?: () => boolean;
  /** Âm kéo cơ (pitch theo lực) */
  onTick?: (d: number) => void;
  haptics: boolean;
}

export interface ShotInput {
  state: ShotState;
  /** Đang mở bi lớn: khoá ngắm & kéo cơ */
  inputLocked: boolean;
  spinOpen: boolean;
  openSpin: () => boolean;
  closeSpin: () => void;
  aimStart: () => void;
  aimEnd: () => void;
  /** Bắt đầu kéo cơ; trả false nếu đang không được phép */
  pullStart: () => boolean;
  pullMove: (d: number) => void;
  pullRelease: (d: number) => void;
  pullCancel: () => void;
}

/**
 * Điều khiển đánh bi: 1 con trỏ kéo cơ → thả để đánh. Dùng chung cho thanh lực, phím Space
 * và kéo cơ trực tiếp trên bàn (chỉ 1 nguồn được kéo tại một thời điểm).
 */
export function useShotInput(opts: ShotInputOptions): ShotInput {
  const { enabled } = opts;
  const [state, setState] = useState<ShotState>(enabled ? "IDLE" : "LOCKED");
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  const ref = useRef<ShotState>(state);
  const optsRef = useRef(opts);
  const lastD = useRef(0);

  // Trạng thái "được phép đánh" đổi -> chuyển trạng thái (điều chỉnh ngay trong render, không cần effect)
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    setState((s) => transition(s, { type: "ENABLED", enabled }).state);
  }
  useEffect(() => {
    ref.current = state;
    optsRef.current = opts;
  });

  const dispatch = useCallback((ev: ShotEvent) => {
    const r = transition(ref.current, ev);
    ref.current = r.state;
    setState(r.state);
    const o = optsRef.current;
    if (r.effect?.type === "cancel") {
      lastD.current = 0;
      o.onPower(0);
    } else if (r.effect?.type === "shoot") {
      lastD.current = 0;
      vibrate(HAPTIC.shoot, o.haptics);
      o.onShoot(r.effect.d);
    }
    return r;
  }, []);

  const pullMove = useCallback((d: number) => {
    if (ref.current !== "PULLING") return;
    const o = optsRef.current;
    if (crossedMilestone(lastD.current, d) !== null) vibrate(HAPTIC.tick, o.haptics);
    lastD.current = d;
    o.onPower(d);
    o.onTick?.(d);
  }, []);

  return {
    state,
    inputLocked: state === "SPIN_EDIT",
    spinOpen: state === "SPIN_EDIT",
    openSpin: () => dispatch({ type: "SPIN_OPEN" }).accepted,
    closeSpin: () => void dispatch({ type: "SPIN_CLOSE" }),
    aimStart: () => void dispatch({ type: "AIM_START" }),
    aimEnd: () => void dispatch({ type: "AIM_END" }),
    pullStart: () => dispatch({ type: "PULL_START" }).accepted,
    pullMove,
    pullRelease: (d: number) => {
      if (ref.current !== "PULLING") return;
      const o = optsRef.current;
      // Cơ vướng: thả tay = huỷ (không đánh)
      if (o.canRelease && !o.canRelease()) {
        dispatch({ type: "PULL_CANCEL" });
        return;
      }
      dispatch({ type: "PULL_RELEASE", d });
    },
    pullCancel: () => void dispatch({ type: "PULL_CANCEL" }),
  };
}
