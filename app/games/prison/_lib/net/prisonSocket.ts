/** Socket.IO riêng cho Prison Break (namespace /game) — chỉ kết nối khi vào trang game. */
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/socket";
import { PRISON_NAMESPACE, type Ack } from "../engine/protocol";

let socket: Socket | null = null;
let refs = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function getPrisonSocket(): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_API_URL}${PRISON_NAMESPACE}`, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      auth: (cb) => {
        const token = getAccessToken();
        cb({ token: token ? `Bearer ${token}` : "" });
      },
    });
  }
  return socket;
}

/** Đếm tham chiếu: trang nào cần socket thì acquire, rời trang thì release */
export function acquirePrisonSocket(): Socket {
  const s = getPrisonSocket();
  refs += 1;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!s.connected) s.connect();
  return s;
}

export function releasePrisonSocket(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || !socket) return;
  releaseTimer = setTimeout(() => {
    if (refs === 0) socket?.disconnect();
  }, 1500);
}

export function waitConnected(s: Socket, ms = 8000): Promise<boolean> {
  if (s.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      s.off("connect", ok);
      resolve(false);
    }, ms);
    const ok = () => {
      clearTimeout(t);
      resolve(true);
    };
    s.once("connect", ok);
  });
}

export async function prisonEmit<T = undefined>(s: Socket, event: string, payload?: unknown, timeoutMs = 6000): Promise<Ack<T>> {
  try {
    const res = (await s.timeout(timeoutMs).emitWithAck(event, payload)) as Ack<T> | undefined;
    return res ?? { ok: false, code: "CONFLICT", message: "Không nhận được phản hồi" };
  } catch {
    return { ok: false, code: "CONFLICT", message: "Mất kết nối tới máy chủ" };
  }
}

export function newRequestId(): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `r${r}`.slice(0, 40);
}
