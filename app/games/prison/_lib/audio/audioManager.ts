/**
 * Âm thanh tổng hợp bằng WebAudio (100% tạo trong code, không dùng file âm thanh của bên khác).
 * Ba bus nhạc / hiệu ứng / giọng (bong bóng) -> master -> bộ nén chống méo.
 * Chỉ khởi tạo sau một lần chạm / phím (quy định trình duyệt).
 */
import { attenuate, busGain, CROSSFADE_SECONDS, headroom, mixPriority, moodFor, RepeatGuard, sanitizeMix, sectionAt, SIREN_FADE_SECONDS, sirenParams, type Bus, type MixSettings, type MusicMood, type Surface } from "./mix";

const STORE = "prison-break:audio:v1";

/**
 * Nhạc nền tự sáng tác bằng code (nhạc gốc, không dùng file ngoài).
 * Ba lớp: nền (bass + pad) · giai điệu · nhịp (trống, hi-hat). Ba đoạn A/B/C luân phiên A-B-A-C,
 * mỗi đoạn có tiến trình hợp âm & motif riêng; giai điệu biến tấu theo hợp âm.
 */
interface MoodDef {
  bpm: number;
  root: number;
  /** thang âm (bán cung so với root) */
  scale: number[];
  /** 3 đoạn × 4 hợp âm (bậc trong thang) */
  progressions: [number[], number[], number[]];
  /** 3 motif × 8 nốt nửa phách (bậc trong thang, null = nghỉ) */
  motifs: [(number | null)[], (number | null)[], (number | null)[]];
  lead: OscillatorType;
  leadGain: number;
  bassGain: number;
  padGain: number;
  /** 0 = không trống, 1 = trống nhẹ, 2 = trống đầy đủ */
  drums: 0 | 1 | 2;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const LIVELY: MoodDef["motifs"] = [
  [0, 2, 4, 2, 5, null, 4, 2],
  [4, null, 5, 4, 2, 0, 2, null],
  [7, 6, 4, null, 2, 4, 5, null],
];

const MOODS: Record<MusicMood, MoodDef> = {
  calm: { bpm: 108, root: 196, scale: MAJOR, progressions: [[0, 5, 3, 4], [3, 4, 0, 5], [5, 3, 0, 4]], motifs: LIVELY, lead: "triangle", leadGain: 0.05, bassGain: 0.09, padGain: 0.04, drums: 2 },
  work: { bpm: 112, root: 174.6, scale: MAJOR, progressions: [[0, 4, 5, 3], [1, 4, 0, 0], [3, 4, 5, 4]], motifs: LIVELY, lead: "square", leadGain: 0.03, bassGain: 0.09, padGain: 0.03, drums: 2 },
  gym: { bpm: 128, root: 220, scale: MINOR, progressions: [[0, 5, 6, 4], [0, 3, 4, 4], [5, 6, 0, 0]], motifs: [[0, 0, 4, 0, 6, 4, 2, 0], [4, 4, 6, 7, 6, 4, 2, null], [7, null, 7, 6, 4, 2, 4, 0]], lead: "square", leadGain: 0.035, bassGain: 0.11, padGain: 0.025, drums: 2 },
  library: { bpm: 84, root: 261.6, scale: MAJOR, progressions: [[0, 3, 4, 0], [5, 3, 1, 4], [0, 5, 3, 4]], motifs: [[4, null, 2, null, 0, null, null, null], [2, null, 4, null, 5, null, 4, null], [7, null, 5, null, 4, null, 2, null]], lead: "sine", leadGain: 0.045, bassGain: 0.05, padGain: 0.05, drums: 0 },
  tense: { bpm: 116, root: 146.8, scale: [0, 1, 3, 5, 6, 8, 10], progressions: [[0, 1, 0, 6], [0, 5, 1, 0], [3, 1, 0, 0]], motifs: [[0, null, 1, null, 0, 6, null, null], [3, 1, null, 0, null, 1, 0, null], [6, 5, 3, 1, 0, null, 0, null]], lead: "sawtooth", leadGain: 0.03, bassGain: 0.09, padGain: 0.03, drums: 2 },
  night: { bpm: 72, root: 164.8, scale: MINOR, progressions: [[0, 5, 3, 4], [0, 3, 5, 6], [3, 4, 0, 0]], motifs: [[4, null, null, 2, null, null, 0, null], [2, null, 4, null, null, 5, null, null], [7, null, null, 4, null, 2, null, null]], lead: "sine", leadGain: 0.035, bassGain: 0.05, padGain: 0.05, drums: 0 },
  silent: { bpm: 56, root: 130.8, scale: MINOR, progressions: [[0, 0, 5, 5], [3, 3, 0, 0], [5, 4, 0, 0]], motifs: [[4, null, null, null, null, null, null, null], [null, null, 2, null, null, null, null, null], [0, null, null, null, null, null, null, null]], lead: "sine", leadGain: 0.02, bassGain: 0.025, padGain: 0.03, drums: 0 },
};

const degFreq = (def: MoodDef, deg: number, octave = 0) => {
  const n = def.scale.length;
  const o = Math.floor(deg / n) + octave;
  return def.root * Math.pow(2, (def.scale[((deg % n) + n) % n] + 12 * o) / 12);
};

export class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private musicBase!: GainNode;
  private musicTension!: GainNode;
  /** hai "đĩa" để chuyển nhạc mượt khi đổi khu */
  private decks: GainNode[] = [];
  private deck = 0;
  private sirenGain: GainNode | null = null;
  private sirenLevel = 0;
  private bellUntil = 0;
  private settings: MixSettings = sanitizeMix(null);
  private guard = new RepeatGuard(150);
  private hidden = false;
  private mood: MusicMood = "calm";
  private tension = 0;
  private sirenOsc: OscillatorNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    try {
      if (typeof localStorage !== "undefined") this.settings = sanitizeMix(JSON.parse(localStorage.getItem(STORE) ?? "null"));
    } catch {
      /* mặc định */
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        this.hidden = document.visibilityState === "hidden";
        this.applyGains();
      });
    }
  }

  /** Gọi trong một handler chạm / phím */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 8;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(comp);
      this.buses = { music: ctx.createGain(), sfx: ctx.createGain(), voice: ctx.createGain() };
      for (const b of Object.values(this.buses)) b.connect(this.master);
      this.musicBase = ctx.createGain();
      this.musicTension = ctx.createGain();
      this.musicTension.gain.value = 0;
      this.musicBase.connect(this.buses.music);
      this.musicTension.connect(this.buses.music);
      this.decks = [ctx.createGain(), ctx.createGain()];
      this.decks[1].gain.value = 0;
      for (const d of this.decks) d.connect(this.musicBase);
      this.applyGains();
      this.nextBeat = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 100);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  getSettings(): MixSettings {
    return this.settings;
  }

  setSettings(next: Partial<MixSettings>): void {
    this.settings = sanitizeMix({ ...this.settings, ...next, muted: { ...this.settings.muted, ...(next.muted ?? {}) } });
    try {
      localStorage.setItem(STORE, JSON.stringify(this.settings));
    } catch {
      /* bỏ qua */
    }
    this.applyGains();
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pr = mixPriority({ siren: this.sirenLevel > 0, bell: t < this.bellUntil });
    this.master.gain.setTargetAtTime(1, t, 0.05);
    this.buses.music.gain.setTargetAtTime(busGain(this.settings, "music", this.hidden) * pr.music, t, 0.3);
    this.buses.sfx.gain.setTargetAtTime(busGain(this.settings, "sfx", this.hidden) * pr.sfx, t, 0.1);
    this.buses.voice.gain.setTargetAtTime(busGain(this.settings, "voice", this.hidden), t, 0.05);
  }

  /**
   * Cập nhật ngữ cảnh nhạc: khu vực, giờ, độ nghi ngờ (0–1), mức còi (0 = tắt, 1–3 = số sao truy nã).
   * Đổi khu -> chuyển nhạc mượt; còi bật ngay khi truy nã, to/dồn dập hơn theo số sao, tắt dần 1 giây.
   */
  setContext(zone: string | null, hour: number, restricted: boolean, suspicion: number, sirenLevel: number): void {
    const mood = moodFor(zone, hour, restricted);
    if (mood !== this.mood) {
      this.mood = mood;
      this.crossfade();
    }
    const target = Math.max(0, Math.min(1, suspicion));
    if (this.ctx && Math.abs(target - this.tension) > 0.02) {
      this.tension = target;
      // lớp căng thẳng trộn mượt trong ~1.5 giây
      this.musicTension.gain.setTargetAtTime(target * 0.9, this.ctx.currentTime, 0.5);
    }
    const level = Math.max(0, Math.min(3, Math.round(sirenLevel)));
    if (level !== this.sirenLevel) {
      this.sirenLevel = level;
      if (level > 0) this.startSiren(level);
      else this.stopSiren();
      this.applyGains();
    }
  }

  /** Đổi sang đĩa còn lại: đĩa mới lên dần, đĩa cũ xuống dần (crossfade) */
  private crossfade(): void {
    const ctx = this.ctx;
    if (!ctx || this.decks.length < 2) return;
    const t = ctx.currentTime;
    const old = this.decks[this.deck];
    this.deck = 1 - this.deck;
    const next = this.decks[this.deck];
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + CROSSFADE_SECONDS);
    next.gain.cancelScheduledValues(t);
    next.gain.setValueAtTime(next.gain.value, t);
    next.gain.linearRampToValueAtTime(1, t + CROSSFADE_SECONDS);
  }

  // ------------------------------------------------------------------ nhạc nền tạo theo nhịp
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.applyGains();
    const def = MOODS[this.mood];
    const dest = this.decks[this.deck] ?? this.musicBase;
    const spb = 60 / def.bpm;
    while (this.nextBeat < ctx.currentTime + 0.3) {
      const t = this.nextBeat;
      const b = this.beat++;
      const bar = Math.floor(b / 4);
      const sec = sectionAt(bar);
      const chord = def.progressions[sec][bar % 4];
      const inBar = b % 4;
      // lớp nền: pad đầu ô nhịp + bass phách 1 & 3 (đoạn B đi bass móc)
      if (inBar === 0) for (const k of [0, 2, 4]) this.note(dest, t, degFreq(def, chord + k), spb * 4, "sine", def.padGain, 0.4);
      if (inBar % 2 === 0 || (sec === 1 && def.drums)) this.note(dest, t, degFreq(def, chord, -1), spb * 0.9, "triangle", def.bassGain, 0.01);
      // lớp giai điệu: motif của đoạn, dịch theo hợp âm, nửa phách; đoạn lặp lần 2 đổi quãng tám cho đỡ đơn điệu
      const motif = def.motifs[sec];
      const variation = Math.floor(bar / (4 * 4)) % 2;
      for (const half of [0, 1]) {
        const deg = motif[(inBar * 2 + half) % motif.length];
        if (deg !== null) this.note(dest, t + half * spb * 0.5, degFreq(def, deg + chord, variation), spb * 0.45, def.lead, def.leadGain, 0.01);
      }
      // lớp nhịp
      if (def.drums) {
        if (inBar === 0 || (def.drums === 2 && inBar === 2)) this.kick(dest, t, 0.13);
        if (def.drums === 2 && (inBar === 1 || inBar === 3)) this.noise(dest, t, 0.12, 0.12, 1800, 0.9);
        for (const half of [0, 1]) this.noise(dest, t + half * spb * 0.5, 0.03, 0.05, 8000, 1, "highpass");
      }
      // lớp căng thẳng: trống dồn + dây trầm (âm lượng theo độ nghi ngờ)
      this.kick(this.musicTension, t, b % 2 ? 0.08 : 0.16);
      if (inBar === 0) this.note(this.musicTension, t, MOODS.tense.root / 2, spb * 4, "sawtooth", 0.05);
      this.nextBeat += spb;
    }
  }

  private note(dest: AudioNode, t: number, freq: number, dur: number, wave: OscillatorType, gain: number, attack = 0.01): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(dest: AudioNode, t: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.25);
  }

  private noise(dest: AudioNode, t: number, dur: number, gain: number, filterFreq: number, q = 1, type: BiquadFilterType = "bandpass"): void {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
  }

  private startSiren(level: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = sirenParams(level);
    const t = ctx.currentTime;
    if (this.sirenOsc && this.sirenGain) {
      // đổi mức sao: chỉnh cao độ / nhịp / âm lượng tại chỗ
      const lfo = (this.sirenOsc as unknown as { _lfo: OscillatorNode; _depth: GainNode })._lfo;
      const depth = (this.sirenOsc as unknown as { _depth: GainNode })._depth;
      this.sirenOsc.frequency.setTargetAtTime(p.center, t, 0.2);
      lfo.frequency.setTargetAtTime(p.rate, t, 0.2);
      depth.gain.setTargetAtTime(p.depth, t, 0.2);
      this.sirenGain.gain.cancelScheduledValues(t);
      this.sirenGain.gain.setTargetAtTime(p.gain, t, 0.2);
      return;
    }
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.value = p.center;
    lfo.frequency.value = p.rate;
    lfoGain.gain.value = p.depth;
    lfo.connect(lfoGain).connect(o.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(p.gain, t + 0.15);
    o.connect(g).connect(this.master);
    o.start();
    lfo.start();
    this.sirenOsc = o;
    this.sirenGain = g;
    Object.assign(o, { _lfo: lfo, _depth: lfoGain });
  }

  /** Tắt còi dần trong 1 giây (không cắt đột ngột) */
  private stopSiren(): void {
    const o = this.sirenOsc;
    const g = this.sirenGain;
    const ctx = this.ctx;
    if (!o || !g || !ctx) return;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + SIREN_FADE_SECONDS);
    o.stop(t + SIREN_FADE_SECONDS + 0.05);
    (o as unknown as { _lfo: OscillatorNode })._lfo.stop(t + SIREN_FADE_SECONDS + 0.05);
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  // ------------------------------------------------------------------ hiệu ứng
  /** Phát SFX; `distance` & `occluded` để suy giảm theo khoảng cách / tường */
  play(name: SfxName, opts: { distance?: number; occluded?: boolean; key?: string; surface?: Surface; maxDistance?: number; gain?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.guard.allow(opts.key ?? name, performance.now())) return;
    const g0 = opts.distance === undefined ? 1 : attenuate(opts.distance, opts.maxDistance ?? 14, !!opts.occluded);
    if (g0 <= 0.01) return;
    const out = ctx.createGain();
    out.gain.value = g0 * (opts.gain ?? 1) * headroom([g0, this.tension * 0.5]);
    const voice = name === "talk";
    out.connect(voice ? this.buses.voice : this.buses.sfx);
    const t = ctx.currentTime;
    switch (name) {
      case "step": {
        const f = { stone: 1800, wood: 900, metal: 3200, grass: 600 }[opts.surface ?? "stone"];
        this.noise(out, t, 0.06, 0.25, f * (0.85 + Math.random() * 0.3), 2.5);
        break;
      }
      case "rollcallBell":
        // chuông điểm danh: ba hồi rõ, vang khắp trại (âm ưu tiên: hạ nhạc nền)
        this.bellUntil = t + 3.4;
        this.applyGains();
        for (let k = 0; k < 3; k++) {
          for (const [f, gg] of [[784, 0.2], [1176, 0.09], [1568, 0.05]] as const) this.note(out, t + k * 0.9, f, 1.4, "sine", gg, 0.004);
          this.noise(out, t + k * 0.9, 0.04, 0.2, 5000, 3);
        }
        break;
      case "bellWarn":
        // cảnh báo trước 1 phút: một tiếng ngắn, nhẹ
        this.bellUntil = t + 0.8;
        this.applyGains();
        this.note(out, t, 1046, 0.6, "sine", 0.1, 0.004);
        break;
      case "bellEnd":
        // kết thúc điểm danh: hai tiếng ngắn đi xuống
        this.bellUntil = t + 1.2;
        this.applyGains();
        this.note(out, t, 988, 0.4, "sine", 0.12, 0.004);
        this.note(out, t + 0.35, 740, 0.6, "sine", 0.12, 0.004);
        break;
      case "bell":
        this.bellUntil = t + 1.6;
        this.applyGains();
        for (const [f, gg] of [[880, 0.18], [1320, 0.08], [1760, 0.05]] as const) this.note(out, t, f, 1.6, "sine", gg, 0.005);
        this.note(out, t + 0.45, 880, 1.2, "sine", 0.14, 0.005);
        break;
      case "door":
        this.noise(out, t, 0.25, 0.4, 300, 6, "lowpass");
        this.note(out, t, 95, 0.3, "square", 0.08);
        break;
      case "lock":
        this.noise(out, t, 0.03, 0.4, 4200, 8);
        this.noise(out, t + 0.07, 0.03, 0.3, 3600, 8);
        break;
      case "dig":
        this.noise(out, t, 0.18, 0.5, 400, 1.5, "lowpass");
        this.kick(out, t, 0.12);
        break;
      case "knock":
        this.kick(out, t, 0.2);
        this.kick(out, t + 0.14, 0.18);
        break;
      case "water":
        this.noise(out, t, 0.7, 0.3, 1200, 0.7, "lowpass");
        break;
      case "lightsOff":
        this.noise(out, t, 0.02, 0.5, 5000, 3);
        this.note(out, t, 60, 0.4, "sine", 0.1);
        break;
      case "alert":
        this.note(out, t, 740, 0.12, "square", 0.12);
        this.note(out, t + 0.13, 990, 0.25, "square", 0.12);
        break;
      case "pickup":
        this.note(out, t, 880, 0.1, "triangle", 0.15);
        this.note(out, t + 0.08, 1320, 0.14, "triangle", 0.12);
        break;
      case "craft":
        for (let i = 0; i < 3; i++) this.noise(out, t + i * 0.09, 0.05, 0.3, 2600, 4);
        break;
      case "hit":
        this.kick(out, t, 0.35);
        this.noise(out, t, 0.2, 0.4, 800, 1);
        break;
      case "error":
        this.note(out, t, 160, 0.18, "square", 0.08);
        break;
      case "success":
        for (const [i, f] of [523, 659, 784, 1047].entries()) this.note(out, t + i * 0.1, f, 0.3, "triangle", 0.12);
        break;
      case "camera":
        this.note(out, t, 1600, 0.08, "sine", 0.1);
        break;
      case "swing":
        this.noise(out, t, 0.13, 0.35, 1800, 0.8);
        this.noise(out, t + 0.03, 0.1, 0.2, 900, 0.8);
        break;
      case "talk":
        for (let i = 0; i < 4; i++) this.note(out, t + i * 0.07, 300 + Math.random() * 300, 0.06, "square", 0.05);
        break;
    }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.stopSiren();
    void this.ctx?.close();
    this.ctx = null;
  }
}

export type SfxName = "step" | "bell" | "rollcallBell" | "bellWarn" | "bellEnd" | "door" | "lock" | "dig" | "knock" | "water" | "lightsOff" | "alert" | "pickup" | "craft" | "hit" | "error" | "success" | "camera" | "talk" | "swing";

let shared: AudioManager | null = null;
export function getAudio(): AudioManager {
  shared ??= new AudioManager();
  return shared;
}
