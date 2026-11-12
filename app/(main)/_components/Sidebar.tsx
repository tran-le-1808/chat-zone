"use client";

import { useAppSelector } from "@/redux/hooks";
import { Conversation } from "@/types/chat";
import { relativeTimeVi } from "@/lib/timeVi";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  Bot,
  ChevronDown,
  MessageSquarePlus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

interface SidebarProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  hasMore: boolean;
  onSelectConversation: (conversation: Conversation) => void;
  onSearch: (keyword: string) => void;
  onLoadMore: () => void;
  onNewChat: () => void;
  onCreateGroup: () => void;
  onSelectAiChat?: () => void;
}

export default function Sidebar({
  conversations,
  selectedConversationId,
  hasMore,
  onSelectConversation,
  onSearch,
  onLoadMore,
  onNewChat,
  onCreateGroup,
  onSelectAiChat,
}: SidebarProps) {
  const { user } = useAppSelector((state) => state.auth);
  const { onlineUsers } = useAppSelector((state) => state.users);
  const isAiSelected = selectedConversationId === "ai-chat";

  return (
    <div className="flex h-full w-full flex-col border-r border-white/10 bg-[#11132a]/80 backdrop-blur-md">
      {/* TIÊU ĐỀ + TÌM KIẾM + HÀNH ĐỘNG */}
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">
            Tin nhắn
            <span className="ml-2 rounded-full bg-[#f4b942]/15 px-2 py-0.5 text-xs font-bold text-[#f4b942]">
              {conversations.length}
            </span>
          </h2>
        </div>

        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition focus-within:border-[#f4b942]/60 focus-within:shadow-[0_0_0_3px_rgba(244,185,66,0.12)]">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            placeholder="Tìm cuộc trò chuyện…"
            onChange={(e) => onSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-3 py-2.5 text-sm font-bold shadow-[0_4px_0_#7f1118] transition active:translate-y-[3px] active:shadow-none"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Trò chuyện
          </button>
          <button
            type="button"
            onClick={onCreateGroup}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#f4b942]/40 bg-[#f4b942]/10 px-3 py-2.5 text-sm font-bold text-[#ffd166] shadow-[0_4px_0_rgba(244,185,66,0.25)] transition hover:bg-[#f4b942]/20 active:translate-y-[3px] active:shadow-none"
          >
            <Users className="h-4 w-4" />
            Tạo nhóm
          </button>
        </div>
      </div>

      {/* DANH SÁCH */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-4 sm:px-3">
        {/* GEMINI AI (luôn ở đầu) */}
        <button
          type="button"
          onClick={onSelectAiChat}
          className={`group relative w-full overflow-hidden rounded-2xl p-3 text-left transition ${
            isAiSelected
              ? "bg-linear-to-r from-[#0f766e] to-[#14b8a6] shadow-[0_0_22px_rgba(20,184,166,0.45)]"
              : "border border-teal-400/25 bg-teal-400/[0.06] hover:border-teal-300/50 hover:bg-teal-400/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  isAiSelected
                    ? "bg-white/20"
                    : "bg-linear-to-br from-[#0f766e] to-[#2dd4bf]"
                }`}
              >
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-[#11132a] bg-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-bold">Gemini AI</h3>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isAiSelected
                      ? "bg-white/20"
                      : "bg-teal-400/15 text-teal-200"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  Trợ lý
                </span>
              </div>
              <p
                className={`truncate text-sm ${isAiSelected ? "text-white/90" : "text-teal-100/60"}`}
              >
                Hỏi tôi bất kỳ điều gì…
              </p>
            </div>
          </div>
        </button>

        <div className="mx-2 my-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          Hội thoại
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {conversations.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Chưa có cuộc trò chuyện nào.
            <br />
            Bấm “Trò chuyện” để bắt đầu nhé!
          </p>
        )}

        {conversations.map((conversation) => {
          const isSelected = selectedConversationId === conversation._id;
          const mySetting = conversation.participantsSettings?.find(
            (setting) => setting.userId === user?._id,
          );
          const unreadCount = mySetting?.unreadCount || 0;
          const hasUnread = unreadCount > 0 && !isSelected;

          // Người trò chuyện cùng (hội thoại 1-1)
          const otherUser = conversation.isGroup
            ? null
            : conversation.participants?.find((p) => p._id !== user?._id);
          const displayName = conversation.isGroup
            ? conversation.groupName
            : otherUser?.name;
          const avatarUrl = conversation.isGroup
            ? conversation.groupAvatar
            : otherUser?.avatar;
          const online = otherUser
            ? onlineUsers.includes(otherUser._id)
            : undefined;

          return (
            <button
              type="button"
              key={conversation._id}
              onClick={() => onSelectConversation(conversation)}
              className={`group relative w-full rounded-2xl p-3 text-left transition ${
                isSelected
                  ? "bg-linear-to-r from-[#c81d25]/90 to-[#e8772e]/80 shadow-[0_0_20px_rgba(232,119,46,0.35)]"
                  : "hover:-translate-y-px hover:bg-white/[0.05]"
              }`}
            >
              {isSelected && (
                <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#ffd166] shadow-[0_0_10px_#ffd166]" />
              )}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <UserAvatar
                    name={displayName}
                    src={avatarUrl}
                    size={48}
                    online={online}
                    ringClassName={
                      isSelected ? "border-[#d9472b]" : "border-[#11132a]"
                    }
                  />
                  {conversation.isGroup && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#11132a] bg-[#f4b942] text-[#3b2400]">
                      <Users className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`truncate ${hasUnread ? "font-extrabold text-white" : "font-semibold text-white/90"}`}
                    >
                      {displayName}
                    </h3>
                    <span
                      className={`shrink-0 text-[11px] ${isSelected ? "text-white/80" : hasUnread ? "font-bold text-[#ffd166]" : "text-slate-500"}`}
                    >
                      {relativeTimeVi(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-sm ${
                        isSelected
                          ? "text-white/85"
                          : hasUnread
                            ? "font-semibold text-white"
                            : "text-slate-400"
                      }`}
                    >
                      {conversation.lastMessage || "Chưa có tin nhắn"}
                    </p>
                    {hasUnread && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#ffd166] px-1.5 text-[11px] font-extrabold text-[#3b2400] shadow-[0_0_10px_rgba(255,209,102,0.6)]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronDown className="h-4 w-4" />
            Tải thêm
          </button>
        )}
      </div>
    </div>
  );
}
