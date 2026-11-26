/** Test theo tài liệu "Phòng tập gym" (mục 9) */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agilitySpeed,
  agilityTime,
  baseClicksFor,
  beatsNeeded,
  buildMeta,
  clockInfo,
  createOutbox,
  damageMultiplier,
  GYM,
  GYM_KINDS,
  machineCount,
  machineId,
  movementModifiers,
  PRISON_CONFIG as C,
  runTick,
  type PlayerState,
  type WorldState,
} from "../_lib/engine";
import { act, makeWorld, noGuards, place, ticks } from "./helpers";

const GYM_SPOT = { x: 38.5, y: 28.5 };
const OPEN = 15 * 60 + 5;

function gymWorld(players = 1, seed = 3) {
  const w = makeWorld(players, players > 1 ? "multi" : "single", seed);
  noGuards(w);
  w.totalGameMinutes = OPEN;
  for (let i = 1; i <= players; i++) place(w, `p${i}`, GYM_SPOT.x + (i - 1) * 0.3, GYM_SPOT.y);
  // tù nhân NPC đứng xa phòng gym (không tranh máy) trừ khi test cần
  for (const n of w.inmates) {
    n.x = 30.5;
    n.y = 8.5;
    n.path = [];
    n.waitUntil = 1e9;
    n.goalZone = "yard";
  }
  return { w, p: w.players.p1 };
}

/** Bấm xen kẽ `beats` nhịp (mỗi nhịp = trái + phải) */
function pump(w: WorldState, pid: string, beats: number) {
  for (let i = 0; i < beats; i++) {
    act(w, pid, { type: "gymPress", side: 0 });
    act(w, pid, { type: "gymPress", side: 1 });
  }
}

function startOn(w: WorldState, p: PlayerState, kind: "pressBench" | "treadmill" = "pressBench", index = 0) {
  const r = act(w, p.id, { type: "gymStart", machineId: machineId(kind, index) });
  assert.equal(r.ok, true, JSON.stringify(r));
  return machineId(kind, index);
}

// 1. Số máy
test("số máy: mỗi loại đúng bằng số tù nhân (NPC + người chơi chưa thoát); thêm/bớt tù nhân thì cập nhật", () => {
  const { w } = gymWorld(2);
  const n = w.inmates.length + 2;
  assert.equal(machineCount(w, "pressBench"), n);
  assert.equal(machineCount(w, "treadmill"), n);
  let meta = buildMeta(w);
  assert.equal(meta.gym.perKind, n);
  assert.equal(meta.gym.machines.filter((m) => m.kind === "pressBench").length, n);
  assert.equal(meta.gym.machines.filter((m) => m.kind === "treadmill").length, n);
  // tù nhân mới
  w.inmates.push({ ...structuredClone(w.inmates[0]), id: "inm_new" });
  assert.equal(machineCount(w, "pressBench"), n + 1);
  // được thả / thoát
  w.inmates.pop();
  w.inmates.pop();
  w.players.p2.status = "ESCAPED";
  assert.equal(machineCount(w, "treadmill"), n - 2);
  meta = buildMeta(w);
  assert.equal(meta.gym.machines.length, (n - 2) * 2);
  // máy bị dỡ khi số tù nhân giảm -> người đang dùng máy đó phải rời
  const { w: w2, p } = gymWorld(1);
  const last = machineCount(w2, "pressBench") - 1;
  startOn(w2, p, "pressBench", last);
  w2.inmates.pop();
  ticks(w2, 1);
  assert.equal(p.gym, null);
  // máy không tồn tại
  const bad = act(w2, "p1", { type: "gymStart", machineId: machineId("pressBench", 99) });
  assert.equal(!bad.ok && bad.code, "NOT_FOUND");
});

// 2. Nhịp click
test("nhịp: bấm xen kẽ được tính; bấm cùng bên hai lần làm mất đà và reset thanh đà", () => {
  const { w, p } = gymWorld();
  p.skills.fitness = 0;
  startOn(w, p);
  pump(w, "p1", 4);
  assert.equal(p.gym!.beats, 4);
  assert.ok(p.gym!.momentum > 0);
  act(w, "p1", { type: "gymPress", side: 0 });
  assert.equal(p.gym!.beats, 4, "nửa nhịp chưa tính");
  const miss = act(w, "p1", { type: "gymPress", side: 0 });
  assert.equal(miss.ok && miss.data?.miss, true);
  assert.equal(p.gym!.momentum, 0);
  assert.equal(p.gym!.beats, 0, "mất đà: bắt đầu lại nhịp mới");
  // Thể lực cao: ít mất đà hơn (giữ lại một phần)
  p.skills.fitness = 100;
  pump(w, "p1", 6);
  act(w, "p1", { type: "gymPress", side: 1 });
  assert.equal(p.gym!.beats, Math.floor(6 * GYM.momentum.mistakeKeepPerFitness100));
});

