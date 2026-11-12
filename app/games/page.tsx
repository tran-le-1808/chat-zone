"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

export interface GameItem {
  id: string;
  title: string;
  description: string;
  category: string;
  players: string;
  icon: string;
  bannerBg: string;
  isAvailable: boolean;
  slug: string;
}

const GAMES_LIST: GameItem[] = [
  {
    id: "1",
    title: "Cờ Caro (Gomoku)",
    description:
      "Trò chơi đấu trí 5 nước thắng kinh điển. Thử thách phản xạ và tư duy chiến thuật với bạn bè.",
    category: "Chiến thuật",
    players: "2 Người",
    icon: "❌⭕",
    bannerBg: "from-blue-600 to-cyan-500",
    isAvailable: false,
    slug: "/games/caro",
  },
  {
    id: "2",
    title: "Cờ Tỷ Phú (Monopoly)",
    description:
      "Đầu tư bất động sản, mua đất, xây nhà và trở thành tỷ phú đô la trong bàn cờ may mắn.",
    category: "Bàn cờ & Kinh tế",
    players: "2 - 4 Người",
    icon: "🎩🎲",
    bannerBg: "from-purple-600 to-pink-500",
    isAvailable: true,
    slug: "/games/monopoly",
  },
  {
    id: "3",
    title: "Cờ Vua (Chess)",
    description:
      "Đấu trí đỉnh cao cùng các quân cờ Vua, Hậu, Mã, Tượng. Thể hiện bản lĩnh kiện tướng.",
    category: "Chiến thuật",
    players: "2 Người",
    icon: "♚♟",
    bannerBg: "from-amber-600 to-orange-500",
    isAvailable: false, // Sắp ra mắt
    slug: "/games/chess",
  },
  {
    id: "5",
    title: "Bida Carom",
    description:
      "Bàn 3 bi không lỗ với vật lý chân thực: xoáy, English, phản xạ băng. Đấu 1 vs 1 theo luật Phăng hoặc 3 băng.",
    category: "Thể thao",
    players: "2 Người",
    icon: "🎱",
    bannerBg: "from-emerald-600 to-teal-500",
    isAvailable: true,
    slug: "/games/billiard",
  },
  {
    id: "4",
    title: "Uno Card",
    description:
      "Game bài vui nhộn đầy bất ngờ. Đánh bài cùng màu, cùng số và nhanh tay hô UNO!",
    category: "Giải trí",
    players: "2 - 6 Người",
    icon: "🃏🔥",
    bannerBg: "from-red-600 to-yellow-500",
    isAvailable: false,
    slug: "/games/uno",
  },
];

export default function GamesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter games theo tên (không phân biệt chữ hoa/thường)
  const filteredGames = useMemo(() => {
    return GAMES_LIST.filter((game) =>
      game.title.toLowerCase().includes(searchQuery.toLowerCase().trim()),
    );
  }, [searchQuery]);

  return (
    <div className="flex flex-1 flex-col bg-[#262a40] min-h-screen text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {/* Quay lại trang chính */}
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-gray-300 transition hover:border-cyan-400/50 hover:bg-white/10 hover:text-white active:scale-95"
            >
              <span aria-hidden>←</span> Trang chính
            </Link>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
              Khu Vực Trò Chơi
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Thách đấu và giải trí cùng bạn bè trực tuyến ngay trên Chat Zone
            </p>
          </div>

          {/* SEARCH INPUT */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm trò chơi (Caro, Cờ tỷ phú...)"
              className="w-full pl-10 pr-4 py-2.5 bg-[#1d2032] border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* GAMES GRID */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className="bg-[#1d2032] border border-white/10 rounded-3xl overflow-hidden shadow-lg hover:border-cyan-400/50 transition-all duration-300 flex flex-col group"
              >
                {/* BANNER / ICON HEADER */}
                <div
                  className={`h-36 bg-gradient-to-br ${game.bannerBg} flex items-center justify-center relative p-4`}
                >
                  <span className="text-6xl drop-shadow-md group-hover:scale-110 transition-transform duration-300">
                    {game.icon}
                  </span>

                  {/* BADGES */}
                  <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-xs px-3 py-1 rounded-full border border-white/10 text-cyan-300 font-medium">
                    {game.category}
                  </div>
                  <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-xs px-3 py-1 rounded-full border border-white/10 text-gray-300">
                    👥 {game.players}
                  </div>
                </div>

                {/* CONTENT */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition">
                      {game.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2 leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  {/* ACTION BUTTON */}
                  <div>
                    {game.isAvailable ? (
                      <Link
                        href={game.slug}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-white font-semibold py-2.5 rounded-2xl hover:opacity-90 transition active:scale-98 shadow-md"
                      >
                        Chơi Ngay 🎮
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="w-full bg-[#2a2d42] text-gray-500 font-semibold py-2.5 rounded-2xl cursor-not-allowed border border-white/5"
                      >
                        Sắp Ra Mắt ⏳
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="bg-[#1d2032] border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
            <span className="text-5xl">🎯</span>
            <h3 className="text-lg font-bold text-white">
              Không tìm thấy trò chơi nào
            </h3>
            <p className="text-gray-400 text-sm max-w-md">
              Không có game nào khớp với từ khóa &quot;
              <span className="text-cyan-400">{searchQuery}</span>&quot;. Thử
              tìm kiếm với tên khác xem sao!
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 text-sm text-cyan-400 underline hover:text-cyan-300"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
