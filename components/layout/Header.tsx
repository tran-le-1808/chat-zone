"use client";

import { logout } from "@/redux/features/authSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import Link from "next/link";

import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  const dispatch = useAppDispatch();

  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());

    router.push("/login");
  };

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

        {/* CENTER */}
        {/* <div className="hidden w-full max-w-md lg:block">
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-5 py-3 text-white outline-none placeholder:text-gray-400 focus:border-cyan-400"
          />
        </div> */}

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2b2f46] text-xl text-white transition hover:bg-[#353a55]">
            🔔
          </button>

          <div className="hidden text-right md:block">
            <p className="text-lg font-semibold text-white">
              {user?.name || "Guest"}
            </p>

            <p className="text-sm text-gray-400">{user?.email || ""}</p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-cyan-400 to-purple-500 text-lg font-bold text-white shadow-lg">
            {user?.name?.charAt(0) || "G"}
          </div>

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
