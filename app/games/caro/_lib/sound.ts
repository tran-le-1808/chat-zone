/**
 * ÂM THANH CỜ CARO (WebAudio tổng hợp, không cần file): đặt quân, thắng, thua, hoà.
 * Bật / tắt tiếng lưu trên trình duyệt. Trình duyệt chỉ cho phát sau thao tác của người dùng (bấm / chạm).
 */
export type CaroSfx = "place" | "opponent" | "win" | "lose" | "draw";

const KEY = "caro-sound-muted";

class CaroSound {
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
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Gọi trong thao tác người dùng để trình duyệt cho phép phát */
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

  play(kind: CaroSfx) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    switch (kind) {
      case "place":
        // tiếng "cạch" quân gỗ đặt xuống bàn
        this.knock(ctx, 820, 0.07, 0.5);
        break;
      case "opponent":
        this.knock(ctx, 620, 0.07, 0.4);
        break;
      case "win":
        this.melody(ctx, [523, 659, 784, 1047], 0.13, 0.28, "triangle");
        break;
      case "lose":
        this.melody(ctx, [440, 370, 311, 262], 0.18, 0.22, "sine");
        break;
      case "draw":
        this.melody(ctx, [523, 523], 0.18, 0.2, "sine");
        break;
    }
  }

  private knock(ctx: AudioContext, freq: number, dur: number, gain: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    // tiếng va chạm ngắn (nhiễu) cho cảm giác quân gỗ
    const len = Math.floor(ctx.sampleRate * 0.02);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const ng = ctx.createGain();
    ng.gain.value = gain * 0.35;
    src.buffer = buf;
    src.connect(ng).connect(this.master!);
    src.start(t);
  }

  private melody(ctx: AudioContext, freqs: number[], step: number, gain: number, type: OscillatorType) {
    const t0 = ctx.currentTime + 0.05;
    freqs.forEach((f, i) => {
      const t = t0 + i * step;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * (i === freqs.length - 1 ? 3 : 1.4));
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + step * 3.2);
    });
  }
}

export const caroSound = new CaroSound();
