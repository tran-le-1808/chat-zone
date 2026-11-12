"use client";

import MainLayout from "@/components/layout/MainLayout";
import BilliardLobby from "./_components/lobby/BilliardLobby";

/** Sảnh Bida Carom online: tạo phòng / vào phòng bằng mã / danh sách phòng */
export default function BilliardLobbyPage() {
  return (
    <MainLayout>
      <BilliardLobby />
    </MainLayout>
  );
}
