"use client";

import { useState, type ReactNode } from "react";
import { Backpack, BookOpen, Dumbbell, Check, ClipboardList, DoorOpen, Hammer, HelpCircle, MessageCircle, Package, Pickaxe, Repeat, Settings2, ShoppingCart, Users, Vault, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getAudio } from "../_lib/audio/audioManager";
import { craftSuccessChance } from "../_lib/engine/actions";

const TIER_NAMES = ["Cơ bản", "Hữu ích", "Quan trọng", "Nâng cao", "Then chốt"];
import { damageMultiplier } from "../_lib/engine/combat";
import { PRICES, SHOP_ITEMS, sellPrice, shopPrice } from "../_lib/engine/economy";
import { ESCAPE_METHODS, ESCAPE_ROUTES, fenceRingsOpen, METHOD_NAMES } from "../_lib/engine/escape";
import { isOuterWall } from "../_lib/engine/digging";
import { containerSlots } from "../_lib/engine/containers";
import { PRISON_MAP } from "../_lib/engine/map";
import SlotGrid, { Slot } from "./SlotGrid";
import { GymPanelBody } from "./GymOverlay";
import { INMATE_BY_ID, npcPrice } from "../_lib/engine/npc";
import { ROUTINE } from "../_lib/engine/config";

const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
import { supportsNeeded } from "../_lib/engine/tunnel";
import { toast } from "sonner";
import { PRISON_CONFIG as C, ROLE_INFO } from "../_lib/engine/config";
import { countItem, ITEM_DEFS, ITEM_IDS, RECIPES, slotsAfter, totalWeight } from "../_lib/engine/items";
import { toolSpec } from "../_lib/engine/tools";
import type { EscapeMethod } from "../_lib/engine/types";
import { questDef } from "../_lib/engine/quests";
import type { Gear, ItemId, PlayerAction, QuestProgress, SlotType } from "../_lib/engine/types";
import type { Panel } from "../_lib/session/interaction";
import type { ClientView } from "../_lib/session/types";
import { playerColor } from "../_lib/session/types";

export type Act = (a: PlayerAction, okText?: string) => Promise<boolean>;

const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${btn} bg-linear-to-r from-[#c81d25] to-[#e8772e] text-white shadow-[0_3px_0_#7f1118]`;
const gold = `${btn} border border-[#f4b942]/40 bg-[#f4b942]/10 text-[#ffd166] hover:bg-[#f4b942]/20`;
const ghost = `${btn} bg-white/5 text-slate-200 hover:bg-white/10`;

/** Khung bảng. fixedLayout: chiều cao cố định, phần thân không tự cuộn — con tự chia vùng cuộn / vùng cố định */
function Shell({ title, icon, onClose, children, fixedLayout = false }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode; fixedLayout?: boolean }) {
  return (
    <div className={`pointer-events-auto absolute inset-x-2 bottom-2 top-14 z-30 mx-auto flex max-w-lg flex-col overflow-hidden rounded-3xl border border-[#f4b942]/20 bg-[#11132a]/95 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-3 sm:top-16 sm:w-[440px] ${fixedLayout ? "sm:bottom-auto sm:h-[78vh]" : "sm:bottom-auto sm:max-h-[78vh]"}`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="text-[#ffd166]">{icon}</span>
        <h2 className="flex-1 text-base font-extrabold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className={fixedLayout ? "flex min-h-0 flex-1 flex-col gap-2 p-3 text-sm" : "min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm"}>{children}</div>
    </div>
  );
}

function ItemChip({ itemId, qty, durability }: { itemId: ItemId; qty?: number; durability?: number }) {
  const d = ITEM_DEFS[itemId];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-lg leading-none">{d.glyph}</span>
      <span className="font-semibold">{d.name}</span>
      {qty !== undefined && qty > 1 && <span className="text-slate-400">×{qty}</span>}
      {durability !== undefined && <span className="rounded bg-white/10 px-1 text-[10px] text-slate-300">bền {durability}</span>}
      {d.contraband && <span className="rounded bg-[#c81d25]/30 px-1 text-[10px] text-[#ff8a7a]">cấm</span>}
    </span>
  );
}

const GEAR_SLOTS: { slot: SlotType; label: string; ghost: string }[] = [
  { slot: "weapon", label: "Vũ khí", ghost: "🗡️" },
  { slot: "outfit", label: "Bộ đồ", ghost: "🩲" },
];

