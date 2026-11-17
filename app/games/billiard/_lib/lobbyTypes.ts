/**
 * Kiểu dữ liệu sảnh Bida Carom — khớp với login-system/src/billiard/lobby (server là nguồn xác thực).
 * Mốc rank / bộ luật / cấu hình tìm trận lấy từ server (`bida:config:get`), không viết cứng ở đây.
 */
import type { CaromMode } from "./physics";

/** Thể loại bida (= chế độ engine): free = Libre (phăng), three = 3 băng — mỗi thể loại một thang hạng */
export type Discipline = CaromMode;
export const DISCIPLINES: Discipline[] = ["free", "three"];

export type GameMode = "RANKED" | "CASUAL" | "TOURNAMENT" | "QUICK";
export type QueueMode = "QUICK" | "RANKED";
export type RoomKind = "casual" | "quick" | "ranked" | "tournament";
export type TournamentStatus = "DRAFT" | "REGISTRATION" | "FULL" | "CHECK_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface RankTier {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
}

export interface RuleSet {
  id: string;
  name: string;
  mode: CaromMode;
  target: number;
}

export interface LobbyConfig {
  ranks: RankTier[];
  ruleSets: RuleSet[];
  /** Luật xếp hạng từng thể loại (15 / 20 điểm) */
  rankedRuleSets: Record<Discipline, string[]>;
  /** Số điểm mặc định của Quick / Ranked (15) */
  defaultTarget: number;
  disciplines: { id: Discipline; name: string }[];
  matchmaking: { windows: { afterSeconds: number; range: number }[]; acceptSeconds: number; noShowSeconds: number };
  tournament: { sizes: number[]; checkInMinutes: number; targetMin: number; targetMax: number };
  turnSecondsOptions: number[];
  startRating: number;
}

export interface WL {
  wins: number;
  losses: number;
}

/** Thang xếp hạng của một thể loại */
export interface LadderView {
  discipline: Discipline;
  name: string;
  rating: number;
  peakRating: number;
  rankId: string;
  bestRankId: string;
  nextRankId: string | null;
  rankProgress: number;
  position: number | null;
  ranked: WL & { winRate: number };
  season: WL;
  seasonHistory: { seasonId: string; name: string; rating: number; rankId: string; wins: number; losses: number; position: number | null }[];
  rankedRuleSets: string[];
}

export interface ProfileView {
  userId: string;
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  ladders: Record<Discipline, LadderView>;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  casual: WL;
  quick: WL;
  tournament: WL & { titles: number; played: number };
  season: { seasonId: string; name: string; endAt: number };
}

export interface LobbySummary {
  online: number;
  inRooms: number;
  playing: number;
  queue: Record<QueueMode, number>;
  tournamentsOpen: number;
  tournamentsLive: number;
}

export type MatchmakingState =
  | { state: "idle" }
  | { state: "searching"; mode: QueueMode; ruleSet: string; rating: number; joinedAt: number; range: number }
  | { state: "found"; pendingId: string; mode: QueueMode; ruleSet: string; deadline: number; accepted: boolean; opponent: Opponent };

export interface Opponent {
  userId: string;
  name: string;
  avatar?: string;
  rating: number;
  rankId: string;
}

export interface LeaderboardRow {
  position: number;
  userId: string;
  name: string;
  avatar?: string;
  rating: number;
  rankId: string;
  wins: number;
  losses: number;
  winRate: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SeasonInfo {
  seasonId: string;
  name: string;
  number: number;
  startAt: number;
  endAt: number;
  status: "ACTIVE" | "ENDED";
}

export interface MatchRecord {
  matchId: string;
  roomCode: string;
  gameMode: GameMode;
  ruleSet: string;
  discipline?: Discipline;
  players: [string, string];
  names: [string, string];
  status: "WAITING" | "PLAYING" | "COMPLETED" | "CANCELLED";
  winnerId: string | null;
  score: [number, number];
  ratingBefore: [number, number] | null;
  ratingChanges: [number, number] | null;
  rated: boolean;
  unratedReason: string | null;
  tournamentId: string | null;
  endReason: string | null;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
}

export interface OnlinePlayer {
  userId: string;
  name: string;
  avatar?: string;
  ratings: Record<Discipline, { rating: number; rankId: string }>;
  level: number;
  status: "playing" | "searching" | "in-room" | "idle";
}

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  playerA: string | null;
  playerB: string | null;
  winner: string | null;
  status: "PENDING" | "READY" | "PLAYING" | "COMPLETED" | "BYE";
  score: [number, number] | null;
  roomCode: string | null;
  startedAt: number | null;
  endedAt: number | null;
}

