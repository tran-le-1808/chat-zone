"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import PoolRoomScreen from "../../_components/online/PoolRoomScreen";

export default function PoolRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="pool">
      <PoolRoomScreen />
    </RoomProvider>
  );
}
