"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import ChessLobby from "./_components/ChessLobby";
import ChessBotGame, { type BotSetup } from "./_components/ChessBotGame";

/** Cờ Vua: sảnh (máy / online) -> bàn chơi với máy ngay tại trang này; online vào /games/chess/room/[code] */
export default function ChessPage() {
  const [bot, setBot] = useState<BotSetup | null>(null);
  if (bot) return <ChessBotGame setup={bot} onExit={() => setBot(null)} />;
  return (
    <MainLayout>
      <ChessLobby onBot={setBot} />
    </MainLayout>
  );
}
