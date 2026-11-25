/**
 * Co-op: client chỉ gửi input (có sequence) + ý định; server có thẩm quyền.
 * - Người chơi cục bộ: dự đoán + đối chiếu (reconcile) theo snapshot.
 * - Người khác & lính gác: nội suy với độ trễ cố định.
 * - Mất mạng: Socket.IO tự kết nối lại, client gửi lại room:join (xác thực lại ở handshake).
 */
import type { Socket } from "socket.io-client";
import { PRISON_CONFIG as C } from "../engine/config";
import { countItem } from "../engine/items";
import { PRISON_MAP, zoneAt } from "../engine/map";
import { computePassFlags, playerSolid } from "../engine/rules";
import { dist } from "../engine/geometry";
import { movementModifiers } from "../engine/movement";
import type { ActionResult, EngineEvent, PlayerAction } from "../engine/types";
import type { FullState, GameSnapshot, GuardPublic, InmatePublic, PlayerPublic, PrivateState, TeamStorageView, WorldMeta } from "../engine/view";
import type { Ack } from "../engine/protocol";
import { ClockSync, InterpolationBuffer, LocalPredictor, type Pose } from "../net/prediction";
import { newRequestId, prisonEmit } from "../net/prisonSocket";
import { clockInfo } from "../engine/rules";
import { toneOf, type ClientView, type ConnectionState, type Notice, type PrisonSession, type RenderSample } from "./types";

export interface JoinPayload {
  room: { roomCode: string; status: string };
  state: FullState | null;
  private: PrivateState | null;
  teamStorage: TeamStorageView | null;
}

