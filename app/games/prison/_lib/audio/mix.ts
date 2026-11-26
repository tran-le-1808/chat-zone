/** Tính toán trộn âm thuần (test được bằng Node): bus, khoảng cách, tường cản, chống lặp, ducking. */

export type Bus = "music" | "sfx" | "voice";

export interface MixSettings {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muted: Record<Bus, boolean>;
  muteWhenHidden: boolean;
}

export const DEFAULT_MIX: MixSettings = {
  master: 0.8,
  music: 0.55,
  sfx: 0.8,
  voice: 0.7,
  muted: { music: false, sfx: false, voice: false },
  muteWhenHidden: true,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export function sanitizeMix(m: Partial<MixSettings> | null | undefined): MixSettings {
  const d = DEFAULT_MIX;
  return {
    master: clamp01(m?.master ?? d.master),
    music: clamp01(m?.music ?? d.music),
    sfx: clamp01(m?.sfx ?? d.sfx),
    voice: clamp01(m?.voice ?? d.voice),
    muted: { music: !!m?.muted?.music, sfx: !!m?.muted?.sfx, voice: !!m?.muted?.voice },
    muteWhenHidden: m?.muteWhenHidden ?? d.muteWhenHidden,
  };
}

/** Hệ số cuối cùng của một bus (0 nếu tắt tiếng riêng / ẩn tab) */
export function busGain(m: MixSettings, bus: Bus, hidden: boolean): number {
  if (m.muted[bus] || (hidden && m.muteWhenHidden)) return 0;
  return clamp01(m.master * m[bus]);
}

/** Suy giảm theo khoảng cách (gần rõ, xa nhỏ dần), bị tường cản thì nhỏ hơn */
export function attenuate(distance: number, maxDistance: number, occluded: boolean): number {
  if (distance >= maxDistance) return 0;
  const k = 1 - distance / maxDistance;
  return clamp01(k * k * (occluded ? 0.35 : 1));
}

/** Âm ưu tiên (chuông, còi) đang phát -> hạ nhạc nền và hiệu ứng thường */
export function duckFactor(priorityActive: boolean): number {
  return priorityActive ? 0.35 : 1;
}

/** Chặn cùng một âm lặp lại trong `windowMs` (mặc định 150 ms) */
export class RepeatGuard {
  private last = new Map<string, number>();
  private readonly windowMs: number;
  constructor(windowMs = 150) {
    this.windowMs = windowMs;
  }
  allow(key: string, nowMs: number): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && nowMs - prev < this.windowMs) return false;
    this.last.set(key, nowMs);
    return true;
  }
}

/** Tổng hệ số các nguồn phát cùng lúc không vượt ngưỡng (tránh méo trước bộ nén) */
export function headroom(gains: number[], ceiling = 0.9): number {
  const sum = gains.reduce((a, b) => a + b, 0);
  return sum <= ceiling ? 1 : ceiling / sum;
}

export type Surface = "stone" | "wood" | "metal" | "grass";

export function surfaceFor(zone: string | null, tile: string): Surface {
  if (tile === "," || tile === "o" || zone === "yard" || zone === "outside") return "grass";
  if (zone === "library" || zone === "dorm" || zone?.startsWith("cell_")) return "wood";
  if (zone === "workshop" || zone === "laundry" || tile === "V") return "metal";
  return "stone";
}

/** Chọn nhạc nền theo khu vực & giờ (mỗi khu một biến thể: gym nhanh, thư viện nhẹ, xà lim đêm rất nhẹ) */
export type MusicMood = "calm" | "work" | "gym" | "library" | "tense" | "night" | "silent";

export function moodFor(zone: string | null, hour: number, restricted: boolean): MusicMood {
  if (restricted) return "tense";
  if (hour >= 21 || hour < 6) return zone?.startsWith("cell_") ? "silent" : "night";
  if (zone === "gym") return "gym";
  if (zone === "library") return "library";
  if (zone === "workshop" || zone === "laundry") return "work";
  return "calm";
}

/** Bố cục nhạc: mỗi đoạn 4 ô nhịp, luân phiên A-B-A-C (3 đoạn khác nhau, không lặp lộ liễu) */
export const SECTION_PATTERN = [0, 1, 0, 2] as const;
export const BARS_PER_SECTION = 4;
export function sectionAt(bar: number): number {
  const i = Math.floor(Math.max(0, bar) / BARS_PER_SECTION) % SECTION_PATTERN.length;
  return SECTION_PATTERN[i];
}

/** Thời gian chuyển nhạc mượt khi đổi khu / trạng thái (giây) */
export const CROSSFADE_SECONDS = 1.5;
/** Tắt còi mượt (giây) */
export const SIREN_FADE_SECONDS = 1;

/** Còi truy nã: càng nhiều sao càng to, cao và dồn dập hơn */
export function sirenParams(level: number): { center: number; depth: number; rate: number; gain: number } {
  const l = Math.max(1, Math.min(3, Math.round(level)));
  return [
    { center: 600, depth: 180, rate: 0.6, gain: 0.05 },
    { center: 700, depth: 240, rate: 1.0, gain: 0.07 },
    { center: 820, depth: 300, rate: 1.6, gain: 0.09 },
  ][l - 1];
}

/** Ưu tiên mix: còi truy nã > chuông điểm danh > hiệu ứng > nhạc nền */
export function mixPriority(s: { siren: boolean; bell: boolean }): { music: number; sfx: number } {
  if (s.siren) return { music: 0.25, sfx: 0.8 };
  if (s.bell) return { music: 0.45, sfx: 0.9 };
  return { music: 1, sfx: 1 };
}

/** Chuông điểm danh là âm toàn cục: nghe ở mọi khu, nhỏ hơn khi ở trong phòng kín */
export function globalBellGain(zone: string | null): number {
  return zone === "yard" || zone === "outside" || zone === null ? 1 : 0.75;
}
