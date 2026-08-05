"use client";

import { socket } from "@/lib/socket";
import { useEffect } from "react";
import { useAppSelector } from "@/redux/hooks";

export default function SocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!user?._id) return;

    socket.connect();

    socket.emit("join", user._id);

    return () => {
      socket.disconnect();
    };
  }, [user?._id]);

  return children;
}