/** Ánh xạ ý định engine -> sự kiện Socket.IO + payload DTO */
export function actionToEvent(a: PlayerAction, requestId: string): [string, Record<string, unknown>] | undefined {
  const r = { requestId };
  switch (a.type) {
    case "interact":
      return ["player:interact", { ...r, targetId: a.targetId }];
    case "cancelChannel":
      return ["player:cancel", r];
    case "useItem":
      return ["player:use-item", { ...r, itemId: a.itemId }];
    case "dropItem":
      return ["player:drop-item", { ...r, itemId: a.itemId, quantity: a.quantity }];
    case "throwItem":
      return ["player:throw-item", { ...r, itemId: a.itemId, dirX: a.dirX, dirY: a.dirY }];
    case "pickupAll":
      return ["player:pickup-all", r];
    case "craft":
      return ["crafting:craft", { ...r, recipeId: a.recipeId, ...(a.quantity && a.quantity > 1 ? { quantity: a.quantity } : {}) }];
    case "deposit":
      return ["team-storage:deposit", { ...r, itemId: a.itemId, quantity: a.quantity }];
    case "withdraw":
      return ["team-storage:withdraw", { ...r, itemId: a.itemId, quantity: a.quantity }];
    case "tradeRequest":
      return ["player:trade-request", { ...r, targetPlayerId: a.targetPlayerId, offeredItems: a.offered, requestedItems: a.requested }];
    case "tradeAccept":
      return ["player:trade-accept", { ...r, tradeId: a.tradeId }];
    case "tradeDecline":
      return ["player:trade-decline", { ...r, tradeId: a.tradeId }];
    case "questAccept":
      return ["quest:accept", { ...r, questId: a.questId }];
    case "questComplete":
      return ["quest:complete", { ...r, questId: a.questId }];
    case "questAbandon":
      return ["quest:abandon", { ...r, questId: a.questId }];
    case "questContribute":
      return ["quest:contribute", { ...r, questId: a.questId, objectiveId: a.objectiveId, contribution: a.quantity }];
    case "revive":
      return ["player:revive", { ...r, targetPlayerId: a.targetPlayerId }];
    case "rescueStart":
      return ["rescue:start", { ...r, targetPlayerId: a.targetPlayerId, rescuePointId: a.rescuePointId }];
    case "rescueCancel":
      return ["rescue:cancel", r];
    case "assist":
      return ["player:assist", { ...r, assistType: a.assistType }];
    case "escapePrepare":
      return ["escape:prepare", { ...r, escapeMethod: a.escapeMethod }];
    case "escapeReady":
      return ["escape:ready", { ...r, ready: a.ready }];
    case "escapeStart":
      return ["escape:start", r];
    case "escapeEnterPoint":
      return ["escape:enter-point", { ...r, escapePointId: a.escapePointId }];
    case "escapeCancel":
      return ["escape:cancel", r];
    case "attack":
      return ["combat:attack", r];
    case "report":
      return ["npc:report", { ...r, npcId: a.npcId }];
    case "answerRollcall":
      return ["rollcall:answer", r];
    case "equip":
      return ["combat:equip", { ...r, ...(a.itemId ? { itemId: a.itemId } : {}) }];
    case "containerTake":
      return ["container:take", { ...r, containerId: a.containerId, index: a.index, itemId: a.itemId, quantity: a.quantity }];
    case "containerPut":
      return ["container:put", { ...r, containerId: a.containerId, index: a.index, itemId: a.itemId, quantity: a.quantity }];
    case "bedTake":
      return ["bed:take", { ...r, bedId: a.bedId, what: a.what }];
    case "bedPlace":
      return ["bed:place", { ...r, bedId: a.bedId, what: a.what }];
    case "hide":
      return ["player:hide", { ...r, spotId: a.spotId, itemId: a.itemId, quantity: a.quantity }];
    case "retrieve":
      return ["player:retrieve", { ...r, spotId: a.spotId, itemId: a.itemId, quantity: a.quantity }];
    case "flush":
      return ["player:flush", { ...r, spotId: a.spotId }];
    case "tunnel":
      return ["tunnel:action", { ...r, cellIndex: a.cellIndex, op: a.op }];
    case "wake":
      return ["player:wake", r];
    case "dig":
      return ["dig:tile", { ...r, x: a.x, y: a.y }];
    case "hatch":
      return ["dig:hatch", r];
    case "placeDecor":
      return ["decor:place", { ...r, itemId: a.itemId, x: a.x, y: a.y }];
    case "takeDecor":
      return ["decor:take", { ...r, x: a.x, y: a.y }];
    case "buy":
      return ["shop:buy", { ...r, itemId: a.itemId }];
    case "sell":
      return ["shop:sell", { ...r, itemId: a.itemId }];
    case "npcTalk":
      return ["npc:talk", { ...r, npcId: a.npcId }];
    case "npcBuy":
      return ["npc:buy", { ...r, npcId: a.npcId, itemId: a.itemId }];
    case "bribe":
      return ["guard:bribe", { ...r, guardId: a.guardId }];
    case "lootStart":
      return ["loot:start", { ...r, targetId: a.targetId }];
    case "lootTake":
      return ["loot:take", { ...r, targetId: a.targetId, slot: a.slot, index: a.index }];
    case "lootClose":
      return ["loot:close", r];
    case "wear":
      return ["gear:wear", { ...r, index: a.index }];
    case "takeOff":
      return ["gear:take-off", { ...r, slot: a.slot }];
    case "dropWeapon":
      return ["gear:drop-weapon", r];
    case "answerChallenge":
      return ["disguise:answer", { ...r, choice: a.choice }];
    case "gymStart":
      return ["gym:start", { ...r, machineId: a.machineId }];
    case "gymPress":
      return ["gym:press", { ...r, side: a.side }];
    case "gymStop":
      return ["gym:stop", r];
    case "reclaimConfiscated":
      return ["guard:reclaim", { ...r, guardId: a.guardId }];
    case "gymAnswer":
      return ["gym:answer", { ...r, yield: a.yield }];
  }
  return undefined;
}

const NOTICE_EVENTS = /^(player|rescue|escape|quest|game|guard|item|route|crafting|team-storage|shop|violation|search|container|bed|combat|activity|tunnel|camera|inmate|disguise|work|bribe|loot|gear|gym|library|confiscation):/;
const PERSONAL_EVENTS = /^(gym:(rep|milestone|request|refused|miss)|library:(read|decay)|item:eaten)$/;
const QUIET = new Set(["game:snapshot", "game:meta", "inventory:updated", "team-storage:updated", "game:started", "game:error", "quest:progress-updated"]);

export class NetSession implements PrisonSession {
  readonly mode = "multi" as const;
  private players = new Map<string, PlayerPublic>();
  private guards = new Map<string, GuardPublic>();
  private inmates = new Map<string, InmatePublic>();
  private simTime = 0;
  private eventListeners = new Set<(e: EngineEvent) => void>();
  private meta!: WorldMeta;
  private me: PrivateState | null = null;
  private teamStorage: TeamStorageView = { items: [], maxSlots: 12, version: 0 };
  private tick = 0;
  private totalGameMinutes = 0;
  private teamHeat = 0;
  private connection: ConnectionState = "online";
  private predictor = new LocalPredictor();
  private interp = new InterpolationBuffer();
  private clock = new ClockSync();
  private listeners = new Set<() => void>();
  private noticeListeners = new Set<(n: Notice) => void>();
  private input = { dx: 0, dy: 0, sprint: false };
  private sentMoving = false;
  private inputTimer: ReturnType<typeof setInterval>;
  private pingTimer: ReturnType<typeof setInterval>;
  private lastStepAt = 0;
  private lastEnterAttempt = 0;
  private view!: ClientView;
  private dirty = true;
  private publishTimer: ReturnType<typeof setInterval>;
  private handlers: [string, (payload: never) => void][] = [];
  private anyHandler: (ev: string, payload: unknown) => void;
  /** Số liệu mạng cho HUD gỡ lỗi */
  stats = { rttMs: 0, correction: 0, pending: 0 };

