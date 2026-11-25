"use client";

/**
 * PHÒNG CHỜ CỜ TỶ PHÚ — cùng phong cách "đồ chơi" với bàn cờ & các modal trong game:
 * thẻ kem bo tròn, viền dày theo màu quân cờ, nút kẹo 3D, font Nunito.
 * Chủ phòng có thể thêm bot vào ghế trống (bot do máy chủ phòng điều khiển trong trận).
 */
import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Crown,
  Hourglass,
  Link2,
  LogOut,
  MessageCircle,
  Play,
  Plus,
  Settings2,
  Undo2,
  Users,
  UserX,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { monoEmit } from "@/lib/monopolySocket";
import { INITIAL_PLAYERS } from "@/types/game.types";
import {
  MONOPOLY_MAX_PLAYERS,
  MONOPOLY_MIN_PLAYERS,
  STARTING_MONEY_OPTIONS,
  TURN_SECONDS,
  type RoomPlayer,
} from "@/types/monopoly-room";
import { useRoom } from "../../_context/RoomContext";
import { BOT_LEVELS, type BotLevel } from "../../_lib/bot";
import GameChat from "../GameChat";
import PawnPreview from "../PawnPreview";
import PlayerAvatar from "../PlayerAvatar";
import VoiceControls, { VoiceBadge } from "../VoiceControls";
import { useMediaQuery } from "../ui/useScreen";
import {
  TOY_COLORS,
  ToyButton,
  ToyKeyframes,
  ToyOverlay,
  ToyPanel,
  toyFont,
  type ToyColor,
} from "../ui/ToyUI";

const WIDE_QUERY = "(min-width: 1024px) and (min-height: 600px)";
const LEVEL_ORDER: BotLevel[] = ["easy", "normal", "hard"];
const LEVEL_COLOR: Record<BotLevel, ToyColor> = {
  easy: "green",
  normal: "blue",
  hard: "red",
};
const CREAM = "linear-gradient(180deg, #fffaf0 0%, #fff1dc 100%)";
const INK = "#2b2f48";
const MUTED = "#7a7f95";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  } catch {
    toast.error("Không sao chép được, hãy copy thủ công");
  }
}

