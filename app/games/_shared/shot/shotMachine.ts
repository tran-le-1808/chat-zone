/**
 * Máy trạng thái của điều khiển đánh bi (thuần, test được):
 *   LOCKED → IDLE ⇄ AIMING → SPIN_EDIT (bi lớn) / PULLING → SHOOTING → LOCKED
 * Mỗi sự kiện trả về trạng thái mới + (nếu có) hiệu ứng cần thực hiện.
 */
export type ShotState = "LOCKED" | "IDLE" | "AIMING" | "SPIN_EDIT" | "PULLING" | "SHOOTING";

export type ShotEvent =
  | { type: "ENABLED"; enabled: boolean }
  | { type: "AIM_START" }
  | { type: "AIM_END" }
  | { type: "SPIN_OPEN" }
  | { type: "SPIN_CLOSE" }
  | { type: "PULL_START" }
  | { type: "PULL_RELEASE"; d: number }
  | { type: "PULL_CANCEL" };

export type ShotEffect = { type: "shoot"; d: number } | { type: "cancel" } | null;

export interface Transition {
  state: ShotState;
  effect: ShotEffect;
  /** Sự kiện có được chấp nhận không (vd. PULL_START bị từ chối khi đang mở bi lớn) */
  accepted: boolean;
}

/** Kéo dưới ngưỡng này rồi thả = huỷ */
export const SHOT_CANCEL_THRESHOLD = 0.05;

export function transition(state: ShotState, ev: ShotEvent, cancelThreshold = SHOT_CANCEL_THRESHOLD): Transition {
  const keep = (accepted: boolean): Transition => ({ state, effect: null, accepted });
  const to = (s: ShotState, effect: ShotEffect = null): Transition => ({ state: s, effect, accepted: true });

  switch (ev.type) {
    case "ENABLED":
      if (!ev.enabled) return to("LOCKED", state === "PULLING" ? { type: "cancel" } : null);
      // Được phép đánh lại (kể cả khi lệnh trước bị server từ chối -> SHOOTING về IDLE)
      return state === "LOCKED" || state === "SHOOTING" ? to("IDLE") : keep(true);
    case "AIM_START":
      return state === "IDLE" ? to("AIMING") : keep(state === "AIMING" || state === "PULLING");
    case "AIM_END":
      return state === "AIMING" ? to("IDLE") : keep(true);
    case "SPIN_OPEN":
      return state === "IDLE" || state === "AIMING" ? to("SPIN_EDIT") : keep(false);
    case "SPIN_CLOSE":
      return state === "SPIN_EDIT" ? to("IDLE") : keep(true);
    case "PULL_START":
      return state === "IDLE" || state === "AIMING" ? to("PULLING") : keep(false);
    case "PULL_RELEASE":
      if (state !== "PULLING") return keep(false);
      return ev.d >= cancelThreshold ? to("SHOOTING", { type: "shoot", d: ev.d }) : to("IDLE", { type: "cancel" });
    case "PULL_CANCEL":
      return state === "PULLING" ? to("IDLE", { type: "cancel" }) : keep(true);
  }
}
