"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import ChessRoomScreen from "../../_components/online/ChessRoomScreen";

export default function ChessRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="chess">
      <ChessRoomScreen />
    </RoomProvider>
  );
}
