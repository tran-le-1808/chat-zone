"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  KeyRound,
  Settings,
  UserRound,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { clearUserStatus } from "@/redux/features/userSlice";
import { ui } from "@/components/ui/styles";
import ProfileTab from "./components/ProfileTab";
import PasswordTab from "./components/PasswordTab";

type Tab = "profile" | "password";

const TABS: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Hồ sơ", icon: UserRound },
  { id: "password", label: "Mật khẩu", icon: KeyRound },
];

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { error, updateSuccessMessage } = useAppSelector(
    (state) => state.users,
  );

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [localError, setLocalError] = useState("");

  // Xoá thông báo cũ khi đổi tab
  useEffect(() => {
    dispatch(clearUserStatus());
  }, [activeTab, dispatch]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setLocalError("");
  };

  const errorMsg = error || localError;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-5 sm:px-6 sm:py-10">
      <Link
        href="/"
        className={`${ui.btnGhost} -ml-2 mb-3 px-3! py-2! text-sm`}
      >
        <ArrowLeft className="h-4 w-4" /> Trang chính
      </Link>

      <div className={`${ui.card} p-5 sm:p-8`}>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#c81d25] to-[#e8772e] shadow-[0_4px_0_#7f1118]">
            <Settings className="h-5 w-5" />
          </span>
          <div>
            <h1 className={`text-2xl font-extrabold ${ui.goldText}`}>
              Cài đặt tài khoản
            </h1>
            <p className="text-sm text-slate-400">
              Cập nhật hồ sơ và bảo mật của bạn
            </p>
          </div>
        </div>

        {/* Tab dạng phân đoạn */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                activeTab === id
                  ? "bg-linear-to-r from-[#c81d25] to-[#e8772e] text-white shadow-md"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {updateSuccessMessage && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {updateSuccessMessage}
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#c81d25]/40 bg-[#c81d25]/10 p-3 text-sm text-[#ff8a7a]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {activeTab === "profile" && <ProfileTab key={user?._id || "profile"} />}
        {activeTab === "password" && (
          <PasswordTab onError={(msg) => setLocalError(msg)} />
        )}
      </div>
    </div>
  );
}
