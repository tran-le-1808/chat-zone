/** Gọi sự kiện sảnh Bida qua kết nối Socket.IO dùng chung (có timeout, tự kết nối lại khi token đổi) */
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import type { AckResponse } from "@/types/monopoly-room";

export type BidaAck<T> = AckResponse<T> & { code?: string };

export async function bidaEmit<T = undefined>(event: string, payload?: unknown): Promise<BidaAck<T>> {
  if (!(await waitForSocket())) return { ok: false, error: "Không kết nối được tới máy chủ" };
  return (await monoEmit<T>(event, payload)) as BidaAck<T>;
}

/** Lưu tạm mật khẩu phòng để trang phòng gửi kèm khi vào (chỉ trong tab hiện tại) */
export function rememberRoomPassword(code: string, password: string): void {
  try {
    sessionStorage.setItem(`bida:pass:${code}`, password);
  } catch {
    /* bỏ qua */
  }
}
export function roomPassword(code: string): string | null {
  try {
    return sessionStorage.getItem(`bida:pass:${code}`);
  } catch {
    return null;
  }
}
