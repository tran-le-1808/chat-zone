/**
 * TRẬN CỤC BỘ (tự luyện / đấu bot) — chạy ngay trên máy, không qua server. Luật tính điểm, lượt, thống kê
 * giống hệt server (login-system/src/billiard/billiard-room.service.ts): ghi điểm thì đánh tiếp, hụt thì mất lượt;
 * ghế 0 dùng bi trắng, ghế 1 dùng bi vàng. Mỗi thay đổi tạo snapshot mới (seq tăng) để giao diện cập nhật.
 */
import {
  checkCueClearance,
  DEFAULT_PHYSICS,
  initialPositions,
  judgeShot,
  sanitizeShot,
  simulateShot,
  validateShotInput,
  type BallId,
  type BallPositions,
  type CaromMode,
  type ShotCommand,
} from "../physics";
import type { BilliardMatch, CompactEvent, PlayerStats } from "../types";

/** Thời gian chờ sau khi bi dừng trước khi được đánh tiếp (giống server) */
export const SETTLE_MS = 700;
/** Tự luyện không có mục tiêu điểm */
export const PRACTICE_TARGET = 9999;

export type LocalKind = "practice" | "bot";

export interface LocalMatchOptions {
  kind: LocalKind;
  mode: CaromMode;
  /** Điểm để thắng (đấu bot) */
  target: number;
  /** Mã người chơi (ghế 0) và bot (ghế 1) */
  me: string;
  bot?: string;
  guideline?: boolean;
  /** Giờ hệ thống (tiêm vào để test) */
  now?: () => number;
}

export type ShotInputCmd = Omit<ShotCommand, "cue">;

const emptyStats = (): PlayerStats => ({ shots: 0, points: 0, bestRun: 0, currentRun: 0, innings: 0 });
const clone = (p: BallPositions): BallPositions => p.map(([x, y]) => [x, y]);

/** Toạ độ hợp lệ: trong mặt thi đấu, không chồng bi khác */
export function validPlacement(balls: BallPositions, id: BallId, x: number, y: number): boolean {
  const c = DEFAULT_PHYSICS;
  const R = c.ballRadius;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (Math.abs(x) > c.tableWidth / 2 - R || Math.abs(y) > c.tableHeight / 2 - R) return false;
  return balls.every(([bx, by], i) => i === id || Math.hypot(bx - x, by - y) >= 2 * R + 1e-4);
}

/** Kẹp toạ độ vào trong mặt thi đấu */
export function clampToTable(x: number, y: number): [number, number] {
  const c = DEFAULT_PHYSICS;
  const hx = c.tableWidth / 2 - c.ballRadius - 1e-4;
  const hy = c.tableHeight / 2 - c.ballRadius - 1e-4;
  return [Math.max(-hx, Math.min(hx, x)), Math.max(-hy, Math.min(hy, y))];
}

export class LocalCaromMatch {
  readonly opts: LocalMatchOptions;
  match: BilliardMatch;
  /** Thế bi trước mỗi cú (để "đánh lại") */
  private history: { balls: BallPositions; turn: number; scores: number[]; stats: PlayerStats[] }[] = [];
  private listeners = new Set<(m: BilliardMatch) => void>();
  private now: () => number;

