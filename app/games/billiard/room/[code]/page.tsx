"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import BilliardRoomScreen from "../../_components/lobby/BilliardRoomScreen";

export default function BilliardRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="billiard">
      <BilliardRoomScreen />
    </RoomProvider>
  );
}
