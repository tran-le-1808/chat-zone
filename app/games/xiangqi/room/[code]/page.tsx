"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "../../../monopoly/_context/RoomContext";
import XiangqiRoomScreen from "../../_components/online/XiangqiRoomScreen";

export default function XiangqiRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  return (
    <RoomProvider code={code} game="xiangqi">
      <XiangqiRoomScreen />
    </RoomProvider>
  );
}
