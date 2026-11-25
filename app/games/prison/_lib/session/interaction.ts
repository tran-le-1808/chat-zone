/** Gợi ý tương tác quanh người chơi (chỉ để hiển thị nút / phím E) — server vẫn kiểm tra lại mọi điều kiện. */
import { distanceToInteractable } from "../engine/actions";
import { PRISON_CONFIG as C } from "../engine/config";
import { dist } from "../engine/geometry";
import { countItem, ITEM_DEFS } from "../engine/items";
import { PRISON_MAP, tileAt, zoneAt } from "../engine/map";
import { clockInfo, PERIOD_INFO } from "../engine/rules";
import { tunnelComplete } from "../engine/tunnel";
import { fenceTileNear } from "../engine/breakout";
import { VEHICLES, vehiclePresent } from "../engine/vehicleSchedule";
import type { PlayerAction, Point } from "../engine/types";
import type { ClientView } from "./types";

export type Panel =
  | "inventory"
  | "craft"
  | "stash"
  | "quests"
  | "team"
  | "escape"
  | "trade"
  | "help"
  | "shop"
  | "hide"
  | "tunnel"
  | "npc"
  | "journal"
  | "settings"
  | "container"
  | "bed"
  | "gym"
  | "confiscated"
  | "stats"
  | "map";

export type HintAction = PlayerAction | { type: "openPanel"; panel: Panel; targetId?: string };

export interface InteractionOption {
  label: string;
  action: HintAction;
  tile: Point | null;
  disabledReason?: string;
  d: number;
}

export interface InteractionHint extends InteractionOption {
  options: InteractionOption[];
}

