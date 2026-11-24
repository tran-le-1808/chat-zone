"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import CaroRoomScreen from "../../_components/online/CaroRoomScreen";

export default function CaroRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="caro">
      <CaroRoomScreen />
    </RoomProvider>
  );
}