// 3. Đếm điểm & 7. Độ khó
test("điểm: đủ nhịp của mức hiện tại thì +1 đúng một điểm; dừng giữa chừng không cộng", () => {
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  const s0 = p.stats.strength;
  startOn(w, p);
  const need = beatsNeeded(p, "pressBench", C.needs.slowThreshold);
  assert.equal(need, 10);
  pump(w, "p1", need - 1);
  assert.equal(p.stats.strength, s0);
  pump(w, "p1", 1);
  assert.equal(p.stats.strength, s0 + 1, "đúng +1");
  assert.equal(p.gym!.reps, 1);
  assert.equal(p.gym!.beats, 0);
  pump(w, "p1", 7);
  assert.equal(act(w, "p1", { type: "gymStop" }).ok, true);
  assert.equal(p.stats.strength, s0 + 1, "lần dở không cộng");
  assert.equal(p.gym, null);
  assert.ok(w.journal.some((j) => j.text === `Tập đẩy tạ — Sức mạnh ${s0 + 1}/50`));
});

test("độ khó: số nhịp mỗi lần đổi đúng theo mốc 20 / 35 điểm", () => {
  assert.equal(baseClicksFor(0), 10);
  assert.equal(baseClicksFor(20), 10);
  assert.equal(baseClicksFor(21), 12);
  assert.equal(baseClicksFor(35), 12);
  assert.equal(baseClicksFor(36), 15);
  assert.equal(baseClicksFor(50), 15);
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  p.stats.agility = 21;
  startOn(w, p, "treadmill", 1);
  pump(w, "p1", 11);
  assert.equal(p.stats.agility, 21);
  pump(w, "p1", 1);
  assert.equal(p.stats.agility, 22);
});

// 4. Giới hạn
test("giới hạn: sức mạnh và nhanh nhẹn không vượt 50", () => {
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  p.stats.strength = 49;
  p.stats.agility = 50;
  startOn(w, p);
  pump(w, "p1", 15);
  assert.equal(p.stats.strength, 50);
  p.stats.energy = 100;
  pump(w, "p1", 15);
  assert.equal(p.stats.strength, 50);
  act(w, "p1", { type: "gymStop" });
  startOn(w, p, "treadmill", 0);
  p.stats.energy = 100;
  pump(w, "p1", 15);
  assert.equal(p.stats.agility, 50);
});

// 5. Hiệu quả sức mạnh
test("sức mạnh: HP tối đa +2/điểm, máu hiện tại tăng theo phần chênh; tấn công × (1 + sức mạnh × 0.02)", () => {
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  p.stats.health = 60;
  const max0 = p.stats.maxHealth;
  const atk = () => damageMultiplier({ stats: p.stats, skills: { fitness: 0 } }); // chỉ phần Sức mạnh
  const atk0 = atk();
  startOn(w, p);
  pump(w, "p1", 10);
  assert.equal(p.stats.maxHealth, max0 + GYM.strength.hpPerPoint);
  assert.equal(p.stats.health, 60 + GYM.strength.hpPerPoint, "không hồi đầy máu");
  assert.ok(Math.abs(atk() - atk0 - GYM.strength.attackPerPoint) < 1e-9);
  // khởi tạo: máu tối đa = gốc + sức mạnh × 2
  const fresh = makeWorld(1).players.p1;
  assert.equal(fresh.stats.maxHealth, C.player.maxHealth + fresh.stats.strength * GYM.strength.hpPerPoint);
  // 50 điểm: tấn công gấp 2 (thể lực 0)
  assert.equal(damageMultiplier({ stats: { strength: 50 }, skills: { fitness: 0 } }), 2);
});

// 6. Hiệu quả nhanh nhẹn
test("nhanh nhẹn: tốc độ × (1 + nhanh nhẹn × 0.01) có trần; thời gian đào/leo giảm tối đa 20%", () => {
  const base = { hunger: 0, fitness: 0, stamina: 5 };
  const s0 = movementModifiers({ ...base, agility: 0 }).speedMul;
  assert.ok(Math.abs(movementModifiers({ ...base, agility: 12 }).speedMul / s0 - 1.12) < 1e-3);
  assert.ok(Math.abs(movementModifiers({ ...base, agility: 50 }).speedMul / s0 - 1.5) < 1e-3);
  assert.equal(agilitySpeed(500), GYM.agility.maxSpeedMultiplier, "có trần");
  assert.equal(agilityTime({ stats: { agility: 0 } as PlayerState["stats"] }), 1);
  assert.ok(Math.abs(agilityTime({ stats: { agility: 50 } as PlayerState["stats"] }) - 0.8) < 1e-9);
  assert.ok(agilityTime({ stats: { agility: 999 } as PlayerState["stats"] }) >= 0.8 - 1e-9);
  // máy chạy bộ: chạy nhanh hơn thật sự trên bản đồ
  const run = (agility: number) => {
    const w = makeWorld(1);
    noGuards(w);
    w.players.p1.stats.agility = agility;
    w.players.p1.stats.hunger = 0;
    w.players.p1.stats.energy = 100;
    place(w, "p1", 30.5, 8.5);
    const x0 = w.players.p1.x;
    runTick(w, createOutbox(), new Map([["p1", Array.from({ length: 10 }, (_, i) => ({ sequence: i + 1, directionX: 1, directionY: 0, sprint: false }))]]));
    return w.players.p1.x - x0;
  };
  assert.ok(Math.abs(run(30) / run(0) - 1.3) < 0.02);
});

