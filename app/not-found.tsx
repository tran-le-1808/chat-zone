import Link from "next/link";
import { Home, MapPinOff } from "lucide-react";
import DongSonDrum from "@/components/ui/DongSonDrum";
import { BrandLogo } from "@/components/ui/BrandPanel";
import { ui } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0d0f1e] px-4 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#c81d25]/25 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-[#f4b942]/15 blur-[140px]" />
      </div>

      <div
        className={`relative z-10 w-full max-w-lg px-6 py-10 text-center sm:px-10 ${ui.card}`}
      >
        <div className="relative mx-auto mb-4 flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
          <DongSonDrum className="absolute inset-0 h-full w-full animate-[spin_60s_linear_infinite] text-[#f4b942]/30" />
          <span
            className={`relative text-6xl font-black sm:text-7xl ${ui.goldText}`}
          >
            404
          </span>
        </div>

        <div className="mb-2 flex items-center justify-center gap-2 text-[#ffd166]">
          <MapPinOff className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">
            Lạc đường rồi
          </span>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Không tìm thấy trang
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          Trang bạn tìm có thể đã bị chuyển đi, xoá hoặc đường dẫn chưa đúng.
          Quay về sảnh chính để tiếp tục nhé!
        </p>

        <Link href="/" className={`${ui.btnPrimary} mt-7 w-full sm:w-auto`}>
          <Home className="h-5 w-5" /> Về trang chính
        </Link>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <BrandLogo size={22} /> Chat Zone © 2026
        </div>
      </div>
    </div>
  );
}
