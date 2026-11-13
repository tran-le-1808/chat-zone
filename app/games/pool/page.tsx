"use client";

import { useState } from "react";
import { useAppSelector } from "@/redux/hooks";
import MainLayout from "@/components/layout/MainLayout";
import PoolGame from "./_components/PoolGame";
import PoolSetupScreen from "./_components/PoolSetupScreen";
import type { PoolSetup } from "./_components/PoolContext";

/** Bida lỗ: chọn thể loại / chế độ, rồi vào bàn (toàn màn hình) */
export default function PoolPage() {
  const [setup, setSetup] = useState<PoolSetup | null>(null);
  const myName = useAppSelector((s) => s.auth.user?.name ?? "");
  const myUserId = useAppSelector((s) => s.auth.user?._id ?? null);
  if (setup) return <PoolGame key={setup.config.seed} setup={setup} onExit={() => setSetup(null)} />;
  return (
    <MainLayout>
      <PoolSetupScreen myName={myName} myUserId={myUserId} onStart={setSetup} />
    </MainLayout>
  );
}
