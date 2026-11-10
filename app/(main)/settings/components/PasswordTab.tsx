"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { changePassword } from "@/redux/features/userSlice";

interface PasswordTabProps {
  onError: (msg: string) => void;
}

export default function PasswordTab({ onError }: PasswordTabProps) {
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.users);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    onError("");

    if (newPassword !== confirmPassword) {
      onError("Mật khẩu mới không trùng khớp!");
      return;
    }

    const res = await dispatch(changePassword({ oldPassword, newPassword }));
    if (changePassword.fulfilled.match(res)) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
          Mật khẩu cũ
        </label>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-4 py-3 text-white focus:border-cyan-400 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
          Mật khẩu mới
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-4 py-3 text-white focus:border-cyan-400 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
          Xác nhận mật khẩu mới
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-4 py-3 text-white focus:border-cyan-400 outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 py-3.5 font-semibold text-white hover:opacity-90 transition active:scale-98 disabled:opacity-50"
      >
        {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
      </button>
    </form>
  );
}
