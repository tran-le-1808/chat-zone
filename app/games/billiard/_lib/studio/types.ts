/**
 * AI SHOT STUDIO — kiểu dữ liệu dùng chung (thuần TS, không phụ thuộc giao diện / trình duyệt).
 * Mọi kết quả cú đánh đều lấy từ physics engine hiện có (simulateShot), không tự bịa quỹ đạo.
 */
import type { BallId, BallPositions, PhysicsEvent, Rail, ShotCommand, ShotVerdict, TrajectoryFrame, Vec2 } from "../physics";

export type ShotScenarioCategory = "STRAIGHT" | "CUT" | "FOLLOW" | "DRAW" | "STUN" | "ENGLISH" | "CUSHION" | "POSITION" | "ARTISTIC" | "CHALLENGE";
export type ShotDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type StylePreset = "EASY_AND_CLEAR" | "TECHNICAL" | "ARTISTIC" | "POSITION_PLAY" | "CHALLENGE" | "RANDOM_DISCOVERY";

/** Kỹ thuật đọc được TỪ MÔ PHỎNG (không chỉ từ thông số đầu vào) */
export type SpinEffect = "FOLLOW" | "DRAW" | "STUN" | "NONE";
export type EnglishSide = "LEFT" | "RIGHT" | "NONE";

/** Một điểm chạm trên quỹ đạo: bi – bi hoặc bi – băng */
export interface ContactMark {
  t: number;
  kind: "ball" | "cushion";
  /** Bi đang xét (với va chạm bi – bi: bi cái nếu có bi cái tham gia) */
  ball: BallId;
  other?: BallId;
  rail?: Rail;
  /** Vị trí tâm bi lúc chạm (toạ độ physics, mét) */
  at: Vec2;
  /** Thứ tự băng của bi cái (1, 2, 3…) */
  cushionIndex?: number;
  speed: number;
}

/** Phân tích một cú đánh đã mô phỏng — mọi trường đều đo từ khung hình / sự kiện của physics */
export interface ShotAnalysis {
  verdict: ShotVerdict;
  events: PhysicsEvent[];
  frames: TrajectoryFrame[];
  duration: number;
  start: BallPositions;
  final: BallPositions;
  /** Góc cắt ở lần chạm bi đầu (độ, 0 = đánh dày thẳng tâm, gần 90 = cực mỏng) */
  cutAngleDeg: number | null;
  /** Độ dày lần chạm đầu (1 = full, 0 = lướt) */
  thickness: number | null;
  /** Hiệu ứng spin đo được sau lần chạm bi đầu */
  spinEffect: SpinEffect;
  /** Độ "rõ" của hiệu ứng spin (0..1) */
  spinStrength: number;
  english: EnglishSide;
  /** Số băng bi cái chạm trước bi thứ hai */
  cushionsBeforeSecond: number;
  cueCushions: number;
  contacts: ContactMark[];
  /** Quãng đường bi cái (m) */
  cuePathLength: number;
  /** Khoảng cách trung bình giữa 3 bi lúc dừng (m) — nhỏ = gom bi tốt */
  finalSpread: number;
  /** Kết thúc có bi nào áp băng (khó đánh tiếp) */
  frozenOnRail: number;
}

export interface ScoreBreakdown {
  successScore: number;
  trajectoryBeauty: number;
  technicalComplexity: number;
  cushionCount: number;
  spinVisibility: number;
  positionPlay: number;
  shotClarity: number;
  repeatability: number;
}

export interface ShotCandidate {
  id: string;
  /** Loại cú đã tìm (để ghép nhiều cú vào một video) */
  category?: ShotScenarioCategory;
  shot: ShotCommand;
  analysis: ShotAnalysis;
  /** Đạt mục tiêu kịch bản (ghi điểm + đúng kỹ thuật yêu cầu) */
  meetsGoal: boolean;
  /** Lý do không đạt (nếu có) */
  rejectReason?: string;
  breakdown: ScoreBreakdown;
  total: number;
  difficulty: ShotDifficulty;
  tags: string[];
}

export interface ShotScenarioSetup {
  ballPositions: { ballId: BallId; position: Vec2 }[];
  cueBallId: BallId;
  targetBallId: BallId;
  thirdBallId: BallId;
}

export interface ShotScenario {
  id: string;
  title: string;
  description: string;
  category: ShotScenarioCategory;
  difficulty: ShotDifficulty;
  tags: string[];
  setup: ShotScenarioSetup;
  shot: {
    aimDirection: Vec2;
    power: number;
    elevation?: number;
    spin: { x: number; y: number };
    english?: EnglishSide;
    hitPoint?: Vec2;
  };
  goal: {
    description: string;
    scoringExpected: boolean;
    desiredContactSequence?: string[];
    positionGoal?: string;
  };
  simulationResult?: {
    validated: boolean;
    score?: number;
    path?: TrajectoryFrame[];
    contacts?: ContactMark[];
  };
  narration?: NarrationScript;
}

export type VoiceStyle = "COACH" | "SPORTS_COMMENTATOR" | "CALM_ANALYST" | "SHORTS" | "CINEMATIC";

export interface NarrationSegment {
  /** Thời điểm bắt đầu nói (giây, tính từ đầu video) */
  start: number;
  /** Thời điểm kết thúc dự kiến */
  end: number;
  text: string;
  scene: SceneId;
}

export interface NarrationScript {
  intro: string;
  technique: string;
  playByPlay: string[];
  conclusion: string;
  segments: NarrationSegment[];
}

export type SceneId = "intro" | "setup" | "aim" | "shot" | "replay" | "result";

export interface SceneSpec {
  id: SceneId;
  start: number;
  end: number;
  /** Tốc độ phát quỹ đạo (1 = thời gian thực; replay chậm < 1) */
  playbackRate?: number;
}
