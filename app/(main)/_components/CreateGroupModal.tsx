"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useDebounce from "@/hooks/useDebounce";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { searchUsers, SearchUser } from "@/redux/features/userSlice";
import {
  createGroup,
  setSelectedConversation,
} from "@/redux/features/chatSlice";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateGroupModal({
  open,
  onClose,
}: CreateGroupModalProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const { users, loading } = useAppSelector((state) => state.users);
  const { user } = useAppSelector((state) => state.auth);
  const { creatingGroup } = useAppSelector((state) => state.chat);

  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Hàm handleClose dùng để reset state và đóng modal
  const handleClose = () => {
    setGroupName("");
    setSearch("");
    setSelectedUsers([]);
    setErrorMsg(null);
    onClose();
  };

  // Fetch danh sách user tương tự NewChatModal
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

  const handleToggleSelectUser = (selectedUser: SearchUser) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === selectedUser._id);
      if (exists) {
        return prev.filter((u) => u._id !== selectedUser._id);
      } else {
        return [...prev, selectedUser];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setErrorMsg("Vui lòng nhập tên nhóm!");
      return;
    }

    if (selectedUsers.length < 2) {
      setErrorMsg("Vui lòng chọn từ 2 thành viên trở lên!");
      return;
    }

    if (!user?._id) {
      setErrorMsg("Không tìm thấy thông tin tài khoản hiện tại!");
      return;
    }

    setErrorMsg(null);

    // Tạo payload JSON khớp với Backend DTO
    const payload = {
      adminId: user._id,
      groupName: groupName.trim(),
      participants: selectedUsers.map((u) => u._id),
    };

    try {
      const resultAction = await dispatch(createGroup(payload));

      if (createGroup.fulfilled.match(resultAction)) {
        const newGroup = resultAction.payload;
        dispatch(setSelectedConversation(newGroup));
        router.push(`/?conversationId=${newGroup._id}`);
        handleClose();
      } else {
        setErrorMsg((resultAction.payload as string) || "Tạo nhóm thất bại!");
      }
    } catch {
      setErrorMsg("Có lỗi xảy ra, vui lòng thử lại!");
    }
  };

  const displayedUsers = users.slice(0, 10);
  const isButtonDisabled =
    creatingGroup || selectedUsers.length < 2 || !groupName.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#23263a] shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-2xl font-bold text-white">Create Group</h2>

          <button
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* FORM BODY */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-2xl bg-red-500/80 p-3 text-center text-sm text-white">
              {errorMsg}
            </div>
          )}

          {/* Group Name Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Group Name
            </label>
            <input
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-5 py-3.5 text-white outline-none placeholder:text-gray-400 focus:border-cyan-400"
            />
          </div>

          {/* Search User Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Add Members (Selected: {selectedUsers.length})
            </label>
            <input
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-5 py-3.5 text-white outline-none placeholder:text-gray-400 focus:border-cyan-400"
            />
          </div>

          {/* Selected Users Chips */}
          {selectedUsers.length > 0 && (
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pt-1">
              {selectedUsers.map((u) => (
                <span
                  key={u._id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300"
                >
                  {u.name}
                  <button
                    type="button"
                    onClick={() => handleToggleSelectUser(u)}
                    className="hover:text-white"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Users List */}
          <div className="h-[260px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <>
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl bg-[#2b2f46] p-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 rounded bg-white/10" />
                        <div className="h-3 w-44 rounded bg-white/5" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : displayedUsers.length ? (
              displayedUsers.map((item) => {
                const isSelected = selectedUsers.some(
                  (u) => u._id === item._id,
                );
                return (
                  <div
                    key={item._id}
                    onClick={() => handleToggleSelectUser(item)}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl p-3.5 transition ${
                      isSelected
                        ? "border border-cyan-400 bg-cyan-500/10"
                        : "bg-[#2b2f46] hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 font-bold text-white">
                        {item.avatar ? (
                          <Image
                            src={item.avatar}
                            alt={item.name}
                            width={44}
                            height={44}
                            unoptimized
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          item.name.charAt(0)
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-white">
                          {item.name}
                        </h3>
                        <p className="text-xs text-gray-400">{item.email}</p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="h-4 w-4 cursor-pointer accent-cyan-400"
                    />
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-gray-400">
                No users found
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-white/10 p-6">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl px-5 py-2.5 font-semibold text-gray-300 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isButtonDisabled}
            onClick={handleCreateGroup}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-6 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creatingGroup ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