/** Hai ô trang bị tách riêng khỏi túi chính: vũ khí, bộ đồ (trống = chỉ mặc đồ lót) */
export function GearSlots({ gear, onPick, active }: { gear: Gear; onPick?: (slot: SlotType) => void; active?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {GEAR_SLOTS.map(({ slot, label, ghost }) => {
        const it = gear[slot as "weapon" | "outfit"];
        return (
          <div key={slot} className="text-center">
            <Slot item={it ?? undefined} label={label} ghost={ghost} disabled={!it || !onPick} onClick={it && onPick ? () => onPick(slot) : undefined} />
            <p className={`mt-0.5 text-[10px] ${active && slot === "weapon" && it ? "font-bold text-orange-300" : "text-slate-400"}`}>
              {label}
              {it?.owner && <span className="block font-mono text-[9px] text-slate-500">{it.owner}</span>}
              {it?.condition !== undefined && it.condition < 60 && <span className="block text-[9px] text-amber-400">{it.condition < 30 ? "rách bẩn" : "hơi bẩn"}</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function InventoryPanel({ view, act, onClose }: { view: ClientView; act: Act; onClose: () => void }) {
  const me = view.me;
  const mine = view.players.find((p) => p.id === view.meId);
  const [sel, setSel] = useState<number | null>(null);
  if (!me) return null;
  const w = totalWeight(me.inventory);
  const weapon = me.gear.weapon;
  const sel_ = sel !== null ? me.inventory[sel] : undefined;
  const selDef = sel_ ? ITEM_DEFS[sel_.itemId] : null;
  return (
    <Shell title="Túi đồ" icon={<Backpack className="h-5 w-5" />} onClose={onClose}>
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          Túi chính {me.inventory.length}/{me.maxSlots} ô · nặng {w}
        </span>
        <span>💰 {me.money}$ · Cấp {me.level}</span>
      </div>

      {me.confiscated.items.length > 0 && (
        <p className="rounded-xl bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-200">
          🔒 {me.confiscated.items.length} món đang nằm trong kho tịch thu — chuộc bằng hối lộ ({me.confiscated.reclaimPrice}$) hoặc đột nhập tủ tang vật.
        </p>
      )}
      <h3 className="text-xs font-bold uppercase text-slate-400">Trang bị</h3>
      <GearSlots gear={me.gear} active={mine?.weaponDrawn} />
      <div className="flex flex-wrap gap-1.5">
        {weapon && (
          <>
            <button type="button" className={mine?.weaponDrawn ? primary : gold} onClick={() => void act({ type: "equip", itemId: mine?.weaponDrawn ? null : weapon.itemId })}>
              {mine?.weaponDrawn ? "Cất vũ khí" : "Rút vũ khí"} <kbd className="rounded bg-black/30 px-1 text-[10px]">R</kbd>
            </button>
            <button type="button" className={ghost} onClick={() => void act({ type: "dropWeapon" })}>
              Vứt {ITEM_DEFS[weapon.itemId].name}
            </button>
          </>
        )}
        {me.gear.outfit && (
          <button type="button" className={ghost} onClick={() => void act({ type: "takeOff", slot: "outfit" })}>
            Cởi bộ đồ
          </button>
        )}
      </div>
      {weapon && (
        <p className="text-[11px] text-orange-300">
          ⚔️ {ITEM_DEFS[weapon.itemId].name}: {Math.round(ITEM_DEFS[weapon.itemId].weapon!.damage * damageMultiplier(me) * 10) / 10} sát thương · tầm {ITEM_DEFS[weapon.itemId].weapon!.range} · hồi {ITEM_DEFS[weapon.itemId].weapon!.cooldown}s
          {!mine?.weaponDrawn && " — đang cất (đánh tay không)"}
        </p>
      )}
      {me.gear.outfit ? (
        <p className={`rounded-xl px-2.5 py-1.5 text-[11px] ${mine?.disguised ? "bg-sky-500/15 text-sky-200" : "bg-white/[0.04] text-slate-400"}`}>
          {ITEM_DEFS[me.gear.outfit.itemId].outfitType === "guard"
            ? mine?.disguised
              ? "🧥 Đang mặc bộ đồ cai ngục — cai ngục coi bạn là đồng nghiệp; chỉ bị lộ khi bị thấy phạm tội."
              : "🧥 Bộ đồ cai ngục — vừa bị thấy phạm tội, tạm mất cải trang."
            : "👕 Bộ đồ tù"}
          {me.outfitCode && ITEM_DEFS[me.gear.outfit.itemId].outfitType !== "guard" && (
            <>
              {" "}
              · mã <b className="font-mono">{me.outfitCode}</b>
            </>
          )}
        </p>
      ) : (
        <p className="rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">🩲 Chỉ mặc đồ lót — ra hành lang / sân sẽ bị nhắc nhở.</p>
      )}

      <h3 className="text-xs font-bold uppercase text-slate-400">Túi chính ({me.maxSlots} ô)</h3>
      <div className="grid grid-cols-6 gap-[3px] rounded-lg bg-[#07080f] p-1.5">
        {Array.from({ length: me.maxSlots }, (_, i) => {
          const it = me.inventory[i];
          return <Slot key={i} item={it} disabled={!it} onClick={it ? () => setSel(sel === i ? null : i) : undefined} />;
        })}
      </div>
      {sel_ && selDef ? (
        <div className="space-y-2 rounded-2xl bg-white/[0.04] p-2.5">
          <ItemChip itemId={sel_.itemId} qty={sel_.quantity} durability={sel_.durability} />
          <p className="text-xs text-slate-400">{selDef.description}</p>
          {sel_.owner && <p className="font-mono text-[11px] text-slate-400">Mã: {sel_.owner}</p>}
          {sel_.quality !== undefined && <p className="text-[11px] text-[#ffd166]">🧍 Độ chân thực {sel_.quality}/100</p>}
          <div className="flex flex-wrap gap-1.5">
            {selDef.slotType === "outfit" && (
              <button type="button" className={gold} onClick={() => void act({ type: "wear", index: sel! }).then((ok) => ok && setSel(null))}>
                Mặc bộ đồ
              </button>
            )}
            {selDef.type === "usable" && (
              <button type="button" disabled={(me.foodCooldowns[sel_.itemId] ?? 0) > 0} className={gold} onClick={() => void act({ type: "useItem", itemId: sel_.itemId })}>
                {selDef.consumable ? `Ăn (+${selDef.staminaRestore} thể lực)` : sel_.itemId === "food" ? "Ăn" : sel_.itemId === "bandage" ? "Băng" : "Dùng"}
                {(me.foodCooldowns[sel_.itemId] ?? 0) > 0 && ` · chờ ${Math.ceil(me.foodCooldowns[sel_.itemId])}s`}
              </button>
            )}
            <button type="button" className={ghost} onClick={() => void act({ type: "dropItem", itemId: sel_.itemId, quantity: 1 }).then((ok) => ok && setSel(null))}>
              Vứt 1 (Q)
            </button>
            {sel_.quantity > 1 && (
              <button type="button" className={ghost} onClick={() => void act({ type: "dropItem", itemId: sel_.itemId, quantity: sel_.quantity }).then((ok) => ok && setSel(null))}>
                Vứt cả chồng ×{sel_.quantity} (Shift+Q)
              </button>
            )}
            <button type="button" className={ghost} title="Ném 1 món theo hướng đang nhìn, xa ~3 ô (qua được hàng rào). Tiếng rơi kéo cai ngục gần đó tới." onClick={() => void act({ type: "throwItem", itemId: sel_.itemId, dirX: 0, dirY: 0 }).then((ok) => ok && setSel(null))}>
              Ném (giữ Q)
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Bấm một ô để xem/mặc/dùng. Vũ khí luôn nằm ở ô vũ khí riêng; áo/quần mặc vào ô tương ứng, đồ cũ trả về túi (túi đầy thì rơi xuống đất).</p>
      )}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white/[0.03] p-2 text-[11px]">
        {(
          [
            ["Khéo tay", me.skills.crafting],
            ["Sức bền", me.skills.fitness],
            ["Khéo léo", me.skills.dexterity],
            ["Giao tiếp", me.skills.social],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="text-center">
            <p className="text-slate-400">{k}</p>
            <p className="font-bold text-[#ffd166]">{Math.round(v)}</p>
          </div>
        ))}
        <div className="col-span-2 text-center">
          <p className="text-slate-400">Uy tín với cai ngục</p>
          <p className="font-bold">{Math.round(me.reputation.guards)}</p>
        </div>
        <div className="col-span-2 text-center">
          <p className="text-slate-400">Uy tín với tù nhân</p>
          <p className="font-bold">{Math.round(me.reputation.inmates)}</p>
        </div>
      </div>
    </Shell>
  );
}

/** "Đã bị tịch thu": đồ đang nằm trong kho tịch thu, hạn huỷ, cách lấy lại */
function ConfiscatedPanel({ view, onClose }: { view: ClientView; onClose: () => void }) {
  const me = view.me;
  if (!me) return null;
  const list = me.confiscated.items;
  return (
    <Shell title="Đã bị tịch thu" icon={<Vault className="h-5 w-5" />} onClose={onClose}>
      {list.length === 0 ? (
        <p className="text-slate-400">Kho tịch thu không có đồ của bạn.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400">Vũ khí, đồ vượt ngục và đồ cấm bị lấy khi bạn bị bắt. Đồ sinh hoạt và quần áo tù vẫn giữ.</p>
          <div className="space-y-1.5">
            {list.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                <ItemChip itemId={e.itemId} qty={e.quantity} />
                <span className={`text-[11px] ${e.daysLeft <= 1 ? "text-red-300" : "text-slate-400"}`}>{e.daysLeft > 0 ? `huỷ sau ${e.daysLeft} ngày` : "sắp bị huỷ"}</span>
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
            <li>
              Hối lộ cai ngục (đứng gần, bấm E): <b className="text-[#ffd166]">{me.confiscated.reclaimPrice}$</b> để chuộc lại tất cả.
            </li>
            <li>Đột nhập tủ tang vật trong phòng bảo vệ (khu cấm) — bị thấy là vi phạm nặng.</li>
          </ul>
        </>
      )}
    </Shell>
  );
}

/** Bảng lục soát người đang ngất: đồ của mục tiêu bên trên, của mình bên dưới. Bấm ô để lấy. */
export function LootPanel({ view, act }: { view: ClientView; act: Act }) {
  const me = view.me;
  const loot = me?.loot;
  if (!me || !loot) return null;
  const busy = view.players.find((p) => p.id === view.meId)?.channel?.kind === "lootTake";
  const take = (slot: SlotType, index = 0) => void act({ type: "lootTake", targetId: loot.targetId, slot, index });
  return (
    <Shell title={`Lục soát ${loot.name}`} icon={<Package className="h-5 w-5" />} onClose={() => void act({ type: "lootClose" })}>
      <p className="text-[11px] text-slate-400">
        Bấm ô để lấy: món thường {C.loot.itemSeconds}s, áo/quần {C.loot.clothingSeconds}s. Di chuyển, bị đánh hoặc mục tiêu tỉnh dậy sẽ dừng lại. Lấy vũ khí khi đã có thì vũ khí cũ rơi xuống đất.
      </p>
      <h3 className="text-xs font-bold uppercase text-slate-400">Trang bị của {loot.name}</h3>
      <GearSlots gear={loot.gear} onPick={busy ? undefined : (slot) => take(slot)} />
      <h3 className="text-xs font-bold uppercase text-slate-400">Túi của {loot.name}</h3>
      <div className="grid grid-cols-6 gap-[3px] rounded-lg bg-[#07080f] p-1.5">
        {Array.from({ length: Math.max(6, loot.bag.length) }, (_, i) => {
          const it = loot.bag[i];
          return <Slot key={i} item={it} disabled={!it || busy} onClick={it && !busy ? () => take("bag", i) : undefined} />;
        })}
      </div>
      <h3 className="text-xs font-bold uppercase text-slate-400">Của bạn</h3>
      <GearSlots gear={me.gear} />
      <div className="grid grid-cols-6 gap-[3px] rounded-lg bg-[#07080f] p-1.5">
        {Array.from({ length: me.maxSlots }, (_, i) => (
          <Slot key={i} item={me.inventory[i]} disabled />
        ))}
      </div>
      <button type="button" className={ghost} onClick={() => void act({ type: "lootClose" })}>
        Đóng
      </button>
    </Shell>
  );
}

/** Cai ngục đồng nghiệp hỏi người đang cải trang — trả lời sai hoặc hết giờ là lộ */
export function ChallengeModal({ view, act }: { view: ClientView; act: Act }) {
  const ch = view.me?.challenge;
  if (!ch) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-2 top-1/4 z-40 mx-auto max-w-sm rounded-3xl border border-sky-400/40 bg-[#0d1530]/95 p-4 shadow-2xl">
      <p className="text-xs font-bold text-sky-300">🧥 {ch.guardName} hỏi bạn — còn {Math.ceil(ch.remaining)}s</p>
      <p className="mt-1 text-base font-extrabold">“{ch.question}”</p>
      <div className="mt-3 space-y-1.5">
        {ch.options.map((o, i) => (
          <button key={o} type="button" className={`${ghost} w-full justify-start text-left`} onClick={() => void act({ type: "answerChallenge", choice: i })}>
            <kbd className="rounded bg-white/15 px-1.5 text-[11px]">{i + 1}</kbd> {o}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Gợi ý: hỏi chuyện tù nhân để biết lịch và mật lệnh của cai ngục.</p>
    </div>
  );
}

const CRAFT_TABS: { id: string; label: string; cats: string[] }[] = [
  { id: "all", label: "Tất cả", cats: [] },
  { id: "tool", label: "Công cụ", cats: ["tool"] },
  { id: "component", label: "Linh kiện", cats: ["component", "raw"] },
  { id: "utility", label: "Hỗ trợ", cats: ["utility"] },
  { id: "weapon", label: "Vũ khí", cats: ["weapon"] },
  { id: "disguise", label: "Cải trang", cats: ["disguise"] },
  { id: "special", label: "Đặc biệt", cats: ["special"] },
];
const RARITY: Record<string, { label: string; cls: string }> = {
  common: { label: "Thường", cls: "text-slate-300" },
  uncommon: { label: "Khá", cls: "text-emerald-300" },
  rare: { label: "Hiếm", cls: "text-sky-300" },
  epic: { label: "Cực hiếm", cls: "text-fuchsia-300" },
};

function CraftPanel({ view, act, onClose }: { view: ClientView; act: Act; onClose: () => void }) {
  const me = view.me;
  const mine = view.players.find((p) => p.id === view.meId);
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const tabCats = CRAFT_TABS.find((t) => t.id === tab)?.cats ?? [];
  const list = [...RECIPES].filter((r) => !tabCats.length || tabCats.includes(ITEM_DEFS[r.output].category ?? "raw")).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  // số lần tối đa đủ nguyên liệu (giới hạn 10 / lần bấm)
  const maxTimes = (r: (typeof RECIPES)[number]) => Math.min(10, ...r.ingredients.map((i) => Math.floor(countItem(me.inventory, i.itemId) / i.quantity)));
  const status = (r: (typeof RECIPES)[number]): { key: "ok" | "locked" | "missing" | "full"; text: string } => {
    if (me.stats.intelligence < r.intelligenceRequired) return { key: "locked", text: `Cần ${r.intelligenceRequired} thông minh` };
    if (maxTimes(r) < 1) return { key: "missing", text: "Thiếu nguyên liệu" };
    if (slotsAfter(me.inventory, r.ingredients, [{ itemId: r.output, quantity: 1 }]) > me.maxSlots && ITEM_DEFS[r.output].slotType === "bag") return { key: "full", text: "Túi đầy" };
    return { key: "ok", text: "Chế được" };
  };
  // luôn có một công thức đang xem: đã chọn > công thức chế được đầu tiên trong tab > công thức đầu tiên
  const cur = RECIPES.find((r) => r.id === sel) ?? list.find((r) => status(r).key === "ok") ?? list[0] ?? null;
  const craftN = async (id: string, n: number) => {
    setBusy(true);
    await act({ type: "craft", recipeId: id, quantity: n });
    setBusy(false);
  };
  return (
    <Shell title="Chế tạo" icon={<Hammer className="h-5 w-5" />} onClose={onClose} fixedLayout>
      <p className="shrink-0 text-[11px] leading-snug text-slate-400">
        Chế tạo mọi nơi, ra ngay. Mở công thức theo <b>thông minh</b> (🧠 <b className="text-[#ffd166]">{me.stats.intelligence}/50</b>). Thất bại mất một nửa nguyên liệu; chế đồ cấm trước mặt cai ngục / camera bị phát hiện.
        {mine?.role === "MECHANIC" && " Mechanic: +thành công, dụng cụ +1 độ bền."}
      </p>
      <div className="flex shrink-0 flex-wrap gap-1">
        {CRAFT_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tab === t.id ? "bg-[#f4b942]/25 text-[#ffd166]" : "bg-white/5 text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {/* chỉ danh sách công thức cuộn; phần chi tiết + nút chế tạo bên dưới luôn hiển thị */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {list.length === 0 && <p className="rounded-xl bg-white/[0.03] p-3 text-center text-xs text-slate-400">Chưa có công thức trong nhóm này.</p>}
        <div className="grid gap-1.5 sm:grid-cols-2">
        {list.map((r) => {
          const st = status(r);
          const def = ITEM_DEFS[r.output];
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSel(r.id)}
              className={`rounded-xl border p-2 text-left ${cur?.id === r.id ? "border-[#f4b942]/60 bg-[#f4b942]/10" : "border-white/10 bg-white/[0.03]"} ${st.key === "locked" ? "opacity-60" : ""}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-lg">{st.key === "locked" ? "🔒" : def.glyph}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{def.name}</span>
                <span className={`text-[10px] font-bold ${RARITY[def.rarity ?? "common"]?.cls}`}>{RARITY[def.rarity ?? "common"]?.label}</span>
              </span>
              <span className={`mt-0.5 block text-[10px] font-semibold ${st.key === "ok" ? "text-emerald-300" : st.key === "locked" ? "text-slate-500" : "text-rose-300"}`}>
                Bậc {r.tier} · {st.text}
              </span>
            </button>
          );
        })}
        </div>
      </div>
      {cur && (
        <div className="max-h-[52%] shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-[#f4b942]/20 bg-white/[0.05] p-3">
          {(() => {
            const def = ITEM_DEFS[cur.output];
            const st = status(cur);
            const times = maxTimes(cur);
            const pct = mine ? Math.round(craftSuccessChance({ role: mine.role, skills: me.skills, stats: me.stats }, cur.id) * 100) : 0;
            const tool = toolSpec(cur.output);
            return (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{def.glyph}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold">{def.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {CRAFT_TABS.find((t) => t.cats.includes(def.category ?? ""))?.label ?? "Khác"} · Bậc {cur.tier} · cần 🧠 {cur.intelligenceRequired}
                      {def.maxDurability ? ` · độ bền ${def.maxDurability}` : ""}
                      {def.contraband ? " · đồ cấm" : ""}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-300">{def.description}</p>
                {tool && (
                  <p className="text-[11px] text-slate-400">
                    {tool.dig && `⛏️ Đào cấp ${tool.dig.power} · tường ×${tool.dig.wall} · sàn ×${tool.dig.floor} · hầm ×${tool.dig.tunnel} `}
                    {tool.pry && `🪝 Cậy ×${tool.pry.efficiency}${tool.pry.noise ? " (ồn)" : ""} `}
                    {tool.cut && `✂️ Cắt rào ×${tool.cut.efficiency} `}
                    {tool.pick && `🗝️ Mở khoá ×${tool.pick.efficiency}`}
                  </p>
                )}
                <div className="space-y-1">
                  {cur.ingredients.map((i) => {
                    const have = countItem(me.inventory, i.itemId);
                    const okIng = have >= i.quantity;
                    return (
                      <div key={i.itemId} className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${st.key === "locked" ? "bg-white/5 text-slate-500" : okIng ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                        <span>
                          {ITEM_DEFS[i.itemId].glyph} {ITEM_DEFS[i.itemId].name}
                        </span>
                        <span>
                          Cần {i.quantity} · có {have}
                          {!okIng && ` · thiếu ${i.quantity - have}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400">
                  ⚡ ra ngay · −{C.stamina.craftStaminaCost} thể lực mỗi lần · ✓ {pct}% thành công
                </p>
                <div className="sticky -bottom-3 -mx-3 -mb-3 flex flex-wrap gap-1.5 border-t border-white/10 bg-[#1b1d33] px-3 py-2">
                  {[1, 5].map((n) => (
                    <button key={n} type="button" disabled={busy || st.key !== "ok" || times < n} className={primary} onClick={() => void craftN(cur.id, n)}>
                      {busy ? "Đang chế tạo…" : `Chế tạo ×${n}`}
                    </button>
                  ))}
                  <button type="button" disabled={busy || st.key !== "ok" || times < 2} className={gold} onClick={() => void craftN(cur.id, times)}>
                    Tối đa (×{Math.max(0, times)})
                  </button>
                </div>
                {st.key !== "ok" && <p className="text-[11px] text-rose-300">{st.text}</p>}
              </>
            );
          })()}
        </div>
      )}
    </Shell>
  );
}

function StashPanel({ view, act, onClose }: { view: ClientView; act: Act; onClose: () => void }) {
  const me = view.me;
  if (!me) return null;
  const ts = view.teamStorage;
  return (
    <Shell title="Kho nhóm" icon={<Package className="h-5 w-5" />} onClose={onClose}>
      <p className="text-xs text-slate-400">
        Kho dùng chung của cả đội ({ts.items.length}/{ts.maxSlots} ô). Phải đứng ở hốc tường cuối hành lang.
      </p>
      <h3 className="font-bold text-[#ffd166]">Trong kho</h3>
      {ts.items.length === 0 && <p className="text-slate-500">Kho trống</p>}
      {ts.items.map((it, i) => (
        <div key={`s-${i}`} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
          <ItemChip itemId={it.itemId} qty={it.quantity} durability={it.durability} />
          <button type="button" className={gold} onClick={() => void act({ type: "withdraw", itemId: it.itemId, quantity: 1 }, "Đã lấy ra")}>
            Lấy 1
          </button>
        </div>
      ))}
      <h3 className="pt-2 font-bold text-[#ffd166]">Túi của bạn</h3>
      {me.inventory.map((it, i) => (
        <div key={`m-${i}`} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
          <ItemChip itemId={it.itemId} qty={it.quantity} durability={it.durability} />
          <button type="button" className={ghost} onClick={() => void act({ type: "deposit", itemId: it.itemId, quantity: 1 }, "Đã cất vào kho")}>
            Cất 1
          </button>
        </div>
      ))}
    </Shell>
  );
}

function QuestRow({ q, act, team, view }: { q: QuestProgress; act: Act; team: boolean; view: ClientView }) {
  const def = questDef(q.questId);
  if (!def) return null;
  const done = def.objectives.every((o) => (q.objectiveProgress[o.objectiveId] ?? 0) >= o.requiredAmount);
  const target = q.targetPlayerId ? view.players.find((p) => p.id === q.targetPlayerId)?.name : null;
  const badge: Record<string, string> = { AVAILABLE: "Có thể nhận", ACTIVE: "Đang làm", COMPLETED: "Hoàn thành", FAILED: "Thất bại", ABANDONED: "Đã bỏ" };
  return (
    <div className={`rounded-2xl p-3 ${q.status === "COMPLETED" ? "bg-emerald-500/10" : "bg-white/[0.04]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {def.name}
            {target ? `: ${target}` : ""}
            {def.escapeRequirement && <span className="ml-1.5 rounded bg-[#f4b942]/20 px-1.5 text-[10px] text-[#ffd166]">bắt buộc để thoát</span>}
          </p>
          <p className="text-xs text-slate-400">{def.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{badge[q.status]}</span>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {def.objectives.map((o) => {
          const v = q.objectiveProgress[o.objectiveId] ?? 0;
          return (
            <li key={o.objectiveId} className="flex items-center gap-2">
              <span className={v >= o.requiredAmount ? "text-emerald-400" : "text-slate-500"}>{v >= o.requiredAmount ? "✔" : "○"}</span>
              <span className="flex-1">{o.label}</span>
              <span className="text-slate-400">
                {v}/{o.requiredAmount}
              </span>
              {o.type === "DELIVER" && q.status === "ACTIVE" && v < o.requiredAmount && (
                <button
                  type="button"
                  className={`${gold} px-2! py-1! text-xs!`}
                  disabled={!view.me || !o.targetId || countItem(view.me.inventory, o.targetId as ItemId) === 0}
                  onClick={() => void act({ type: "questContribute", questId: q.questId, objectiveId: o.objectiveId, quantity: 1 }, "Đã góp")}
                >
                  Góp 1
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex gap-2">
        {!team && (q.status === "AVAILABLE" || q.status === "ABANDONED") && (
          <button type="button" className={gold} onClick={() => void act({ type: "questAccept", questId: q.questId })}>
            Nhận nhiệm vụ
          </button>
        )}
        {q.status === "ACTIVE" && done && def.type !== "DYNAMIC" && (
          <button type="button" className={primary} onClick={() => void act({ type: "questComplete", questId: q.questId }, `Nhận thưởng +${def.rewards.money}$`)}>
            <Check className="h-4 w-4" /> Nhận thưởng {def.rewards.money}$
          </button>
        )}
        {!team && q.status === "ACTIVE" && (
          <button type="button" className={ghost} onClick={() => void act({ type: "questAbandon", questId: q.questId })}>
            Bỏ
          </button>
        )}
      </div>
    </div>
  );
}

function QuestPanel({ view, act, onClose }: { view: ClientView; act: Act; onClose: () => void }) {
  return (
    <Shell title="Nhiệm vụ" icon={<ClipboardList className="h-5 w-5" />} onClose={onClose}>
      <h3 className="font-bold text-[#ffd166]">Nhiệm vụ nhóm</h3>
      {view.meta.teamQuests.map((q) => (
        <QuestRow key={q.questId} q={q} act={act} team view={view} />
      ))}
      <h3 className="pt-2 font-bold text-[#ffd166]">Nhiệm vụ cá nhân</h3>
      {(view.me?.quests ?? []).map((q) => (
        <QuestRow key={q.questId} q={q} act={act} team={false} view={view} />
      ))}
    </Shell>
  );
}

function TeamPanel({ view, act, onClose, onTrade }: { view: ClientView; act: Act; onClose: () => void; onTrade: (id: string) => void }) {
  const me = view.players.find((p) => p.id === view.meId);
  const label: Record<string, string> = { ACTIVE: "Hoạt động", KNOCKED_OUT: "Bị hạ gục", CAPTURED: "Biệt giam", ESCAPED: "Đã thoát" };
  return (
    <Shell title="Đồng đội" icon={<Users className="h-5 w-5" />} onClose={onClose}>
      {view.players.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: playerColor(p.colorIndex) }} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">
              {p.name} {p.id === view.meId && <span className="text-xs text-[#ffd166]">(bạn)</span>}
            </p>
            <p className="text-xs text-slate-400">
              {ROLE_INFO[p.role].name} · {label[p.status]}
              {!p.connected && " · 📴 mất kết nối"}
              {p.knockoutRemaining !== null && ` · còn ${Math.ceil(p.knockoutRemaining)}s`}
              {p.solitaryRemaining !== null && ` · mãn hạn sau ${Math.ceil(p.solitaryRemaining)}s`}
            </p>
            <div className="mt-1 flex gap-1">
              <div className="h-1.5 flex-1 rounded bg-white/10">
                <div className="h-full rounded bg-rose-500" style={{ width: `${(p.health / p.maxHealth) * 100}%` }} />
              </div>
              <div className="h-1.5 flex-1 rounded bg-white/10">
                <div className="h-full rounded bg-orange-500" style={{ width: `${p.heat}%` }} />
              </div>
            </div>
          </div>
          {view.mode === "multi" && p.id !== view.meId && p.status === "ACTIVE" && me?.status === "ACTIVE" && (
            <button type="button" className={ghost} onClick={() => onTrade(p.id)}>
              <Repeat className="h-4 w-4" /> Trao đổi
            </button>
          )}
        </div>
      ))}
      {me?.status === "ESCAPED" && view.mode === "multi" && (
        <button type="button" className={`${primary} w-full`} disabled={(view.me?.assistReadyIn ?? 0) > 0} onClick={() => void act({ type: "assist", assistType: "INTEL" }, "Đã gửi vị trí lính gác cho đồng đội")}>
          📡 Báo vị trí lính gác {(view.me?.assistReadyIn ?? 0) > 0 ? `(${Math.ceil(view.me!.assistReadyIn)}s)` : ""}
        </button>
      )}
      {view.me && view.me.trades.length > 0 && <TradeList view={view} act={act} />}
    </Shell>
  );
}

function TradeList({ view, act }: { view: ClientView; act: Act }) {
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  return (
    <div className="space-y-2 pt-2">
      <h3 className="font-bold text-[#ffd166]">Giao dịch đang chờ</h3>
      {view.me!.trades.map((t) => {
        const incoming = t.toId === view.meId;
        return (
          <div key={t.id} className="rounded-2xl border border-[#f4b942]/20 bg-white/[0.04] p-3 text-xs">
            <p className="font-bold">{incoming ? `${name(t.fromId)} đề nghị` : `Bạn đề nghị ${name(t.toId)}`}</p>
            <p className="mt-1">
              Đưa: {t.offered.map((o) => `${ITEM_DEFS[o.itemId].glyph}${o.quantity}`).join(" ") || "—"} · Đổi lấy: {t.requested.map((o) => `${ITEM_DEFS[o.itemId].glyph}${o.quantity}`).join(" ") || "—"}
            </p>
            <div className="mt-2 flex gap-2">
              {incoming && (
                <button type="button" className={primary} onClick={() => void act({ type: "tradeAccept", tradeId: t.id }, "Giao dịch hoàn tất")}>
                  Chấp nhận
                </button>
              )}
              <button type="button" className={ghost} onClick={() => void act({ type: "tradeDecline", tradeId: t.id })}>
                {incoming ? "Từ chối" : "Huỷ"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradeComposer({ view, act, targetId, onClose }: { view: ClientView; act: Act; targetId: string; onClose: () => void }) {
  const [offer, setOffer] = useState<Partial<Record<ItemId, number>>>({});
  const [want, setWant] = useState<Partial<Record<ItemId, number>>>({});
  const target = view.players.find((p) => p.id === targetId);
  if (!view.me || !target) return null;
  const toList = (m: Partial<Record<ItemId, number>>) => (Object.entries(m) as [ItemId, number][]).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity }));
  const owned = ITEM_IDS.filter((id) => countItem(view.me!.inventory, id) > 0);
  return (
    <Shell title={`Trao đổi với ${target.name}`} icon={<Repeat className="h-5 w-5" />} onClose={onClose}>
      <p className="text-xs text-slate-400">Đứng gần nhau (≤ {C.interaction.tradeRange} ô). Chỉ hoàn tất khi người kia chấp nhận; server kiểm tra lại túi đồ lúc chốt.</p>
      <h3 className="font-bold text-[#ffd166]">Bạn đưa</h3>
      <div className="flex flex-wrap gap-2">
        {owned.length === 0 && <span className="text-slate-500">Túi trống</span>}
        {owned.map((id) => (
          <button key={id} type="button" className={ghost} onClick={() => setOffer((o) => ({ ...o, [id]: Math.min(countItem(view.me!.inventory, id), (o[id] ?? 0) + 1) }))}>
            {ITEM_DEFS[id].glyph} {offer[id] ?? 0}/{countItem(view.me!.inventory, id)}
          </button>
        ))}
      </div>
      <h3 className="font-bold text-[#ffd166]">Đổi lấy</h3>
      <div className="flex flex-wrap gap-2">
        {ITEM_IDS.map((id) => (
          <button key={id} type="button" className={ghost} onClick={() => setWant((o) => ({ ...o, [id]: Math.min(5, (o[id] ?? 0) + 1) }))}>
            {ITEM_DEFS[id].glyph} {want[id] ?? 0}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" className={ghost} onClick={() => (setOffer({}), setWant({}))}>
          Xoá
        </button>
        <button
          type="button"
          className={`${primary} flex-1`}
          disabled={!toList(offer).length && !toList(want).length}
          onClick={async () => {
            if (await act({ type: "tradeRequest", targetPlayerId: targetId, offered: toList(offer), requested: toList(want) }, "Đã gửi đề nghị")) onClose();
          }}
        >
          Gửi đề nghị
        </button>
      </div>
    </Shell>
  );
}

function EscapePanel({ view, act, onClose }: { view: ClientView; act: Act; onClose: () => void }) {
  const e = view.meta.escape;
  const supplies = view.meta.teamQuests.find((q) => q.questId === "t_supplies");
  const me = view.players.find((p) => p.id === view.meId);
  const statusText: Record<string, string> = {
    PREPARING: "Đang chuẩn bị",
    READY_CHECK: "Chờ mọi người sẵn sàng",
    EXECUTING: "ĐANG ĐÀO TẨU",
    RESCUE_REQUIRED: "Cần giải cứu đồng đội!",
    FAILED: "Thất bại — chuẩn bị lại",
    ALL_ESCAPED: "Cả đội đã thoát",
  };
  const pst: Record<string, string> = { INSIDE: "Trong trại", ESCAPING: "Đang thoát", ESCAPED: "Đã thoát ✅", CAPTURED: "Bị giam ⛓️", KNOCKED_OUT: "Bị hạ gục 💫" };
  const uniform = view.me?.gear.outfit?.itemId === "guard_outfit";
  const rings = Object.values(fenceRingsOpen({ routes: { ventOpen: view.meta.routes.ventOpen, fenceGaps: view.meta.routes.fenceGaps } }));
  const routeReady: Record<EscapeMethod, boolean> = {
    TUNNEL: Object.values(view.meta.tunnels).some((t) => t.progress >= C.tunnel.segments),
    VENT: view.meta.routes.ventOpen,
    GATE: uniform && (countItem(view.me?.inventory ?? [], "keycard") > 0 || countItem(view.me?.inventory ?? [], "fake_keycard") > 0),
    LAUNDRY: true,
    FENCE: rings.length > 0 && rings.every(Boolean),
    WALL: Object.keys(view.meta.dig?.holes ?? {}).some((k) => {
      const [x, y] = k.split(",").map(Number);
      return isOuterWall(x, y);
    }),
    TRUCK: countItem(view.me?.inventory ?? [], "fake_key") > 0 || countItem(view.me?.inventory ?? [], "keycard") > 0,
  };
  const req = (ok: boolean, text: string) => (
    <li className="flex items-center gap-2">
      <span className={ok ? "text-emerald-400" : "text-slate-500"}>{ok ? "✔" : "○"}</span>
      {text}
    </li>
  );
  return (
    <Shell title="Kế hoạch đào tẩu" icon={<DoorOpen className="h-5 w-5" />} onClose={onClose}>
      <div className="rounded-2xl bg-white/[0.04] p-3">
        <p className="text-xs text-slate-400">Trạng thái</p>
        <p className="text-lg font-extrabold text-[#ffd166]">{statusText[e.status]}</p>
        {e.method && <p className="text-xs">Phương án: {METHOD_NAMES[e.method]}</p>}
      </div>
      <ul className="space-y-1 text-sm">{req(supplies?.status === "COMPLETED", "Nhiệm vụ nhóm «Lương thực đào tẩu» đã nhận thưởng")}</ul>
      <div className="space-y-2">
        {ESCAPE_METHODS.map((m) => {
          const r = ESCAPE_ROUTES[m];
          const open = routeReady[m];
          const canPrepare = (e.status === "PREPARING" || e.status === "FAILED" || e.status === "READY_CHECK") && me?.status === "ACTIVE";
          return (
            <details key={m} className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <span className="font-bold">
                  <span className={open ? "text-emerald-400" : "text-slate-500"}>{open ? "✔" : "○"}</span> {r.name}
                </span>
                {canPrepare && (
                  <button type="button" className={gold} onClick={() => void act({ type: "escapePrepare", escapeMethod: m }, "Đã chốt kế hoạch")}>
                    Chốt
                  </button>
                )}
              </summary>
              <p className="mt-1 text-slate-300">Cần: {r.requirements.join(" · ")}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-300">
                {r.steps.map((st) => (
                  <li key={st}>{st}</li>
                ))}
              </ol>
              <p className="mt-1 text-rose-300">Rủi ro: {r.risks}</p>
              <p className="text-slate-400">Thời gian: {r.time}</p>
            </details>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">Chiến thắng chỉ khi MỌI thành viên đều thoát. Một người thoát trước không kết thúc trận.</p>
      <div className="space-y-1.5">
        {view.meta.requiredPlayerIds.map((id) => {
          const p = view.players.find((x) => x.id === id);
          const s = e.playerStatuses[id];
          return (
            <div key={id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
              <span className="font-semibold">{p?.name ?? id}</span>
              <span>
                {s ? pst[s.status] : "—"} {e.status === "READY_CHECK" && (p?.escapeReady ? "· sẵn sàng" : "· chưa sẵn sàng")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {e.status === "READY_CHECK" && (
          <>
            <button type="button" className={ghost} onClick={() => void act({ type: "escapeReady", ready: !me?.escapeReady })}>
              {me?.escapeReady ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
            <button type="button" className={primary} disabled={!e.allPlayersReady} onClick={() => void act({ type: "escapeStart" })}>
              🏃 Bắt đầu đào tẩu
            </button>
          </>
        )}
        {(e.status === "READY_CHECK" || e.status === "EXECUTING" || e.status === "RESCUE_REQUIRED") && (
          <button type="button" className={ghost} onClick={() => void act({ type: "escapeCancel" })}>
            Huỷ kế hoạch
          </button>
        )}
      </div>
      {(e.status === "EXECUTING" || e.status === "RESCUE_REQUIRED") && <p className="rounded-xl bg-[#c81d25]/20 p-2 text-xs text-[#ffb4a8]">Đi qua lối thoát đã mở ra vùng bên ngoài (hoặc chui xuống miệng hầm) — luật chơi xác nhận khi bạn tới điểm thoát.</p>}
    </Shell>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="Cách chơi" icon={<HelpCircle className="h-5 w-5" />} onClose={onClose}>
      <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
        <li>
          <b>Phím mũi tên</b> di chuyển (phím <b>A</b> để đánh), <b>Shift</b> chạy (tốn năng lượng, gây tiếng động), <b>E</b> tương tác. Giữ <b>E</b> nhặt hết đồ quanh chân. Chọn ô túi bằng <b>1–6</b>, rồi <b>Q</b> vứt 1 món ra ô trước mặt, <b>Shift+Q</b> vứt cả chồng, giữ <b>Q</b> để ném xa ~3 ô (bay qua hàng rào, tiếng rơi kéo cai ngục tới chỗ đó). Đồ cấm vứt trên đất bị cai ngục nhặt (tịch thu, tăng nghi ngờ); tù nhân tham lam hay nhặt đồ rơi; đồ trên đất tự biến mất sau 2 ngày. Nhiệm vụ: phím <b>J</b>.
        </li>
        <li>
          <b>I</b> túi đồ · <b>C</b> chế tạo · <b>Q</b> nhiệm vụ · <b>T</b> đồng đội · <b>P</b> kế hoạch đào tẩu · <b>Tab</b> nhật ký · <b>1–6</b> chọn ô túi (bấm lại để dùng / mặc) · <b>Space</b> tạm dừng (chơi đơn) · <b>Esc</b> đóng. Hỗ trợ tay cầm (gamepad).
        </li>
        <li>
          <b>Lịch mỗi ngày</b> (lệch lịch: nhắc nhở → phạt → nghiêm trọng):
          <table className="mt-1 w-full text-xs">
            <tbody>
              {ROUTINE.periods.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap py-0.5 pr-2 font-mono text-[#ffd166]">
                    {fmtMin(p.startMinute)}–{fmtMin(p.endMinute)}
                  </td>
                  <td className="pr-2 font-semibold">{p.name}</td>
                  <td className="text-slate-400">{p.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="text-xs text-slate-400">19:30–20:00 nghỉ giữa giờ. Bỏ việc giữa ca bị trừ tiền công; không tắm bị trừ uy tín; ngủ ngoài giờ là vi phạm.</span>
        </li>
        <li>
          <b>Sau 21:00</b> phải ở trong xà lim. Ra ngoài mà bị cai ngục thấy → <b>truy nã</b> (1–3 ★, tăng khi bị thấy lại / ở ngoài lâu). Từ 2★: còi báo động, tăng viện, phong toả cửa khu (cần Kẹp mở khóa / Thẻ từ). Không bị ai thấy đủ lâu thì giảm dần. Bị bắt khi truy nã: biệt giam lâu hơn, mất một phần đồ.
        </li>
        <li>
          <b>Hình nộm</b> (chăn + gối + quần áo): đặt lên giường để trông như đang ngủ. Độ chân thực theo Khéo tay.
        </li>
        <li>
          <b>Tù nhân</b>: bị đánh thì người hung hăng đánh trả, người hiền thường bỏ chạy; người cùng nhóm có thể lao vào (tối đa 3). Người nóng tính có thù sẽ chủ động gây sự — đánh trả hoặc chọn &quot;Bỏ chạy &amp; báo cai ngục&quot;. Ngất thì tỉnh lại ở phòng y tế.
        </li>
        <li>Đói & mệt cao làm chậm. Ăn bánh mì, ngủ ở giường của mình. Làm việc ở xưởng/phòng giặt để kiếm tiền.</li>
        <li>
          <b>Đánh nhau:</b> phím <b>A</b> (giữ để đánh liên tục) vung theo hướng đang quay mặt; <b>R</b> rút/cất vũ khí đang mang ở ô vũ khí riêng (chỉ mang được 1; nhặt cái mới thì cái cũ rơi xuống đất). Vũ khí tăng sát thương, Sức mạnh và Sức bền cũng cộng thêm; đánh lén từ phía sau gây ×1,5. Vũ khí chế từ thìa + giũa (dao mài), gỗ + vải (gậy), kim loại + vải (ống thép), hoặc nhặt dùi cui khi hạ gục cai ngục. Vũ khí mòn khi trúng và là đồ cấm; cầm ra trước mặt cai ngục hay đánh nhau đều là vi phạm.
        </li>
        <li>
          <b>Thể lực</b> (thanh ⚡, tối đa 100): mỗi lần tập gym −4, đào −2, trèo rào −6, chế tạo −1 mỗi 10 giây, chạy −1 mỗi giây. Hết thể lực thì không tập, đào, trèo được; dưới 20 đi chậm 15%. Hồi khi ngủ trên giường (mọi lúc, +4 mỗi giây, tự dậy khi đầy; vẫn bị gọi dậy trước giờ điểm danh), tắm xong trong giờ tắm +30, ăn Socola (+25), Bánh năng lượng (+20), Sữa đặc (+15)… mỗi món chờ 30 giây mới ăn lại. Không hồi khi nghỉ trong khu cấm hoặc đang bị truy nã.
        </li>
        <li>
          <b>Thông minh</b> (🧠, bắt đầu 20, tối đa 50): đọc kệ sách ở thư viện (E, đứng yên 5 giây) luôn +1 mỗi lần đọc xong. Thư viện mở cả ngày. Mỗi 08:00 −2. Chế tạo cần đủ thông minh theo bậc: 0 · 15 · 25 · 35 · 45.
        </li>
        <li>
          <b>Phòng gym</b> (mở cả ngày; 15:00–16:00 là giờ gym trong lịch, E ở máy tập): số máy đẩy tạ và máy chạy bộ bằng số tù nhân. Bấm <b>xen kẽ</b> TRÁI – PHẢI (phím ←/→ hoặc A/D, trên điện thoại là hai nút lớn); bấm cùng một bên hai lần là mất đà. Đủ 10 nhịp (12 từ 21 điểm, 15 từ 36 điểm) = +1 điểm, tối đa 50. Đẩy tạ: +2 HP tối đa và +2% tấn công mỗi điểm. Chạy bộ: +1% tốc độ mỗi điểm, đào / trèo nhanh hơn (tối đa 20%). Mỗi lần −4 thể lực; dưới 4 thể lực máy không cho tập tiếp; thể lực dưới 20 cần thêm 20% nhịp. Hết giờ hoặc Nghỉ thì lần đang dở không tính. Tù nhân khác có thể xin hoặc đòi máy.
        </li>
        <li>
          <b>Túi đồ:</b> túi chính 6 ô + 3 ô trang bị riêng (vũ khí, áo, quần). Mặc áo/quần mới thì đồ cũ trả về túi, túi đầy thì rơi xuống đất. Áo tù có mã chủ — mặc áo người khác, chủ áo gặp sẽ nhận ra.
        </li>
        <li>
          <b>Lục soát người bị ngất</b> (E khi đứng cạnh): mở túi 3 giây, lấy mỗi món 0,5 giây, áo/quần 2 giây. Di chuyển, bị đánh hay nạn nhân tỉnh dậy sẽ dừng. Bị cai ngục thấy đang lục là vi phạm nặng. Tù nhân tỉnh dậy thấy mất đồ sẽ trả thù hoặc báo cai ngục.
        </li>
        <li>
          <b>Cải trang cai ngục</b> (áo + quần cai ngục): nhìn từ xa thường qua mắt (ban đêm dễ hơn). Lại gần, cai ngục kiểm <b>mã trên áo</b> — mã của người đang trực là lộ ngay; đồ bẩn/rách dễ lộ hơn. Đồng nghiệp đứng gần sẽ hỏi — chọn câu trả lời bằng chuột hoặc phím <b>1–3</b> (hỏi tù nhân để biết đáp án). Giả dạng mà nằm trong xà lim lúc điểm danh là bị phát hiện.
        </li>
        <li>
          <b>Bị bắt:</b> vũ khí, đồ vượt ngục và đồ cấm bị tịch thu vào kho (chuộc lại bằng hối lộ cai ngục hoặc đột nhập tủ tang vật trong phòng bảo vệ; quá 3 ngày bị huỷ). Chơi một mình thì không ngồi biệt giam nhiều ngày: ngủ qua đêm trong phòng biệt giam, 08:00 hôm sau thức dậy đầy thể lực rồi được thả.
        </li>
        <li>
          <b>Đánh ngất cai ngục:</b> đồng nghiệp chưa biết cho tới khi thấy người nằm ngất hoặc điểm danh thiếu người → điều tra, báo động nhỏ. Tỉnh dậy, cai ngục được tăng cường và khai ra kẻ tấn công. Mỗi cai ngục chỉ ngất được 1 lần mỗi ngày.
        </li>
        <li>Mở tủ / thùng / bàn bằng E: hiện lưới ô như rương, bấm ô để cất vào hoặc lấy ra. Chế tạo ở bất kỳ đâu (C).</li>
        <li>Giấu vật cấm sau bồn cầu, trong sách ở thư viện… Giường không giấu được đồ. Cai ngục khám phòng 10:00 &amp; 15:00 — có thể mua chuộc.</li>
        <li>Bốn lối thoát: ống thông gió (Tua vít), trèo rào (Dây thừng), đường hầm (Xẻng + Thanh chống, xả đất xuống bồn cầu, che miệng hầm), ngụy trang (áo + quần cai ngục + Thẻ từ qua cổng phụ).</li>
        <li>Lính gác thấy bạn vi phạm (khu cấm, sai giờ giới nghiêm / điểm danh, đang phá hoại) → Heat tăng → truy đuổi. Bị tóm → hạ gục; đồng đội có 45 giây hồi sinh, nếu không sẽ vào biệt giam và mất vật cấm.</li>
        <li>Team Heat 100 → phong tỏa toàn trại 90 giây.</li>
        <li>Lộ trình gợi ý: lục tủ lấy Mảnh kim loại + Nhựa → chế Tua vít → tháo nắp ống ở xưởng. Hoặc 3 Vải + Dây điện → Dây thừng → buộc lên tường sân.</li>
        <li>Góp 2 Bánh mì cho nhiệm vụ nhóm, chốt kế hoạch, cả đội Sẵn sàng rồi Bắt đầu. Chỉ thắng khi tất cả cùng thoát.</li>
        <li>Giải cứu đồng đội bị biệt giam bằng Kẹp mở khóa (Dây điện + Giũa) ở cửa biệt giam.</li>
      </ul>
    </Shell>
  );
}

function ShopPanel({ view, act, onClose }: { view: ClientView; act: Act; onClose: () => void }) {
  const me = view.me;
  if (!me) return null;
  const sellable = me.inventory.filter((i, k, arr) => !ITEM_DEFS[i.itemId].contraband && arr.findIndex((x) => x.itemId === i.itemId) === k);
  return (
    <Shell title="Căng tin" icon={<ShoppingCart className="h-5 w-5" />} onClose={onClose}>
      <p className="text-xs text-slate-400">Giá dao động theo cung cầu (mua nhiều thì đắt lên, hồi dần theo giờ). Kỹ năng Giao tiếp & uy tín với cai ngục giúp giảm giá. 💰 {me.money}$</p>
      {SHOP_ITEMS.map((s) => {
        const price = shopPrice(view.meta, s.itemId, me);
        return (
          <div key={s.itemId} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
            <ItemChip itemId={s.itemId} />
            <button type="button" className={primary} disabled={me.money < price} onClick={() => void act({ type: "buy", itemId: s.itemId })}>
              Mua {price}$
            </button>
          </div>
        );
      })}
      <h3 className="pt-2 font-bold text-[#ffd166]">Bán lại</h3>
      {sellable.length === 0 && <p className="text-slate-500">Không có gì để bán (căng tin không mua đồ cấm)</p>}
      {sellable.map((i) => (
        <div key={i.itemId} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
          <ItemChip itemId={i.itemId} qty={countItem(me.inventory, i.itemId)} />
          <button type="button" className={ghost} onClick={() => void act({ type: "sell", itemId: i.itemId })}>
            Bán {sellPrice(view.meta, i.itemId)}$
          </button>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">Tiền mặt trên {PRICES.cashContrabandThreshold}$ bị xem là đồ cấm khi bị bắt.</p>
    </Shell>
  );
}

function HidePanel({ view, act, onClose, spotId }: { view: ClientView; act: Act; onClose: () => void; spotId: string }) {
  const me = view.me;
  const spot = PRISON_MAP.interactableById[spotId];
  if (!me || !spot) return null;
  const items = view.meta.hideSpots[spotId] ?? [];
  const toilet = spotId.startsWith("toilet_");
  const safety = Math.round((spot.safety ?? 0.5) * 100);
  return (
    <Shell title={spot.name} icon={<Vault className="h-5 w-5" />} onClose={onClose}>
      <p className="text-xs text-slate-400">
        Độ an toàn {safety}% — khi khám phòng, mỗi vật cấm có {100 - safety}% khả năng bị lộ. Sức chứa {items.length}/{spot.capacity ?? 4} ô.
      </p>
      {toilet && countItem(me.inventory, "dirt") > 0 && (
        <button type="button" className={`${primary} w-full`} onClick={() => void act({ type: "flush", spotId })}>
          🚽 Xả 1 đất đào ({countItem(me.inventory, "dirt")})
        </button>
      )}
      <h3 className="font-bold text-[#ffd166]">Đang giấu</h3>
      {items.length === 0 && <p className="text-slate-500">Trống</p>}
      {items.map((it, i) => (
        <div key={`h-${i}`} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
          <ItemChip itemId={it.itemId} qty={it.quantity} durability={it.durability} />
          <button type="button" className={gold} onClick={() => void act({ type: "retrieve", spotId, itemId: it.itemId, quantity: 1 })}>
            Lấy 1
          </button>
        </div>
      ))}
      <h3 className="pt-2 font-bold text-[#ffd166]">Túi của bạn</h3>
      {me.inventory.map((it, i) => (
        <div key={`m-${i}`} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
          <ItemChip itemId={it.itemId} qty={it.quantity} durability={it.durability} />
          <button type="button" className={ghost} onClick={() => void act({ type: "hide", spotId, itemId: it.itemId, quantity: 1 })}>
            Giấu 1
          </button>
        </div>
      ))}
    </Shell>
  );
}

function TunnelPanel({ view, act, onClose, cellIndex }: { view: ClientView; act: Act; onClose: () => void; cellIndex: number }) {
  const me = view.me;
  if (!me) return null;
  const t = view.meta.tunnels[String(cellIndex)] ?? { progress: 0, supports: 0, covered: true };
  const need = supportsNeeded(t.progress);
  const risky = t.progress > 0 && t.progress % C.tunnel.supportEvery === 0 && t.supports < need;
  return (
    <Shell title={`Đường hầm phòng ${cellIndex + 1}`} icon={<Pickaxe className="h-5 w-5" />} onClose={onClose}>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-amber-500" style={{ width: `${(t.progress / C.tunnel.segments) * 100}%` }} />
      </div>
      <p className="text-xs text-slate-300">
        {t.progress}/{C.tunnel.segments} đoạn · {t.supports} thanh chống (cần {need}) · miệng hầm {t.covered ? "đã che" : <b className="text-red-300">đang hở!</b>}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
        <li>Mỗi đoạn đào ra 1 Đất (vật cấm) — xả xuống bồn cầu trong phòng.</li>
        <li>Cứ {C.tunnel.supportEvery} đoạn cần 1 Thanh chống, thiếu có thể sập ({Math.round(C.tunnel.collapseChance * 100)}%).</li>
        <li>Đào gây tiếng động & là vi phạm nghiêm trọng nếu bị thấy. Hãy che miệng hầm trước giờ khám phòng.</li>
      </ul>
      {risky && <p className="rounded-xl bg-red-500/15 p-2 text-xs text-red-200">⚠️ Đào tiếp mà không chống có thể sập hầm!</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={!countItem(me.inventory, "shovel") || t.progress >= C.tunnel.segments} onClick={() => void act({ type: "tunnel", cellIndex, op: "dig" })}>
          ⛏️ Đào {countItem(me.inventory, "shovel") ? "" : "(cần Xẻng)"}
        </button>
        <button type="button" className={gold} disabled={!countItem(me.inventory, "support") || t.progress === 0} onClick={() => void act({ type: "tunnel", cellIndex, op: "support" })}>
          🪜 Chống hầm
        </button>
        <button type="button" className={ghost} disabled={t.covered || t.progress === 0} onClick={() => void act({ type: "tunnel", cellIndex, op: "cover" })}>
          🛏️ Che miệng hầm
        </button>
      </div>
    </Shell>
  );
}

function ContainerPanel({ view, act, onClose, containerId }: { view: ClientView; act: Act; onClose: () => void; containerId: string }) {
  const me = view.me;
  const it = PRISON_MAP.interactableById[containerId];
  if (!me || !it) return null;
  const items = view.meta.containers[containerId] ?? [];
  const slots = containerSlots(it);
  return (
    <Shell title={it.name} icon={<Package className="h-5 w-5" />} onClose={onClose}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {items.length}/{slots} ô
        </span>
        <span>Bấm ô để chuyển qua lại — mở nhiều lần mỗi ngày được tính 1 lần cho nhiệm vụ</span>
      </div>
      <SlotGrid items={items} slots={slots} onMove={(index, item, all) => void act({ type: "containerTake", containerId, index, itemId: item.itemId, quantity: all ? item.quantity : 1 })} />
      <h3 className="text-xs font-bold uppercase text-slate-400">Túi đồ của bạn</h3>
      <SlotGrid items={me.inventory} slots={me.maxSlots} onMove={(index, item, all) => void act({ type: "containerPut", containerId, index, itemId: item.itemId, quantity: all ? item.quantity : 1 })} />
      <p className="text-[11px] text-slate-500">Đồ cấm cất trong bàn phòng giam rất dễ bị cai ngục lục ra khi khám phòng — hãy giấu ở chỗ an toàn hơn.</p>
    </Shell>
  );
}

const BED_SLOTS: { what: "pillow" | "blanket" | "dummy"; label: string; ghost: string }[] = [
  { what: "pillow", label: "Gối", ghost: "☁️" },
  { what: "blanket", label: "Chăn", ghost: "🛏️" },
  { what: "dummy", label: "Hình nộm", ghost: "🧍" },
];

function BedPanel({ view, act, onClose, bedId }: { view: ClientView; act: Act; onClose: () => void; bedId: string }) {
  const me = view.me;
  const mine = view.players.find((p) => p.id === view.meId);
  const it = PRISON_MAP.interactableById[bedId];
  const bed = view.meta.beds[bedId];
  if (!me || !mine || !it || !bed) return null;
  const own = it.cellIndex === mine.cellIndex;
  return (
    <Shell title={it.name} icon={<Vault className="h-5 w-5" />} onClose={onClose}>
      <p className="text-xs text-slate-400">
        {own ? "Giường của bạn. " : ""}Giường chỉ để nằm nghỉ — không chứa, không giấu được đồ. Trên giường có 1 gối và 1 chăn; lấy ra để ghép Hình nộm (chăn + gối + quần áo, chế tạo ở C). Đồ đặt trên giường lộ ngay khi khám phòng.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {BED_SLOTS.map((b) => {
          const present = bed[b.what];
          const have = countItem(me.inventory, b.what) > 0;
          return (
            <div key={b.what} className="space-y-1 text-center">
              <Slot
                large
                item={present ? { itemId: b.what, quantity: 1 } : undefined}
                ghost={b.ghost}
                disabled={!present && !have}
                onClick={() => void act(present ? { type: "bedTake", bedId, what: b.what } : { type: "bedPlace", bedId, what: b.what })}
              />
              <p className="text-[11px] font-bold">{b.label}</p>
              <p className="text-[10px] text-slate-500">{present ? "Bấm để lấy" : have ? "Bấm để đặt" : "Trống"}</p>
            </div>
          );
        })}
      </div>
      {bed.dummy && (
        <div className="space-y-1 rounded-xl bg-[#f4b942]/10 p-2 text-xs text-[#ffd166]">
          <p>🧍 Hình nộm trên giường — độ chân thực {bed.realism}/100.</p>
          <p className="text-slate-300">Ban đêm cai ngục nhìn thoáng vào xà lim (22:00, 00:00, 04:00): hình nộm tốt + trời tối dễ qua mắt. Điểm danh đêm 02:00 gọi tên thì hình nộm lộ, trừ khi đồng đội đứng trong xà lim trả lời thay. Không tránh được điểm danh 08:30 / 19:00.</p>
          <div className="h-1.5 overflow-hidden rounded bg-black/40" title="Thanh nghi ngờ phụ — đầy thì lộ">
            <div className="h-full bg-red-500" style={{ width: `${bed.meter}%` }} />
          </div>
        </div>
      )}
      {own && !bed.dummy && (
        <button
          type="button"
          className={`${primary} w-full`}
          onClick={async () => {
            if (await act({ type: "interact", targetId: bedId })) onClose();
          }}
        >
          😴 Ngủ (hồi sức, tua nhanh thời gian)
        </button>
      )}
      <h3 className="text-xs font-bold uppercase text-slate-400">Túi đồ của bạn</h3>
      <SlotGrid
        items={me.inventory}
        slots={me.maxSlots}
        onMove={(_i, item) => {
          if (item.itemId === "pillow" || item.itemId === "blanket" || item.itemId === "dummy") void act({ type: "bedPlace", bedId, what: item.itemId });
          else toast.error("Giường chỉ nhận gối, chăn và hình nộm");
        }}
      />
      <p className="text-[11px] text-slate-500">Quy định: ban đêm vắng mặt khỏi phòng mà giường không có hình nộm sẽ bị phát lệnh truy nã.</p>
    </Shell>
  );
}

function NpcPanel({ view, act, onClose, npcId }: { view: ClientView; act: Act; onClose: () => void; npcId: string }) {
  const def = INMATE_BY_ID[npcId];
  const me = view.me;
  const meP = view.players.find((p) => p.id === view.meId);
  if (!def || !me || !meP) return null;
  const personality: Record<string, string> = { calm: "điềm tĩnh", greedy: "tham lam", snitch: "hay mách lẻo", hothead: "nóng tính" };
  return (
    <Shell title={def.name} icon={<MessageCircle className="h-5 w-5" />} onClose={onClose}>
      <p className="text-xs text-slate-400">
        Tính cách: {personality[def.personality]} · hung hăng {Math.round(def.aggression * 100)}% · nhóm {def.groupId}. Thông tin từ tù nhân có thể sai — tự kiểm chứng!
      </p>
      {me.groupRep[def.groupId] !== undefined && <p className="text-xs text-slate-400">Uy tín của bạn với nhóm {def.groupId}: {Math.round(me.groupRep[def.groupId])}</p>}
      <button type="button" className={`${gold} w-full`} onClick={() => void act({ type: "npcTalk", npcId })}>
        💬 Hỏi chuyện (ghi vào nhật ký)
      </button>
      <h3 className="pt-2 font-bold text-[#ffd166]">Hàng chợ đen</h3>
      {def.sells.map((s) => {
        const price = npcPrice(def, s.itemId, me) ?? 0;
        return (
          <div key={s.itemId} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5">
            <ItemChip itemId={s.itemId} />
            <button type="button" className={primary} disabled={me.money < price} onClick={() => void act({ type: "npcBuy", npcId, itemId: s.itemId })}>
              Mua {price}$
            </button>
          </div>
        );
      })}
    </Shell>
  );
}

function JournalPanel({ view, onClose }: { view: ClientView; onClose: () => void }) {
  const icon: Record<string, string> = { warning: "📣", penalty: "⚠️", violation: "🚨", event: "📝", search: "🔦", capture: "⛓️", escape: "🌄", tip: "💬", craft: "🛠️" };
  const list = [...view.meta.journal].reverse();
  const fmt = (t: number) => `N${Math.floor(t / 1440) + 1} ${String(Math.floor((t % 1440) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  return (
    <Shell title="Nhật ký" icon={<BookOpen className="h-5 w-5" />} onClose={onClose}>
      {view.me && (
        <p className="text-xs text-slate-400">
          Hôm nay: {view.me.violationsToday} vi phạm · Bị bắt {view.me.timesCaught} lần
        </p>
      )}
      {list.length === 0 && <p className="text-slate-500">Chưa có gì.</p>}
      {list.map((j) => (
        <div key={j.id} className="flex gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
          <span>{icon[j.kind] ?? "•"}</span>
          <span className="shrink-0 text-slate-500">{fmt(j.t)}</span>
          <span className="text-slate-200">{j.text}</span>
        </div>
      ))}
    </Shell>
  );
}

/** Bật / tắt chữ gợi ý tương tác (mặc định tắt) */
function HintToggle() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem("prison:showHints") === "1";
    } catch {
      return false;
    }
  });
  return (
    <label className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
      <span>Hiện chữ gợi ý tương tác</span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          try {
            localStorage.setItem("prison:showHints", e.target.checked ? "1" : "0");
          } catch {
            /* bỏ qua */
          }
          window.dispatchEvent(new Event("prison:hints"));
        }}
      />
    </label>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const audio = getAudio();
  const s = useSyncExternalStore(
    (fn) => audio.subscribe(fn),
    () => audio.getSettings(),
    () => audio.getSettings(),
  );
  const slider = (label: string, key: "master" | "music" | "sfx" | "voice", bus?: "music" | "sfx" | "voice") => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        {bus && (
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input type="checkbox" checked={s.muted[bus]} onChange={(e) => audio.setSettings({ muted: { ...s.muted, [bus]: e.target.checked } })} /> Tắt
          </label>
        )}
      </div>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => audio.setSettings({ [key]: Number(e.target.value) })} className="w-full accent-[#f4b942]" aria-label={label} />
    </div>
  );
  return (
    <Shell title="Cài đặt" icon={<Settings2 className="h-5 w-5" />} onClose={onClose}>
      <HintToggle />
      {slider("Tổng", "master")}
      {slider("Nhạc nền", "music", "music")}
      {slider("Hiệu ứng", "sfx", "sfx")}
      {slider("Bong bóng thoại", "voice", "voice")}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.muteWhenHidden} onChange={(e) => audio.setSettings({ muteWhenHidden: e.target.checked })} /> Tắt tiếng khi ẩn tab
      </label>
      <p className="text-xs text-slate-500">Toàn bộ nhạc và hiệu ứng được tổng hợp trong trình duyệt (WebAudio).</p>
    </Shell>
  );
}

export default function Panels({ panel, panelTarget, view, act, onClose, tradeTarget, setTradeTarget }: { panel: Panel | null; panelTarget: string | null; view: ClientView; act: Act; onClose: () => void; tradeTarget: string | null; setTradeTarget: (id: string | null) => void }) {
  if (!panel) return null;
  switch (panel) {
    case "inventory":
      return <InventoryPanel view={view} act={act} onClose={onClose} />;
    case "craft":
      return <CraftPanel view={view} act={act} onClose={onClose} />;
    case "stash":
      return <StashPanel view={view} act={act} onClose={onClose} />;
    case "quests":
      return <QuestPanel view={view} act={act} onClose={onClose} />;
    case "team":
      return <TeamPanel view={view} act={act} onClose={onClose} onTrade={(id) => setTradeTarget(id)} />;
    case "trade":
      return tradeTarget ? <TradeComposer view={view} act={act} targetId={tradeTarget} onClose={onClose} /> : null;
    case "escape":
      return <EscapePanel view={view} act={act} onClose={onClose} />;
    case "help":
      return <HelpPanel onClose={onClose} />;
    case "shop":
      return <ShopPanel view={view} act={act} onClose={onClose} />;
    case "hide":
      return panelTarget ? <HidePanel view={view} act={act} onClose={onClose} spotId={panelTarget} /> : null;
    case "tunnel":
      return panelTarget ? <TunnelPanel view={view} act={act} onClose={onClose} cellIndex={Number(panelTarget)} /> : null;
    case "npc":
      return panelTarget ? <NpcPanel view={view} act={act} onClose={onClose} npcId={panelTarget} /> : null;
    case "container":
      return panelTarget ? <ContainerPanel view={view} act={act} onClose={onClose} containerId={panelTarget} /> : null;
    case "bed":
      return panelTarget ? <BedPanel view={view} act={act} onClose={onClose} bedId={panelTarget} /> : null;
    case "journal":
      return <JournalPanel view={view} onClose={onClose} />;
    case "confiscated":
      return <ConfiscatedPanel view={view} onClose={onClose} />;
    case "gym":
      return (
        <Shell title="Phòng gym" icon={<Dumbbell className="h-5 w-5" />} onClose={onClose}>
          <GymPanelBody view={view} act={(a) => void act(a).then((ok) => ok && a.type === "gymStart" && onClose())} />
        </Shell>
      );
    case "settings":
      return <SettingsPanel onClose={onClose} />;
  }
}

export function useToastAct(sessionAct: (a: PlayerAction) => Promise<{ ok: boolean; message?: string; duplicate?: boolean }>): Act {
  return async (a, okText) => {
    const r = await sessionAct(a);
    if (!r.ok) toast.error(r.message ?? "Không thực hiện được");
    else if (okText) toast.success(okText);
    return r.ok;
  };
}
