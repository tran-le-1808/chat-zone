"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import SacMauRoomScreen from "../../_components/online/SacMauRoomScreen";

export default function SacMauRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="sacmau">
      <SacMauRoomScreen />
    </RoomProvider>
  );
}
