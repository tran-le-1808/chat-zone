"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  DoorOpen,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { authUrlWithRedirect } from "@/lib/redirect";
import { useAppSelector } from "@/redux/hooks";
import { INITIAL_PLAYERS } from "@/types/game.types";
import {
  JoinResult,
  MONOPOLY_MAX_PLAYERS,
  RoomInfo,
} from "@/types/monopoly-room";
import PlayerAvatar from "../PlayerAvatar";
import {
  TOY_COLORS,
  ToyButton,
  ToyKeyframes,
  toyFont,
  type ToyColor,
} from "../ui/ToyUI";

const CREAM = "linear-gradient(180deg, #fffaf0 0%, #fff1dc 100%)";
const INK = "#2b2f48";
const MUTED = "#7a7f95";

/** Thẻ kem viền dày màu nhấn, có huy hiệu biểu tượng ở góc (giống modal trong game) */
function ToyCard({
  color,
  icon,
  title,
  action,
  className = "",
  children,
}: {
  color: ToyColor;
  icon: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const c = TOY_COLORS[color];
  return (
    <section
      className={`relative rounded-[28px] p-4 sm:p-5 ${className}`}
      style={{
        background: CREAM,
        border: `4px solid ${c.main}`,
        boxShadow: `0 7px 0 ${c.dark}, 0 16px 34px rgba(0,0,0,0.32)`,
        color: INK,
      }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{
            background: `radial-gradient(circle at 35% 30%, #fff, ${c.soft} 45%, ${c.main})`,
            boxShadow: `0 4px 0 ${c.dark}`,
          }}
        >
          {icon}
        </span>
        <h2
          className="min-w-0 flex-1 text-lg sm:text-xl"
          style={{ color: c.dark }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Candy({
  color,
  children,
}: {
  color: ToyColor;
  children: React.ReactNode;
}) {
  const c = TOY_COLORS[color];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs"
      style={{
        background: c.soft,
        color: c.text,
        boxShadow: `inset 0 -2px 0 ${c.main}66`,
      }}
    >
      {children}
    </span>
  );
}

const CODE_LENGTH = 6;

export default function LobbyBrowser() {
  const router = useRouter();
  const { user, loading } = useAppSelector((state) => state.auth);

  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [myRoom, setMyRoom] = useState<RoomInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const connected = await waitForSocket();
    if (!connected) {
      setRefreshing(false);
      return;
    }
    const [list, mine] = await Promise.all([
      monoEmit<RoomInfo[]>("mono:list"),
      monoEmit<RoomInfo | null>("mono:myRoom"),
    ]);
    if (list.ok) setRooms(list.data ?? []);
    if (mine.ok) setMyRoom(mine.data ?? null);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(() => void refresh(), 10000);
    return () => clearInterval(id);
  }, [user?._id, refresh]);

  const createRoom = async () => {
    setBusy(true);
    const res = await monoEmit<JoinResult>("mono:create");
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Không tạo được phòng");
      return;
    }
    router.push(`/games/monopoly/room/${res.data.room.code}`);
  };

  /** Chơi ngay với bot: tạo phòng riêng rồi thêm 3 bot */
  const playWithBots = async () => {
    setBusy(true);
    const res = await monoEmit<JoinResult>("mono:create", { isPrivate: true });
    if (!res.ok || !res.data) {
      setBusy(false);
      toast.error(res.error ?? "Không tạo được phòng");
      return;
    }
    for (let i = 0; i < MONOPOLY_MAX_PLAYERS - 1; i++)
      await monoEmit("mono:bot:add", { level: "normal" });
    setBusy(false);
    router.push(`/games/monopoly/room/${res.data.room.code}`);
  };

  const joinByCode = (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== CODE_LENGTH) {
      toast.error(`Mã phòng gồm ${CODE_LENGTH} ký tự`);
      return;
    }
    router.push(`/games/monopoly/room/${normalized}`);
  };

  if (!user) {
    return (
      <div
        className={`${toyFont.className} flex min-h-full items-center justify-center px-4 py-20`}
      >
        <ToyKeyframes />
        {loading ? (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ffc23d] border-t-transparent" />
        ) : (
          <ToyCard
            color="orange"
            icon="🔐"
            title="Đăng nhập để chơi"
            className="toy-pop w-full max-w-sm text-center"
          >
            <p className="mb-4 text-sm" style={{ color: MUTED }}>
              Bạn cần đăng nhập để chơi Cờ Tỷ Phú online
            </p>
            <Link
              href={authUrlWithRedirect("/login", "/games/monopoly")}
              className="block"
            >
              <ToyButton color="orange" size="lg">
                <span className="mx-auto flex items-center gap-2">
                  <LogIn className="h-5 w-5" /> Đăng nhập
                </span>
              </ToyButton>
            </Link>
          </ToyCard>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${toyFont.className} relative min-h-full overflow-hidden px-3 py-5 text-white sm:px-6 md:p-10`}
    >
      <ToyKeyframes />
      {/* Nền: quầng sáng & biểu tượng mờ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#3a5bd9]/30 blur-[100px]" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#ff8a3d]/15 blur-[110px]" />
        {["🎲", "🏠", "💰", "🏨", "💎", "🎲"].map((e, i) => (
          <span
            key={i}
            className="toy-bob absolute select-none text-5xl opacity-[0.1] sm:text-6xl"
            style={{
              left: `${[4, 88, 10, 80, 50, 94][i]}%`,
              top: `${[30, 8, 82, 66, 92, 40][i]}%`,
              animationDelay: `${i * 0.45}s`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      <div className="relative mx-auto max-w-5xl space-y-6 sm:space-y-7">
        {/* HEADER */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/games"
              className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[#fff1dc]/80 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Khu vực trò chơi
            </Link>
            <h1 className="mt-2 flex items-center gap-3 text-3xl sm:text-4xl">
              <span
                className="toy-wiggle flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl"
                style={{
                  background: `radial-gradient(circle at 35% 30%, #fff, ${TOY_COLORS.gold.soft} 45%, ${TOY_COLORS.gold.main})`,
                  boxShadow: `0 5px 0 ${TOY_COLORS.gold.dark}`,
                }}
              >
                🎲
              </span>
              <span
                style={{
                  color: "#ffd166",
                  textShadow: `0 3px 0 ${TOY_COLORS.orange.dark}, 0 6px 14px rgba(0,0,0,.35)`,
                }}
              >
                Cờ Tỷ Phú Online
              </span>
            </h1>
            <p className="mt-2 text-sm text-[#fff1dc]/70">
              Tạo phòng, mời bạn bè bằng mã hoặc chơi cùng bot — 2 đến 4 người
            </p>
          </div>
          <div
            className="flex items-center gap-3 self-start rounded-full py-1.5 pl-1.5 pr-4 md:self-auto"
            style={{
              background: CREAM,
              boxShadow: `0 4px 0 #e3d3b5`,
              color: INK,
            }}
          >
            <PlayerAvatar name={user.name} avatar={user.avatar} size={36} />
            <div className="text-sm leading-tight">
              <div className="text-[11px]" style={{ color: MUTED }}>
                Chơi với tên
              </div>
              <div>{user.name}</div>
            </div>
          </div>
        </div>

        {/* ĐANG Ở PHÒNG KHÁC */}
        {myRoom && (
          <div
            className="toy-pop flex flex-col gap-3 rounded-[22px] px-4 py-3 md:flex-row md:items-center md:justify-between"
            style={{
              background: TOY_COLORS.gold.soft,
              border: `3px solid ${TOY_COLORS.gold.main}`,
              boxShadow: `0 5px 0 ${TOY_COLORS.gold.dark}`,
              color: TOY_COLORS.gold.text,
            }}
          >
            <div className="text-sm">
              🏠 Bạn đang ở phòng{" "}
              <span className="font-mono font-black tracking-widest">
                {myRoom.code}
              </span>{" "}
              ({myRoom.status === "playing" ? "đang chơi" : "đang chờ"})
            </div>
            <div className="flex gap-2">
              <Link
                href={`/games/monopoly/room/${myRoom.code}`}
                className="flex-1 md:flex-none"
              >
                <ToyButton size="sm" color="orange">
                  <span className="mx-auto">Quay lại phòng</span>
                </ToyButton>
              </Link>
              <ToyButton
                size="sm"
                color="red"
                block={false}
                className="flex-1 md:flex-none"
                onClick={async () => {
                  await monoEmit("mono:leave");
                  void refresh();
                }}
              >
                <span className="mx-auto flex items-center gap-1.5">
                  <LogOut className="h-4 w-4 rotate-180" /> Rời phòng
                </span>
              </ToyButton>
            </div>
          </div>
        )}

        {/* TẠO / VÀO PHÒNG */}
        <div className="grid gap-6 md:grid-cols-2">
          <ToyCard
            color="orange"
            icon="🏗️"
            title="Tạo phòng mới"
            className="toy-pop"
          >
            <p className="mb-4 text-sm" style={{ color: MUTED }}>
              Bạn là chủ phòng: mời bạn bè bằng mã, chỉnh luật chơi, thêm bot
              vào ghế trống.
            </p>
            <div className="space-y-3">
              <ToyButton
                color="orange"
                size="lg"
                disabled={busy}
                onClick={() => void createRoom()}
              >
                <span className="mx-auto flex items-center gap-2">
                  <DoorOpen className="h-5 w-5" />
                  {busy ? "Đang tạo…" : "Tạo phòng"}
                </span>
              </ToyButton>
              <ToyButton
                color="purple"
                disabled={busy}
                onClick={() => void playWithBots()}
              >
                <span className="mx-auto flex items-center gap-2">
                  <Bot className="h-5 w-5" /> Chơi ngay với 3 bot
                </span>
              </ToyButton>
            </div>
          </ToyCard>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinByCode(code);
            }}
          >
            <ToyCard
              color="blue"
              icon="🔑"
              title="Vào phòng bằng mã"
              className="toy-pop h-full"
            >
              <input
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, CODE_LENGTH),
                  )
                }
                placeholder="VD: K7M2QX"
                aria-label="Mã phòng"
                className="mb-4 w-full rounded-2xl bg-white px-4 py-3 text-center font-mono text-xl font-black tracking-[0.35em] outline-none transition placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal sm:text-2xl"
                style={{
                  color: TOY_COLORS.blue.text,
                  border: `3px solid ${code ? TOY_COLORS.blue.main : "#f0e3cc"}`,
                  boxShadow: "inset 0 3px 0 #f3e8d3",
                }}
              />
              <ToyButton
                type="submit"
                color="blue"
                size="lg"
                disabled={code.length !== CODE_LENGTH}
              >
                <span className="mx-auto flex items-center gap-2">
                  <KeyRound className="h-5 w-5" /> Vào phòng
                </span>
              </ToyButton>
            </ToyCard>
          </form>
        </div>

        {/* PHÒNG CÔNG KHAI */}
        <ToyCard
          color="green"
          icon="🌏"
          title="Phòng đang chờ"
          action={
            <ToyButton
              size="sm"
              color="green"
              block={false}
              onClick={() => void refresh()}
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="max-sm:hidden">Làm mới</span>
              </span>
            </ToyButton>
          }
        >
          {rooms.length === 0 ? (
            <p
              className="rounded-2xl py-8 text-center text-sm"
              style={{ color: MUTED, border: "3px dashed #ecdcbd" }}
            >
              Chưa có phòng công khai nào. Hãy tạo phòng đầu tiên! 🎲
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rooms.map((r) => {
                const host = r.players.find((p) => p.userId === r.hostId);
                const bots = r.players.filter((p) => p.botLevel).length;
                return (
                  <div
                    key={r.code}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3.5"
                    style={{
                      border: "3px solid #f0e3cc",
                      boxShadow: "0 4px 0 #e3d3b5",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate">
                        Phòng của {host?.name ?? "?"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Candy color="gray">
                          <span className="font-mono tracking-wider">
                            {r.code}
                          </span>
                        </Candy>
                        <Candy color="gold">
                          💰 ${r.settings.startingMoney.toLocaleString()}
                        </Candy>
                        {bots > 0 && (
                          <Candy color="purple">
                            <Bot className="h-3 w-3" /> {bots}
                          </Candy>
                        )}
                      </div>
                      <div className="mt-2 flex -space-x-2">
                        {r.players.map((p) => (
                          <PlayerAvatar
                            key={p.userId}
                            name={p.name}
                            avatar={p.avatar}
                            color={INITIAL_PLAYERS[p.seat]?.color}
                            size={26}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Candy color="blue">
                        <Users className="h-3.5 w-3.5" />
                        {r.players.length}/{MONOPOLY_MAX_PLAYERS}
                      </Candy>
                      <ToyButton
                        size="sm"
                        color="orange"
                        block={false}
                        onClick={() => joinByCode(r.code)}
                      >
                        <span className="flex items-center gap-1">
                          <Plus className="h-3.5 w-3.5" /> Vào
                        </span>
                      </ToyButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ToyCard>
      </div>
    </div>
  );
}
