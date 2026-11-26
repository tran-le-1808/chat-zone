"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import XiangqiLobby from "./_components/XiangqiLobby";
import XiangqiBotGame, { type BotSetup } from "./_components/XiangqiBotGame";

/** Cờ Tướng: sảnh (máy / online) -> bàn chơi với máy ngay tại trang này; online vào /games/xiangqi/room/[code] */
export default function XiangqiPage() {
  const [bot, setBot] = useState<BotSetup | null>(null);
  if (bot) return <XiangqiBotGame setup={bot} onExit={() => setBot(null)} />;
  return (
    <MainLayout>
      <XiangqiLobby onBot={setBot} />
    </MainLayout>
  );
}
