/**
 * LỜI THUYẾT MINH tiếng Việt sinh từ DỮ LIỆU ĐÃ XÁC MINH (phân tích mô phỏng), theo phong cách giọng.
 * Quy tắc: chỉ nói kỹ thuật thật sự được dùng VÀ đo thấy trong mô phỏng (vd. chỉ nói "draw" khi đánh dưới tâm
 * và bi cái thực sự lùi). Có mốc thời gian theo cảnh + phụ đề WebVTT / SRT.
 */
import type { BallId, ShotCommand } from "../physics";
import { TIP_INTENT } from "./analysis";
import { CATEGORY_INFO } from "./search";
import type { NarrationScript, NarrationSegment, SceneSpec, ShotAnalysis, ShotScenarioCategory, VoiceStyle } from "./types";

export const BALL_VI: Record<BallId, string> = { 0: "bi trắng", 1: "bi vàng", 2: "bi đỏ" };
const RAIL_VI = { left: "băng ngắn trái", right: "băng ngắn phải", bottom: "băng dài dưới", top: "băng dài trên" } as const;

/** Tốc độ nói ước lượng (ký tự / giây) ở tốc độ 1 */
export const CHARS_PER_SECOND = 16;
export const speechSeconds = (text: string, rate = 1) => Math.max(0.8, text.length / (CHARS_PER_SECOND * rate)) + 0.25;

function area(x: number, y: number): string {
  const side = x < -0.47 ? "đầu bàn" : x > 0.47 ? "cuối bàn" : "giữa bàn";
  const lane = y > 0.3 ? " phía trên" : y < -0.3 ? " phía dưới" : "";
  return side + lane;
}

function tipText(s: ShotCommand): string {
  const v = s.tipY >= TIP_INTENT.vertical ? "trên tâm" : s.tipY <= -TIP_INTENT.vertical ? "dưới tâm" : "gần giữa tâm";
  const h = s.tipX >= TIP_INTENT.side ? ", lệch phải" : s.tipX <= -TIP_INTENT.side ? ", lệch trái" : "";
  return v + h;
}

const powerText = (p: number) => (p >= 0.75 ? "lực mạnh" : p >= 0.5 ? "lực vừa" : p >= 0.3 ? "lực nhẹ vừa" : "lực rất nhẹ");

function thicknessText(a: ShotAnalysis): string {
  const c = a.cutAngleDeg ?? 0;
  if (c <= 12) return "đánh dày, gần chính diện";
  if (c >= 55) return `cắt rất mỏng, khoảng ${Math.round(c)} độ`;
  if (c >= 35) return `cắt mỏng, khoảng ${Math.round(c)} độ`;
  return `cắt vừa, khoảng ${Math.round(c)} độ`;
}

/** Hiệu ứng sau va chạm — chỉ khẳng định spin khi đầu vào VÀ mô phỏng cùng xác nhận */
export function spinSentence(s: ShotCommand, a: ShotAnalysis): string | null {
  if (a.spinEffect === "DRAW" && s.tipY <= -TIP_INTENT.vertical) return "Spin dưới kéo bi trắng lùi lại sau va chạm.";
  if (a.spinEffect === "FOLLOW" && s.tipY >= TIP_INTENT.vertical) return "Spin trên giúp bi trắng tiếp tục lăn tiến sau va chạm.";
  if (a.spinEffect === "FOLLOW") return "Bi trắng lăn tự nhiên về phía trước sau va chạm.";
  if (a.spinEffect === "STUN") return (a.cutAngleDeg ?? 0) <= 12 ? "Bi trắng gần như dừng lại ở điểm va chạm." : "Bi trắng tách ra theo đường tiếp tuyến.";
  return null;
}

interface Phrases {
  intro: (title: string, cat: ShotScenarioCategory) => string;
  setup: (a: ShotAnalysis, cue: BallId, first: BallId | null) => string;
  technique: (s: ShotCommand, a: ShotAnalysis) => string;
  action: string;
  firstContact: (b: BallId, a: ShotAnalysis) => string;
  cushion: (n: number, rail: string) => string;
  second: (b: BallId) => string;
  replay: string;
  conclusion: (a: ShotAnalysis) => string;
}

