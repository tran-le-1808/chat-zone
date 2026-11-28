/** Ma Sói: bộ vai, đêm (cắn / che / soi / thuốc), bỏ phiếu, Thợ Săn, thắng thua, góc nhìn riêng, máy chơi hết ván */
import { test } from "node:test";
import assert from "node:assert/strict";
import { act, deal, MS_MAX, MS_MIN, pendingSeats, rolesFor, timeout, viewFor, type MSAction, type MSState, type Role } from "../_lib/game";
import { botAction } from "../_lib/bot";

function fixed(roles: Role[]): MSState {
  const s = deal(roles.length, { reveal: true }, Math.random);
  s.roles = roles.slice();
  return s;
}
function must(s: MSState, seat: number, a: MSAction): MSState {
  const r = act(s, seat, a, () => 0);
  assert.ok(r.ok, `act ${JSON.stringify(a)} failed: ${r.ok ? "" : r.error}`);
  return r.state;
}
// 0 sói, 1 tiên tri, 2 bảo vệ, 3 phù thuỷ, 4 thợ săn, 5-6 dân
const R: Role[] = ["wolf", "seer", "guard", "witch", "hunter", "villager", "villager"];

test("bộ vai đủ số người, luôn có Sói, Tiên Tri", () => {
  for (let n = MS_MIN; n <= MS_MAX; n++) {
    const r = rolesFor(n);
    assert.equal(r.length, n);
    assert.ok(r.includes("wolf") && r.includes("seer"));
    assert.ok(r.filter((x) => x === "wolf").length * 2 < n);
  }
  const s = deal(8, { reveal: true }, Math.random, { 0: "seer" });
  assert.equal(s.roles[0], "seer");
  assert.equal(s.roles.filter((r) => r === "seer").length, 1);
});

test("đêm: Sói cắn, Bảo Vệ che đúng người thì không ai chết; Tiên Tri thấy kết quả", () => {
  let s = fixed(R);
  assert.deepEqual(pendingSeats(s), [0, 1, 2]);
  s = must(s, 0, { k: "kill", target: 5 });
  s = must(s, 1, { k: "see", target: 0 });
  s = must(s, 2, { k: "guard", target: 5 });
  assert.equal(s.phase, "witch");
  s = must(s, 3, { k: "witch", save: false, poison: -1 });
  assert.equal(s.phase, "day");
  assert.ok(s.alive[5]);
  assert.deepEqual(s.seerLog, [{ day: 1, target: 0, wolf: true }]);
  assert.equal(viewFor(s, 1).seerLog.length, 1);
  assert.equal(viewFor(s, 5).seerLog.length, 0);
  // Bảo Vệ không được che cùng người 2 đêm liền
  s = timeout(timeout(s)); // ngày -> bỏ phiếu -> (không ai bầu) đêm 2
  assert.equal(s.phase, "night");
  assert.equal(s.day, 2);
  assert.equal(act(s, 2, { k: "guard", target: 5 }).ok, false);
});

test("Phù Thuỷ cứu người bị cắn rồi đầu độc ở đêm sau", () => {
  let s = fixed(R);
  s = must(s, 0, { k: "kill", target: 6 });
  s = must(s, 1, { k: "see", target: 5 });
  s = must(s, 2, { k: "guard", target: 1 });
  assert.equal(viewFor(s, 3).victim, 6);
  assert.equal(viewFor(s, 5).victim, -1);
  assert.equal(act(s, 3, { k: "witch", save: true, poison: 0 }).ok, false); // 1 bình mỗi đêm
  s = must(s, 3, { k: "witch", save: true, poison: -1 });
  assert.ok(s.alive[6]);
  assert.equal(s.potions.heal, false);
  s = timeout(timeout(s));
  s = must(s, 0, { k: "kill", target: 5 });
  s = must(s, 1, { k: "see", target: 6 });
  s = must(s, 2, { k: "guard", target: 2 });
  assert.equal(act(s, 3, { k: "witch", save: true, poison: -1 }).ok, false);
  s = must(s, 3, { k: "witch", save: false, poison: 0 });
  assert.equal(s.phase, "over");
  assert.equal(s.winner, "village");
});

