"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Bell, CircleDot, Home, LogIn, Settings, Trophy, User, Medal } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { ui } from "@/components/ui/styles";
import { authUrlWithRedirect } from "@/lib/redirect";
import { useAppSelector } from "@/redux/hooks";
import PlayerAvatar from "../../../monopoly/_components/PlayerAvatar";
import { BilliardLobbyProvider, useLobby } from "../../_context/BilliardLobbyContext";
import MatchmakingOverlay from "./Matchmaking";
import { ErrorBox, RankBadge } from "./ui";
import { DISCIPLINES, TABLE_MODE_NAME } from "../../_lib/lobbyTypes";

const NAV = [
  { href: "/games/billiard", label: "Sảnh", icon: Home },
  { href: "/games/billiard/tournaments", label: "Giải đấu", icon: Trophy },
  { href: "/games/billiard/leaderboard", label: "Xếp hạng", icon: Medal },
  { href: "/games/billiard/profile", label: "Hồ sơ", icon: User },
];

function TopBar() {
  const { profile, notifications, unread, markRead } = useLobby();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1a14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6">
        <Link href="/games" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10" aria-label="Khu vực trò chơi">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link href="/games/billiard" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-600 to-emerald-800 shadow-[0_3px_0_#064e3b]">
            <CircleDot className="h-5 w-5 text-white" />
          </span>
          <span className="hidden text-lg font-black tracking-tight sm:block">
            Carom <span className={ui.goldText}>Arena</span>
          </span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${pathname === n.href ? "bg-[#f4b942]/15 text-[#ffd166]" : "text-slate-300 hover:bg-white/10"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {profile && (
            <Link href="/games/billiard/profile" className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/10">
              <PlayerAvatar name={profile.name} avatar={profile.avatar} size={34} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-32 truncate text-sm font-bold">{profile.name}</span>
                <span className="block text-[11px] text-slate-400">
                  Lv.{profile.level} · {profile.totalWins} thắng
                </span>
              </span>
              {DISCIPLINES.map((d) => (
                <span key={d} className="hidden items-center gap-1 sm:inline-flex" title={`${TABLE_MODE_NAME[d]}: ${profile.ladders[d].rating}`}>
                  <RankBadge rankId={profile.ladders[d].rankId} size="sm" showName={false} />
                  <span className="text-[11px] font-bold leading-tight text-[#ffd166]">
                    <span className="block text-[9px] font-semibold uppercase text-slate-400">{d === "free" ? "Libre" : "3 băng"}</span>
                    {profile.ladders[d].rating}
                  </span>
                </span>
              ))}
            </Link>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpen((o) => !o);
                markRead();
              }}
              className="relative rounded-lg p-2 text-slate-300 hover:bg-white/10"
              aria-label="Thông báo"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/10 bg-[#11132a] p-2 shadow-2xl">
                {notifications.length === 0 ? (
                  <p className="p-3 text-center text-sm text-slate-400">Chưa có thông báo</p>
                ) : (
                  notifications.map((n) =>
                    n.href ? (
                      <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/10">
                        {n.text}
                      </Link>
                    ) : (
                      <p key={n.id} className="px-3 py-2 text-sm">
                        {n.text}
                      </p>
                    ),
                  )
                )}
              </div>
            )}
          </div>
          <Link href="/settings" className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Cài đặt">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
      <nav className="flex justify-around border-t border-white/5 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-bold ${pathname === n.href ? "text-[#ffd166]" : "text-slate-400"}`}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Body({ children }: { children: ReactNode }) {
  const { ready, error, retry } = useLobby();
  if (!ready)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4b942] border-t-transparent" />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBox text={error} onRetry={retry} />
      </div>
    );
  return <>{children}</>;
}

/** Khung chung các trang sảnh Bida: đăng nhập, thanh trên, điều hướng, lớp tìm trận */
export default function HubShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAppSelector((s) => s.auth);
  const pathname = usePathname();
  if (!user)
    return (
      <MainLayout>
        <div className="flex min-h-full items-center justify-center px-4 py-20 text-white">
          {loading ? (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f4b942] border-t-transparent" />
          ) : (
            <div className={`space-y-4 px-8 py-10 text-center ${ui.card}`}>
              <div className="text-5xl">🎱</div>
              <p className="text-slate-300">Bạn cần đăng nhập để vào sảnh Bida Carom</p>
              <Link href={authUrlWithRedirect("/login", pathname ?? "/games/billiard")} className={ui.btnPrimary}>
                <LogIn className="h-5 w-5" /> Đăng nhập
              </Link>
            </div>
          )}
        </div>
      </MainLayout>
    );
  return (
    <MainLayout>
      <BilliardLobbyProvider>
        <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#14532d_0%,#0b1a14_45%,#070b10_100%)] text-white">
          <TopBar />
          <main className="mx-auto max-w-6xl px-3 py-4 pb-28 sm:px-6 sm:py-6">
            <Body>{children}</Body>
          </main>
          <MatchmakingOverlay />
        </div>
      </BilliardLobbyProvider>
    </MainLayout>
  );
}
