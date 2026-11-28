"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import VeDoanRoomScreen from "../../_components/online/VeDoanRoomScreen";

export default function VeDoanRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="vedoan">
      <VeDoanRoomScreen />
    </RoomProvider>
  );
}
