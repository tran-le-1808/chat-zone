// lib/socket.ts
import { io } from "socket.io-client";
import Cookies from "js-cookie";

const getAccessToken = () => {
  if (typeof window !== "undefined") {
    return Cookies.get("token") || "";
  }
  return "";
};

export const socket = io(`${process.env.NEXT_PUBLIC_API_URL}`, {
  autoConnect: true,
  transports: ["websocket"],
  withCredentials: true,
  auth: (cb) => {
    // Hàm này chạy động mỗi lần socket kết nối/kết nối lại để lấy token mới nhất
    cb({
      token: `Bearer ${getAccessToken()}`,
    });
  },
});
