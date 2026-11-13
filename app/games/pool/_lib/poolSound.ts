/**
 * ÂM THANH BIDA LỖ — tổng hợp bằng WebAudio, phụ thuộc vật lý:
 * - Âm lượng / cao độ theo vận tốc va chạm tương đối; ≥ 4 biến thể mỗi loại để không lặp.
 * - Âm 3D theo vị trí trên bàn (PannerNode, người nghe ở đầu bàn phía người chơi).
 * - Bi–bi "cạch", bi–băng "thịch" trầm, mũi lỗ lạch cạch, bi rơi + lăn trong máng, cơ–bi "cốc",
 *   trượt cơ có âm riêng.
 */
export type PoolSfx = "land" | "jump" | "pull" | "cue" | "miscue" | "ball" | "rail" | "jaw" | "back" | "drop" | "turn" | "foul" | "win";

class PoolSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<string, number>();
  volume = 0.8;

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
      const l = this.ctx.listener;
      if (l.positionX) {
        l.positionX.value = 0;
        l.positionY.value = 1.2;
        l.positionZ.value = 1.6;
      }
    }
    if (this.master) this.master.gain.value = this.volume;
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  /** Nút âm 3D tại vị trí (x, y) trên bàn (toạ độ vật lý) */
  private spatial(ctx: AudioContext, x: number, y: number): AudioNode {
    const p = ctx.createPanner();
    p.panningModel = "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = 1;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = 0;
      p.positionZ.value = -y;
    }
    p.connect(this.master!);
    return p;
  }

  /** x, y: vị trí phát ra âm; intensity 0..1 theo vận tốc va chạm */
  play(kind: PoolSfx, intensity = 1, x = 0, y = 0) {
    if (this.volume <= 0) return;
    const now = performance.now();
    const key = `${kind}`;
    const gap = kind === "ball" ? 12 : kind === "jaw" ? 25 : kind === "pull" ? 70 : 30;
    if (now - (this.last.get(key) ?? 0) < gap) return;
    this.last.set(key, now);
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const k = Math.max(0.03, Math.min(1, intensity));
    const out = this.spatial(ctx, x, y);
    const variant = Math.floor(Math.random() * 4);
    switch (kind) {
      case "land":
        // Bi đáp xuống nỉ: "tộp" trầm, nhỏ dần theo tốc độ đáp
        this.thud(ctx, out, 130 + 60 * k, 0.07, 0.5 * k);
        this.burst(ctx, out, 1800, 0.02, 0.18 * k);
        break;
      case "jump":
        this.burst(ctx, out, 3200, 0.05, 0.12 * k);
        break;
      case "pull":
        // Tiếng kéo cơ: tích tắc ngắn, cao độ tăng theo lực
        this.click(ctx, out, 260 + 520 * k, 0.03, 0.12);
        break;
      case "ball": {
        // Phenolic: tiếng "cạch" sáng; va mạnh -> to hơn & cao hơn chút
        const base = [3100, 3350, 2900, 3600][variant] * (0.9 + 0.2 * k);
        this.click(ctx, out, base, 0.03 + 0.02 * k, 0.7 * k);
        this.click(ctx, out, base * 2.1, 0.015, 0.25 * k);
        this.burst(ctx, out, 6000, 0.012, 0.25 * k);
        break;
      }
      case "cue":
        this.click(ctx, out, [1500, 1650, 1400, 1550][variant], 0.05, 0.55 * k);
        this.burst(ctx, out, 2500, 0.02, 0.3 * k);
        break;
      case "miscue":
        this.burst(ctx, out, 900, 0.09, 0.5);
        this.click(ctx, out, 700, 0.08, 0.3);
        break;
      case "rail":
        this.thud(ctx, out, [150, 165, 140, 175][variant], 0.11, 0.75 * k);
        this.burst(ctx, out, 800, 0.03, 0.15 * k);
        break;
      case "jaw":
        // Mũi lỗ: va vào nỉ + gỗ phía sau -> "lạch cạch"
        this.thud(ctx, out, 220, 0.06, 0.5 * k);
        this.click(ctx, out, 1200 + variant * 140, 0.025, 0.3 * k);
        break;
      case "back":
        this.thud(ctx, out, 110, 0.12, 0.6 * k);
        break;
      case "drop": {
        // Bi rơi xuống đáy lỗ rồi lăn trong máng hồi bi
        this.thud(ctx, out, 95, 0.16, 0.7);
        const t = ctx.currentTime + 0.12;
        this.rumble(ctx, out, t, 0.9 + variant * 0.15, 0.18);
        break;
      }
      case "turn":
        this.tone(ctx, [660], 0.08, 0.1);
        break;
      case "foul":
        this.tone(ctx, [330, 247], 0.14, 0.14);
        break;
      case "win":
        this.tone(ctx, [523, 659, 784, 1047], 0.14, 0.22);
        break;
    }
  }

  private click(ctx: AudioContext, out: AudioNode, freq: number, dur: number, gain: number) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  private burst(ctx: AudioContext, out: AudioNode, freq: number, dur: number, gain: number) {
    if (!this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.01);
  }

  private thud(ctx: AudioContext, out: AudioNode, freq: number, dur: number, gain: number) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  /** Tiếng lăn trong máng: nhiễu thấp, rung nhẹ, nhỏ dần */
  private rumble(ctx: AudioContext, out: AudioNode, t: number, dur: number, gain: number) {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0008, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(ctx: AudioContext, freqs: number[], step: number, gain: number) {
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const t = t0 + i * step;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.6);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + step * 1.7);
    });
  }
}

export const poolSound = new PoolSound();
