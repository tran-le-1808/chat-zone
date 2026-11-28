/** ÂM THANH MA SÓI (WebAudio tổng hợp): màn đêm, bình minh, chết, bỏ phiếu, chọn, thắng / thua */
export type MSSfx = "night" | "day" | "death" | "vote" | "select" | "win" | "lose" | "claim" | "turn";
const KEY = "masoi-sound-muted";

class MSSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
    } catch {
      this.muted = false;
    }
  }
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  unlock() {
    this.ensure();
  }
  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(KEY, m ? "1" : "0");
    } catch {
      /* bỏ qua */
    }
  }
  /** Một nốt có đường cao độ (from → to) */
  private tone(t: number, from: number, to: number, dur: number, gain: number, type: OscillatorType = "sine") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.08, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  play(kind: MSSfx) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (kind) {
      case "night": // tiếng sói tru
        this.tone(t, 300, 520, 0.5, 0.18, "triangle");
        this.tone(t + 0.45, 520, 470, 0.9, 0.16, "triangle");
        this.tone(t + 1.3, 470, 260, 0.6, 0.1, "triangle");
        break;
      case "day": // chuông sáng
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.09, f, f, 0.5, 0.12));
        break;
      case "death":
        this.tone(t, 160, 50, 0.7, 0.3, "sine");
        this.tone(t, 90, 40, 0.9, 0.2, "triangle");
        break;
      case "vote":
        this.tone(t, 220, 200, 0.12, 0.18, "square");
        break;
      case "select":
        this.tone(t, 880, 990, 0.08, 0.08);
        break;
      case "claim":
        this.tone(t, 660, 990, 0.25, 0.1, "triangle");
        break;
      case "turn":
        this.tone(t, 740, 740, 0.12, 0.1);
        this.tone(t + 0.14, 990, 990, 0.18, 0.1);
        break;
      case "win":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.12, f, f, 0.45, 0.14, "triangle"));
        break;
      case "lose":
        [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.18, f, f * 0.97, 0.5, 0.14, "triangle"));
        break;
    }
  }
}

export const msSound = new MSSound();