export interface TournamentParticipant {
  userId: string;
  name: string;
  avatar?: string;
  rating: number;
  rankId: string;
  checkedIn: boolean;
  joinedAt: number;
}

export interface TournamentView {
  tournamentId: string;
  name: string;
  description: string;
  thumbnail: string | null;
  organizerId: string;
  organizerName: string;
  maxParticipants: number;
  participants: TournamentParticipant[];
  ruleSet: string;
  ruleName: string;
  format: "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";
  seeding: "random" | "rating";
  status: TournamentStatus;
  startAt: number;
  registrationDeadline: number;
  checkInAt: number;
  matchDurationMinutes: number;
  visibility: "PUBLIC" | "PRIVATE";
  hasPassword: boolean;
  entryFee: number | null;
  prizePool: number | null;
  bracket: { format: string; size: number; rounds: BracketMatch[][]; seeds: string[] } | null;
  championId: string | null;
  cancelReason: string | null;
  createdAt: number;
  roundNames: string[];
}

export interface RatingResult {
  userId: string;
  won: boolean;
  before: number;
  after: number;
  delta: number;
  rankBefore: string;
  rankAfter: string;
  promoted: boolean;
  demoted: boolean;
}

export interface MatchResultEvent {
  matchId: string;
  roomCode: string;
  gameMode: GameMode;
  discipline: Discipline;
  rated: boolean;
  unratedReason: string | null;
  tournamentId: string | null;
  me: RatingResult;
  opponent?: RatingResult;
}

export interface RoomMatchMeta {
  matchId: string;
  ruleSet: string | null;
  tournamentId: string | null;
  tournamentMatchId: string | null;
  joinDeadline: number | null;
}

/** Thông tin thêm của phòng bida (ngoài RoomInfo dùng chung) */
export interface BilliardRoomExtra {
  kind: RoomKind;
  hasPassword: boolean;
  hostName: string;
  meta: RoomMatchMeta | null;
}

/** Tên loại bida (free = Libre / phăng, three = 3 băng) */
export const TABLE_MODE_NAME: Record<CaromMode, string> = {
  free: "Libre (phăng)",
  three: "3 băng",
};

/** Tên bộ luật từ mã `free-10` / `three-5` (kể cả số điểm tuỳ chỉnh của giải đấu) */
export function ruleSetName(id: string): string {
  const m = /^(free|three)-(\d{1,2})$/.exec(id);
  return m ? `${TABLE_MODE_NAME[m[1] as CaromMode]} ${m[2]} điểm` : id;
}

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: "Bản nháp",
  REGISTRATION: "Đang đăng ký",
  FULL: "Đã khoá đăng ký",
  CHECK_IN: "Đang check-in",
  IN_PROGRESS: "Đang thi đấu",
  COMPLETED: "Đã kết thúc",
  CANCELLED: "Đã huỷ",
};

export const GAME_MODE_LABEL: Record<GameMode, string> = {
  RANKED: "Xếp hạng",
  CASUAL: "Đấu thường",
  QUICK: "Tìm trận nhanh",
  TOURNAMENT: "Giải đấu",
};

/** Thể loại của một bộ luật (`free-10` -> free) */
export const disciplineOfRule = (ruleSet: string): Discipline => (ruleSet.startsWith("three") ? "three" : "free");
