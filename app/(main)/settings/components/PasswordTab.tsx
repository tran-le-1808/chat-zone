"use client";

import { useState } from "react";
import { KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { changePassword } from "@/redux/features/userSlice";
import IconInput from "@/components/ui/IconInput";
import { ui } from "@/components/ui/styles";

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
      <IconInput
        label="Mật khẩu hiện tại"
        icon={Lock}
        type="password"
        name="oldPassword"
        autoComplete="current-password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
        required
      />
      <IconInput
        label="Mật khẩu mới"
        icon={KeyRound}
        type="password"
        name="newPassword"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />
      <IconInput
        label="Xác nhận mật khẩu mới"
        icon={ShieldCheck}
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      <button
        type="submit"
        disabled={loading}
        className={`${ui.btnPrimary} w-full`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ShieldCheck className="h-5 w-5" />
        )}
        {loading ? "Đang xử lý…" : "Cập nhật mật khẩu"}
      </button>
    </form>
  );
}
