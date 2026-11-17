"use client";

import { Suspense } from "react";
import HubShell from "../_components/hub/HubShell";
import TournamentsPage from "../_components/hub/Tournaments";

export default function BilliardTournamentsPage() {
  return (
    <HubShell>
      <Suspense>
        <TournamentsPage />
      </Suspense>
    </HubShell>
  );
}
