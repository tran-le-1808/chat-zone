import type * as THREE from "three";

/**
 * Hiệu ứng ô khi quân chạm đất: ô đang đón lún xuống 3–5% độ dày rồi bật lại bằng lò xo.
 * Chỉ ô đón nhân vật lún (không lan). Một vòng cập nhật duy nhất (TileFxDriver).
 */
const refs = new Map<number, { g: THREE.Group; baseY: number }>();
const active = new Map<number, number>(); // tileId -> thời điểm chạm (giây, đồng hồ driver)

export const tileFx = {
  register(id: number, g: THREE.Group | null, baseY: number) {
    if (g) refs.set(id, { g, baseY });
    else refs.delete(id);
  },
  /** Gọi khi quân chạm đất ô `id` */
  land(id: number, now: number, strong = false) {
    active.set(id, now - (strong ? 0 : 0));
  },
  /** Cập nhật vị trí Y của các ô đang lún; trả về true nếu còn ô đang chuyển động */
  step(now: number): boolean {
    const DEPTH = 0.11; // ~4% độ dày khối ô + chút nhìn rõ
    const W = 2 * Math.PI * 7;
    const Z = 0.5;
    const Wd = W * Math.sqrt(1 - Z * Z);
    for (const [id, t0] of active) {
      const r = refs.get(id);
      const t = now - t0;
      if (!r || t > 0.5) {
        if (r) r.g.position.y = r.baseY;
        active.delete(id);
        continue;
      }
      const x = Math.exp(-Z * W * t) * (Math.cos(Wd * t) + ((Z * W) / Wd) * Math.sin(Wd * t));
      r.g.position.y = r.baseY - DEPTH * x;
    }
    return active.size > 0;
  },
};
