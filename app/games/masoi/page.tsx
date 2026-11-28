"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import MaSoiLobby from "./_components/MaSoiLobby";
import MSBotGame, { type BotSetup } from "./_components/MSBotGame";

/** Ma Sói: sảnh (máy / online) -> chơi với máy ngay tại trang; online vào /games/masoi/room/[code] */
export default function MaSoiPage() {
  const [bot, setBot] = useState<BotSetup | null>(null);
  if (bot) return <MSBotGame setup={bot} onExit={() => setBot(null)} />;
  return (
    <MainLayout>
      <MaSoiLobby onBot={setBot} />
    </MainLayout>
  );
}
