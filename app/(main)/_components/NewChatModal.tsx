"use client";

import useDebounce from "@/hooks/useDebounce";
import { socket } from "@/lib/socket";
import {
  createConversation,
  setSelectedConversation,
  setSelectedUser,
} from "@/redux/features/chatSlice";
import { searchUsers } from "@/redux/features/userSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  MessageCircle,
  MessageSquarePlus,
  Search,
  UserSearch,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { goToConversation } from "@/lib/chatNav";

interface NewChatModalProps {
  open: boolean;

  onClose: () => void;
}

export default function NewChatModal({
  open,

  onClose,
}: NewChatModalProps) {
  const dispatch = useAppDispatch();

  const { users, loading } = useAppSelector((state) => state.users);
  const { user } = useAppSelector((state) => state.auth);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const onStartChat = async (selectedUserId: string) => {
    const selectedUser = users.find((u) => u._id === selectedUserId);

    if (!selectedUser) return;

    const result = await dispatch(
      createConversation({
        receiverId: selectedUserId,
      }),
    );

    if (createConversation.fulfilled.match(result)) {
      dispatch(setSelectedConversation(result.payload));

      dispatch(setSelectedUser(selectedUser));

      if (!socket.connected) {
        socket.connect();
      }

      socket.emit("joinConversation", result.payload._id);

      // Đồng bộ URL với hội thoại mới (tránh bị chọn lại hội thoại cũ theo URL;
      // trên điện thoại chuyển thẳng sang khung chat)
      goToConversation(result.payload._id);
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      dispatch(
        searchUsers({
          keyword: debouncedSearch,
          currentUserId: user?._id,
        }),
      );
    }
  }, [dispatch, open, debouncedSearch, user?._id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Trò chuyện mới"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#f4b942]/20 bg-[#11132a] shadow-2xl sm:rounded-3xl"
      >
        {/* TIÊU ĐỀ */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-[#c81d25] to-[#e8772e]">
              <MessageSquarePlus className="h-5 w-5" />
            </span>
            Trò chuyện mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TÌM KIẾM */}
        <div className="p-4">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 focus-within:border-[#f4b942]/60">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              placeholder="Tìm theo tên hoặc email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
        </div>

        {/* NGƯỜI DÙNG */}
        <div className="min-h-[240px] flex-1 space-y-2 overflow-y-auto px-4 pb-5">
          {loading ? (
            [1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="flex animate-pulse items-center gap-3 rounded-2xl bg-white/[0.03] p-3"
              >
                <div className="h-11 w-11 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-white/10" />
                  <div className="h-3 w-44 rounded bg-white/5" />
                </div>
              </div>
            ))
          ) : users.length ? (
            users.map((u) => (
              <div
                key={u._id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={u.name} src={u.avatar} size={44} />
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{u.name}</h3>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartChat(u._id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-3.5 py-2 text-sm font-bold shadow-[0_3px_0_#7f1118] transition active:translate-y-[2px] active:shadow-none"
                >
                  <MessageCircle className="h-4 w-4" />
                  Nhắn tin
                </button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-400">
              <UserSearch className="h-8 w-8 text-slate-500" />
              Không tìm thấy người dùng
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
