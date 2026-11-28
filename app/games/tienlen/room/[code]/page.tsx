"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import TienLenRoomScreen from "../../_components/online/TienLenRoomScreen";

export default function TienLenRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="tienlen">
      <TienLenRoomScreen />
    </RoomProvider>
  );
}
