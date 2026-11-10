"use client";

import { logout } from "@/redux/features/authSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    router.push("/login");
  };

  const navItems = [{ name: "Trò Chơi", href: "/games", icon: "🎮" }];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1f2235] px-6 py-4 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between">
        {/* LEFT */}
        <Link href="/" className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-r from-cyan-400 to-purple-500 text-2xl text-white shadow-lg">
            💬
          </div>

          <div>
            <h1 className="bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text text-3xl font-bold text-transparent">
              Chat Zone
            </h1>

            <p className="text-sm text-gray-400">Welcome back 👋</p>
          </div>
        </Link>

        {/* CENTER - NAVIGATION MENU */}
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-2xl px-5 py-2.5 text-base font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-linear-to-r from-cyan-400/20 to-purple-500/20 text-cyan-400 border border-cyan-400/30 shadow-md"
                    : "bg-[#2b2f46]/60 text-gray-300 hover:bg-[#353a55] hover:text-white border border-white/5"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          <Link href="/settings" className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <p className="text-lg font-semibold text-white">
                {user?.name || "Guest"}
              </p>

              <p className="text-sm text-gray-400">{user?.email || ""}</p>
            </div>

            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-lg font-bold text-white shadow-lg">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name || "Avatar"}
                  fill
                  className="object-cover"
                />
              ) : (
                user?.name?.charAt(0).toUpperCase() || "G"
              )}
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="rounded-2xl bg-linear-to-r from-cyan-400 to-purple-500 px-5 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
