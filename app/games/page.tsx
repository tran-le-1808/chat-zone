"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brush,
  CircleDot,
  Crown,
  Dices,
  Grid3x3,
  KeyRound,
  Layers,
  Moon,
  Search,
  Spade,
  Swords,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import {
  TOY_COLORS,
  ToyButton,
  ToyKeyframes,
  toyFont,
  type ToyColor,
} from "./monopoly/_components/ui/ToyUI";

export interface GameItem {
  id: string;
  title: string;
  description: string;
  category: string;
  players: string;
  icon: LucideIcon;
  bannerBg: string;
  isAvailable: boolean;
  slug: string;
  /** Màu nhấn của thẻ (bảng màu "đồ chơi") */
  accent: ToyColor;
  /** Hình minh hoạ lớn trên banner + hình phụ */
  emoji: string;
  emoji2: string;
}

const CREAM = "linear-gradient(180deg, #fffaf0 0%, #fff1dc 100%)";
const INK = "#2b2f48";
const MUTED = "#7a7f95";

const GAMES_LIST: GameItem[] = [
  {
    id: "2",
    title: "Cờ Tỷ Phú (Monopoly)",
    description:
      "Đầu tư bất động sản, mua đất, xây nhà và trở thành tỷ phú đô la trong bàn cờ may mắn.",
    category: "Bàn cờ & Kinh tế",
    players: "2 - 4 người",
    icon: Dices,
    bannerBg: "from-[#7f1118] via-[#c81d25] to-[#e8772e]",
    isAvailable: true,
    slug: "/games/monopoly",
    accent: "orange",
    emoji: "🎲",
    emoji2: "🏠",
  },
  {
    id: "5",
    title: "Bida Carom",
    description:
      "Bàn 3 bi không lỗ với vật lý chân thực: xoáy, English, phản xạ băng. Đấu 1 vs 1 theo luật Phăng hoặc 3 băng.",
    category: "Thể thao",
    players: "2 người",
    icon: CircleDot,
    bannerBg: "from-[#0b4d3a] via-[#11704f] to-[#c2621f]",
    isAvailable: true,
    slug: "/games/billiard",
    accent: "green",
    emoji: "⚪",
    emoji2: "🔴",
  },
  {
    id: "6",
    title: "Bida Lỗ (Pool)",
    description:
      "Bàn 9 feet với 8 bi & 9 bi luật WPA: vật lý thật (đi sau, kéo về, throw, rung mép lỗ), trọng tài tự động, đấu máy 3 cấp độ.",
    category: "Thể thao",
    players: "1 - 2 người",
    icon: Target,
    bannerBg: "from-[#0b3d2e] via-[#0f6b52] to-[#7f1118]",
    isAvailable: true,
    slug: "/games/pool",
    accent: "blue",
    emoji: "🎱",
    emoji2: "🎯",
  },
  {
    id: "7",
    title: "Prison Break – Last Chance",
    description:
      "Vượt ngục 2D: né lính gác, lục soát, chế tạo, giải cứu đồng đội. Chơi đơn hoặc co-op 4 người — chỉ thắng khi cả đội cùng thoát.",
    category: "Hành động & Co-op",
    players: "1 - 4 người",
    icon: KeyRound,
    bannerBg: "from-[#0f172a] via-[#334155] to-[#7f1118]",
    isAvailable: true,
    slug: "/games/prison",
    accent: "red",
    emoji: "🔑",
    emoji2: "🚔",
  },
  {
    id: "1",
    title: "Cờ Caro (Gomoku)",
    description:
      "Trò chơi đấu trí 5 nước thắng kinh điển. Thử thách phản xạ và tư duy chiến thuật với bạn bè.",
    category: "Chiến thuật",
    players: "2 người",
    icon: Grid3x3,
    bannerBg: "from-[#1d2347] to-[#3a3f6b]",
    isAvailable: true,
    slug: "/games/caro",
    accent: "purple",
    emoji: "⭕",
    emoji2: "❌",
  },
  {
    id: "xiangqi",
    title: "Cờ Tướng",
    description:
      "Cờ tướng luật chuẩn: chơi với máy 4 cấp độ hoặc đấu online với bạn bè, có đồng hồ và biên bản ván cờ.",
    category: "Chiến thuật",
    players: "2 người",
    icon: Swords,
    bannerBg: "from-[#5a1410] to-[#a3261e]",
    isAvailable: true,
    slug: "/games/xiangqi",
    accent: "red",
    emoji: "🀄",
    emoji2: "🏯",
  },
  {
    id: "tienlen",
    title: "Tiến Lên Miền Nam",
    description:
      "Đánh bài tiến lên 52 lá, 2–4 người: chơi với máy hoặc online với bạn bè. Chặt heo, đôi thông, tứ quý, tới trắng.",
    category: "Bài",
    players: "2–4 người",
    icon: Spade,
    bannerBg: "from-[#7d0f0f] to-[#c0201f]",
    isAvailable: true,
    slug: "/games/tienlen",
    accent: "red",
    emoji: "🃏",
    emoji2: "🧧",
  },
  {
    id: "3",
    title: "Cờ Vua (Chess)",
    description:
      "Cờ vua luật FIDE: chơi với máy 4 cấp độ hoặc đấu online có đồng hồ, xin hoà, biên bản ván cờ.",
    category: "Chiến thuật",
    players: "2 người",
    icon: Crown,
    bannerBg: "from-[#2a1d12] to-[#6b4a1f]",
    isAvailable: true,
    slug: "/games/chess",
    accent: "gold",
    emoji: "♟️",
    emoji2: "👑",
  },
  {
    id: "4",
    title: "Sắc Màu",
    description:
      "Game bài đổi màu 4 hệ Lửa · Nước · Lá · Gió: Chặn, Đảo chiều, +2, Đổi sắc, nhớ hô “Báo!”. Chơi với máy hoặc online.",
    category: "Bài",
    players: "2–4 người",
    icon: Layers,
    bannerBg: "from-[#2a2468] to-[#6d4ce0]",
    isAvailable: true,
    slug: "/games/sacmau",
    accent: "purple",
    emoji: "🎴",
    emoji2: "🌈",
  },
  {
    id: "masoi",
    title: "Ma Sói",
    description:
      "Trò chơi suy luận 5–12 người: Sói, Tiên Tri, Bảo Vệ, Phù Thuỷ, Thợ Săn. Đêm đi săn, ngày bỏ phiếu treo cổ. Chơi với máy hoặc online.",
    category: "Suy luận",
    players: "5–12 người",
    icon: Moon,
    bannerBg: "from-[#0b1026] to-[#3a2a6a]",
    isAvailable: true,
    slug: "/games/masoi",
    accent: "blue",
    emoji: "🐺",
    emoji2: "🌕",
  },
  {
    id: "vedoan",
    title: "Vẽ Đoán",
    description:
      "Một người vẽ, cả phòng đoán chữ! Đoán càng nhanh càng nhiều điểm, có gợi ý chữ cái, từ tự nhập và voice. 2–10 người online.",
    category: "Vui nhộn",
    players: "2–10 người",
    icon: Brush,
    bannerBg: "from-[#2f5fd0] to-[#4f86f7]",
    isAvailable: true,
    slug: "/games/vedoan",
    accent: "orange",
    emoji: "🎨",
    emoji2: "✏️",
  },
];