export function findInteractions(view: ClientView, pos: Point): InteractionOption[] {
  const me = view.players.find((p) => p.id === view.meId);
  if (!me || me.status !== "ACTIVE") return [];
  const R = C.interaction.range;
  const has = (id: Parameters<typeof countItem>[1]) => !!view.me && countItem(view.me.inventory, id) > 0;
  const opts: InteractionOption[] = [];
  const add = (o: Omit<InteractionOption, "d">, d: number, priority = 0) => opts.push({ ...o, d: d - priority });

  for (const p of view.players) {
    if (p.id === me.id) continue;
    const d = dist(pos.x, pos.y, p.x, p.y);
    if (p.status === "KNOCKED_OUT" && d <= R) add({ label: `Hồi sinh ${p.name}`, action: { type: "revive", targetPlayerId: p.id }, tile: { x: Math.floor(p.x), y: Math.floor(p.y) } }, d, 10);
  }
  for (const [i, cell] of PRISON_MAP.solitaryCells.entries()) {
    const door = PRISON_MAP.interactableById[cell.doorId];
    if (!door) continue;
    const d = distanceToInteractable(pos, door);
    if (d > R) continue;
    const prisoner = view.players.find((q) => q.id !== me.id && q.status === "CAPTURED" && Math.abs(q.x - cell.inside.x) < 1.6 && Math.abs(q.y - cell.inside.y) < 1.6);
    if (prisoner)
      add({ label: `Giải cứu ${prisoner.name}`, action: { type: "rescueStart", targetPlayerId: prisoner.id, rescuePointId: door.id }, tile: door.tiles[0], disabledReason: has("lockpick") ? undefined : "Cần Kẹp mở khóa" }, d, 9);
    void i;
  }
  for (const n of view.inmates) {
    const d = dist(pos.x, pos.y, n.x, n.y);
    if (n.fightWith === me.id && (n.combat === "fighting" || n.combat === "threatened") && d <= 8)
      add({ label: `Bỏ chạy & báo cai ngục về ${n.name}`, action: { type: "report", npcId: n.id }, tile: null }, d, 8);
    if (n.down) {
      if (d <= C.interaction.npcRange) add({ label: `Lục soát ${n.name} (đang ngất)`, action: { type: "lootStart", targetId: n.id }, tile: null }, d, 6);
      continue;
    }
    if (d <= C.interaction.npcRange)
      add({ label: `Nói chuyện với ${n.name}`, action: { type: "openPanel", panel: "npc", targetId: n.id }, tile: null, disabledReason: n.state === "SLEEP" ? "Đang ngủ" : undefined }, d);
  }
  for (const g of view.guards) {
    const d = dist(pos.x, pos.y, g.x, g.y);
    if (g.down) {
      if (d <= C.interaction.npcRange) add({ label: `Lục soát ${g.name} (đang ngất)`, action: { type: "lootStart", targetId: g.id }, tile: null }, d, 6);
      continue;
    }
    if (d <= C.interaction.npcRange && g.state !== "CHASE")
      add({ label: `Mua chuộc ${g.name} (bỏ qua khám phòng hôm nay)`, action: { type: "bribe", guardId: g.id }, tile: null, disabledReason: g.state === "SUSPICIOUS" ? "Đang để ý bạn" : undefined }, d + 0.5);
    if (d <= C.interaction.npcRange && g.state !== "CHASE" && (view.me?.confiscated.items.length ?? 0) > 0) {
      const price = view.me!.confiscated.reclaimPrice;
      add({ label: `Hối lộ ${g.name} chuộc lại đồ bị tịch thu (${price}$)`, action: { type: "reclaimConfiscated", guardId: g.id }, tile: null, disabledReason: g.state === "SUSPICIOUS" ? "Đang để ý bạn" : (view.me?.money ?? 0) < price ? `Cần ${price}$` : undefined }, d + 0.6);
    }
  }
  for (const f of view.meta.floorItems) {
    const d = dist(pos.x, pos.y, f.x, f.y);
    if (d <= R) add({ label: `Nhặt ${ITEM_DEFS[f.item.itemId].name}`, action: { type: "interact", targetId: f.id }, tile: { x: Math.floor(f.x), y: Math.floor(f.y) } }, d, 1);
  }
  const executing = view.meta.escape.status === "EXECUTING" || view.meta.escape.status === "RESCUE_REQUIRED";
  const period = clockInfo(view.totalGameMinutes).period;
  const sleepOk = !!PERIOD_INFO[period]?.sleepOk;
  // điểm danh đêm: đang đứng trong xà lim của đồng đội vắng mặt -> trả lời thay
  if (view.meta.nightRollcallRemaining > 0) {
    const m = /^cell_(\d+)$/.exec(zoneAt(PRISON_MAP, pos.x, pos.y) ?? "");
    const owner = m ? view.players.find((q) => q.cellIndex === Number(m[1]) && q.id !== me.id) : undefined;
    if (owner) add({ label: `Trả lời điểm danh thay ${owner.name} (${Math.ceil(view.meta.nightRollcallRemaining)}s)`, action: { type: "answerRollcall" }, tile: null }, 0, 20);
  }
  for (const it of PRISON_MAP.interactables) {
    const d = distanceToInteractable(pos, it);
    if (d > R) continue;
    const tile = it.tiles[0];
    switch (it.kind) {
      case "container": {
        const n = view.meta.containers[it.id]?.length ?? 0;
        add({ label: `Mở ${it.name}${n ? ` (${n} món)` : " (trống)"}`, action: { type: "openPanel", panel: "container", targetId: it.id }, tile }, d);
        break;
      }
      case "shop":
        add({ label: "Mở quầy căng tin", action: { type: "openPanel", panel: "shop" }, tile }, d);
        break;
      case "stash":
        add({ label: "Mở kho nhóm", action: { type: "openPanel", panel: "stash" }, tile }, d);
        break;
      case "hideSpot":
        add({ label: `${it.name}`, action: { type: "openPanel", panel: "hide", targetId: it.id }, tile }, d);
        break;
      case "bed": {
        const own = it.cellIndex === me.cellIndex;
        const dummyOn = view.meta.beds[it.id]?.dummy;
        const taken = view.players.some((q) => q.id !== me.id && q.bed === it.id);
        // ngủ mọi lúc, ở mọi giường trống; đang nằm thì chỉ còn nút Dậy
        if (me.bed === it.id) add({ label: "Dậy", action: { type: "wake" }, tile }, d - 5);
        else if (!me.bed)
          add({ label: `Ngủ${sleepOk ? "" : " (giờ sinh hoạt — sẽ bị ghi vi phạm)"}`, action: { type: "interact", targetId: it.id }, tile, disabledReason: taken ? "Giường đang có người" : dummyOn ? "Lấy hình nộm ra khỏi giường trước" : undefined }, d);
        add({ label: own ? "Gối · chăn · hình nộm" : `${it.name}: gối · chăn`, action: { type: "openPanel", panel: "bed", targetId: it.id }, tile }, d + 0.1);
        break;
      }
      case "tunnelSpot": {
        const t = view.meta.tunnels[String(it.cellIndex)];
        if (executing && tunnelComplete(t)) add({ label: "Chui qua hầm ra ngoài tường!", action: { type: "tunnel", cellIndex: it.cellIndex ?? 0, op: "crawl" }, tile }, d, 5);
        else if (it.cellIndex === me.cellIndex || t?.progress) add({ label: `Góc sàn đào được${t?.progress ? ` (${t.progress}/${C.tunnel.segments})` : ""}`, action: { type: "openPanel", panel: "tunnel", targetId: String(it.cellIndex) }, tile }, d + 0.3);
        break;
      }
      case "job":
        add({ label: `Làm việc: ${it.name} (+tiền)`, action: { type: "interact", targetId: it.id }, tile, disabledReason: PERIOD_INFO[period]?.workShift ? undefined : "Chỉ trong giờ làm nhiệm vụ 09:00–11:00, 13:00–15:00" }, d);
        break;
      case "gym":
        // bấm vào máy là tập luôn (không bảng chọn máy)
        if (!view.me?.gym) add({ label: "Tập máy này", action: { type: "interact", targetId: it.id }, tile }, d);
        break;
      case "bookshelf": {
        add({ label: `Đọc ${it.name.toLowerCase()} (+1 thông minh)`, action: { type: "interact", targetId: it.id }, tile }, d);
        break;
      }
      case "evidenceLocker": {
        const n = view.me?.confiscated.items.length ?? 0;
        add({ label: n ? `Phá tủ tang vật — lấy lại ${n} món của bạn` : "Tủ tang vật (không có đồ của bạn)", action: { type: "interact", targetId: it.id }, tile, disabledReason: n ? undefined : "Không có đồ của bạn trong tủ" }, d);
        break;
      }
      case "shower":
        // vòi sen luôn xả: đứng ở ô dưới vòi là hồi thể lực — không cần nút
        break;
      case "cameraPanel":
        add({ label: "Tắt hệ thống camera", action: { type: "interact", targetId: it.id }, tile, disabledReason: view.meta.camerasOffRemaining > 0 ? "Camera đang tắt" : undefined }, d);
        break;
      case "vent": {
        const pry = has("screwdriver") || has("shiv") || view.me?.gear.weapon?.itemId === "shiv";
        if (!view.meta.routes.ventOpen) add({ label: "Cậy lưới thông gió", action: { type: "interact", targetId: it.id }, tile, disabledReason: pry ? undefined : "Cần Dao mài hoặc Tua vít" }, d);
        break;
      }
      case "fence": {
        const ft = fenceTileNear(pos, it);
        if (!ft || view.meta.routes.fenceGaps.includes(`${ft.x},${ft.y}`)) break;
        const label = has("wire_cutters") ? `Cắt ${it.name.toLowerCase()}` : `Buộc dây leo lên ${it.name.toLowerCase()}`;
        add({ label, action: { type: "interact", targetId: it.id }, tile: ft, disabledReason: has("wire_cutters") || has("rope") ? undefined : "Cần Kìm cắt rào hoặc Dây leo cao" }, d);
        break;
      }
      case "powerPanel":
        add({ label: "Gắn thiết bị phá điện", action: { type: "interact", targetId: it.id }, tile, disabledReason: view.meta.blackoutRemaining > 0 ? "Đang mất điện" : has("jammer") ? undefined : "Cần Thiết bị phá điện" }, d);
        break;
      case "vehicle": {
        const v = it.vehicle ? VEHICLES[it.vehicle] : undefined;
        if (!v) break;
        if (me.vehicle) {
          add({ label: `Chui ra khỏi ${v.name.toLowerCase()}`, action: { type: "interact", targetId: it.id }, tile }, d, 5);
          break;
        }
        const present = vehiclePresent(v.id, clockInfo(view.totalGameMinutes).minuteOfDay);
        add({ label: `Trốn vào ${v.name.toLowerCase()}`, action: { type: "interact", targetId: it.id }, tile, disabledReason: !executing ? "Chốt kế hoạch & bắt đầu đào tẩu trước" : !present ? `${v.name} không có ở đây lúc này` : undefined }, d);
        break;
      }
      case "gate":
        add({ label: "Cổng xe tải", action: { type: "openPanel", panel: "escape" }, tile, disabledReason: me.disguised && (has("keycard") || has("fake_keycard")) ? undefined : "Cần đồng phục cai ngục + thẻ (hoặc chờ xe hàng mở cổng)" }, d + 0.5);
        break;
      default:
        break;
    }
  }
  addDigHints(view, me, pos, add);
  // đang nằm: chỉ còn Dậy
  if (me.bed) return opts.filter((o) => o.action.type === "wake").sort((a, b) => a.d - b.d);
  return opts.sort((a, b) => a.d - b.d);
}

