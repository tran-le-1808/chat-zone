"use client";

import { useState } from "react";
import { Loader2, Mail, Save, UserRound } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { editProfile } from "@/redux/features/userSlice";
import { getProfile } from "@/redux/features/authSlice";
import AvatarUpload from "@/components/common/AvatarUpload";
import IconInput from "@/components/ui/IconInput";
import { ui } from "@/components/ui/styles";

export default function ProfileTab() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { loading } = useAppSelector((state) => state.users);

  const [name, setName] = useState(user?.name || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(editProfile({ name, file: selectedFile }));
    if (editProfile.fulfilled.match(result)) {
      dispatch(getProfile());
    }
  };

  return (
    <form onSubmit={handleUpdateProfile} className="space-y-5">
      <AvatarUpload
        currentAvatar={user?.avatar}
        name={user?.name}
        onFileSelect={(file) => setSelectedFile(file)}
      />

      <IconInput
        label="Email (không thể thay đổi)"
        icon={Mail}
        type="email"
        name="email"
        value={user?.email || ""}
        disabled
        readOnly
      />

      <IconInput
        label="Tên hiển thị"
        icon={UserRound}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên của bạn"
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
          <Save className="h-5 w-5" />
        )}
        {loading ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
