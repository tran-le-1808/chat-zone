"use client";

import { useParams } from "next/navigation";
import PrisonRoomScreen from "../../_components/PrisonRoomScreen";

export default function PrisonRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return <PrisonRoomScreen key={code} code={code} />;
}