// 8. Thể lực (ghi đè phần "mệt" theo tài liệu thể lực)
test("thể lực: mỗi lần −4; thể lực < 20 cần thêm 20% nhịp; dưới 4 thì máy dừng, không cho bắt đầu lần mới", () => {
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  p.stats.hunger = 0;
  startOn(w, p);
  pump(w, "p1", 10);
  assert.equal(p.stats.energy, 100 - C.stamina.gymStaminaCost);
  p.stats.energy = C.stamina.lowThreshold - 1;
  assert.equal(beatsNeeded(p, "pressBench", C.needs.slowThreshold), Math.ceil(10 * GYM.lowStaminaMultiplier));
  // đói / yếu: cảnh báo & giảm hiệu quả
  p.stats.energy = 100;
  p.stats.hunger = 90;
  assert.equal(beatsNeeded(p, "pressBench", C.needs.slowThreshold), Math.ceil(10 * GYM.weakEffectMultiplier));
  p.stats.hunger = 0;
  p.stats.energy = 6;
  const s = p.stats.strength;
  pump(w, "p1", 12);
  assert.equal(p.stats.strength, s + 1);
  assert.equal(p.stats.energy, 2);
  assert.equal(p.gym, null, "dưới 4 thể lực -> máy tự dừng");
  const again = act(w, "p1", { type: "gymStart", machineId: machineId("pressBench", 0) });
  assert.equal(!again.ok && again.message, "Hết thể lực, hãy nghỉ hoặc ăn");
});

// 9. Giờ mở cửa (ghi đè: mở 24/24)
test("giờ mở: phòng gym dùng được mọi giờ — cả sau 21:00 và trong giờ điểm danh; phải ở trong phòng gym", () => {
  for (const minute of [3 * 60, 8 * 60 + 40, 12 * 60, 15 * 60 + 30, 19 * 60 + 10, 22 * 60]) {
    const { w, p } = gymWorld();
    w.totalGameMinutes = 1440 + minute;
    p.stats.energy = 100;
    const s = p.stats.strength;
    startOn(w, p);
    pump(w, "p1", 10);
    assert.equal(p.stats.strength, s + 1, `lúc ${minute}`);
    ticks(w, 5);
    assert.ok(p.gym, "không bị đuổi khỏi máy vì giờ giấc");
  }
  const { w: w2 } = gymWorld();
  place(w2, "p1", 30.5, 8.5);
  const out = act(w2, "p1", { type: "gymStart", machineId: machineId("pressBench", 0) });
  assert.equal(!out.ok && out.code, "OUT_OF_RANGE");
});

test("đang tập: không di chuyển, không đánh; bị đánh thì dừng nhưng giữ các lần đã xong", async () => {
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  startOn(w, p);
  const { x, y } = p;
  ticks(w, 5, new Map([["p1", Array.from({ length: 5 }, (_, i) => ({ sequence: 100 + i, directionX: 1, directionY: 0, sprint: false }))]]));
  assert.equal(p.x, x);
  assert.equal(p.y, y);
  assert.equal(act(w, "p1", { type: "attack" }).ok, false);
  pump(w, "p1", 10);
  const s = p.stats.strength;
  pump(w, "p1", 5);
  const { damagePlayer } = await import("../_lib/engine");
  damagePlayer(w, createOutbox(), p, 5, "test");
  assert.equal(p.gym, null);
  assert.equal(p.stats.strength, s);
});

// 10. Tranh máy & hàng chờ
test("tranh máy: không dùng chung — máy đang có người thì không vào được; bấm lại đúng máy đang tập là thoát", () => {
  const { w } = gymWorld(2);
  const [a, b] = [w.players.p1, w.players.p2];
  const mid = startOn(w, a);
  const q = act(w, "p2", { type: "gymStart", machineId: mid });
  assert.equal(!q.ok && q.code, "CONFLICT", "máy bận");
  assert.equal(b.gym, null);
  assert.equal(w.gym.occupants[mid], "p1");
  // bấm lại máy đang tập: thoát
  assert.equal(act(w, "p1", { type: "gymStart", machineId: mid }).ok, true);
  assert.equal(a.gym, null);
  // máy trống: vào ngay
  assert.equal(act(w, "p2", { type: "gymStart", machineId: mid }).ok, true);
  assert.equal((b as PlayerState).gym?.machineId, mid);
});

