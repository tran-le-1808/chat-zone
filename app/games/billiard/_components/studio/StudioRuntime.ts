/**
 * Bộ chạy video của AI Shot Studio (không phải React state): giữ đồng hồ, cảnh hiện tại, phát âm va chạm
 * đúng thời điểm physics, đọc thuyết minh theo mốc, giảm âm game khi đang nói, báo tiến độ / kết thúc.
 * Tách khỏi trận đấu thật: chỉ đọc dữ liệu cú đánh đã mô phỏng, không gửi gì lên server.
 */
import { billiardSound } from "../../_lib/sound";
import { restSamples, type BallSample } from "../../_lib/playback";
import type { BallPositions, ShotCommand } from "../../_lib/physics";
import { eventsBetween, frameAt, totalDuration, type DirectorFrame, type NarrationSegment, type SceneSpec, type ShotAnalysis, type VideoMode } from "../../_lib/studio";
import { speak, stopSpeaking } from "../../_lib/studio/tts";

export type CameraMode = "top" | "angle" | "cinematic";

export interface StudioJob {
  scenes: SceneSpec[];
  predicted: ShotAnalysis;
  actual: ShotAnalysis;
  shot: ShotCommand;
  segments: NarrationSegment[];
  title: string;
  subtitle: string;
  difficulty: string;
  tags: string[];
  techniqueLabels: string[];
  mismatch: string | null;
  mode: VideoMode;
  annotate: boolean;
  captions: boolean;
  camera: CameraMode;
  gameAudio: boolean;
  voice: { enabled: boolean; voice: SpeechSynthesisVoice | null; rate: number; duck: boolean };
}

export class StudioRuntime {
  job: StudioJob | null = null;
  idle: BallPositions = [];
  frame: DirectorFrame | null = null;
  private t0 = 0;
  private pausedAt: number | null = null;
  private lastPhys = -1;
  private lastScene: string | null = null;
  private spoken = new Set<number>();
  private speakingUntil = 0;
  /** Nhịp vẽ tối đa (khung/giây): ghi hình = fps đã chọn; xem trước = 60 (kể cả màn 120 Hz) */
  private targetFps = 60;
  private nextDraw = 0;
  private frameSink: (() => void) | null = null;
  /** Số khung đã vẽ + đẩy vào video kể từ setPacing (để báo fps thực tế sau khi quay) */
  framesDrawn = 0;
  onProgress: ((t: number, total: number, scene: string) => void) | null = null;
  onDone: (() => void) | null = null;

  setPacing(fps: number, sink: (() => void) | null): void {
    this.targetFps = fps;
    this.frameSink = sink;
    this.nextDraw = 0;
    this.framesDrawn = 0;
  }

  /**
   * true nếu đã tới lúc vẽ khung kế tiếp. Dùng mốc cố định (nextDraw += chu kỳ) thay vì đo khoảng cách từ lần vẽ trước,
   * nên nhịp không trôi / không lỡ nhịp do sai số của vsync; màn hình 120 Hz không vẽ thừa.
   */
  shouldDraw(ms: number): boolean {
    const interval = 1000 / this.targetFps;
    // cho phép sớm tối đa nửa chu kỳ của màn hình 60 Hz (~8 ms) để khớp vsync
    if (ms < this.nextDraw - Math.min(8, interval / 2)) return false;
    // lỡ nhịp quá xa (tab bị treo, máy chậm): đặt lại mốc thay vì vẽ bù dồn dập
    this.nextDraw = ms - this.nextDraw > interval * 2 ? ms + interval : this.nextDraw + interval;
    return true;
  }

  /** Báo đã vẽ xong một khung — đẩy vào video đang ghi */
  frameDrawn(): void {
    this.framesDrawn++;
    this.frameSink?.();
  }

  setIdle(pos: BallPositions): void {
    this.idle = pos;
  }

  setHandlers(onProgress: StudioRuntime["onProgress"], onDone: StudioRuntime["onDone"]): void {
    this.onProgress = onProgress;
    this.onDone = onDone;
  }

  get playing(): boolean {
    return !!this.job;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  play(job: StudioJob): void {
    this.stop();
    this.job = job;
    this.t0 = performance.now();
    this.pausedAt = null;
    this.lastPhys = -1;
    this.lastScene = null;
    this.spoken.clear();
    billiardSound.unlock();
  }

  pause(on: boolean): void {
    if (!this.job) return;
    if (on && this.pausedAt === null) {
      this.pausedAt = performance.now();
      stopSpeaking();
    } else if (!on && this.pausedAt !== null) {
      this.t0 += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  stop(): void {
    this.job = null;
    this.frame = null;
    this.pausedAt = null;
    this.frameSink = null;
    this.targetFps = 60;
    stopSpeaking();
    billiardSound.duck(1);
  }

  /** Thời điểm video hiện tại (giây) */
  now(ms: number): number {
    return ((this.pausedAt ?? ms) - this.t0) / 1000;
  }

  /** Gọi mỗi khung hình trước khi render */
  update(ms: number): void {
    const job = this.job;
    if (!job) return;
    const total = totalDuration(job.scenes);
    const t = Math.min(this.now(ms), total);
    const f = frameAt(job.scenes, job.actual, t);
    this.frame = f;
    const sceneId = f.scene?.id ?? "";
    // âm thanh va chạm theo đúng thời điểm physics (cả lúc quay chậm)
    if (sceneId !== this.lastScene) this.lastPhys = -1;
    this.lastScene = sceneId;
    if (job.gameAudio && f.physicsT !== null && this.pausedAt === null) {
      const slow = sceneId === "replay";
      for (const e of eventsBetween(job.actual.events, this.lastPhys, f.physicsT)) {
        const k = Math.min(1, e.speed / 3);
        billiardSound.play(e.type, (e.type === "cue" ? k + 0.2 : k) * (slow ? 0.6 : 1));
      }
      this.lastPhys = f.physicsT;
    }
    // thuyết minh
    if (job.voice.enabled && this.pausedAt === null) {
      job.segments.forEach((s, i) => {
        if (this.spoken.has(i) || t < s.start || t > s.end) return;
        this.spoken.add(i);
        if (job.voice.duck) billiardSound.duck(0.35);
        this.speakingUntil = s.end;
        void speak(s.text, { voice: job.voice.voice, rate: job.voice.rate });
      });
      if (job.voice.duck && t > this.speakingUntil) billiardSound.duck(1);
    }
    this.onProgress?.(t, total, sceneId);
    if (t >= total && this.pausedAt === null) {
      const done = this.onDone;
      this.stop();
      done?.();
    }
  }

  sample(): BallSample[] {
    return this.frame?.balls ?? restSamples(this.idle);
  }
}
