"use client";

import HubShell from "./_components/hub/HubShell";
import LobbyHome from "./_components/hub/LobbyHome";

/** Sảnh Bida Carom: hồ sơ, 4 chế độ (Quick / Ranked / Casual / Tournament), giải đấu, xếp hạng, online */
export default function BilliardLobbyPage() {
  return (
    <HubShell>
      <LobbyHome />
    </HubShell>
  );
}
