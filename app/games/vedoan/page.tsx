"use client";

import MainLayout from "@/components/layout/MainLayout";
import VeDoanLobby from "./_components/VeDoanLobby";

/** Vẽ Đoán: sảnh (online / vẽ thử); phòng online ở /games/vedoan/room/[code] */
export default function VeDoanPage() {
  return (
    <MainLayout>
      <VeDoanLobby />
    </MainLayout>
  );
}
