"use client";

import { useParams } from "next/navigation";
import HubShell from "../../_components/hub/HubShell";
import TournamentDetail from "../../_components/hub/TournamentDetail";

export default function BilliardTournamentPage() {
  const params = useParams<{ id: string }>();
  return (
    <HubShell>
      <TournamentDetail id={(params.id ?? "").toUpperCase()} />
    </HubShell>
  );
}
