"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import SacMauLobby from "./_components/SacMauLobby";
import SMBotGame, { type BotSetup } from "./_components/SMBotGame";

/** Sắc Màu: sảnh (máy / online) -> bàn chơi với máy ngay tại trang; online vào /games/sacmau/room/[code] */
export default function SacMauPage() {
  const [bot, setBot] = useState<BotSetup | null>(null);
  if (bot) return <SMBotGame setup={bot} onExit={() => setBot(null)} />;
  return (
    <MainLayout>
      <SacMauLobby onBot={setBot} />
    </MainLayout>
  );
}
