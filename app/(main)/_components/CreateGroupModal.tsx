"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  AlertCircle,
  Check,
  Loader2,
  Search,
  UserSearch,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import useDebounce from "@/hooks/useDebounce";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { searchUsers, SearchUser } from "@/redux/features/userSlice";
import {
  createGroup,
  setSelectedConversation,
} from "@/redux/features/chatSlice";
import { goToConversation } from "@/lib/chatNav";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateGroupModal({
  open,
  onClose,
}: CreateGroupModalProps) {
  const dispatch = useAppDispatch();

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
        goToConversation(newGroup._id);
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-label="Tạo nhóm"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#f4b942]/20 bg-[#11132a] shadow-2xl sm:rounded-3xl"
      >
        {/* TIÊU ĐỀ */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-[#b45309] to-[#facc15] text-[#3b2400]">
              <Users className="h-5 w-5" />
            </span>
            Tạo nhóm
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* NỘI DUNG */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#c81d25]/40 bg-[#c81d25]/15 p-3 text-sm text-[#ffb4a8]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">
              Tên nhóm
            </label>
            <input
              placeholder="VD: Hội bạn thân Sài Gòn"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#f4b942]/60"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-300">
              Thêm thành viên
              <span className="rounded-full bg-[#f4b942]/15 px-2 py-0.5 text-xs font-bold text-[#ffd166]">
                Đã chọn {selectedUsers.length}
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 focus-within:border-[#f4b942]/60">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                placeholder="Tìm theo tên hoặc email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {selectedUsers.map((u) => (
                <span
                  key={u._id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#f4b942]/30 bg-[#f4b942]/10 py-1 pl-1 pr-2 text-xs font-semibold text-[#ffd166]"
                >
                  <UserAvatar name={u.name} src={u.avatar} size={20} />
                  {u.name}
                  <button
                    type="button"
                    aria-label={`Bỏ ${u.name}`}
                    onClick={() => handleToggleSelectUser(u)}
                    className="rounded-full p-0.5 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex animate-pulse items-center gap-3 rounded-2xl bg-white/[0.03] p-3"
                >
                  <div className="h-10 w-10 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-white/10" />
                    <div className="h-3 w-44 rounded bg-white/5" />
                  </div>
                </div>
              ))
            ) : displayedUsers.length ? (
              displayedUsers.map((item) => {
                const isSelected = selectedUsers.some(
                  (u) => u._id === item._id,
                );
                return (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => handleToggleSelectUser(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition ${
                      isSelected
                        ? "border border-[#f4b942]/60 bg-[#f4b942]/10"
                        : "border border-transparent bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        name={item.name}
                        src={item.avatar}
                        size={40}
                      />
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{item.name}</h3>
                        <p className="truncate text-xs text-slate-400">
                          {item.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                        isSelected
                          ? "border-[#f4b942] bg-[#f4b942] text-[#3b2400]"
                          : "border-white/20"
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      )}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-400">
                <UserSearch className="h-8 w-8 text-slate-500" />
                Không tìm thấy người dùng
              </div>
            )}
          </div>
        </div>

        {/* NÚT */}
        <div className="flex gap-2 border-t border-white/10 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl px-4 py-2.5 font-semibold text-slate-300 transition hover:bg-white/10 sm:flex-none"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={isButtonDisabled}
            onClick={handleCreateGroup}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-5 py-2.5 font-bold shadow-[0_3px_0_#7f1118] transition active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto sm:flex-none"
          >
            {creatingGroup ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UsersRound className="h-4 w-4" />
            )}
            {creatingGroup ? "Đang tạo…" : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}
