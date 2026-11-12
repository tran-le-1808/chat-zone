"use client";

import { logout } from "@/redux/features/authSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gamepad2,
  LogOut,
  MessagesSquare,
  Settings,
  Sparkles,
} from "lucide-react";
import DongSonDrum from "@/components/ui/DongSonDrum";
import UserAvatar from "@/components/ui/UserAvatar";

const NAV_ITEMS = [
  { name: "Trò chuyện", href: "/", icon: MessagesSquare },
  { name: "Trò chơi", href: "/games", icon: Gamepad2 },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="relative z-40 shrink-0 border-b border-[#f4b942]/15 bg-[#0d0f1e]/85 backdrop-blur-xl">
      {/* Viền vàng kim mảnh phía dưới */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-[#f4b942]/50 to-transparent" />

      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:h-16 sm:px-5">
        {/* LOGO */}
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-[#c81d25] to-[#f4b942] shadow-[0_0_18px_rgba(244,185,66,0.35)] transition group-hover:scale-105 sm:h-11 sm:w-11">
            <DongSonDrum className="absolute h-[140%] w-[140%] text-white/25 transition-transform duration-700 group-hover:rotate-45" />
            <MessagesSquare
              className="relative h-5 w-5 text-white"
              strokeWidth={2.4}
            />
          </div>
          <div className="min-w-0">
            <h1 className="bg-linear-to-r from-[#ffd166] via-[#f4b942] to-[#ff6b4a] bg-clip-text text-lg font-extrabold leading-tight tracking-tight text-transparent sm:text-xl">
              Chat Zone
            </h1>
            <p className="hidden items-center gap-1 truncate text-xs text-slate-400 sm:flex">
              <Sparkles className="h-3 w-3 text-[#f4b942]" />
              Xin chào, {user?.name || "bạn"}!
            </p>
          </div>
        </Link>

        {/* ĐIỀU HƯỚNG */}
        <nav className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {NAV_ITEMS.map(({ name, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={name}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold transition sm:px-4 ${
                  active
                    ? "bg-linear-to-r from-[#c81d25] to-[#e8772e] text-white shadow-[0_0_14px_rgba(232,119,46,0.45)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{name}</span>
              </Link>
            );
          })}
        </nav>

        {/* TÀI KHOẢN */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-2xl p-1 transition hover:bg-white/5 sm:pr-3"
            title="Cài đặt tài khoản"
          >
            <UserAvatar
              name={user?.name}
              src={user?.avatar}
              size={36}
              className="ring-2 ring-[#f4b942]/60 rounded-full"
            />
            <div className="hidden text-left lg:block">
              <p className="max-w-[160px] truncate text-sm font-semibold leading-tight">
                {user?.name || "Khách"}
              </p>
              <p className="max-w-[160px] truncate text-xs text-slate-400">
                {user?.email || ""}
              </p>
            </div>
            <Settings className="hidden h-4 w-4 text-slate-400 lg:block" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="flex h-9 items-center gap-2 rounded-xl border border-[#c81d25]/40 bg-[#c81d25]/10 px-2.5 text-sm font-semibold text-[#ff8a7a] transition hover:bg-[#c81d25]/25 hover:text-white sm:px-3"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}