test("gym: bấm E ở máy tập là tập luôn máy trống gần nhất (không còn bảng chọn máy)", () => {
  const { w } = gymWorld(1);
  const p = w.players.p1;
  place(w, "p1", 37.5, 29.5);
  const r = act(w, "p1", { type: "interact", targetId: "gym_4" }); // máy tập ngay cạnh
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(p.gym, "đang tập");
  assert.equal(r.ok && r.data?.opened, undefined, "không mở bảng chọn máy");
});

function npcContest(defId: string) {
  const { w, p } = gymWorld(1, 9);
  const idx = w.inmates.findIndex((n) => n.defId === defId);
  const n = w.inmates[idx];
  const day = clockInfo(w.totalGameMinutes).day;
  const kind = GYM_KINDS[(day + idx) % GYM_KINDS.length];
  const mid = startOn(w, p, kind, idx); // người chơi chiếm đúng máy riêng của tù nhân này
  n.x = GYM_SPOT.x + 1;
  n.y = GYM_SPOT.y + 1;
  n.goalZone = "gym";
  n.waitUntil = 1e9;
  n.combat = "idle";
  ticks(w, 2);
  return { w, p, n, mid };
}

test("tranh máy với NPC: tù nhân hiền xin máy — nhường thì NPC lên máy; từ chối thì giảm uy tín và NPC chờ", () => {
  const give = npcContest("npc_tu");
  const req = give.w.gym.requests.p1;
  assert.ok(req, "tù nhân xin máy");
  assert.equal(req.aggressive, false);
  assert.equal(act(give.w, "p1", { type: "gymAnswer", yield: true }).ok, true);
  assert.equal(give.p.gym, null);
  assert.equal(give.w.gym.occupants[give.mid], give.n.id);
  assert.equal(give.n.gymMachine, give.mid);

  const no = npcContest("npc_tu");
  const rep = no.p.reputation.inmates;
  assert.equal(act(no.w, "p1", { type: "gymAnswer", yield: false }).ok, true);
  assert.equal(no.p.reputation.inmates, rep - GYM.contest.refuseReputationLoss);
  assert.equal((no.p as PlayerState).gym?.machineId, no.mid, "vẫn tập tiếp");
  assert.equal(no.w.gym.queue[no.mid], no.n.id, "NPC vào hàng chờ");
  act(no.w, "p1", { type: "gymStop" });
  ticks(no.w, 1);
  assert.equal(no.w.gym.occupants[no.mid], no.n.id, "máy trống -> NPC lên");
});

test("tranh máy với NPC hung hăng: đòi máy; từ chối thì bị gây sự", () => {
  const { w, n } = npcContest("npc_hai");
  assert.equal(w.gym.requests.p1?.aggressive, true);
  act(w, "p1", { type: "gymAnswer", yield: false });
  assert.equal(n.fightWith, "p1");
  assert.ok(n.combat === "threatened" || n.combat === "fighting");
});

test("NPC trong giờ gym tự dùng máy riêng, rời máy khi hết giờ", () => {
  const { w } = gymWorld(1, 4);
  const n = w.inmates[0];
  n.x = GYM_SPOT.x - 1;
  n.y = GYM_SPOT.y;
  n.goalZone = "gym";
  n.waitUntil = 1e9;
  ticks(w, 2);
  assert.ok(n.gymMachine);
  const meta = buildMeta(w);
  assert.ok(meta.gym.machines.some((m) => m.occupantId === n.id));
  w.totalGameMinutes = 16 * 60 + 1;
  ticks(w, 2);
  assert.equal(n.gymMachine, null);
  assert.equal(Object.keys(w.gym.occupants).length, 0);
});

// 11. Lưu / tải
test("lưu/tải: chỉ số, thể lực và tiến trình lần dở được lưu; lần dở không cộng điểm", () => {
  const { w, p } = gymWorld();
  p.stats.energy = 100;
  startOn(w, p);
  pump(w, "p1", 10);
  pump(w, "p1", 4);
  const loaded = JSON.parse(JSON.stringify(w)) as WorldState;
  const lp = loaded.players.p1;
  assert.equal(lp.stats.strength, p.stats.strength);
  assert.equal(lp.stats.energy, p.stats.energy);
  assert.equal(lp.gym?.beats, 4);
  assert.equal(lp.gym?.reps, 1);
  assert.equal(loaded.gym.occupants[lp.gym!.machineId], "p1");
  ticks(w, 10);
  ticks(loaded, 10);
  assert.equal(JSON.stringify(loaded), JSON.stringify(w));
});