  constructor(opts: LocalMatchOptions) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
    const t = this.now();
    const players = opts.kind === "bot" ? [opts.me, opts.bot ?? "bot"] : [opts.me, opts.me];
    this.match = {
      seq: 0,
      mode: opts.mode,
      target: opts.kind === "bot" ? opts.target : PRACTICE_TARGET,
      guideline: opts.guideline ?? true,
      balls: initialPositions(),
      players,
      scores: [0, 0],
      stats: [{ ...emptyStats(), innings: 1 }, emptyStats()],
      turn: 0,
      busyUntil: t,
      turnDeadline: t + 365 * 86400_000,
      lastShot: null,
      winner: null,
      startedAt: t,
      serverNow: t,
      turnSeconds: 0,
    };
  }

  subscribe(fn: (m: BilliardMatch) => void): () => void {
    this.listeners.add(fn);
    fn(this.match);
    return () => this.listeners.delete(fn);
  }

  private publish(patch: Partial<BilliardMatch>): void {
    const t = this.now();
    this.match = { ...this.match, ...patch, seq: this.match.seq + 1, serverNow: t };
    for (const fn of this.listeners) fn(this.match);
  }

  busy(): boolean {
    return this.now() < this.match.busyUntil;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Đánh cú của ghế `by` — cùng kiểm tra như server */
  shoot(input: ShotInputCmd, by: number): { ok: boolean; error?: string } {
    const m = this.match;
    if (m.winner !== null) return { ok: false, error: "Trận đấu đã kết thúc" };
    if (m.turn !== by) return { ok: false, error: "Chưa tới lượt" };
    if (this.busy()) return { ok: false, error: "Bi vẫn đang lăn" };
    const invalid = validateShotInput(input);
    if (invalid) return { ok: false, error: invalid };
    const cue = m.turn as BallId;
    const shot = sanitizeShot(input, cue);
    const start = clone(m.balls);
    const clearance = checkCueClearance(start, shot, DEFAULT_PHYSICS);
    if (!clearance.ok) return { ok: false, error: `${clearance.reason}${clearance.minElevation !== null ? ` — hãy nâng cơ tối thiểu ${clearance.minElevation}°` : ""}` };
    const res = simulateShot(start, shot, DEFAULT_PHYSICS, { recordFrames: true });
    const verdict = judgeShot(res.events, cue, { mode: m.mode });
    const t = this.now();
    this.history.push({ balls: start, turn: m.turn, scores: [...m.scores], stats: m.stats.map((s) => ({ ...s })) });
    if (this.history.length > 50) this.history.shift();
    const stats = m.stats.map((s) => ({ ...s }));
    const scores = [...m.scores];
    const st = stats[by];
    st.shots += 1;
    let turn = m.turn;
    let winner: number | null = null;
    if (verdict.scored) {
      scores[by] += 1;
      st.points += 1;
      st.currentRun += 1;
      st.bestRun = Math.max(st.bestRun, st.currentRun);
      if (scores[by] >= m.target) winner = by;
    } else {
      st.currentRun = 0;
      // tự luyện: không đổi lượt; đấu bot: sang ghế kia
      if (this.opts.kind === "bot") {
        turn = (turn + 1) % 2;
        stats[turn].innings += 1;
      }
    }
    const busyUntil = t + Math.ceil(res.duration * 1000) + SETTLE_MS;
    this.publish({
      balls: res.final,
      scores,
      stats,
      turn,
      winner,
      ...(winner !== null ? { endedAt: t } : {}),
      busyUntil,
      turnDeadline: busyUntil + 365 * 86400_000,
      lastShot: {
        seq: m.seq + 1,
        shotId: `local-${m.seq + 1}`,
        by,
        shot,
        start,
        final: res.final,
        frames: res.frames,
        events: res.events.map((e): CompactEvent => ({ t: Math.round(e.t * 1000) / 1000, type: e.type, speed: Math.round(e.speed * 100) / 100, ball: e.type === "cushion" ? e.ball : undefined })),
        verdict,
        duration: res.duration,
        at: t,
      },
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- công cụ tự luyện

  private editable(): boolean {
    return this.opts.kind === "practice" && !this.busy();
  }

  /** Kéo thả một bi (tự luyện). Trả về false nếu vị trí không hợp lệ (giữ nguyên chỗ cũ). */
  placeBall(id: BallId, x: number, y: number): boolean {
    if (!this.editable()) return false;
    const [cx, cy] = clampToTable(x, y);
    if (!validPlacement(this.match.balls, id, cx, cy)) return false;
    const balls = clone(this.match.balls);
    balls[id] = [Math.round(cx * 1e4) / 1e4, Math.round(cy * 1e4) / 1e4];
    this.publish({ balls, lastShot: null, busyUntil: this.now() });
    return true;
  }

  /** Đặt cả thế bi (khai cuộc / ngẫu nhiên / thế bi trong thư viện) */
  setLayout(balls: BallPositions): boolean {
    if (!this.editable()) return false;
    for (let i = 0; i < 3; i++) if (!validPlacement(balls, i as BallId, balls[i][0], balls[i][1])) return false;
    this.publish({ balls: clone(balls), lastShot: null, busyUntil: this.now() });
    return true;
  }

  /** Chọn bi cái khi tự luyện: 0 trắng, 1 vàng */
  setCueBall(id: 0 | 1): void {
    if (!this.editable() || this.match.turn === id) return;
    this.publish({ turn: id, lastShot: null, busyUntil: this.now() });
  }

  /** Đánh lại: quay về thế bi trước cú vừa rồi (điểm / thống kê cũng quay lại) */
  undo(): boolean {
    if (this.opts.kind !== "practice" || this.busy()) return false;
    const h = this.history.pop();
    if (!h) return false;
    this.publish({ balls: h.balls, turn: h.turn, scores: h.scores, stats: h.stats, winner: null, lastShot: null, busyUntil: this.now() });
    return true;
  }

  /** Ván mới (giữ cấu hình) */
  restart(): void {
    const t = this.now();
    this.history = [];
    this.publish({
      balls: initialPositions(),
      scores: [0, 0],
      stats: [{ ...emptyStats(), innings: 1 }, emptyStats()],
      turn: 0,
      winner: null,
      endedAt: undefined,
      lastShot: null,
      busyUntil: t,
      startedAt: t,
    });
  }
}
