import { stepSoundEnabled } from "./animSettings";

/**
 * Âm khi quân đi từng ô — kiểu "marimba vui tai": mỗi bước là một nốt gỗ ngắn, các bước
 * đi LÊN theo thang ngũ cung (nghe như bước nhảy lên cầu thang âm nhạc), bước cuối là một
 * hợp âm sáng, có tiếng "pop" trầm. Tổng hợp bằng WebAudio (không cần file), mỗi nốt biến
 * thiên rất nhẹ (±4 cent, ±8% âm lượng). Gắn vào sự kiện STEP_LAND.
 */

/** Thang ngũ cung trưởng (nửa cung so với nốt gốc) — luôn hoà âm, không nốt "lệch" */
export const PENTATONIC = [0, 2, 4, 7, 9];
/** Nốt gốc G4 (392 Hz) */
const ROOT_HZ = 392;
/** Mỗi người chơi lệch gốc một chút để phân biệt quân (vẫn trong thang) */
const PLAYER_SHIFT = [0, 4, 7, 2];

/** Cao độ (Hz) của bước thứ `step` (bắt đầu từ 0): leo 7 nốt rồi lặp */
export function stepNoteHz(step: number, playerId = 0): number {
  const n = ((step % 7) + 7) % 7; // 0..6: leo hơn 1 quãng tám rồi lặp (không lên quá chói)
  const semis = PENTATONIC[n % 5] + 12 * Math.floor(n / 5) + PLAYER_SHIFT[((playerId % 4) + 4) % 4];
  return ROOT_HZ * Math.pow(2, semis / 12);
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    // Nén nhẹ để nhiều nốt liên tiếp không chói tai
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Một nốt "gỗ": sóng sin + hài bậc 4 (đặc trưng marimba) tắt nhanh */
function pluck(ac: AudioContext, t: number, hz: number, vol: number, decay: number) {
  const cents = (Math.random() * 2 - 1) * 4;
  const f = hz * Math.pow(2, cents / 1200);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(master as GainNode);
  const o1 = ac.createOscillator();
  o1.type = "sine";
  o1.frequency.value = f;
  o1.connect(g);
  o1.start(t);
  o1.stop(t + decay + 0.02);
  // Hài bậc 4: tắt nhanh hơn thân nốt -> tiếng "cộc" tròn
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.004);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.35);
  g2.connect(master as GainNode);
  const o2 = ac.createOscillator();
  o2.type = "sine";
  o2.frequency.value = f * 4;
  o2.connect(g2);
  o2.start(t);
  o2.stop(t + decay * 0.4);
}

/** "Pop" nhỏ khi chân chạm ô: sin trượt xuống nhanh */
function pop(ac: AudioContext, t: number, hz: number, vol: number) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  g.connect(master as GainNode);
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(hz * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(hz * 0.5, t + 0.07);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.1);
}

export function playStepLand(opts: { last?: boolean; playerId?: number; step?: number } = {}) {
  if (!stepSoundEnabled()) return;
  try {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.005;
    const vol = (v: number) => v * (1 + (Math.random() * 2 - 1) * 0.08);
    const hz = stepNoteHz(opts.step ?? 0, opts.playerId ?? 0);
    if (opts.last) {
      // Bước cuối: hợp âm trưởng sáng (gốc – quãng 3 – quãng 5) + pop trầm "đã tới nơi"
      pop(ac, t, hz * 0.5, vol(0.16));
      pluck(ac, t, hz, vol(0.12), 0.55);
      pluck(ac, t + 0.012, hz * Math.pow(2, 4 / 12), vol(0.09), 0.5);
      pluck(ac, t + 0.024, hz * Math.pow(2, 7 / 12), vol(0.09), 0.6);
      pluck(ac, t + 0.04, hz * 2, vol(0.06), 0.7);
    } else {
      pop(ac, t, hz * 0.5, vol(0.05));
      pluck(ac, t, hz, vol(0.11), 0.2);
    }
  } catch {
    /* âm thanh là phụ, bỏ qua lỗi */
  }
}

// ---------------------------------------------------------------------------
// Âm máy bay (đi Du lịch): cất cánh -> động cơ cánh quạt vo ve -> hạ cánh
// ---------------------------------------------------------------------------
let noiseBuf: AudioBuffer | null = null;
function noise(ac: AudioContext) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/**
 * Tiếng chuyến bay kéo dài `dur` giây:
 *  - chuông "ting" báo cất cánh
 *  - động cơ: sóng răng cưa trầm có rung (cánh quạt) lên cao khi cất cánh, hạ xuống khi hạ cánh
 *  - gió vù: nhiễu lọc, quét tần số theo độ cao cung bay
 *  - chuông hạ cánh êm ở cuối (do playFlightLand)
 */
