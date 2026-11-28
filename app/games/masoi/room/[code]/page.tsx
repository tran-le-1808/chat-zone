"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import MaSoiRoomScreen from "../../_components/online/MaSoiRoomScreen";

export default function MaSoiRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="masoi">
      <MaSoiRoomScreen />
    </RoomProvider>
  );
}