const base = (a: ShotAnalysis, cue: BallId, first: BallId | null) => {
  const [cx, cy] = a.start[cue];
  const others = ([0, 1, 2] as BallId[]).filter((b) => b !== cue);
  const f = first ?? others[0];
  const s = others.find((b) => b !== f)!;
  return `${cap(BALL_VI[cue])} ở ${area(cx, cy)}, ${BALL_VI[f]} ${area(a.start[f][0], a.start[f][1])}, ${BALL_VI[s]} ${area(a.start[s][0], a.start[s][1])}.`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function conclusionCommon(a: ShotAnalysis): string {
  const pos = a.finalSpread <= 0.6 ? " Ba bi dừng gần nhau, thế bi tiếp theo rất thuận lợi." : "";
  return a.verdict.scored ? `Ghi điểm${a.cushionsBeforeSecond ? ` sau ${a.cushionsBeforeSecond} băng` : ""}.${pos}` : `Không ghi điểm: ${a.verdict.reason.toLowerCase()}.`;
}

const STYLES: Record<VoiceStyle, Phrases> = {
  COACH: {
    intro: (t, c) => `Bài tập hôm nay: ${t}. Kỹ thuật chính là ${CATEGORY_INFO[c].name.toLowerCase()}.`,
    setup: base,
    technique: (s, a) => `Chúng ta ${thicknessText(a)}, đánh ${tipText(s)}, ${powerText(s.power)}.`,
    action: "Ra cơ.",
    firstContact: (b, a) => `Chạm ${BALL_VI[b]}, ${thicknessText(a)}.`,
    cushion: (n, r) => `Băng ${n}, ${r}.`,
    second: (b) => `Chạm ${BALL_VI[b]}!`,
    replay: "Xem chậm lại: hãy chú ý hướng bi trắng ngay sau điểm chạm đầu tiên.",
    conclusion: (a) => `${conclusionCommon(a)} Kiểm soát lực và điểm chạm là chìa khoá của cú này.`,
  },
  SPORTS_COMMENTATOR: {
    intro: (t) => `Xin chào quý vị! Cùng đến với pha bóng: ${t}!`,
    setup: base,
    technique: (s, a) => `Cơ thủ chọn ${thicknessText(a)}, điểm chạm ${tipText(s)}, ${powerText(s.power)}!`,
    action: "Ra cơ!",
    firstContact: (b) => `Trúng ${BALL_VI[b]}!`,
    cushion: (n) => `Băng ${n}!`,
    second: (b) => `Và chạm ${BALL_VI[b]}! Tuyệt vời!`,
    replay: "Hãy cùng xem lại pha bóng này ở tốc độ chậm!",
    conclusion: (a) => (a.verdict.scored ? `Một điểm cực kỳ đẹp mắt! ${conclusionCommon(a)}` : conclusionCommon(a)),
  },
  CALM_ANALYST: {
    intro: (t, c) => `Phân tích tình huống: ${t}. Nhóm kỹ thuật: ${CATEGORY_INFO[c].name.toLowerCase()}.`,
    setup: base,
    technique: (s, a) => `Lựa chọn ở đây là ${thicknessText(a)}. Điểm chạm đầu cơ ${tipText(s)}, ${powerText(s.power)}, để kiểm soát đường đi của bi trắng.`,
    action: "Cú đánh được thực hiện.",
    firstContact: (b, a) => `Tiếp xúc đầu tiên với ${BALL_VI[b]}, ${thicknessText(a)}.`,
    cushion: (n, r) => `Lần chạm băng thứ ${n}, ${r}.`,
    second: (b) => `Tiếp xúc ${BALL_VI[b]}.`,
    replay: "Ở tốc độ chậm, có thể thấy rõ bi trắng đổi hướng sau từng điểm chạm.",
    conclusion: (a) => conclusionCommon(a),
  },
  SHORTS: {
    intro: (t) => `${t}. Xem nè!`,
    setup: () => "Thế bi này đánh sao?",
    technique: (s, a) => `${cap(thicknessText(a))}, ${tipText(s)}.`,
    action: "Đánh!",
    firstContact: (b) => `${cap(BALL_VI[b])}!`,
    cushion: (n) => `Băng ${n}!`,
    second: (b) => `${cap(BALL_VI[b])}! Ăn điểm!`,
    replay: "Chậm lại nè.",
    conclusion: (a) => (a.verdict.scored ? "Quá đẹp!" : "Hụt mất rồi."),
  },
  CINEMATIC: {
    intro: (t) => `${t}. Một đường bi, một quyết định.`,
    setup: base,
    technique: (s, a) => `${cap(thicknessText(a))}. Đầu cơ ${tipText(s)}. ${cap(powerText(s.power))}.`,
    action: "Và… ra cơ.",
    firstContact: (b) => `${cap(BALL_VI[b])}.`,
    cushion: (n) => `Băng ${n}.`,
    second: (b) => `${cap(BALL_VI[b])}.`,
    replay: "Từng khoảnh khắc, chậm lại.",
    conclusion: (a) => (a.verdict.scored ? `${conclusionCommon(a)} Đúng như tính toán.` : conclusionCommon(a)),
  },
};

export interface NarrationInput {
  title: string;
  category: ShotScenarioCategory;
  shot: ShotCommand;
  analysis: ShotAnalysis;
  scenes: SceneSpec[];
  style: VoiceStyle;
  /** Tốc độ nói (1 = bình thường) */
  rate?: number;
  /** Mức chi tiết: tắt bình luận từng băng khi "brief" */
  detail?: "brief" | "full";
}

export function buildNarration(i: NarrationInput): NarrationScript {
  const p = STYLES[i.style];
  const a = i.analysis;
  const cue = i.shot.cue;
  const rate = i.rate ?? 1;
  const segs: NarrationSegment[] = [];
  let busyUntil = 0;
  /** Nói câu `text` từ thời điểm `at`; phải xong trước `limit` (mặc định: cuối cảnh), không thì bỏ — không nói dồn / chồng */
  const say = (scene: SceneSpec | undefined, at: number, text: string, limit?: number) => {
    if (!scene || !text) return;
    const start = Math.max(at, busyUntil);
    const end = start + speechSeconds(text, rate);
    if (end > (limit ?? scene.end + 0.4)) return;
    segs.push({ start: round2(start), end: round2(end), text, scene: scene.id });
    busyUntil = end + 0.15;
  };
  const sc = (id: SceneSpec["id"]) => i.scenes.find((s) => s.id === id);
  const intro = p.intro(i.title, i.category);
  const first = a.verdict.firstBall;
  const setup = p.setup(a, cue, first);
  const spin = spinSentence(i.shot, a);
  const technique = p.technique(i.shot, a) + (i.analysis.english !== "NONE" ? ` Thêm english ${i.analysis.english === "LEFT" ? "trái" : "phải"} để đổi góc bật băng.` : "");
  const conclusion = p.conclusion(a);
  const plays: string[] = [];

  const sIntro = sc("intro");
  const sSetup = sc("setup");
  const sAim = sc("aim");
  const sShot = sc("shot");
  // các câu trước cú đánh được nói nối tiếp qua 3 cảnh đầu, nhưng phải xong trước lúc ra cơ
  const preLimit = sShot ? sShot.start - 0.1 : undefined;
  if (sIntro) say(sIntro, sIntro.start + 0.3, intro, preLimit);
  if (sSetup) say(sSetup, sSetup.start + 0.2, setup, preLimit);
  if (sAim) say(sAim, sAim.start + 0.1, technique, preLimit);
  if (sShot) {
    busyUntil = Math.min(busyUntil, sShot.start);
    say(sShot, sShot.start, p.action);
    // bình luận theo sự kiện của bi cái — đúng thời điểm trong mô phỏng
    let secondDone = false;
    for (const c of a.contacts) {
      if (c.ball !== cue) continue;
      let text = "";
      if (c.kind === "ball" && c.other === first && !plays.length) text = p.firstContact(c.other, a);
      else if (c.kind === "ball" && c.other !== undefined && c.other === a.verdict.secondBall && !secondDone) {
        text = p.second(c.other);
        secondDone = true;
      } else if (c.kind === "cushion" && i.detail !== "brief" && !secondDone && c.cushionIndex && c.cushionIndex <= 4) text = p.cushion(c.cushionIndex, RAIL_VI[c.rail ?? "top"]);
      if (!text) continue;
      plays.push(text);
      say(sShot, sShot.start + c.t, text);
    }
    if (spin && i.style !== "SHORTS") say(sShot, busyUntil, spin);
  }
  const sReplay = sc("replay");
  if (sReplay) say(sReplay, sReplay.start + 0.3, p.replay);
  const sRes = sc("result");
  if (sRes) say(sRes, sRes.start + 0.2, conclusion, Infinity);
  return { intro, technique: `${technique}${spin ? ` ${spin}` : ""}`, playByPlay: plays, conclusion, segments: segs };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function stamp(t: number, sep: "." | ","): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)}${sep}${String(r).padStart(3, "0")}`;
}

export function toWebVTT(segs: NarrationSegment[]): string {
  return ["WEBVTT", "", ...segs.map((s, i) => `${i + 1}\n${stamp(s.start, ".")} --> ${stamp(s.end, ".")}\n${s.text}\n`)].join("\n");
}

export function toSRT(segs: NarrationSegment[]): string {
  return segs.map((s, i) => `${i + 1}\n${stamp(s.start, ",")} --> ${stamp(s.end, ",")}\n${s.text}\n`).join("\n");
}

/** Phụ đề đang hiện tại thời điểm t */
export function captionAt(segs: NarrationSegment[], t: number): NarrationSegment | null {
  return segs.find((s) => t >= s.start && t < s.end) ?? null;
}
