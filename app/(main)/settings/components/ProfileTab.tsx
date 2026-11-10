"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { editProfile } from "@/redux/features/userSlice";
import AvatarUpload from "@/components/common/AvatarUpload";
import { getProfile } from "@/redux/features/authSlice";

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
      {/* COMPONENT UPLOAD AVATAR KÉO THẢ */}
      <AvatarUpload
        currentAvatar={user?.avatar}
        name={user?.name}
        onFileSelect={(file) => setSelectedFile(file)}
      />

      {/* EMAIL (READ-ONLY) */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
          Gmail (Không thể thay đổi)
        </label>
        <input
          type="email"
          value={user?.email || ""}
          disabled
          className="w-full rounded-2xl border border-white/10 bg-[#262a40] px-4 py-3 text-gray-400 cursor-not-allowed outline-none"
        />
      </div>

      {/* NAME */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
          Họ và Tên
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-4 py-3 text-white focus:border-cyan-400 outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 py-3.5 font-semibold text-white hover:opacity-90 transition active:scale-98 disabled:opacity-50"
      >
        {loading ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