/** Đào tường / sàn / hầm, lên xuống hầm, treo ảnh / trải thảm / gỡ — theo ô trước mặt và ô đang đứng */
function addDigHints(view: ClientView, me: ClientView["players"][number], pos: Point, add: (o: Omit<InteractionOption, "d">, d: number, priority?: number) => void): void {
  const inv = view.me?.inventory ?? [];
  const has = (id: Parameters<typeof countItem>[1]) => countItem(inv, id) > 0;
  const dig = view.meta.dig;
  if (!dig) return;
  const here = { x: Math.floor(pos.x), y: Math.floor(pos.y) };
  const f = { x: Math.floor(pos.x + Math.cos(me.facing) * 0.75), y: Math.floor(pos.y + Math.sin(me.facing) * 0.75) };
  const front = f.x === here.x && f.y === here.y ? { x: here.x + Math.round(Math.cos(me.facing)), y: here.y + Math.round(Math.sin(me.facing)) } : f;
  const k = (t: Point) => `${t.x},${t.y}`;
  const tool = has("shovel") || has("sharpened_spoon");
  const toolReason = tool ? undefined : "Cần Muỗng mài / Dụng cụ đào";
  if (me.underground) {
    if (dig.entrances[k(here)]) add({ label: "Lên khỏi hầm", action: { type: "hatch" }, tile: here }, 0, 4);
    else add({ label: "Đào lên mặt đất", action: { type: "dig", x: here.x, y: here.y }, tile: here, disabledReason: toolReason }, 0.6);
    if (!dig.tunnels[k(front)]) add({ label: "Đào hầm phía trước", action: { type: "dig", x: front.x, y: front.y }, tile: front, disabledReason: toolReason }, 0.5, 1);
    if (dig.entrances[k(here)] && has("floor_rug") && !dig.decor[k(here)]) add({ label: "Che miệng hầm bằng thảm", action: { type: "placeDecor", itemId: "floor_rug", x: here.x, y: here.y }, tile: here }, 0.7);
    return;
  }
  if (dig.entrances[k(here)]) add({ label: "Xuống hầm", action: { type: "hatch" }, tile: here }, 0, 4);
  const ch = tileAt(PRISON_MAP, front.x, front.y);
  if (ch === "#" && !dig.holes[k(front)] && tool) add({ label: "Đục tường", action: { type: "dig", x: front.x, y: front.y }, tile: front }, 1.2);
  if ((ch === "." || ch === ",") && !dig.entrances[k(front)] && tool) add({ label: "Đào sàn (mở miệng hầm)", action: { type: "dig", x: front.x, y: front.y }, tile: front }, 1.3);
  const decorAt = dig.decor[k(front)];
  if (decorAt) add({ label: `Gỡ ${ITEM_DEFS[decorAt].name.toLowerCase()}`, action: { type: "takeDecor", x: front.x, y: front.y }, tile: front }, 1.1);
  else if (ch === "#" && has("wall_picture")) add({ label: dig.holes[k(front)] ? "Treo ảnh che lỗ tường" : "Treo ảnh", action: { type: "placeDecor", itemId: "wall_picture", x: front.x, y: front.y }, tile: front }, dig.holes[k(front)] ? 0.4 : 1.4);
  else if ((ch === "." || ch === "," || dig.entrances[k(front)]) && has("floor_rug")) add({ label: dig.entrances[k(front)] ? "Trải thảm che miệng hầm" : "Trải thảm", action: { type: "placeDecor", itemId: "floor_rug", x: front.x, y: front.y }, tile: front }, dig.entrances[k(front)] ? 0.4 : 1.4);
}

export function findInteraction(view: ClientView, pos: Point): InteractionHint | null {
  const all = findInteractions(view, pos);
  if (!all.length) return null;
  return { ...all[0], options: all.slice(1, 4) };
}
