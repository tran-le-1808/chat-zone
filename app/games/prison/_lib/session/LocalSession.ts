/**
 * Chơi đơn: chạy engine dùng chung ngay trong trình duyệt, KHÔNG cần Socket.IO.
 * Cùng bước tick cố định (20/s) với server; tăng tốc = chạy nhiều tick mỗi khung (vẫn tất định).
 */
import { applyAction } from "../engine/actions";
import { PRISON_CONFIG as C } from "../engine/config";
import { clockInfo } from "../engine/rules";
import { createOutbox, type ActionResult, type Difficulty, type EngineEvent, type PlayerAction, type Role, type WorldState } from "../engine/types";
import { buildMeta, buildPrivate, buildTeamStorage, guardPublic, inmatePublic, playerPublic, type PlayerPublic } from "../engine/view";
import { createWorld, runTick } from "../engine/world";
import type { Pose } from "../net/prediction";
import { writeSave, type SlotId } from "./save";
import { toneOf, type ClientView, type Notice, type PrisonSession, type RenderSample } from "./types";

const ME = "me";

export class LocalSession implements PrisonSession {
  readonly mode = "single" as const;
  readonly meId = ME;
  private world: WorldState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private noticeListeners = new Set<(n: Notice) => void>();
  private eventListeners = new Set<(e: EngineEvent) => void>();
  private input = { dx: 0, dy: 0, sprint: false };
  private seq = 0;
  private prev = new Map<string, Pose>();
  private lastTickAt = 0;
  private view: ClientView;
  private paused = false;
  private speed = 1;
  private reqSeq = 0;
  private publishCounter = 0;

  constructor(opts: { world?: WorldState; name: string; role: Role; difficulty: Difficulty; dayLimit?: number | null }) {
    this.world =
      opts.world ??
      createWorld({
        seed: Math.floor(Math.random() * 2 ** 31),
        difficulty: opts.difficulty,
        mode: "single",
        dayLimit: opts.dayLimit === undefined ? 30 : opts.dayLimit,
        players: [{ id: ME, name: opts.name || "Tù nhân", role: opts.role }],
      });
    this.seq = this.world.players[ME]?.lastSeq ?? 0;
    this.view = this.buildView();
    this.timer = setInterval(() => this.frame(), 1000 / C.net.tickRate);
  }

  private buildView(): ClientView {
    const w = this.world;
    return {
      mode: "single",
      meId: ME,
      tick: w.tick,
      time: w.time,
      clock: clockInfo(w.totalGameMinutes),
      totalGameMinutes: w.totalGameMinutes,
      teamHeat: Math.round(w.teamHeat),
      players: w.playerOrder.map((id) => playerPublic(w, id)).filter((p): p is PlayerPublic => !!p),
      guards: w.guards.map(guardPublic),
      inmates: w.inmates.map(inmatePublic),
      meta: buildMeta(w),
      me: buildPrivate(w, ME),
      teamStorage: buildTeamStorage(w),
      connection: "online",
      paused: this.paused,
      speed: this.effectiveSpeed(),
    };
  }

  /** Tốc độ thực: người chơi chọn × tự tua nhanh khi ngủ / ở biệt giam */
  private effectiveSpeed(): number {
    const p = this.world.players[ME];
    let s = this.speed;
    if (p?.channel?.kind === "sleep") s *= C.clock.sleepSpeedMultiplier;
    if (p?.status === "CAPTURED") s *= C.clock.solitarySpeedMultiplier;
    return Math.min(16, s);
  }

  private publish(): void {
    this.view = this.buildView();
    for (const fn of this.listeners) fn();
  }

  private drain(out: ReturnType<typeof createOutbox>): void {
    for (const ev of out.events) {
      for (const fn of this.eventListeners) fn(ev);
      if (ev.type === "game:midnight") void this.save("auto");
      if (!ev.text) continue;
      const n: Notice = { id: ev.id, text: ev.text, tone: toneOf(ev.type), at: Date.now() };
      for (const fn of this.noticeListeners) fn(n);
    }
  }

  private frame(): void {
    if (this.paused || this.world.outcome) return;
    const n = this.effectiveSpeed();
    const out = createOutbox();
    for (let i = 0; i < n && !this.world.outcome; i++) {
      if (i === n - 1) {
        for (const id of this.world.playerOrder) {
          const p = this.world.players[id];
          this.prev.set(id, { x: p.x, y: p.y, facing: p.facing });
        }
        for (const g of this.world.guards) this.prev.set(g.id, { x: g.x, y: g.y, facing: g.facing });
        for (const m of this.world.inmates) this.prev.set(m.id, { x: m.x, y: m.y, facing: m.facing });
      }
      const inputs = new Map([[ME, [{ sequence: ++this.seq, directionX: this.input.dx, directionY: this.input.dy, sprint: this.input.sprint }]]]);
      runTick(this.world, out, inputs);
    }
    this.lastTickAt = performance.now();
    this.drain(out);
    this.publishCounter += 1;
    if (this.publishCounter % 2 === 0 || out.events.length || this.world.outcome) this.publish();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onNotice(fn: (n: Notice) => void): () => void {
    this.noticeListeners.add(fn);
    return () => this.noticeListeners.delete(fn);
  }

  onEvent(fn: (e: EngineEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  getView(): ClientView {
    return this.view;
  }

  setInput(dx: number, dy: number, sprint: boolean): void {
    this.input = { dx, dy, sprint };
  }

  sample(nowMs: number): RenderSample {
    const alpha = Math.max(0, Math.min(1, (nowMs - this.lastTickAt) / (1000 / C.net.tickRate)));
    const lerp = (id: string, cur: Pose): Pose => {
      const a = this.prev.get(id);
      if (!a || Math.hypot(cur.x - a.x, cur.y - a.y) > 2) return { x: cur.x, y: cur.y, facing: cur.facing };
      const d = Math.atan2(Math.sin(cur.facing - a.facing), Math.cos(cur.facing - a.facing));
      return { x: a.x + (cur.x - a.x) * alpha, y: a.y + (cur.y - a.y) * alpha, facing: a.facing + d * alpha };
    };
    const players = new Map<string, Pose>();
    for (const id of this.world.playerOrder) players.set(id, lerp(id, this.world.players[id]));
    const guards = new Map<string, Pose>();
    for (const g of this.world.guards) guards.set(g.id, lerp(g.id, g));
    const inmates = new Map<string, Pose>();
    for (const m of this.world.inmates) inmates.set(m.id, lerp(m.id, m));
    return { players, guards, inmates };
  }

  act(action: PlayerAction): Promise<ActionResult> {
    const out = createOutbox();
    const res = applyAction(this.world, out, ME, action, `local-${++this.reqSeq}`);
    this.drain(out);
    this.publish();
    return Promise.resolve(res);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) void this.save("auto");
    this.publish();
  }

  setSpeed(speed: number): void {
    this.speed = (C.clock.singleSpeeds as number[]).includes(speed) ? speed : 1;
    this.publish();
  }

  save(slot: SlotId = "auto"): Promise<boolean> {
    return writeSave(slot, this.world);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.save("auto");
    this.listeners.clear();
    this.noticeListeners.clear();
    this.eventListeners.clear();
  }
}
