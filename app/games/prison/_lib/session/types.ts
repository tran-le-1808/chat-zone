import type { ClockInfo } from "../engine/rules";
import type { ActionResult, EngineEvent, GameMode, PlayerAction } from "../engine/types";
import type { GuardPublic, InmatePublic, PlayerPublic, PrivateState, TeamStorageView, WorldMeta } from "../engine/view";
import type { Pose } from "../net/prediction";

export type ConnectionState = "online" | "reconnecting" | "offline";

/** Trạng thái giao diện — giống nhau cho chơi đơn & co-op (renderer/HUD không cần biết chế độ) */
export interface ClientView {
  mode: GameMode;
  meId: string;
  tick: number;
  /** Thời gian mô phỏng (giây) — dùng cho góc quét camera */
  time: number;
  clock: ClockInfo;
  totalGameMinutes: number;
  teamHeat: number;
  players: PlayerPublic[];
  guards: GuardPublic[];
  inmates: InmatePublic[];
  meta: WorldMeta;
  me: PrivateState | null;
  teamStorage: TeamStorageView;
  connection: ConnectionState;
  paused: boolean;
  /** Tốc độ thời gian (chơi đơn) */
  speed: number;
}

export type NoticeTone = "info" | "good" | "warn" | "danger";

export interface Notice {
  id: string;
  text: string;
  tone: NoticeTone;
  at: number;
}

export interface RenderSample {
  players: Map<string, Pose>;
  guards: Map<string, Pose>;
  inmates: Map<string, Pose>;
}

export interface PrisonSession {
  readonly mode: GameMode;
  readonly meId: string;
  subscribe(fn: () => void): () => void;
  getView(): ClientView;
  onNotice(fn: (n: Notice) => void): () => void;
  /** Bus sự kiện engine (âm thanh, hiệu ứng) */
  onEvent(fn: (e: EngineEvent) => void): () => void;
  setInput(dx: number, dy: number, sprint: boolean): void;
  sample(nowMs: number, frameDt: number): RenderSample;
  act(action: PlayerAction): Promise<ActionResult>;
  setPaused?(paused: boolean): void;
  setSpeed?(speed: number): void;
  save?(slot?: import("./save").SlotId): Promise<boolean>;
  dispose(): void;
}

export function toneOf(type: string): NoticeTone {
  if (/knocked|captured|alert|lockdown|failed|rescue:request|rescue-required|removed|serious|found|snitched|blown|collapse|reported|spotted|time-up/.test(type)) return "danger";
  if (/escaped|victory|completed|revived|level|route:opened|break-free|paid|disabled|woke/.test(type)) return "good";
  if (/suspicious|lost|clock|disconnected|bell|warning|penalty|search:start|lights/.test(type)) return "warn";
  return "info";
}

export function playerColor(i: number): string {
  return ["#f97316", "#a855f7", "#22d3ee", "#facc15"][i % 4];
}