const ALL = "Tất cả";

function GameCard({ game, index }: { game: GameItem; index: number }) {
  const c = TOY_COLORS[game.isAvailable ? game.accent : "gray"];
  const Icon = game.icon;
  const card = (
    <article
      className={`toy-pop group relative flex h-full flex-col overflow-hidden rounded-[18px] transition duration-300 ${
        game.isAvailable ? "cursor-pointer hover:-translate-y-1.5" : ""
      }`}
      style={{
        background: CREAM,
        border: `3px solid ${c.main}`,
        boxShadow: `0 4px 0 ${c.dark}, 0 8px 18px rgba(0,0,0,0.28)`,
        color: INK,
        animationDelay: `${index * 0.06}s`,
      }}
    >
      {/* Banner */}
      <div
        className={`relative flex h-[72px] items-center justify-center overflow-hidden bg-linear-to-br ${game.bannerBg} ${
          game.isAvailable ? "" : "grayscale-[60%]"
        }`}
      >
        {/* chấm bi trang trí */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,.55) 1.5px, transparent 1.6px)",
            backgroundSize: "18px 18px",
          }}
        />
        <span
          aria-hidden
          className="absolute -bottom-2 -left-1 rotate-[-14deg] text-2xl opacity-40 transition duration-500 group-hover:rotate-0"
        >
          {game.emoji2}
        </span>
        <Icon
          aria-hidden
          className="absolute -right-3 -top-3 h-12 w-12 text-white/15 transition duration-700 group-hover:rotate-12"
          strokeWidth={1.4}
        />
        <span
          className="toy-bob relative flex h-11 w-11 items-center justify-center rounded-full text-xl transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `radial-gradient(circle at 35% 30%, #fff, ${c.soft} 45%, ${c.main})`,
            border: "3px solid #fffaf0",
            boxShadow: `0 3px 0 ${c.dark}, 0 6px 12px rgba(0,0,0,.3)`,
            animationDelay: `${index * 0.3}s`,
          }}
        >
          {game.emoji}
        </span>
        {!game.isAvailable && (
          <span
            className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] text-white"
            style={{ background: "rgba(0,0,0,.45)" }}
          >
            🔒 Sắp ra mắt
          </span>
        )}
      </div>

      {/* Tên */}
      <h3
        className="truncate px-2 py-2 text-center text-sm leading-tight"
        style={{ color: c.dark }}
        title={game.title}
      >
        {game.title}
      </h3>
    </article>
  );
  return game.isAvailable ? (
    <Link href={game.slug} aria-label={`Chơi ${game.title}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

export default function GamesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(
    () => [ALL, ...new Set(GAMES_LIST.map((g) => g.category))],
    [],
  );

  const filteredGames = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return GAMES_LIST.filter(
      (g) =>
        (category === ALL || g.category === category) &&
        (g.title.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)),
    ).sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));
  }, [searchQuery, category]);

  const playable = GAMES_LIST.filter((g) => g.isAvailable).length;

  return (
    <MainLayout>
      <div
        className={`${toyFont.className} relative min-h-full overflow-hidden text-white`}
      >
        <ToyKeyframes />
        {/* Nền: quầng sáng & biểu tượng mờ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-[#3a5bd9]/25 blur-[110px]" />
          <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-[#ff8a3d]/15 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#ff5c9a]/10 blur-[110px]" />
          {["🎲", "🎱", "♟️", "⭕", "🃏", "🔑", "🏆", "🎯"].map((e, i) => (
            <span
              key={i}
              className="toy-bob absolute select-none text-5xl opacity-[0.08] sm:text-6xl"
              style={{
                left: `${[3, 90, 8, 84, 46, 95, 30, 70][i]}%`,
                top: `${[14, 6, 62, 48, 94, 82, 36, 22][i]}%`,
                animationDelay: `${i * 0.4}s`,
              }}
            >
              {e}
            </span>
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-6xl space-y-6 px-3 py-5 sm:px-6 sm:py-8 md:space-y-8">
          {/* Tiêu đề + tìm kiếm */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Link
                href="/"
                className="-ml-1 mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[#fff1dc]/80 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Trang chính
              </Link>
              <h1 className="flex items-center gap-3 text-3xl sm:text-4xl">
                <span
                  className="toy-wiggle flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, #fff, ${TOY_COLORS.gold.soft} 45%, ${TOY_COLORS.gold.main})`,
                    boxShadow: `0 5px 0 ${TOY_COLORS.gold.dark}`,
                  }}
                >
                  🎮
                </span>
                <span
                  style={{
                    color: "#ffd166",
                    textShadow: `0 3px 0 ${TOY_COLORS.orange.dark}, 0 6px 14px rgba(0,0,0,.35)`,
                  }}
                >
                  Khu Vực Trò Chơi
                </span>
              </h1>
              <p className="mt-2 text-sm text-[#fff1dc]/70">
                {playable} trò chơi đang mở — thách đấu bạn bè hoặc luyện tập
                với bot ngay trên Chat Zone
              </p>
            </div>

            <label
              className="flex w-full items-center gap-2 rounded-full px-4 py-2.5 md:w-80"
              style={{
                background: CREAM,
                border: "3px solid #f0e3cc",
                boxShadow: "0 4px 0 #e3d3b5",
                color: INK,
              }}
            >
              <Search
                className="h-4 w-4 shrink-0"
                style={{ color: TOY_COLORS.orange.main }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm trò chơi (Caro, Cờ tỷ phú…)"
                aria-label="Tìm trò chơi"
                className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-[#a8a293]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xoá tìm kiếm"
                  className="shrink-0 rounded-full p-1 transition hover:bg-black/5"
                  style={{ color: MUTED }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>

          {/* Lọc theo thể loại */}
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {categories.map((cat) => {
              const active = cat === category;
              const c = TOY_COLORS.orange;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(cat)}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm transition active:translate-y-[3px]"
                  style={
                    active
                      ? {
                          background: `linear-gradient(180deg, ${c.main}, ${c.dark} 130%)`,
                          boxShadow: `0 4px 0 ${c.dark}`,
                          color: "#fff",
                          textShadow: "0 1px 0 rgba(0,0,0,.2)",
                        }
                      : {
                          background: "rgba(255,250,240,0.1)",
                          border: "2px solid rgba(255,241,220,0.2)",
                          color: "#fff1dc",
                        }
                  }
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredGames.map((game, i) => (
                <GameCard key={game.id} game={game} index={i} />
              ))}
            </div>
          ) : (
            <div
              className="toy-pop mx-auto flex max-w-md flex-col items-center gap-3 rounded-[28px] p-8 text-center"
              style={{
                background: CREAM,
                border: `4px solid ${TOY_COLORS.gold.main}`,
                boxShadow: `0 7px 0 ${TOY_COLORS.gold.dark}`,
                color: INK,
              }}
            >
              <span className="text-5xl">🔍</span>
              <h3 className="text-lg" style={{ color: TOY_COLORS.gold.dark }}>
                Không tìm thấy trò chơi nào
              </h3>
              <p className="text-sm" style={{ color: MUTED }}>
                Không có game nào khớp với &quot;
                <b style={{ color: INK }}>{searchQuery || category}</b>&quot;.
                Thử tìm với tên khác xem sao!
              </p>
              <ToyButton
                color="gold"
                block={false}
                onClick={() => {
                  setSearchQuery("");
                  setCategory(ALL);
                }}
              >
                <span className="mx-auto">Xoá bộ lọc</span>
              </ToyButton>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
