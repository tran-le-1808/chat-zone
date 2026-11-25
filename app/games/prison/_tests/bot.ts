/** Bot tự động: đi bằng input thật (A* trên luật va chạm của người chơi), lục soát, chế tạo, thao tác. */
import assert from "node:assert/strict";
import {
  applyAction,
  countItem,
  createOutbox,
  distanceToInteractable,
  findPath,
  passFlags,
  playerSolid,
  PRISON_MAP,
  runTick,
  type EscapeMethod,
  type ItemId,
  type PlayerAction,
  type Point,
  type WorldState,
} from "../_lib/engine";

let rid = 0;

export class Bot {
  readonly w: WorldState;
  readonly id: string;
  constructor(w: WorldState, id = "p1") {
    this.w = w;
    this.id = id;
    // bot "đã học đủ ở thư viện": đủ thông minh để chế tạo mọi bậc (test lối thoát, không test thư viện)
    this.p.stats.intelligence = 50;
  }

  get p() {
    return this.w.players[this.id];
  }

  tick(n = 1, input?: { dx: number; dy: number; sprint?: boolean }) {
    const o = createOutbox();
    for (let i = 0; i < n; i++) {
      const inputs = new Map();
      if (input) inputs.set(this.id, [{ sequence: this.p.lastSeq + 1, directionX: input.dx, directionY: input.dy, sprint: !!input.sprint }]);
      runTick(this.w, o, inputs);
    }
    return o;
  }

  /** Giữ đói thấp, thể lực & thông minh đủ (bot "ăn ngủ, đọc sách đúng giờ") để test tập trung vào lối thoát */
  rest() {
    this.p.stats.hunger = 10;
    this.p.stats.energy = this.p.stats.maxEnergy;
    this.p.stats.intelligence = Math.max(this.p.stats.intelligence, 50);
  }

  walkTo(target: Point, tolerance = 0.2, maxTicks = 4000) {
    const pass = (tx: number, ty: number) => !playerSolid(passFlags(this.w, this.p))(tx, ty);
    const path = findPath(PRISON_MAP, pass, this.p, target, 6000);
    assert.ok(path, `không tìm được đường tới ${target.x},${target.y} từ ${this.p.x},${this.p.y}`);
    path[path.length - 1] = target;
    let i = 0;
    for (let t = 0; t < maxTicks && i < path.length; t++) {
      const wp = path[i];
      const dx = wp.x - this.p.x;
      const dy = wp.y - this.p.y;
      const d = Math.hypot(dx, dy);
      if (d < (i === path.length - 1 ? tolerance : 0.25)) {
        i++;
        continue;
      }
      this.tick(1, { dx: dx / d, dy: dy / d });
      if (this.p.status !== "ACTIVE") return false;
    }
    return i >= path.length;
  }

  /** Đi tới ô trống cạnh vật tương tác (trong tầm) */
  goNear(interactableId: string) {
    const it = PRISON_MAP.interactableById[interactableId];
    assert.ok(it, interactableId);
    const pass = (tx: number, ty: number) => !playerSolid(passFlags(this.w, this.p))(tx, ty);
    let best: Point | null = null;
    let bestLen = Infinity;
    for (const t of it.tiles)
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const c = { x: t.x + ox + 0.5, y: t.y + oy + 0.5 };
        if (!pass(t.x + ox, t.y + oy) || distanceToInteractable(c, it) > 1.5) continue;
        const path = findPath(PRISON_MAP, pass, this.p, c, 6000);
        if (path && path.length < bestLen) {
          best = c;
          bestLen = path.length;
        }
      }
    assert.ok(best, `không có chỗ đứng cạnh ${interactableId}`);
    assert.ok(this.walkTo(best), `không tới được ${interactableId}`);
  }

  act(a: PlayerAction) {
    return applyAction(this.w, createOutbox(), this.id, a, `bot${++rid}`);
  }

  must(a: PlayerAction) {
    const r = this.act(a);
    assert.equal(r.ok, true, `${a.type}: ${JSON.stringify(r)} túi=${JSON.stringify(this.p.inventory.map((i) => i.itemId + "x" + i.quantity))}`);
    return r;
  }

  /** Chờ thao tác giữ xong */
  finishChannel(max = 400) {
    for (let i = 0; i < max && this.p.channel; i++) this.tick(1);
    assert.equal(this.p.channel, null, "thao tác giữ chưa xong");
  }

  /** Ngủ qua đêm: nhảy tới 05:59 ngày hôm sau rồi chạy qua mốc 06:00 (bổ sung đồ) */
  skipDay() {
    this.w.totalGameMinutes = Math.floor(this.w.totalGameMinutes / 1440 + 1) * 1440 + 6 * 60 - 1;
    this.tick(25);
    this.rest();
  }

  /**
   * Mở tủ và lấy món cần (đồ trong tủ là ngẫu nhiên). Nếu tủ không có: vét sạch ra sàn rồi sang ngày
   * mới để tủ được bổ sung đồ khác — giống người chơi quay lại hôm sau.
   */
  searchFor(containerId: string, want: ItemId, count = 1) {
    this.goNear(containerId);
    for (let n = 0; n < 60 && countItem(this.p.inventory, want) < count; n++) {
      const items = this.w.containers[containerId].items;
      const idx = items.findIndex((i) => i.itemId === want);
      if (idx >= 0) {
        this.must({ type: "containerTake", containerId, index: idx, itemId: want, quantity: Math.min(items[idx].quantity, count - countItem(this.p.inventory, want)) });
        continue;
      }
      // dọn rác trong tủ để sáng mai tủ bổ sung đồ mới; túi đầy thì để lại món đó
      for (let k = 0; k < items.length; ) {
        // chép trước khi lấy: lấy xong thì ô trong tủ bị trừ về 0
        const { itemId, quantity } = items[k];
        const took = this.act({ type: "containerTake", containerId, index: k, itemId, quantity });
        if (!took.ok) {
          k++;
          continue;
        }
        this.must({ type: "dropItem", itemId, quantity });
      }
      this.skipDay();
      this.goNear(containerId);
    }
    assert.ok(countItem(this.p.inventory, want) >= count, `không tìm được ${want} ở ${containerId}`);
  }

  craft(recipeId: string, times = 1) {
    const before = this.p.inventory.length;
    for (let i = 0; i < times; i++) {
      this.p.skills.crafting = 100;
      this.must({ type: "craft", recipeId });
      this.finishChannel();
    }
    void before;
  }

  /** Góp 2 bánh mì cho nhiệm vụ nhóm (mua ở căng tin) rồi nhận thưởng */
  supplies() {
    this.goNear("shop");
    this.p.money += 40;
    while (countItem(this.p.inventory, "food") < 2) this.must({ type: "buy", itemId: "food" });
    this.must({ type: "questContribute", questId: "t_supplies", objectiveId: "food", quantity: 2 });
    this.must({ type: "questComplete", questId: "t_supplies" });
  }

  escapeVia(method: EscapeMethod) {
    this.must({ type: "escapePrepare", escapeMethod: method });
    this.must({ type: "escapeReady", ready: true });
    this.must({ type: "escapeStart" });
  }
}
