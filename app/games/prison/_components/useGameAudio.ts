"use client";

/** Nối bus sự kiện engine + chuyển động thực thể vào âm thanh (nhạc theo khu/giờ, bước chân theo bề mặt). */
import { useEffect } from "react";
import { getAudio, type SfxName } from "../_lib/audio/audioManager";
import { globalBellGain, surfaceFor } from "../_lib/audio/mix";
import { hasLineOfSight } from "../_lib/engine/geometry";
import { PRISON_MAP, tileAt, zoneAt, ZONE_BY_ID } from "../_lib/engine/map";
import type { EngineEvent } from "../_lib/engine/types";
import type { PrisonSession } from "../_lib/session/types";
import type { SceneRuntime } from "./PrisonScene";

const EVENT_SFX: Record<string, SfxName> = {
  "game:bell": "bell",
  "game:rollcall-bell": "rollcallBell",
  "game:rollcall-warning": "bellWarn",
  "game:rollcall-end": "bellEnd",
  "player:woken": "bellWarn",
  "player:solo-night": "bell",
  "confiscation:reclaimed": "pickup",
  "confiscation:stolen": "lock",
  "game:countdown": "camera",
  "game:wake": "bell",
  "activity:gym": "knock",
  "activity:shower": "water",
  "inmate:fight": "alert",
  "inmate:provoke": "alert",
  "inmate:joined": "alert",
  "bed:dummy-exposed": "alert",
  "bed:rollcall-answered": "talk",
  "game:lights-out": "lightsOff",
  "guard:alert": "alert",
  "violation:serious": "alert",
  "violation:warning": "error",
  "violation:penalty": "error",
  "disguise:blown": "alert",
  "camera:spotted": "camera",
  "camera:disabled": "lock",
  "tunnel:dug": "dig",
  "tunnel:support": "knock",
  "tunnel:collapse": "hit",
  "tunnel:flushed": "water",
  "item:found": "pickup",
  "player:item-picked": "pickup",
  "player:item-dropped": "pickup",
  "player:item-thrown": "swing",
  "floor:confiscated": "alert",
  "item:hidden": "pickup",
  "container:put": "pickup",
  "bed:take": "pickup",
  "bed:place": "pickup",
  "bed:dummy-fooled": "success",
  "violation:wanted": "alert",
  "game:night-check": "knock",
  "crafting:result": "craft",
  "crafting:failed": "error",
  "route:opened": "success",
  "rescue:completed": "lock",
  "player:revived": "success",
  "player:knocked-out": "hit",
  "player:captured": "door",
  "player:released": "door",
  "escape:player-escaped": "success",
  "escape:team-victory": "success",
  "search:start": "knock",
  "search:found": "alert",
  "inmate:snitched": "talk",
  "inmate:trade": "talk",
  "work:paid": "pickup",
  "work:accident": "hit",
  "shop:bought": "pickup",
  "combat:swing": "swing",
  "combat:hit": "hit",
  "combat:ko": "hit",
  "combat:hurt": "hit",
  "combat:weapon-broken": "error",
  "combat:equip": "lock",
  "player:recovered": "success",
  "gym:rep": "success",
  "library:read": "pickup",
  "item:eaten": "pickup",
  "gym:milestone": "success",
  "gym:miss": "error",
  "gym:request": "talk",
  "gym:start": "lock",
  "loot:open": "pickup",
  "loot:take": "pickup",
  "loot:watched": "alert",
  "gear:wear": "pickup",
  "gear:dropped": "knock",
  "disguise:challenge": "talk",
  "disguise:passed": "success",
  "game:guard-missing": "alert",
  "guard:woke": "alert",
  "inmate:revenge": "alert",
  "inmate:recognized": "alert",
  "inmate:reported": "talk",
};

