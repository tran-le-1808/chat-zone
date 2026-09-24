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
    const token = getAccessToken();

    console.log("[AI Socket] Getting token:", !!token);

    cb({
      token: token ? `Bearer ${token}` : "",
    });
  },
});

socket.on("connect", () => {
  console.log("[AI Socket] CONNECTED:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("[AI Socket] CONNECT ERROR:", error.message);
});

socket.on("disconnect", (reason) => {
  console.warn("[AI Socket] DISCONNECTED:", reason);
});

socket.on("error", (error) => {
  console.error("[AI Socket] ERROR:", error);
});
