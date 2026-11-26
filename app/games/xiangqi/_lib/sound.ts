/**
 * ÂM THANH CỜ TƯỚNG (WebAudio tổng hợp, không cần file): quân gỗ đặt xuống, ăn quân, chiếu tướng, kết quả.
 * Bật / tắt tiếng lưu trên trình duyệt.
 */
export type XqSfx = "select" | "move" | "capture" | "check" | "win" | "lose" | "draw";

const KEY = "xiangqi-sound-muted";

class XqSound {
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
      this.master.gain.value = 0.65;
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

  play(kind: XqSfx) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.005;
    switch (kind) {
      case "select":
        this.wood(ctx, t, 1400, 0.03, 0.12);
        break;
      case "move":
        // "cạch": quân gỗ dày đặt xuống bàn gỗ
        this.wood(ctx, t, 520, 0.09, 0.55);
        this.wood(ctx, t + 0.004, 1650, 0.03, 0.18);
        break;
      case "capture":
        // hai tiếng gõ: quân chạm quân rồi đặt xuống
        this.wood(ctx, t, 900, 0.05, 0.35);
        this.wood(ctx, t + 0.075, 430, 0.12, 0.7);
        this.wood(ctx, t + 0.079, 1500, 0.04, 0.22);
        break;
      case "check":
        this.wood(ctx, t, 520, 0.09, 0.5);
        this.tone(ctx, t + 0.05, 880, 0.16, 0.18, "square");
        this.tone(ctx, t + 0.2, 660, 0.22, 0.18, "square");
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(ctx, t + i * 0.13, f, i === 3 ? 0.6 : 0.2, 0.25, "triangle"));
        break;
      case "lose":
        [440, 370, 311, 262].forEach((f, i) => this.tone(ctx, t + i * 0.18, f, i === 3 ? 0.6 : 0.25, 0.2, "sine"));
        break;
      case "draw":
        [523, 523].forEach((f, i) => this.tone(ctx, t + i * 0.2, f, 0.3, 0.2, "sine"));
        break;
    }
  }

  /** Tiếng gỗ: dao động tắt nhanh + nhiễu ngắn lọc dải */
  private wood(ctx: AudioContext, t: number, freq: number, dur: number, gain: number) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 2.2;
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.value = gain * 0.6;
    src.connect(bp).connect(ng).connect(this.master!);
    src.start(t);
  }

  private tone(ctx: AudioContext, t: number, f: number, dur: number, gain: number, type: OscillatorType) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export const xqSound = new XqSound();

/** Phát âm cho nước vừa đi */
export function soundForMove(captured: number, check: boolean) {
  xqSound.play(check ? "check" : captured ? "capture" : "move");
}
