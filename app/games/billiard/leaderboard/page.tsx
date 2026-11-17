"use client";

import { Suspense } from "react";
import HubShell from "../_components/hub/HubShell";
import Leaderboard from "../_components/hub/Leaderboard";

export default function BilliardLeaderboardPage() {
  return (
    <HubShell>
      <Suspense>
        <Leaderboard />
      </Suspense>
    </HubShell>
  );
}
