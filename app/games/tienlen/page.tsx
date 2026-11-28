"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import TienLenLobby from "./_components/TienLenLobby";
import TienLenBotGame, { type BotSetup } from "./_components/TienLenBotGame";

/** Tiến Lên Miền Nam: sảnh (máy / online) -> bàn chơi với máy ngay tại trang; online vào /games/tienlen/room/[code] */
export default function TienLenPage() {
  const [bot, setBot] = useState<BotSetup | null>(null);
  if (bot) return <TienLenBotGame setup={bot} onExit={() => setBot(null)} />;
  return (
    <MainLayout>
      <TienLenLobby onBot={setBot} />
    </MainLayout>
  );
}
