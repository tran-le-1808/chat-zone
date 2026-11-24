"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import CaroLobby from "./_components/CaroLobby";
import CaroBotGame, { type BotSetup } from "./_components/CaroBotGame";

/** Cờ Caro: sảnh (bot / online) -> bàn chơi với bot ngay tại trang này; online vào /games/caro/room/[code] */
export default function CaroPage() {
  const [bot, setBot] = useState<BotSetup | null>(null);
  if (bot) return <CaroBotGame setup={bot} onExit={() => setBot(null)} />;
  return (
    <MainLayout>
      <CaroLobby onBot={setBot} />
    </MainLayout>
  );
}
