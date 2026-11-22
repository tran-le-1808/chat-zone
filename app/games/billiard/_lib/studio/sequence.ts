/**
 * TRÌNH TỰ VIDEO (cinematic template): intro → thế bi → xem trước đường dự kiến → cú đánh thật →
 * quay chậm (phát lại quỹ đạo đã xác minh ở tốc độ thấp) → kết quả. Thời lượng tính từ thời lượng cú đánh thật.
 */
import type { SceneSpec } from "./types";

export type VideoMode = "CLEAN" | "COACH" | "CINEMATIC";

export interface SequenceOptions {
  mode: VideoMode;
  /** Thời lượng cú đánh (giây, từ mô phỏng) */
  shotDuration: number;
  replay: boolean;
  replayRate?: number;
  introOutro?: boolean;
}

export function buildSequence(o: SequenceOptions): SceneSpec[] {
  const scenes: SceneSpec[] = [];
  let t = 0;
  const push = (id: SceneSpec["id"], dur: number, playbackRate?: number) => {
    scenes.push({ id, start: t, end: t + dur, ...(playbackRate ? { playbackRate } : {}) });
    t += dur;
  };
  const shot = Math.max(1, o.shotDuration) + 0.8; // thêm chút để thấy bi dừng hẳn
  if (o.mode === "CLEAN") {
    push("setup", 1.2);
    push("shot", shot, 1);
    push("result", 1.2);
    return scenes;
  }
  const intro = o.introOutro !== false;
  if (intro) push("intro", 4);
  push("setup", 5.5);
  push("aim", 5);
  push("shot", shot, 1);
  if (o.replay && o.mode === "CINEMATIC") {
    const rate = o.replayRate ?? 0.45;
    // quay chậm tối đa ~14 giây: cú dài thì chỉ chậm phần đầu (nơi có các điểm chạm chính)
    push("replay", Math.min(14, o.shotDuration / rate), rate);
  }
  push("result", intro ? 3.5 : 2.5);
  return scenes;
}

export function sceneAt(scenes: SceneSpec[], t: number): SceneSpec | null {
  return scenes.find((s) => t >= s.start && t < s.end) ?? null;
}

export function totalDuration(scenes: SceneSpec[]): number {
  return scenes.length ? scenes[scenes.length - 1].end : 0;
}

/** Dời toàn bộ cảnh của một cú đi `offset` giây (để nối nhiều cú thành một video) */
export function shiftScenes(scenes: SceneSpec[], offset: number): SceneSpec[] {
  return scenes.map((s) => ({ ...s, start: s.start + offset, end: s.end + offset }));
}
