/**
 * ÂM THANH BIDA (WebAudio tổng hợp, không cần file âm thanh).
 * Âm lượng theo cường độ va chạm, có chặn phát dồn dập khi nhiều va chạm liên tiếp.
 * Âm thanh chỉ là phản hồi — không ảnh hưởng vật lý.
 */
export type SfxKind =
  "pull" | "cue" | "ball" | "cushion" | "score" | "miss" | "win" | "turn";

const MIN_GAP_MS: Record<SfxKind, number> = {
  pull: 70,
  cue: 60,
  ball: 35,
  cushion: 45,
  score: 300,
  miss: 300,
  win: 1000,
  turn: 400,
};

class BilliardSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last: Partial<Record<SfxKind, number>> = {};
  volume = 0.7;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.master) this.master.gain.value = this.volume;
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Gọi trong thao tác người dùng (bấm nút) để trình duyệt cho phép phát âm thanh */
  unlock() {
    this.ensure();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  play(kind: SfxKind, intensity = 1) {
    if (this.volume <= 0) return;
    const now = performance.now();
    if (now - (this.last[kind] ?? 0) < MIN_GAP_MS[kind]) return;
    this.last[kind] = now;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const k = Math.max(0.05, Math.min(1, intensity));
    switch (kind) {
      case "pull":
        // Tiếng kéo cơ: tích tắc ngắn, cao độ tăng theo lực
        this.click(ctx, 260 + 520 * k, 0.03, 0.12);
        break;
      case "ball":
        this.click(ctx, 2600, 0.035, 0.55 * k);
        this.click(ctx, 5200, 0.02, 0.25 * k);
        break;
      case "cue":
        this.click(ctx, 1400, 0.05, 0.5 * k);
        break;
      case "cushion":
        this.thud(ctx, 160, 0.09, 0.6 * k);
        break;
      case "score":
        this.tone(ctx, [880, 1320], 0.12, 0.25);
        break;
      case "miss":
        this.tone(ctx, [330, 247], 0.14, 0.15);
        break;
      case "turn":
        this.tone(ctx, [660], 0.08, 0.12);
        break;
      case "win":
        this.tone(ctx, [523, 659, 784, 1047], 0.14, 0.25);
        break;
    }
  }

  /** Tiếng "cạch" ngắn (bi chạm bi / đầu cơ) */
  private click(ctx: AudioContext, freq: number, dur: number, gain: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** Tiếng "bụp" trầm (chạm băng cao su) */
  private thud(ctx: AudioContext, freq: number, dur: number, gain: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  private tone(ctx: AudioContext, freqs: number[], step: number, gain: number) {
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const t = t0 + i * step;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.6);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + step * 1.7);
    });
  }
}

export const billiardSound = new BilliardSound();