/** Viên kẹo nhỏ (nhãn trạng thái / luật) */
function Candy({
  color,
  children,
  onClick,
  title,
}: {
  color: ToyColor;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const c = TOY_COLORS[color];
  const cls =
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs";
  const style = {
    background: c.soft,
    color: c.text,
    boxShadow: `inset 0 -2px 0 ${c.main}66`,
  };
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${cls} transition active:translate-y-px`}
      style={style}
    >
      {children}
    </button>
  ) : (
    <span className={cls} style={style} title={title}>
      {children}
    </span>
  );
}

/** Nút tròn nhỏ kiểu kẹo trên thanh tiêu đề */
function RoundButton({
  label,
  color = "gray",
  onClick,
  children,
  badge,
}: {
  label: string;
  color?: ToyColor;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  const c = TOY_COLORS[color];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition active:translate-y-[3px] sm:h-11 sm:w-11"
      style={{
        background: `linear-gradient(180deg, ${c.main}, ${c.dark} 130%)`,
        boxShadow: `0 4px 0 ${c.dark}`,
      }}
    >
      {children}
      {!!badge && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff5a4e] px-1 text-[10px] text-white shadow">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function SeatState({ player, host }: { player: RoomPlayer; host: boolean }) {
  if (player.botLevel)
    return (
      <Candy color="purple">
        <Bot className="h-3 w-3" /> Bot
      </Candy>
    );
  if (!player.connected)
    return (
      <Candy color="gray">
        <WifiOff className="h-3 w-3" /> Mất kết nối
      </Candy>
    );
  if (host)
    return (
      <Candy color="gold">
        <Crown className="h-3 w-3" /> Chủ phòng
      </Candy>
    );
  if (player.ready)
    return (
      <Candy color="green">
        <Check className="h-3 w-3" /> Sẵn sàng
      </Candy>
    );
  return (
    <Candy color="gray">
      <Hourglass className="h-3 w-3" /> Chưa sẵn sàng
    </Candy>
  );
}

/** Nhóm lựa chọn kiểu nút kẹo trong modal cài đặt */
function ToyOptions<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
  color = "orange",
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
  color?: ToyColor;
}) {
  const c = TOY_COLORS[color];
  return (
    <fieldset disabled={disabled} className="mt-4 text-left">
      <legend className="mb-2 text-sm" style={{ color: c.dark }}>
        {label}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(90px,1fr))]">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => !active && onChange(o.value)}
              className="rounded-2xl px-3 py-2 text-left text-sm transition active:translate-y-[3px] disabled:cursor-not-allowed"
              style={
                active
                  ? {
                      background: `linear-gradient(180deg, ${c.main}, ${c.dark} 130%)`,
                      color: "#fff",
                      boxShadow: `0 4px 0 ${c.dark}`,
                      textShadow: "0 1px 0 rgba(0,0,0,.2)",
                    }
                  : {
                      background: "#fff",
                      color: INK,
                      boxShadow: "0 4px 0 #e3d3b5",
                      border: "2px solid #f0e3cc",
                      opacity: disabled ? 0.6 : 1,
                    }
              }
            >
              {o.label}
              {o.hint && (
                <span
                  className="block text-[11px]"
                  style={{ color: active ? "rgba(255,255,255,.85)" : MUTED }}
                >
                  {o.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function WaitingRoom() {
  const {
    code,
    room,
    me,
    isHost,
    myUserId,
    leaveRoom,
    kickPlayer,
    setReady,
    changeSeat,
    updateSettings,
    startGame,
  } = useRoom();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busySeat, setBusySeat] = useState<number | null>(null);
  const wide = useMediaQuery(WIDE_QUERY);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setSettingsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  if (!room) return null;

  const others = room.players.filter((p) => p.userId !== room.hostId);
  const allReady = others.every((p) => p.ready && p.connected);
  const enoughPlayers = room.players.length >= MONOPOLY_MIN_PLAYERS;
  const canStart = isHost && enoughPlayers && allReady;
  const bots = room.players.filter((p) => p.botLevel).length;
  const startHint = !enoughPlayers
    ? `Cần ít nhất ${MONOPOLY_MIN_PLAYERS} người chơi — thêm bot để chơi ngay`
    : !allReady
      ? "Đang chờ mọi người sẵn sàng"
      : "Mọi người đã sẵn sàng!";

  const addBot = async (seat: number) => {
    setBusySeat(seat);
    const r = await monoEmit("mono:bot:add", { seat, level: "normal" });
    setBusySeat(null);
    if (!r.ok) toast.error(r.error ?? "Không thêm được bot");
  };
  const cycleBotLevel = async (p: RoomPlayer) => {
    const cur = LEVEL_ORDER.indexOf(p.botLevel ?? "normal");
    const level = LEVEL_ORDER[(cur + 1) % LEVEL_ORDER.length];
    const r = await monoEmit("mono:bot:level", { userId: p.userId, level });
    if (!r.ok) toast.error(r.error ?? "Không đổi được độ khó");
  };
  const removePlayer = async (p: RoomPlayer) => {
    if (
      p.botLevel ||
      (await confirmDialog({
        title: `Mời ${p.name} ra khỏi phòng?`,
        message: "Người chơi sẽ bị đưa ra khỏi phòng chờ.",
        confirmText: "Mời ra",
        tone: "danger",
        icon: UserX,
      }))
    )
      void kickPlayer(p.userId);
  };

  // ------------------------------------------------------------- ghế
  const seats = (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-3 sm:gap-4 [@media(max-height:500px)]:grid-cols-4 [@media(max-height:500px)]:grid-rows-1 [@media(max-height:500px)]:gap-2">
      {Array.from({ length: MONOPOLY_MAX_PLAYERS }, (_, seat) => {
        const preset = INITIAL_PLAYERS[seat];
        const player = room.players.find((p) => p.seat === seat);

        if (!player) {
          return (
            <div
              key={seat}
              className="group relative flex min-h-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[28px] p-2 text-center"
              style={{
                background: "rgba(255,250,240,0.08)",
                border: "3px dashed rgba(255,241,220,0.28)",
              }}
            >
              <PawnPreview
                type={preset.type}
                className="min-h-0 w-full max-w-32 flex-1 opacity-50 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
              />
              <span className="shrink-0 text-sm text-[#fff1dc]/80">
                Ghế trống · <b style={{ color: preset.color }}>{preset.name}</b>
              </span>
              <div className="flex shrink-0 flex-wrap justify-center gap-1.5">
                <ToyButton
                  size="sm"
                  block={false}
                  color="orange"
                  onClick={() => void changeSeat(seat)}
                >
                  <span className="mx-auto">Ngồi đây</span>
                </ToyButton>
                {isHost && (
                  <ToyButton
                    size="sm"
                    block={false}
                    color="purple"
                    disabled={busySeat === seat}
                    onClick={() => void addBot(seat)}
                  >
                    <span className="mx-auto flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" /> Bot
                    </span>
                  </ToyButton>
                )}
              </div>
            </div>
          );
        }

        const isMe = player.userId === myUserId;
        const isPlayerHost = player.userId === room.hostId;
        const isBot = !!player.botLevel;
        const pawnState = !player.connected
          ? "loser"
          : player.ready || isPlayerHost
            ? "moving"
            : "idle";

        return (
          <div
            key={seat}
            className="toy-pop relative flex min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[28px] p-2 text-center"
            style={{
              background: CREAM,
              border: `4px solid ${preset.color}`,
              boxShadow: `0 7px 0 ${preset.color}99, 0 14px 30px rgba(0,0,0,0.35)${isMe ? ", 0 0 0 4px #ffc23d" : ""}`,
              color: INK,
            }}
          >
            {/* Sân khấu màu quân cờ */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-3/4"
              style={{
                background: `radial-gradient(ellipse at 50% 35%, ${preset.color}55, transparent 70%)`,
              }}
            />
            <PawnPreview
              type={preset.type}
              state={pawnState}
              className={`relative min-h-0 w-full max-w-36 flex-1 ${player.connected ? "" : "opacity-50 grayscale"}`}
            />
            <div
              className="relative flex w-full min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-white px-2 py-1"
              style={{ boxShadow: "0 3px 0 #e3d3b5" }}
            >
              {isBot ? (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: preset.color }}
                >
                  <Bot className="h-3.5 w-3.5" />
                </span>
              ) : (
                <PlayerAvatar
                  name={player.name}
                  avatar={player.avatar}
                  color={preset.color}
                  size={20}
                />
              )}
              <span className="truncate text-sm">{player.name}</span>
              {!isBot && <VoiceBadge userId={player.userId} />}
              {isMe && <Candy color="gold">Bạn</Candy>}
            </div>
            <div className="relative flex shrink-0 flex-wrap items-center justify-center gap-1.5">
              <span
                className="text-[11px] max-[380px]:hidden"
                style={{ color: preset.color, filter: "brightness(.8)" }}
              >
                {preset.name}
              </span>
              <SeatState player={player} host={isPlayerHost} />
              {isBot && player.botLevel && (
                <Candy
                  color={LEVEL_COLOR[player.botLevel]}
                  onClick={
                    isHost ? () => void cycleBotLevel(player) : undefined
                  }
                  title={isHost ? "Bấm để đổi độ khó" : undefined}
                >
                  {BOT_LEVELS[player.botLevel]}
                </Candy>
              )}
            </div>

            {isHost && !isMe && (
              <button
                type="button"
                onClick={() => void removePlayer(player)}
                title={isBot ? "Xoá bot" : "Mời ra khỏi phòng"}
                aria-label={
                  isBot ? `Xoá ${player.name}` : `Kick ${player.name}`
                }
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white transition active:translate-y-px"
                style={{
                  background: TOY_COLORS.red.main,
                  boxShadow: `0 3px 0 ${TOY_COLORS.red.dark}`,
                }}
              >
                {isBot ? (
                  <X className="h-4 w-4" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  // ------------------------------------------------------------- bố cục
  return (
    <div
      className={`${toyFont.className} relative flex h-dvh flex-col overflow-hidden text-white`}
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, #3a5bd9 0%, #1d2a6b 38%, #0c0d24 100%)",
      }}
    >
      <ToyKeyframes />
      {/* Nền: chấm sáng & xúc xắc mờ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[#ff8a3d]/20 blur-[90px]" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#ffc23d]/15 blur-[100px]" />
        {["🎲", "🏠", "💰", "🎲", "🏨", "💎"].map((e, i) => (
          <span
            key={i}
            className="toy-bob absolute select-none text-4xl opacity-[0.12] sm:text-6xl"
            style={{
              left: `${[6, 86, 14, 78, 46, 92][i]}%`,
              top: `${[18, 12, 78, 70, 6, 44][i]}%`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      {/* THANH TIÊU ĐỀ */}
      <header className="relative z-10 shrink-0 px-3 pt-3 sm:px-5 [@media(max-height:500px)]:pt-1.5">
        <div
          className="mx-auto flex w-full max-w-6xl items-center gap-2 rounded-[22px] px-2.5 py-2 sm:gap-3 sm:px-3 [@media(max-height:500px)]:py-1"
          style={{
            background: CREAM,
            border: `4px solid ${TOY_COLORS.orange.main}`,
            boxShadow: `0 6px 0 ${TOY_COLORS.orange.dark}, 0 14px 30px rgba(0,0,0,.3)`,
            color: INK,
          }}
        >
          <RoundButton
            label="Rời phòng"
            color="red"
            onClick={() => void leaveRoom()}
          >
            <LogOut className="h-4.5 w-4.5 rotate-180" />
          </RoundButton>
          <span
            className="toy-wiggle flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl max-[359px]:hidden sm:h-11 sm:w-11"
            style={{
              background: `radial-gradient(circle at 35% 30%, #fff, ${TOY_COLORS.gold.soft} 45%, ${TOY_COLORS.gold.main})`,
              boxShadow: `0 4px 0 ${TOY_COLORS.gold.dark}`,
            }}
          >
            🎲
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p
              className="truncate text-xs sm:text-sm"
              style={{ color: TOY_COLORS.orange.dark }}
            >
              Cờ Tỷ Phú <span className="max-sm:hidden">· Phòng chờ</span>
            </p>
            <button
              type="button"
              onClick={() => void copy(code, "mã phòng")}
              title="Sao chép mã phòng"
              className="group flex items-center gap-1.5"
            >
              <span
                className="font-mono text-base font-black tracking-[0.12em] min-[400px]:text-lg min-[400px]:tracking-[0.2em] sm:text-2xl sm:tracking-[0.3em]"
                style={{ color: INK }}
              >
                {code}
              </span>
              <Copy
                className="h-3.5 w-3.5 transition group-hover:scale-110"
                style={{ color: MUTED }}
              />
            </button>
          </div>
          <RoundButton
            label="Sao chép link mời"
            color="blue"
            onClick={() =>
              void copy(
                `${window.location.origin}/games/monopoly/room/${code}`,
                "link mời",
              )
            }
          >
            <Link2 className="h-4.5 w-4.5" />
          </RoundButton>
          <RoundButton
            label="Cài đặt trận đấu"
            color="purple"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4.5 w-4.5" />
          </RoundButton>
          {!wide && (
            <GameChat
              variant="modal"
              trigger={({ onClick, unread }) => (
                <RoundButton
                  label="Chat phòng"
                  color="green"
                  onClick={onClick}
                  badge={unread}
                >
                  <MessageCircle className="h-4.5 w-4.5" />
                </RoundButton>
              )}
            />
          )}
        </div>
      </header>

      {/* NỘI DUNG */}
      <div className="relative z-0 mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-5 px-3 pt-4 sm:px-5 lg:pt-6 [@media(max-height:500px)]:pt-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <VoiceControls variant="lobby" />
            <span className="flex items-center gap-1.5">
              {bots > 0 && (
                <Candy color="purple">
                  <Bot className="h-3.5 w-3.5" /> {bots} bot
                </Candy>
              )}
              <Candy color="gold">
                <Users className="h-3.5 w-3.5" /> {room.players.length}/
                {MONOPOLY_MAX_PLAYERS} người
              </Candy>
            </span>
          </div>

          <div className="min-h-0 flex-1 pb-2">{seats}</div>

          {/* Luật đang chọn -> bấm mở cài đặt */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-left transition active:translate-y-px"
            style={{
              background: "rgba(255,250,240,0.1)",
              border: "2px solid rgba(255,241,220,0.18)",
            }}
          >
            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              <Candy color="gold">
                💰 ${room.settings.startingMoney.toLocaleString()}
              </Candy>
              <Candy color="blue">
                {room.settings.isPrivate ? "🔒 Riêng tư" : "🌏 Công khai"}
              </Candy>
              <Candy color="pink">⏱️ {TURN_SECONDS}s/lượt</Candy>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-[#ffd166]">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="max-[380px]:hidden">
                {isHost ? "Chỉnh luật" : "Xem luật"}
              </span>
            </span>
          </button>

          {/* Hành động */}
          <div className="flex shrink-0 flex-col items-center gap-1.5 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-5 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:gap-3 [@media(max-height:500px)]:pb-2">
            <div className="w-full max-w-md [@media(max-height:500px)]:w-72">
              {isHost ? (
                <ToyButton
                  size="lg"
                  color="green"
                  disabled={!canStart}
                  onClick={() => void startGame()}
                >
                  <span className="mx-auto flex items-center gap-2">
                    <Play className="h-5 w-5 fill-current" /> Bắt đầu trận đấu
                  </span>
                </ToyButton>
              ) : (
                <ToyButton
                  size="lg"
                  color={me?.ready ? "gray" : "green"}
                  onClick={() => void setReady(!me?.ready)}
                >
                  <span className="mx-auto flex items-center gap-2">
                    {me?.ready ? (
                      <>
                        <Undo2 className="h-5 w-5" /> Huỷ sẵn sàng
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" /> Sẵn sàng
                      </>
                    )}
                  </span>
                </ToyButton>
              )}
            </div>
            {isHost && (
              <span className="text-xs text-[#fff1dc]/75">{startHint}</span>
            )}
          </div>
        </div>

        {wide && (
          <aside className="w-[340px] shrink-0 pb-5 xl:w-[360px]">
            <GameChat variant="inline" />
          </aside>
        )}
      </div>

      {/* CÀI ĐẶT */}
      {settingsOpen && (
        <ToyOverlay z={70}>
          <ToyPanel
            color="purple"
            icon="⚙️"
            title="Cài đặt trận đấu"
            subtitle={
              isHost
                ? "Áp dụng ngay cho cả phòng"
                : "Chỉ chủ phòng được thay đổi"
            }
            maxWidth={460}
          >
            <ToyOptions
              label="💰 Tiền khởi điểm"
              color="gold"
              disabled={!isHost}
              value={room.settings.startingMoney}
              options={STARTING_MONEY_OPTIONS.map((m) => ({
                value: m,
                label: `$${m.toLocaleString()}`,
              }))}
              onChange={(v) => void updateSettings({ startingMoney: v })}
            />
            <ToyOptions
              label="🔑 Chế độ phòng"
              color="blue"
              disabled={!isHost}
              value={room.settings.isPrivate ? "private" : "public"}
              options={[
                {
                  value: "public",
                  label: "Công khai",
                  hint: "Hiện trong sảnh",
                },
                {
                  value: "private",
                  label: "Riêng tư",
                  hint: "Chỉ vào bằng mã",
                },
              ]}
              onChange={(v) =>
                void updateSettings({ isPrivate: v === "private" })
              }
            />
            <p
              className="mt-4 rounded-2xl px-3 py-2.5 text-left text-xs leading-relaxed"
              style={{
                background: TOY_COLORS.orange.soft,
                color: TOY_COLORS.orange.text,
              }}
            >
              ⏱️ Mỗi lượt tối đa {TURN_SECONDS} giây, hết giờ hệ thống tự đi
              thay. Giá đất, tiền thuê và tiền qua ô Bắt đầu tự điều chỉnh theo
              tiền khởi điểm.
              <br />
              🤖 Chủ phòng bấm <b>+ Bot</b> ở ghế trống để thêm bot, bấm nhãn độ
              khó để đổi Dễ / Thường / Khó.
            </p>
            <div className="mt-4">
              <ToyButton color="purple" onClick={() => setSettingsOpen(false)}>
                <span className="mx-auto">Xong</span>
              </ToyButton>
            </div>
          </ToyPanel>
        </ToyOverlay>
      )}
    </div>
  );
}
