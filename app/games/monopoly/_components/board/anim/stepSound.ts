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
