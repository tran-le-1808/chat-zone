/** ÂM THANH VẼ ĐOÁN (WebAudio tổng hợp): đoán đúng, gần đúng, đến lượt vẽ, tích tắc, hết lượt, hết ván */
export type VDSfx = "correct" | "close" | "turn" | "tick" | "reveal" | "end" | "pop";
const KEY = "vedoan-sound-muted";

class VDSound {
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
  private tone(t: number, f: number, dur: number, gain: number, type: OscillatorType = "sine", to = f) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  play(kind: VDSfx) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (kind) {
      case "correct":
        [784, 988, 1319].forEach((f, i) => this.tone(t + i * 0.08, f, 0.25, 0.14, "triangle"));
        break;
      case "close":
        this.tone(t, 520, 0.12, 0.12, "square", 700);
        break;
      case "turn":
        [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.1, f, 0.3, 0.12));
        break;
      case "tick":
        this.tone(t, 1400, 0.04, 0.08, "square");
        break;
      case "reveal":
        this.tone(t, 660, 0.25, 0.12, "triangle", 440);
        break;
      case "end":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.12, f, 0.4, 0.13, "triangle"));
        break;
      case "pop":
        this.tone(t, 900, 0.06, 0.08, "sine", 500);
        break;
    }
  }
}

export const vdSound = new VDSound();
