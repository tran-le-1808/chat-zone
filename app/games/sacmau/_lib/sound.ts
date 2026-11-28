/**
 * ÂM THANH SẮC MÀU (WebAudio tổng hợp, không cần file): chia bài, đánh lá, bốc bài, bị +2/+4, báo, thắng / thua, tới lượt.
 */
export type SMSfx = "deal" | "play" | "pass" | "chop" | "win" | "lose" | "turn" | "select" | "draw" | "call" | "skip";
const KEY = "sacmau-sound-muted";

class SMSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
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
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

  /** Tiếng "phạch" của lá bài: nhiễu lọc dải ngắn */
  private snap(t: number, freq: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private tone(t: number, f: number, dur: number, gain: number, type: OscillatorType = "sine") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(kind: SMSfx, count = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    switch (kind) {
      case "deal":
        for (let i = 0; i < 14; i++) this.snap(t + i * 0.045, 2600 + Math.random() * 900, 0.05, 0.22);
        break;
      case "play":
        for (let i = 0; i < Math.min(count, 6); i++) this.snap(t + i * 0.035, 1800 + Math.random() * 500, 0.07, 0.5);
        break;
      case "draw":
        for (let i = 0; i < Math.min(count, 6); i++) this.snap(t + i * 0.07, 1200 + Math.random() * 300, 0.09, 0.28);
        break;
      case "call":
        this.tone(t, 988, 0.12, 0.2, "square");
        this.tone(t + 0.12, 1319, 0.22, 0.18, "square");
        break;
      case "skip":
        this.tone(t, 620, 0.08, 0.15, "sawtooth");
        this.tone(t + 0.07, 410, 0.14, 0.12, "sawtooth");
        break;
      case "select":
        this.snap(t, 3400, 0.03, 0.15);
        break;
      case "pass":
        this.tone(t, 330, 0.12, 0.12, "triangle");
        this.tone(t + 0.08, 262, 0.16, 0.1, "triangle");
        break;
      case "chop": {
        // "bùm": tiếng trầm rơi + nhiễu
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.45);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g).connect(this.master!);
        o.start(t);
        o.stop(t + 0.55);
        this.snap(t, 900, 0.3, 0.6);
        this.snap(t + 0.02, 2400, 0.15, 0.5);
        break;
      }
      case "turn":
        this.tone(t, 880, 0.12, 0.15);
        this.tone(t + 0.1, 1175, 0.18, 0.13);
        break;
      case "win":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.11, f, i === 4 ? 0.7 : 0.2, 0.22, "triangle"));
        break;
      case "lose":
        [440, 392, 349, 294].forEach((f, i) => this.tone(t + i * 0.16, f, i === 3 ? 0.6 : 0.22, 0.18));
        break;
    }
  }
}

export const smSound = new SMSound();
