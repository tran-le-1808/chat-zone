import { io } from "socket.io-client";

export const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
  autoConnect: true,
  transports: ["websocket", "polling"],
  withCredentials: true,
});