test("bỏ phiếu: hoà phiếu không treo ai; đa số thì treo; lộ vai khi chết", () => {
  let s = fixed(R);
  s = must(s, 0, { k: "kill", target: 6 });
  s = must(s, 1, { k: "see", target: 5 });
  s = must(s, 2, { k: "guard", target: 6 });
  s = must(s, 3, { k: "witch", save: false, poison: -1 });
  for (let i = 0; i < 7; i++) s = must(s, i, { k: "ready" });
  assert.equal(s.phase, "vote");
  const votes = [5, 0, 0, 5, -1, 0, 5];
  for (let i = 0; i < 7; i++) s = must(s, i, { k: "vote", target: votes[i] });
  assert.equal(s.phase, "night");
  assert.ok(s.alive.every(Boolean));
  s = timeout(timeout(s)); // đêm 2 không ai làm -> (phù thuỷ còn độc) -> sáng
  s = timeout(s); // ngày -> bỏ phiếu
  assert.equal(s.phase, "vote");
  for (const [i, t] of [[1, 5], [2, 5], [3, 5], [4, 5], [0, 1]] as const) s = must(s, i, { k: "vote", target: t });
  s = timeout(s);
  assert.equal(s.alive[5], false);
  assert.equal(viewFor(s, 6).roles[5], "villager");
  assert.equal(viewFor(s, 6).roles[0], null);
  assert.equal(viewFor(s, 0).roles[0], "wolf");
});

test("Thợ Săn bị treo được bắn một người; bắn trúng Sói thì Dân thắng", () => {
  let s = fixed(R);
  s = timeout(timeout(s)); // đêm -> phù thuỷ (còn độc) -> sáng
  assert.equal(s.phase, "day");
  s = timeout(s);
  for (let i = 0; i < 7; i++) s = must(s, i, { k: "vote", target: i === 4 ? 5 : 4 });
  assert.equal(s.phase, "hunter");
  assert.deepEqual(pendingSeats(s), [4]);
  assert.equal(viewFor(s, 6).roles[4], "hunter");
  s = must(s, 4, { k: "shoot", target: 0 });
  assert.equal(s.winner, "village");
});

test("Sói thắng khi số Sói bằng số người còn lại", () => {
  let s = fixed(["wolf", "villager", "seer", "guard", "villager"]);
  s = must(s, 0, { k: "kill", target: 1 });
  s = must(s, 2, { k: "see", target: 3 });
  s = must(s, 3, { k: "guard", target: 4 });
  assert.equal(s.phase, "day");
  s = timeout(s);
  for (const [i, t] of [[0, 4], [2, 4], [3, 4], [4, 0]] as const) s = must(s, i, { k: "vote", target: t });
  s = must(s, 0, { k: "kill", target: 2 });
  s = must(s, 2, { k: "see", target: 0 });
  s = must(s, 3, { k: "guard", target: 3 });
  assert.equal(s.winner, "wolf");
});

test("máy tự chơi hết ván ở mọi số người, không có nước đi sai", () => {
  for (let n = MS_MIN; n <= MS_MAX; n++)
    for (const level of ["easy", "normal", "hard"] as const)
      for (let g = 0; g < 15; g++) {
        let s = deal(n, { reveal: g % 2 === 0 });
        let steps = 0;
        while (s.phase !== "over") {
          assert.ok(++steps < 3000, "kẹt ván");
          const p = pendingSeats(s);
          const a = p.length ? botAction(s, p[0], level) : null;
          if (!a) {
            s = timeout(s);
            continue;
          }
          const r = act(s, p[0], a);
          assert.ok(r.ok, `${s.phase} ${JSON.stringify(a)} ${r.ok ? "" : r.error}`);
          s = r.state;
        }
        assert.ok(s.winner);
      }
});

test("voice: đêm chỉ Sói nghe nhau, ngày cả làng, người chết chỉ nói với người chết", async () => {
  const { msVoiceRule } = await import("../_lib/voice");
  // 0 sói, 1 sói, 2 tiên tri, 3 dân, 4 dân (đã chết)
  const s = fixed(["wolf", "wolf", "seer", "villager", "villager", "guard"]);
  s.alive[4] = false;
  const ids = ["w0", "w1", "s2", "v3", "d4", "g5"];
  const wolf = msVoiceRule(viewFor(s, 0), ids);
  assert.equal(wolf.mic, true);
  assert.ok(wolf.canSend("w1") && wolf.canHear("w1"));
  assert.ok(!wolf.canSend("s2") && !wolf.canHear("s2"));
  assert.ok(wolf.canSend("d4") && !wolf.canHear("d4"));
  const seer = msVoiceRule(viewFor(s, 2), ids);
  assert.equal(seer.mic, false);
  assert.ok(!seer.canSend("v3") && !seer.canHear("w0"));
  const dead = msVoiceRule(viewFor(s, 4), ids);
  assert.ok(dead.canHear("w0") && dead.canHear("s2"));
  assert.ok(!dead.canSend("s2"));
  const day = { ...s, phase: "day" as const };
  const v = msVoiceRule(viewFor(day, 3), ids);
  assert.ok(v.mic && v.canSend("w0") && v.canHear("w0") && v.canSend("d4") && !v.canHear("d4"));
  assert.notEqual(msVoiceRule(viewFor(day, 0), ids).key, wolf.key);
  const over = msVoiceRule(viewFor({ ...s, phase: "over" }, 2), ids);
  assert.ok(over.canHear("d4") && over.canSend("w0"));
});