export function playFlight(dur = 1.9) {
  if (!stepSoundEnabled()) return;
  try {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.01;
    const end = t + dur;
    const mid = t + dur * 0.5;

    // Chuông cất cánh: hai nốt đi lên
    pluck(ac, t, 784, 0.1, 0.35);
    pluck(ac, t + 0.09, 1175, 0.08, 0.4);

    // Động cơ cánh quạt
    const eng = ac.createOscillator();
    eng.type = "sawtooth";
    eng.frequency.setValueAtTime(70, t);
    eng.frequency.exponentialRampToValueAtTime(125, mid);
    eng.frequency.exponentialRampToValueAtTime(80, end);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const trem = ac.createGain(); // cánh quạt quay: biên độ rung nhanh
    trem.gain.value = 0.55;
    const lfo = ac.createOscillator();
    lfo.frequency.setValueAtTime(14, t);
    lfo.frequency.linearRampToValueAtTime(24, mid);
    lfo.frequency.linearRampToValueAtTime(15, end);
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth).connect(trem.gain);
    const eg = ac.createGain();
    eg.gain.setValueAtTime(0.0001, t);
    eg.gain.exponentialRampToValueAtTime(0.07, t + 0.25);
    eg.gain.setValueAtTime(0.07, end - 0.35);
    eg.gain.exponentialRampToValueAtTime(0.0001, end);
    eng.connect(lp).connect(trem).connect(eg).connect(master as GainNode);
    eng.start(t);
    lfo.start(t);
    eng.stop(end + 0.05);
    lfo.stop(end + 0.05);

    // Gió vù: nhiễu băng thông quét lên đỉnh cung rồi xuống
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1800, mid);
    bp.frequency.exponentialRampToValueAtTime(600, end);
    const wg = ac.createGain();
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.3);
    wg.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(bp).connect(wg).connect(master as GainNode);
    src.start(t);
    src.stop(end + 0.05);
  } catch {
    /* âm thanh là phụ */
  }
}

/** Hạ cánh êm: chuông xuống nhẹ + "pop" trầm */
export function playFlightLand() {
  if (!stepSoundEnabled()) return;
  try {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.005;
    pop(ac, t, 180, 0.15);
    pluck(ac, t, 988, 0.09, 0.5);
    pluck(ac, t + 0.1, 784, 0.09, 0.55);
    pluck(ac, t + 0.2, 587, 0.1, 0.7);
  } catch {
    /* bỏ qua */
  }
}

// ---------------------------------------------------------------------------
// Âm xúc xắc: lắc lóc cóc trong tay -> lăn & nảy trên bàn (thưa dần) -> dừng
// ---------------------------------------------------------------------------

/** Một tiếng "cạch" của xúc xắc nhựa: nhiễu ngắn lọc dải cao + tiếng gõ trầm của mặt bàn */
function clack(ac: AudioContext, t: number, vol: number, bright = 1) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = (2600 + Math.random() * 1800) * bright;
  bp.Q.value = 2.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035 + Math.random() * 0.02);
  src.connect(bp).connect(g).connect(master as GainNode);
  src.start(t, Math.random() * 1.5);
  src.stop(t + 0.07);
  // Gõ vào mặt bàn gỗ
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(420 + Math.random() * 120, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(og).connect(master as GainNode);
  o.start(t);
  o.stop(t + 0.07);
}

/** Tiếng lắc + lăn xúc xắc, kéo dài khoảng `dur` giây (khớp hoạt ảnh xoay) */
export function playDiceRoll(dur = 1.3) {
  if (!stepSoundEnabled()) return;
  try {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01;
    // 1. Lắc trong tay: chuỗi cạch nhỏ dày đặc
    for (let i = 0; i < 7; i++) {
      clack(ac, t0 + i * 0.028 + Math.random() * 0.01, 0.05 + Math.random() * 0.03, 1.15);
    }
    // 2. Lăn trên bàn: 2 viên, mỗi viên nảy thưa dần & nhỏ dần
    const start = t0 + 0.22;
    const span = dur - 0.22;
    for (let die = 0; die < 2; die++) {
      let x = die * 0.04;
      let gap = 0.06;
      let vol = 0.22;
      while (x < span) {
        clack(ac, start + x, vol);
        gap *= 1.32 + Math.random() * 0.12;
        vol *= 0.84;
        x += gap;
      }
    }
  } catch {
    /* âm thanh là phụ */
  }
}

/** Xúc xắc dừng: tiếng "ting" báo kết quả; ra đôi thì vui hơn */
export function playDiceResult(double = false) {
  if (!stepSoundEnabled()) return;
  try {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.005;
    pluck(ac, t, 784, 0.1, 0.4);
    pluck(ac, t + 0.07, 1175, 0.09, 0.5);
    if (double) {
      pluck(ac, t + 0.14, 1568, 0.09, 0.6);
      pluck(ac, t + 0.21, 2093, 0.07, 0.7);
    }
  } catch {
    /* bỏ qua */
  }
}
