import { getAccessToken, getHandshakeToken, socket } from "@/lib/socket";
import { AckResponse } from "@/types/monopoly-room";

const ACK_TIMEOUT_MS = 8000;
const AUTH_ERROR = "Bạn cần đăng nhập";

async function emitOnce<T>(
  event: string,
  payload?: unknown,
): Promise<AckResponse<T>> {
  try {
    const res = (await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(event, payload)) as AckResponse<T>;
    return res ?? { ok: false, error: "Không nhận được phản hồi" };
  } catch {
    return { ok: false, error: "Mất kết nối tới máy chủ, vui lòng thử lại" };
  }
}

/** Gửi sự kiện Cờ Tỷ Phú lên server và chờ phản hồi */
export async function monoEmit<T = undefined>(
  event: string,
  payload?: unknown,
): Promise<AckResponse<T>> {
  const res = await emitOnce<T>(event, payload);

  // Socket đang dùng token cũ / rỗng (vd. vừa đăng nhập hoặc token vừa được làm mới)
  // -> kết nối lại để gửi token hiện tại rồi thử lại 1 lần
  const token = getAccessToken();
  if (
    !res.ok &&
    res.error === AUTH_ERROR &&
    token &&
    token !== getHandshakeToken()
  ) {
    socket.disconnect();
    socket.connect();
    if (await waitForSocket()) return emitOnce<T>(event, payload);
  }
  return res;
}

/** Chờ socket kết nối (socket chỉ kết nối sau khi đăng nhập) */
export function waitForSocket(timeoutMs = 10000): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      resolve(false);
    }, timeoutMs);
    const onConnect = () => {
      clearTimeout(timer);
      resolve(true);
    };
    socket.once("connect", onConnect);
  });
}
