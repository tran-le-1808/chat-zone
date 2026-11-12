"use client";

import MainLayout from "@/components/layout/MainLayout";
import LobbyBrowser from "./_components/lobby/LobbyBrowser";

/** Sảnh Cờ Tỷ Phú online: tạo phòng / vào phòng bằng mã / danh sách phòng */
export default function MonopolyLobbyPage() {
  return (
    <MainLayout>
      <LobbyBrowser />
    </MainLayout>
  );
}
