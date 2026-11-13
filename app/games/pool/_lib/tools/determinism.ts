import { rackEight, rackNine, rng } from "../rules/rack";
import { configForPreset } from "../physics/config";
import { simulateShot } from "../physics/simulator";
import { shotCommandFromInput } from "../protocol";

/** Bộ cú đánh ngẫu nhiên (xác định theo seed) để so trạng thái giữa các môi trường chạy */
export function randomShots(n: number, seed = 7) {
  const rand = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const rack = i % 2 ? rackNine(i) : rackEight(i);
    const cue = { n: 0, x: -0.9 + rand() * 0.5, y: (rand() - 0.5) * 1 };
    // Bỏ bớt vài bi để có thế bàn giữa ván
    const balls = [cue, ...rack.filter(() => rand() > 0.3).map((b) => ({ ...b, x: b.x - rand() * 1.6, y: (rand() - 0.5) * 1.1 }))]
      .filter((b, j, arr) => arr.slice(0, j).every((o) => Math.hypot(o.x - b.x, o.y - b.y) > 0.06))
      .filter((b) => Math.abs(b.x) < 1.2 && Math.abs(b.y) < 0.6);
    return {
      balls,
      input: {
        aimAngle: (rand() - 0.5) * 2 * Math.PI,
        power: 0.05 + rand() * 0.95,
        tipX: (rand() - 0.5) * 1.2,
        tipY: (rand() - 0.5) * 1.2,
        elevation: rand() < 0.8 ? rand() * 8 : rand() * 60,
      },
      preset: (["wpa", "easy", "pro"] as const)[i % 3],
    };
  });
}


/** Băm kết quả của từng cú (dùng chung cho Node test & trang kiểm tra trong trình duyệt) */
export function determinismHashes(n: number, seed = 7): string[] {
  return randomShots(n, seed).map((s) => {
    const tip = Math.hypot(s.input.tipX, s.input.tipY);
    const input = tip > 1 ? { ...s.input, tipX: s.input.tipX / tip, tipY: s.input.tipY / tip } : s.input;
    return simulateShot(s.balls, shotCommandFromInput(input), { config: configForPreset(s.preset) }).hash;
  });
}
