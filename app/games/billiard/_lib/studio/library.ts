/**
 * THƯ VIỆN THẾ BI cho AI Shot Studio. Mỗi kịch bản chỉ cố định THẾ BI + MỤC TIÊU; thông số cú đánh
 * luôn do bộ tìm kiếm sinh ra và physics xác nhận (không có cú đánh "viết tay" chưa kiểm chứng).
 * Toạ độ mét, gốc ở tâm bàn: x ∈ (−1,42; 1,42), y ∈ (−0,71; 0,71). Bi 0 trắng (bi cái), 1 vàng, 2 đỏ.
 */
import { DEFAULT_PHYSICS, type BallPositions, type PhysicsConfig } from "../physics";
import { validateSetup } from "./analysis";
import { CATEGORY_INFO, mulberry32 } from "./search";
import type { ShotDifficulty, ShotScenarioCategory } from "./types";

export interface ScenarioTemplate {
  id: string;
  title: string;
  description: string;
  category: ShotScenarioCategory;
  difficulty: ShotDifficulty;
  tags: string[];
  positions: BallPositions;
  positionGoal?: string;
}

export const SCENARIO_LIBRARY: ScenarioTemplate[] = [
  { id: "straight-short", title: "Đánh dày cự ly ngắn", description: "Bi vàng gần như thẳng hàng với bi trắng, bi đỏ nằm phía sau lệch nhẹ.", category: "STRAIGHT", difficulty: "BEGINNER", tags: ["cơ bản"], positions: [[-0.6, 0.05], [-0.2, 0.04], [0.35, 0.22]] },
  { id: "cut-thin-rail", title: "Cắt mỏng gần băng", description: "Bi vàng nằm lệch góc, phải cắt mỏng để bi trắng chạy sang bi đỏ.", category: "CUT", difficulty: "INTERMEDIATE", tags: ["góc cắt"], positions: [[-0.9, -0.35], [-0.35, 0.05], [0.55, -0.45]] },
  { id: "follow-through", title: "Follow xuyên bi", description: "Bi đỏ nằm ngay phía sau bi vàng: cần follow để bi trắng chạy tiếp.", category: "FOLLOW", difficulty: "BEGINNER", tags: ["spin trên"], positions: [[-0.85, 0.1], [-0.25, 0.12], [0.45, 0.2]] },
  { id: "draw-back", title: "Kéo lùi (draw)", description: "Bi đỏ nằm ngay phía sau bi trắng: đánh dưới tâm để bi trắng lùi về chạm bi đỏ.", category: "DRAW", difficulty: "INTERMEDIATE", tags: ["spin dưới"], positions: [[-0.2, 0.0], [0.25, 0.01], [-0.75, 0.03]] },
  { id: "stun-angle", title: "Stun đi tiếp tuyến", description: "Bi đỏ nằm trên đường tiếp tuyến khi cắt bi vàng ở góc vừa.", category: "STUN", difficulty: "INTERMEDIATE", tags: ["stop shot"], positions: [[-0.6, -0.2], [-0.15, 0.05], [-0.05, -0.55]] },
  { id: "english-rail", title: "English đổi góc bật băng", description: "Bi trắng phải đi qua băng dài, spin ngang quyết định góc bật.", category: "ENGLISH", difficulty: "ADVANCED", tags: ["spin ngang", "băng"], positions: [[-0.95, 0.35], [-0.25, -0.45], [0.75, 0.42]] },
  { id: "one-cushion", title: "Một băng vào bi", description: "Bi vàng bị che hướng thẳng tới bi đỏ — dùng một băng.", category: "CUSHION", difficulty: "BEGINNER", tags: ["1 băng"], positions: [[-0.7, 0.45], [-0.1, 0.5], [0.6, 0.48]] },
  { id: "two-cushion", title: "Hai băng góc bàn", description: "Bi đỏ nằm sát góc xa: đi hai băng để vào bi.", category: "CUSHION", difficulty: "INTERMEDIATE", tags: ["2 băng"], positions: [[-0.5, -0.3], [0.1, -0.1], [1.15, 0.5]] },
  { id: "three-cushion", title: "Ba băng biểu diễn", description: "Thế bi kiểu 3 băng: chạm bi đầu rồi đi vòng ba băng.", category: "CUSHION", difficulty: "ADVANCED", tags: ["3 băng"], positions: [[-0.95, -0.2], [-0.6, 0.05], [0.9, -0.45]] },
  { id: "gather", title: "Gom 3 bi về một góc", description: "Ghi điểm nhẹ nhàng và để ba bi gần nhau cho lượt sau.", category: "POSITION", difficulty: "INTERMEDIATE", tags: ["gom bi"], positions: [[0.55, 0.3], [0.85, 0.35], [1.05, 0.15]], positionGoal: "3 bi cách nhau trung bình dưới 0,6 m" },
  { id: "artistic-loop", title: "Vòng bi trình diễn", description: "Bi trắng đi một vòng nhiều băng quanh bàn trước khi chạm bi thứ hai.", category: "ARTISTIC", difficulty: "EXPERT", tags: ["trình diễn"], positions: [[-0.2, -0.5], [0.2, -0.45], [-0.9, 0.45]] },
  { id: "challenge-frozen", title: "Bi trắng áp băng", description: "Bi trắng nằm sát băng, bi vàng và đỏ ở hai đầu bàn.", category: "CHALLENGE", difficulty: "EXPERT", tags: ["thế khó"], positions: [[0, -0.675], [-1.1, 0.4], [1.15, 0.35]] },
];

export const SCENARIO_BY_ID: Record<string, ScenarioTemplate> = Object.fromEntries(SCENARIO_LIBRARY.map((s) => [s.id, s]));

export function scenariosFor(category: ShotScenarioCategory | "ALL"): ScenarioTemplate[] {
  return category === "ALL" ? SCENARIO_LIBRARY : SCENARIO_LIBRARY.filter((s) => s.category === category);
}

/** Thế bi ngẫu nhiên hợp lệ (tất định theo seed) — dùng cho "khám phá ngẫu nhiên" */
export function randomLayout(seed: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): BallPositions {
  const rnd = mulberry32(seed);
  const hx = cfg.tableWidth / 2 - cfg.ballRadius * 2;
  const hy = cfg.tableHeight / 2 - cfg.ballRadius * 2;
  for (let tries = 0; tries < 200; tries++) {
    const pos: BallPositions = [0, 1, 2].map(() => [Math.round((rnd() * 2 - 1) * hx * 1000) / 1000, Math.round((rnd() * 2 - 1) * hy * 1000) / 1000]);
    const minGap = Math.min(...[[0, 1], [0, 2], [1, 2]].map(([a, b]) => Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1])));
    if (!validateSetup(pos, cfg) && minGap > 0.25) return pos;
  }
  return [[-0.71, -0.18], [-0.71, 0], [0.71, 0]];
}

export function scenarioGoal(t: Pick<ScenarioTemplate, "category">): string {
  return CATEGORY_INFO[t.category].goal;
}