  constructor(
    private readonly socket: Socket,
    readonly roomCode: string,
    readonly meId: string,
    join: JoinPayload,
    private readonly onRoomEnded: (reason: string) => void,
  ) {
    this.applyFull(join);
    const on = <T>(ev: string, fn: (p: T) => void) => {
      socket.on(ev, fn);
      this.handlers.push([ev, fn as (payload: never) => void]);
    };
    on<GameSnapshot>("game:snapshot", (s) => this.onSnapshot(s));
    on<WorldMeta>("game:meta", (m) => {
      this.meta = m;
      this.dirty = true;
    });
    on<PrivateState>("inventory:updated", (p) => {
      if (p.playerId === this.meId) {
        this.me = p;
        this.dirty = true;
      }
    });
    on<TeamStorageView>("team-storage:updated", (t) => {
      this.teamStorage = t;
      this.dirty = true;
    });
    on<{ code: string; message: string }>("game:error", (e) => this.notice(`⚠️ ${e.message}`, "warn"));
    on<{ userId: string; graceSeconds: number }>("player:disconnected", (d) => {
      const p = this.players.get(d.userId);
      if (p) this.notice(`📴 ${p.name} mất kết nối — giữ chỗ ${d.graceSeconds} giây`, "warn");
    });
    on<{ userId: string }>("player:reconnected", (d) => {
      const p = this.players.get(d.userId);
      if (p && d.userId !== this.meId) this.notice(`🔌 ${p.name} đã kết nối lại`, "good");
    });
    on<unknown>("game:paused", () => this.notice("⏸️ Trận tạm dừng", "warn"));
    on<{ roomCode: string }>("room:closed", () => this.onRoomEnded("Phòng đã đóng"));
    on<{ userId: string; reason: string }>("room:player-left", (d) => {
      if (d.userId === this.meId) this.onRoomEnded("Bạn đã bị đưa ra khỏi trận");
    });
    on<unknown>("disconnect", () => {
      this.connection = "reconnecting";
      this.dirty = true;
    });
    on<unknown>("connect", () => void this.rejoin());
    this.anyHandler = (ev, payload) => {
      if (QUIET.has(ev) || !NOTICE_EVENTS.test(ev)) return;
      const e = payload as EngineEvent | undefined;
      if (!e || typeof e !== "object" || e.type !== ev) return;
      for (const fn of this.eventListeners) fn(e);
      // thông báo riêng của người tập (+1 chỉ số, bị xin máy…) chỉ hiện cho chính họ
      if (PERSONAL_EVENTS.test(ev) && e.playerId !== this.meId) return;
      if (typeof e.text === "string") this.notice(e.text, toneOf(ev), e.id);
    };
    socket.onAny(this.anyHandler);
    this.inputTimer = setInterval(() => this.sendInput(), 1000 / C.net.tickRate);
    this.publishTimer = setInterval(() => this.flushView(), 100);
    this.pingTimer = setInterval(() => void this.ping(), 3000);
    void this.ping();
  }

  private async ping(): Promise<void> {
    const t0 = performance.now();
    const r = await prisonEmit<{ serverTime: number }>(this.socket, "game:ping", {}, 3000);
    if (r.ok && r.data) {
      this.stats.rttMs = Math.round(performance.now() - t0);
      this.clock.update(r.data.serverTime + this.stats.rttMs / 2, Date.now());
    }
  }

  private async rejoin(): Promise<void> {
    const r = await prisonEmit<JoinPayload>(this.socket, "room:join", { roomCode: this.roomCode });
    if (r.ok && r.data) {
      this.applyFull(r.data);
      this.notice("🔌 Đã kết nối lại — đồng bộ trạng thái", "good");
    } else {
      this.connection = "offline";
      this.dirty = true;
      this.onRoomEnded(r.ok ? "Không khôi phục được trận" : r.message);
    }
  }

