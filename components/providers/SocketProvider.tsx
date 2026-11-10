"use client";

import { getAccessToken, getHandshakeToken, socket } from "@/lib/socket";
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

    // Token chỉ được gửi lúc bắt tay (handshake). Nếu socket đang kết nối từ trước
    // (ví dụ trước khi đăng nhập / đổi tài khoản) thì phải kết nối lại để gửi token mới.
    if (socket.connected && getHandshakeToken() !== getAccessToken()) {
      socket.disconnect();
    }
    socket.connect();

    socket.emit("join", user._id);

    return () => {
      socket.disconnect();
    };
  }, [user?._id]);

  return children;
}
