"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleDot,
  Crown,
  Dices,
  Gamepad2,
  Grid3x3,
  Hourglass,
  Layers,
  Play,
  Search,
  SearchX,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import DongSonDrum from "@/components/ui/DongSonDrum";
import { ui } from "@/components/ui/styles";

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
}

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
    isAvailable: false,
    slug: "/games/caro",
  },
  {
    id: "3",
    title: "Cờ Vua (Chess)",
    description:
      "Đấu trí đỉnh cao cùng các quân cờ Vua, Hậu, Mã, Tượng. Thể hiện bản lĩnh kiện tướng.",
    category: "Chiến thuật",
    players: "2 người",
    icon: Crown,
    bannerBg: "from-[#2a1d12] to-[#6b4a1f]",
    isAvailable: false,
    slug: "/games/chess",
  },
  {
    id: "4",
    title: "Uno Card",
    description:
      "Game bài vui nhộn đầy bất ngờ. Đánh bài cùng màu, cùng số và nhanh tay hô UNO!",
    category: "Giải trí",
    players: "2 - 6 người",
    icon: Layers,
    bannerBg: "from-[#3b1530] to-[#6b2a3f]",
    isAvailable: false,
    slug: "/games/uno",
  },
];

export default function GamesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGames = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return GAMES_LIST.filter((g) => g.title.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-5 text-white sm:px-6 sm:py-8 md:space-y-8">
        {/* Tiêu đề + tìm kiếm */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/"
              className={`${ui.btnGhost} -ml-2 mb-2 px-3! py-1.5! text-sm`}
            >
              <ArrowLeft className="h-4 w-4" /> Trang chính
            </Link>
            <h1 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_4px_0_#7f1118]">
                <Gamepad2 className="h-6 w-6" />
              </span>
              <span className={ui.goldText}>Khu Vực Trò Chơi</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Thách đấu và giải trí cùng bạn bè trực tuyến ngay trên Chat Zone
            </p>
          </div>

          <div className={`${ui.field} w-full py-2.5 md:w-80`}>
            <Search className="h-4 w-4 shrink-0 text-[#f4b942]/80" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm trò chơi (Caro, Cờ tỷ phú…)"
              aria-label="Tìm trò chơi"
              className="w-full min-w-0 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Xoá tìm kiếm"
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {filteredGames.map((game) => {
              const Icon = game.icon;
              return (
                <div
                  key={game.id}
                  className={`group flex flex-col overflow-hidden transition duration-300 ${ui.card} ${
                    game.isAvailable
                      ? "hover:-translate-y-1 hover:border-[#f4b942]/50"
                      : "opacity-80"
                  }`}
                >
                  {/* Banner */}
                  <div
                    className={`relative flex h-32 items-center justify-center overflow-hidden bg-linear-to-br sm:h-36 ${game.bannerBg}`}
                  >
                    <DongSonDrum className="absolute -right-16 -top-16 h-56 w-56 text-[#ffd166]/15 transition-transform duration-700 group-hover:rotate-45" />
                    <Icon
                      className="relative h-16 w-16 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-110"
                      strokeWidth={1.6}
                    />
                    <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-semibold text-[#ffd166] backdrop-blur-md">
                      {game.category}
                    </span>
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs text-white/85 backdrop-blur-md">
                      <Users className="h-3.5 w-3.5" /> {game.players}
                    </span>
                  </div>

                  {/* Nội dung */}
                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div>
                      <h3 className="text-lg font-bold transition group-hover:text-[#ffd166] sm:text-xl">
                        {game.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
                        {game.description}
                      </p>
                    </div>

                    {game.isAvailable ? (
                      <Link
                        href={game.slug}
                        className={`${ui.btnPrimary} w-full`}
                      >
                        <Play className="h-4 w-4 fill-current" /> Chơi ngay
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 font-semibold text-slate-500"
                      >
                        <Hourglass className="h-4 w-4" /> Sắp ra mắt
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`flex flex-col items-center justify-center space-y-3 p-10 text-center sm:p-12 ${ui.card}`}
          >
            <SearchX className="h-12 w-12 text-[#f4b942]" />
            <h3 className="text-lg font-bold">Không tìm thấy trò chơi nào</h3>
            <p className="max-w-md text-sm text-slate-400">
              Không có game nào khớp với từ khoá &quot;
              <span className="text-[#ffd166]">{searchQuery}</span>&quot;. Thử
              tìm với tên khác xem sao!
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className={`${ui.btnGold} mt-2 px-4! py-2! text-sm`}
            >
              Xoá bộ lọc
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
