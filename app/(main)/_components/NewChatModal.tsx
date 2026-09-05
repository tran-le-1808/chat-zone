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
import Image from "next/image";
import { useEffect, useState } from "react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#23263a] shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">New Chat</h2>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* SEARCH */}
        <div className="p-6">
          <input
            placeholder="Search user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-5 py-4 text-white outline-none placeholder:text-gray-400 focus:border-cyan-400"
          />
        </div>

        {/* USERS */}
        <div className="h-[400px] space-y-3 overflow-y-auto px-6 pb-6">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl bg-[#2b2f46] p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-white/10" />

                    <div className="flex-1">
                      <div className="h-5 w-40 rounded bg-white/10" />

                      <div className="mt-2 h-4 w-56 rounded bg-white/5" />
                    </div>

                    <div className="h-10 w-20 rounded-xl bg-white/10" />
                  </div>
                </div>
              ))}
            </>
          ) : users.length ? (
            users.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between rounded-2xl bg-[#2b2f46] p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 font-bold text-white">
                    {user.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={user.name}
                        width={44}
                        height={44}
                        unoptimized
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {user.name}
                    </h3>

                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => onStartChat(user._id)}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-5 py-2 font-semibold text-white transition hover:opacity-90"
                >
                  Chat
                </button>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-gray-400">
              No users found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
