"use client";

import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { clearUserStatus } from "@/redux/features/userSlice";
import ProfileTab from "./components/ProfileTab";
import PasswordTab from "./components/PasswordTab";

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { error, updateSuccessMessage } = useAppSelector(
    (state) => state.users,
  );

  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [localError, setLocalError] = useState("");

  // Chỉ gọi dispatch clear status lên Redux khi activeTab đổi
  useEffect(() => {
    dispatch(clearUserStatus());
  }, [activeTab, dispatch]);

  // Hàm chuyển Tab xử lý tập trung
  const handleTabChange = (tab: "profile" | "password") => {
    setActiveTab(tab);
    setLocalError(""); // Xóa local error an toàn trong event handler
  };

  return (
    <div className="flex flex-1 justify-center bg-[#262a40] p-6 text-white min-h-screen">
      <div className="w-full max-w-2xl rounded-3xl bg-[#1d2032] p-8 shadow-xl border border-white/10 self-start mt-6">
        <h1 className="text-2xl font-bold mb-6 text-cyan-400">
          Cài Đặt Tài Khoản
        </h1>

        {/* TABS HEADER */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            onClick={() => handleTabChange("profile")}
            className={`pb-3 px-4 font-medium transition ${
              activeTab === "profile"
                ? "border-b-2 border-cyan-400 text-cyan-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Thông tin cá nhân
          </button>
          <button
            onClick={() => handleTabChange("password")}
            className={`pb-3 px-4 font-medium transition ${
              activeTab === "password"
                ? "border-b-2 border-cyan-400 text-cyan-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Đổi mật khẩu
          </button>
        </div>

        {/* ALERT NOTIFICATION */}
        {updateSuccessMessage && (
          <div className="mb-4 rounded-xl bg-green-500/20 p-3 text-sm text-green-400 border border-green-500/30">
            {updateSuccessMessage}
          </div>
        )}
        {(error || localError) && (
          <div className="mb-4 rounded-xl bg-red-500/20 p-3 text-sm text-red-400 border border-red-500/30">
            {error || localError}
          </div>
        )}

        {/* TAB CONTENTS */}
        {activeTab === "profile" && <ProfileTab key={user?._id || "profile"} />}
        {activeTab === "password" && (
          <PasswordTab onError={(msg) => setLocalError(msg)} />
        )}
      </div>
    </div>
  );
}