  private applyFull(join: JoinPayload): void {
    const s = join.state;
    if (!s) return;
    this.players.clear();
    this.guards.clear();
    this.inmates.clear();
    this.simTime = s.time;
    this.interp.clear();
    this.predictor.reset();
    this.tick = s.tick;
    this.totalGameMinutes = s.totalGameMinutes;
    this.teamHeat = s.teamHeat;
    this.meta = s.meta;
    this.teamStorage = join.teamStorage ?? s.teamStorage;
    this.me = join.private;
    this.clock.update(s.serverTime, Date.now());
    for (const p of s.players) {
      this.players.set(p.id, p);
      this.interp.push(p.id, s.serverTime, p);
    }
    for (const g of s.guards) {
      this.guards.set(g.id, g);
      this.interp.push(g.id, s.serverTime, g);
    }
    for (const n of s.inmates) {
      this.inmates.set(n.id, n);
      this.interp.push(n.id, s.serverTime, n);
    }
    const mine = this.players.get(this.meId);
    if (mine) {
      this.predictor.state = { x: mine.x, y: mine.y, facing: mine.facing, energy: mine.energy };
      this.predictor.prev = this.predictor.state;
      this.predictor.syncSequence(mine.lastSeq);
    }
    this.connection = "online";
    this.dirty = true;
  }

  /** Cùng hệ số với server: lấy từ chỉ số đói / mệt / thể lực do server gửi */
  private moveCtx() {
    const m = this.players.get(this.meId);
    const e = this.meta.escape.status;
    const has = (id: Parameters<typeof countItem>[1]) => !!this.me && countItem(this.me.inventory, id) > 0;
    return {
      solid: playerSolid(
        computePassFlags({
          ventOpen: this.meta.routes.ventOpen,
          fenceGaps: this.meta.routes.fenceGaps,
          escapeActive: e === "EXECUTING" || e === "RESCUE_REQUIRED",
          minuteOfDay: clockInfo(this.totalGameMinutes).minuteOfDay,
          has: (id) => has(id as Parameters<typeof countItem>[1]),
          disguised: !!m?.disguised,
          doorsLocked: this.meta.doorsLocked,
          holes: Object.keys(this.meta.dig?.holes ?? {}),
          tunnels: Object.keys(this.meta.dig?.tunnels ?? {}),
          underground: !!m?.underground,
        }),
      ),
      role: m?.role ?? "HACKER",
      ...movementModifiers({ hunger: m?.hunger ?? 0, fitness: m?.fitness ?? 0, stamina: this.me?.stats.stamina ?? 5, agility: m?.agility ?? this.me?.stats.agility ?? 0 }),
    };
  }

  private onSnapshot(s: GameSnapshot): void {
    if (s.tick < this.tick) return; // gói cũ
    this.tick = s.tick;
    this.totalGameMinutes = s.totalGameMinutes;
    this.simTime = s.time;
    this.teamHeat = s.prisonAlertLevel;
    this.clock.update(s.serverTime, Date.now());
    const seen = new Set<string>();
    for (const p of s.players) {
      seen.add(p.id);
      this.players.set(p.id, p);
      if (p.id === this.meId) {
        const canMove = p.status === "ACTIVE";
        this.stats.correction = this.predictor.reconcile(this.moveCtx(), { x: p.x, y: p.y, facing: p.facing, energy: p.energy, lastSeq: p.lastSeq }, canMove);
        this.stats.pending = this.predictor.pendingCount;
      } else this.interp.push(p.id, s.serverTime, p);
    }
    for (const id of [...this.players.keys()])
      if (!seen.has(id)) {
        this.players.delete(id);
        this.interp.remove(id);
      }
    for (const e of s.changedEntities) {
      if (e.kind === "guard") {
        const { kind: _k, ...g } = e;
        void _k;
        this.guards.set(g.id, g);
        this.interp.push(g.id, s.serverTime, g);
      } else {
        const { kind: _k, ...n } = e;
        void _k;
        this.inmates.set(n.id, n);
        this.interp.push(n.id, s.serverTime, n);
      }
    }
    this.dirty = true;
  }

