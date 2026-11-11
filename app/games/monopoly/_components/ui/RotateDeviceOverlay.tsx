"use client";

import { useEffect, useState } from "react";
import { toyFont } from "./ToyUI";
import { useMediaQuery } from "./useScreen";

/** Điện thoại (màn hình cảm ứng, hẹp) đang cầm DỌC */
const PHONE_PORTRAIT_QUERY =
  "(orientation: portrait) and (max-width: 767px) and (pointer: coarse)";

type LockableOrientation = ScreenOrientation & {
  lock?: (o: "landscape") => Promise<void>;
  unlock?: () => void;
};

const getOrientation = () =>
  (typeof screen !== "undefined" ? screen.orientation : undefined) as
    LockableOrientation | undefined;

/** Thử khoá màn hình ngang (Android Chrome cần đang ở chế độ toàn màn hình) */
async function lockLandscape(withFullscreen: boolean) {
  const o = getOrientation();
  if (!o?.lock) return false;
  try {
    if (
      withFullscreen &&
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
    }
    await o.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

/**
 * Bàn cờ luôn chơi NGANG trên điện thoại:
 * - Thử tự khoá màn hình ngang (được khi web chạy toàn màn hình / cài như app).
 * - Cầm dọc -> che màn hình, nhắc xoay ngang. Trên Android có nút
 *   "Xoay ngang ngay" (vào toàn màn hình + khoá ngang). iPhone không cho web
 *   tự xoay nên chỉ hiện lời nhắc.
 */
export default function RotateDeviceOverlay() {
  const isPortraitPhone = useMediaQuery(PHONE_PORTRAIT_QUERY);
  // Trình duyệt có hỗ trợ khoá hướng màn hình (Android) hay không
  const [canLock] = useState(
    () =>
      typeof document !== "undefined" &&
      !!getOrientation()?.lock &&
      !!document.documentElement.requestFullscreen,
  );

  // Vào trận: thử khoá ngang ngay (không bật toàn màn hình vì cần thao tác người dùng)
  useEffect(() => {
    void lockLandscape(false);
    return () => {
      // Rời trận: trả lại xoay tự do & thoát toàn màn hình
      try {
        getOrientation()?.unlock?.();
      } catch {
        /* bỏ qua */
      }
      if (document.fullscreenElement) void document.exitFullscreen?.();
    };
  }, []);

  if (!isPortraitPhone) return null;

  return (
    <div
      className={`${toyFont.className} fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 px-8 text-center text-white`}
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #2b3566 0%, #141728 70%)",
      }}
    >
      <style>{`
        @keyframes rotate-phone {
          0%, 15% { transform: rotate(0deg); }
          45%, 70% { transform: rotate(-90deg); }
          100% { transform: rotate(0deg); }
        }
        .rotate-phone { animation: rotate-phone 2.4s ease-in-out infinite; }
      `}</style>

      {/* Điện thoại xoay sang ngang */}
      <div className="rotate-phone relative h-28 w-16 rounded-[18px] border-4 border-white/90 bg-white/10 shadow-[0_0_40px_rgba(103,232,249,0.35)]">
        <span className="absolute left-1/2 top-1.5 h-1 w-5 -translate-x-1/2 rounded-full bg-white/70" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">
          🎲
        </span>
      </div>

      <div>
        <p className="text-xl">Xoay ngang điện thoại</p>
        <p className="mt-1 text-sm text-white/70">
          Bàn cờ được thiết kế để chơi ở màn hình ngang
        </p>
      </div>

      {canLock && (
        <button
          type="button"
          onClick={() => void lockLandscape(true)}
          className="rounded-2xl px-6 py-3 text-base text-white transition active:translate-y-[3px]"
          style={{
            background: "linear-gradient(180deg,#22d3ee,#0891b2)",
            boxShadow: "0 4px 0 #0e7490, 0 10px 24px rgba(0,0,0,0.35)",
          }}
        >
          🔄 Xoay ngang ngay
        </button>
      )}
    </div>
  );
}
