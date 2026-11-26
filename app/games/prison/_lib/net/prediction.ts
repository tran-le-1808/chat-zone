/**
 * Client prediction + server reconciliation + interpolation.
 * - Người chơi cục bộ: áp input ngay (dự đoán), giữ input chưa được xác nhận; khi có snapshot,
 *   đặt lại theo vị trí server tại lastSeq rồi phát lại input còn treo.
 * - Người khác & lính gác: nội suy giữa các snapshot với độ trễ cố định.
 * Prediction KHÔNG quyết định vị trí cuối — server luôn thắng.
 */
import { stepMove, type MoveBody, type MoveContext } from "../engine/movement";
import type { MoveInput } from "../engine/types";

export interface ServerBody extends MoveBody {
  lastSeq: number;
}

export class LocalPredictor {
  private pending: MoveInput[] = [];
  private seq = 0;
  state: MoveBody | null = null;
  prev: MoveBody | null = null;
  /** Lệch hiển thị sau khi sửa (giảm dần để không giật) */
  visualOffset = { x: 0, y: 0 };
  lastCorrection = 0;

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Đặt sequence bắt đầu (sau khi kết nối lại phải lớn hơn lastSeq của server) */
  syncSequence(serverLastSeq: number): void {
    if (this.seq < serverLastSeq) this.seq = serverLastSeq;
  }

  makeInput(directionX: number, directionY: number, sprint: boolean): MoveInput {
    this.seq += 1;
    return { sequence: this.seq, directionX, directionY, sprint };
  }

  applyLocal(ctx: MoveContext, input: MoveInput): void {
    if (!this.state) return;
    this.prev = this.state;
    const r = stepMove(ctx, this.state, input);
    this.state = { x: r.x, y: r.y, facing: r.facing, energy: r.energy };
    this.pending.push(input);
    if (this.pending.length > 120) this.pending.shift();
  }

  /** Trả về độ lệch (đơn vị ô) giữa dự đoán cũ và kết quả sau khi đối chiếu */
  reconcile(ctx: MoveContext, server: ServerBody, canMove: boolean): number {
    this.pending = this.pending.filter((i) => i.sequence > server.lastSeq);
    this.syncSequence(server.lastSeq);
    const before = this.state;
    let s: MoveBody = { x: server.x, y: server.y, facing: server.facing, energy: server.energy };
    if (canMove)
      for (const inp of this.pending) {
        const r = stepMove(ctx, s, inp);
        s = { x: r.x, y: r.y, facing: r.facing, energy: r.energy };
      }
    else this.pending = [];
    this.state = s;
    if (!before) {
      this.prev = s;
      return 0;
    }
    const ex = before.x - s.x;
    const ey = before.y - s.y;
    const err = Math.hypot(ex, ey);
    if (err > 2.5) {
      // dịch chuyển lớn (bị bắt, được thả...) -> nhảy thẳng
      this.visualOffset = { x: 0, y: 0 };
      this.prev = s;
    } else if (err > 1e-4) {
      this.visualOffset.x += ex;
      this.visualOffset.y += ey;
      this.lastCorrection = err;
    }
    return err;
  }

  decayOffset(frameDt: number): void {
    const k = Math.exp(-frameDt * 12);
    this.visualOffset.x *= k;
    this.visualOffset.y *= k;
    if (Math.abs(this.visualOffset.x) < 1e-4) this.visualOffset.x = 0;
    if (Math.abs(this.visualOffset.y) < 1e-4) this.visualOffset.y = 0;
  }

  reset(): void {
    this.pending = [];
    this.state = null;
    this.prev = null;
    this.visualOffset = { x: 0, y: 0 };
  }
}

export interface Pose {
  x: number;
  y: number;
  facing: number;
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/** Bộ đệm nội suy theo thời gian server (ms) */
export class InterpolationBuffer {
  private samples = new Map<string, { t: number; p: Pose }[]>();

  push(id: string, serverTimeMs: number, pose: Pose): void {
    let list = this.samples.get(id);
    if (!list) this.samples.set(id, (list = []));
    if (list.length && serverTimeMs <= list[list.length - 1].t) {
      // gói đến muộn / trùng -> bỏ (snapshot luôn tăng dần theo thời gian)
      if (serverTimeMs === list[list.length - 1].t) list[list.length - 1].p = pose;
      return;
    }
    list.push({ t: serverTimeMs, p: pose });
    if (list.length > 30) list.splice(0, list.length - 30);
  }

  sample(id: string, renderTimeMs: number): Pose | null {
    const list = this.samples.get(id);
    if (!list || !list.length) return null;
    if (renderTimeMs <= list[0].t) return list[0].p;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (a.t <= renderTimeMs) {
        const b = list[i + 1];
        if (!b) return a.p; // không ngoại suy quá xa: giữ mẫu cuối
        const t = (renderTimeMs - a.t) / (b.t - a.t);
        return { x: a.p.x + (b.p.x - a.p.x) * t, y: a.p.y + (b.p.y - a.p.y) * t, facing: lerpAngle(a.p.facing, b.p.facing, t) };
      }
    }
    return list[list.length - 1].p;
  }

  remove(id: string): void {
    this.samples.delete(id);
  }

  clear(): void {
    this.samples.clear();
  }
}

/** Ước lượng lệch đồng hồ server–client (lấy mẫu có độ trễ thấp nhất trong cửa sổ gần đây) */
export class ClockSync {
  private offsets: number[] = [];
  offset = 0;

  update(serverTimeMs: number, localNowMs: number): void {
    this.offsets.push(serverTimeMs - localNowMs);
    if (this.offsets.length > 20) this.offsets.shift();
    // gói đến muộn làm offset nhỏ đi -> lấy giá trị lớn nhất (ít trễ nhất)
    this.offset = Math.max(...this.offsets);
  }

  serverNow(localNowMs: number): number {
    return localNowMs + this.offset;
  }
}
