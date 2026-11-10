"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../_context/RoomContext";
import RoomScreen from "../../_components/lobby/RoomScreen";

export default function MonopolyRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  return (
    <RoomProvider code={code}>
      <RoomScreen />
    </RoomProvider>
  );
}