export function useGameAudio(session: PrisonSession, runtime: SceneRuntime) {
  useEffect(() => {
    const audio = getAudio();
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const offEvent = session.onEvent((e: EngineEvent) => {
      const sfx = EVENT_SFX[e.type];
      const v = session.getView();
      const me = v.players.find((p) => p.id === v.meId);
      const mine = e.playerId === v.meId;
      if (mine && (e.type === "player:knocked-out" || e.type === "tunnel:collapse")) runtime.shake(0.35);
      if (mine && e.type === "combat:hurt") runtime.shake(0.2);
      if (e.type === "combat:swing" && e.x !== undefined && e.y !== undefined) runtime.swing(e.x, e.y, Number(e.data?.facing ?? 0), Number(e.data?.range ?? 1));
      if (e.type === "combat:hit" && e.x !== undefined && e.y !== undefined) runtime.hit(e.x, e.y, mine);
      if (!sfx) return;
      // chuông điểm danh: âm toàn cục, nghe ở mọi khu (nhỏ hơn trong phòng kín)
      if (sfx === "rollcallBell" || sfx === "bellWarn" || sfx === "bellEnd") {
        if (e.type === "player:woken" && !mine) return;
        audio.play(sfx, { key: e.type, gain: globalBellGain(me ? zoneAt(PRISON_MAP, me.x, me.y) : null) });
        return;
      }
      if (!mine && /^(gym:(miss|rep|milestone|request)|library:read|item:eaten)$/.test(e.type)) return; // âm thanh riêng của người đang tập
      if (e.x !== undefined && e.y !== undefined && me && !mine) {
        const d = Math.hypot(e.x - me.x, e.y - me.y);
        audio.play(sfx, { distance: d, occluded: !hasLineOfSight(PRISON_MAP, me.x, me.y, e.x, e.y), key: `${e.type}:${e.playerId ?? ""}` });
      } else audio.play(sfx, { key: e.type });
    });

    // bước chân & cửa (theo chuyển động hiển thị)
    const last = new Map<string, { x: number; y: number; acc: number; tile: string }>();
    let raf = 0;
    let prevT = performance.now();
    let ctxAt = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - prevT) / 1000);
      prevT = now;
      const v = session.getView();
      const me = v.players.find((p) => p.id === v.meId);
      const sample = session.sample(now, 0);
      const all: [string, { x: number; y: number }, boolean][] = [
        ...v.players.filter((p) => p.status === "ACTIVE").map((p) => [p.id, sample.players.get(p.id) ?? p, p.sprinting] as [string, { x: number; y: number }, boolean]),
        ...v.guards.map((g) => [g.id, sample.guards.get(g.id) ?? g, g.state === "CHASE"] as [string, { x: number; y: number }, boolean]),
      ];
      for (const [id, pos, fast] of all) {
        const prev = last.get(id);
        const tile = tileAt(PRISON_MAP, Math.floor(pos.x), Math.floor(pos.y));
        if (!prev) {
          last.set(id, { x: pos.x, y: pos.y, acc: 0, tile });
          continue;
        }
        const moved = Math.hypot(pos.x - prev.x, pos.y - prev.y);
        if (moved > 2) prev.acc = 0;
        else prev.acc += moved;
        const stride = fast ? 0.62 : 0.45;
        if (prev.acc >= stride) {
          prev.acc = 0;
          const surface = surfaceFor(zoneAt(PRISON_MAP, pos.x, pos.y), tile);
          if (id === v.meId) audio.play("step", { surface, key: `step:${id}` });
          else if (me) audio.play("step", { surface, key: `step:${id}`, distance: Math.hypot(pos.x - me.x, pos.y - me.y), maxDistance: 9, occluded: !hasLineOfSight(PRISON_MAP, me.x, me.y, pos.x, pos.y) });
        }
        if (id === v.meId && tile !== prev.tile && (tile === "d" || tile === "L")) audio.play("door", { key: "door" });
        prev.x = pos.x;
        prev.y = pos.y;
        prev.tile = tile;
      }
      ctxAt += dt;
      if (ctxAt > 0.5 && me) {
        ctxAt = 0;
        const zone = zoneAt(PRISON_MAP, me.x, me.y);
        const chasingMe = v.guards.some((g) => g.state === "CHASE" && g.targetPlayerId === me.id);
        const watched = v.guards.some((g) => (g.state === "SUSPICIOUS" || g.state === "INVESTIGATE") && Math.hypot(g.x - me.x, g.y - me.y) < 8);
        const suspicion = Math.max(me.heat / 100, watched ? 0.6 : 0, chasingMe ? 1 : 0);
        // còi: bật ngay khi bị truy nã (to dần theo số sao); phong toả trại = 1 sao. Bị đuổi / nghi ngờ -> lớp nhạc căng thẳng
        const siren = me.wanted > 0 ? me.wanted : v.meta.prisonState === "LOCKDOWN" ? 1 : 0;
        audio.setContext(zone, v.clock.hour, !!(zone && ZONE_BY_ID[zone]?.restricted), Math.max(suspicion, me.wanted / 3), siren);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      offEvent();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.setContext(null, 12, false, 0, 0);
    };
  }, [session, runtime]);
}