  private sendInput(): void {
    if (this.connection !== "online" || !this.socket.connected) return;
    const mine = this.players.get(this.meId);
    if (!mine || mine.status !== "ACTIVE" || this.meta.outcome) return;
    const moving = Math.hypot(this.input.dx, this.input.dy) > 0.05;
    if (!moving && !this.sentMoving) return;
    this.sentMoving = moving;
    const inp = this.predictor.makeInput(this.input.dx, this.input.dy, this.input.sprint);
    // đang nằm trên giường / trốn trong xe: server khoá vị trí — không dự đoán di chuyển (tránh "nhảy xuống" rồi giật về)
    const locked = this.players.get(this.meId);
    if (!locked?.bed && !locked?.vehicle) this.predictor.applyLocal(this.moveCtx(), inp);
    this.lastStepAt = performance.now();
    this.socket.emit("player:input", inp);
    // Tới điểm thoát -> gửi yêu cầu kiểm tra (server vẫn tự xác minh)
    const st = this.predictor.state;
    const e = this.meta.escape.status;
    if (st && (e === "EXECUTING" || e === "RESCUE_REQUIRED") && zoneAt(PRISON_MAP, st.x, st.y) === "outside" && Date.now() - this.lastEnterAttempt > 1000) {
      const point = this.meta.escapePoints.find((pt) => !pt.inside && dist(st.x, st.y, pt.x, pt.y) <= C.escape.pointRadius);
      if (point) {
        this.lastEnterAttempt = Date.now();
        void this.act({ type: "escapeEnterPoint", escapePointId: point.id });
      }
    }
  }

  private notice(text: string, tone: Notice["tone"], id = `${Date.now()}-${Math.random()}`): void {
    const n: Notice = { id, text, tone, at: Date.now() };
    for (const fn of this.noticeListeners) fn(n);
  }

  private flushView(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const mine = this.players.get(this.meId);
    const players = [...this.players.values()].map((p) =>
      p.id === this.meId && this.predictor.state && mine?.status === "ACTIVE" ? { ...p, x: this.predictor.state.x, y: this.predictor.state.y } : p,
    );
    this.view = {
      mode: "multi",
      meId: this.meId,
      tick: this.tick,
      time: this.simTime,
      clock: clockInfo(this.totalGameMinutes),
      totalGameMinutes: this.totalGameMinutes,
      teamHeat: this.teamHeat,
      players,
      guards: [...this.guards.values()],
      inmates: [...this.inmates.values()],
      meta: this.meta,
      me: this.me,
      teamStorage: this.teamStorage,
      connection: this.connection,
      paused: false,
      speed: 1,
    };
    for (const fn of this.listeners) fn();
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
    if (!this.view) {
      this.dirty = true;
      this.flushView();
    }
    return this.view;
  }

  setInput(dx: number, dy: number, sprint: boolean): void {
    this.input = { dx, dy, sprint };
  }

  sample(nowMs: number, frameDt: number): RenderSample {
    const renderT = this.clock.serverNow(Date.now()) - C.net.interpolationDelayMs;
    const players = new Map<string, Pose>();
    for (const p of this.players.values()) {
      if (p.id === this.meId && this.predictor.state) {
        this.predictor.decayOffset(frameDt);
        const cur = this.predictor.state;
        const prev = this.predictor.prev ?? cur;
        const a = Math.max(0, Math.min(1, (nowMs - this.lastStepAt) / (1000 / C.net.tickRate)));
        players.set(p.id, {
          x: prev.x + (cur.x - prev.x) * a + this.predictor.visualOffset.x,
          y: prev.y + (cur.y - prev.y) * a + this.predictor.visualOffset.y,
          facing: cur.facing,
        });
      } else players.set(p.id, this.interp.sample(p.id, renderT) ?? p);
    }
    const guards = new Map<string, Pose>();
    for (const g of this.guards.values()) guards.set(g.id, this.interp.sample(g.id, renderT) ?? g);
    const inmates = new Map<string, Pose>();
    for (const n of this.inmates.values()) inmates.set(n.id, this.interp.sample(n.id, renderT) ?? n);
    return { players, guards, inmates };
  }

  /** Gửi ý định; hết thời gian chờ -> thử lại MỘT lần với CÙNG requestId (server idempotent) */
  async act(action: PlayerAction): Promise<ActionResult> {
    const requestId = newRequestId();
    const mapped = actionToEvent(action, requestId);
    if (!mapped) return { ok: false, code: "INVALID_PAYLOAD", message: "Thao tác không hỗ trợ" };
    const [ev, payload] = mapped;
    let res: Ack<Record<string, string | number | boolean>> = await prisonEmit(this.socket, ev, payload);
    if (!res.ok && res.message === "Mất kết nối tới máy chủ" && this.socket.connected) res = await prisonEmit(this.socket, ev, payload);
    if (res.ok) return { ok: true, data: res.data, duplicate: !!res.data?.duplicate };
    return { ok: false, code: res.code, message: res.message };
  }

  dispose(): void {
    clearInterval(this.inputTimer);
    clearInterval(this.publishTimer);
    clearInterval(this.pingTimer);
    for (const [ev, fn] of this.handlers) this.socket.off(ev, fn as (payload: unknown) => void);
    this.socket.offAny(this.anyHandler);
    this.listeners.clear();
    this.noticeListeners.clear();
    this.eventListeners.clear();
  }
}
