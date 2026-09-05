"use client";

import Image from "next/image";
import { useAppSelector } from "@/redux/hooks";
import { Conversation } from "@/types/chat";

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
  const isAiSelected = selectedConversationId === "ai-chat";

  return (
    <div className="flex h-full w-full flex-col border-r border-white/10 bg-[#23263a] md:w-[320px] xl:w-[350px]">
      {/* SEARCH */}
      <div className="space-y-3 p-4">
        <input
          placeholder="Search chat..."
          onChange={(e) => onSearch(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-[#2b2f46] px-4 py-3 text-white outline-none placeholder:text-gray-400 focus:border-cyan-400"
        />

        <div className="flex gap-2">
          <button
            onClick={onNewChat}
            className="flex-1 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            New Chat
          </button>

          <button
            onClick={onCreateGroup}
            className="flex-1 rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-600"
          >
            Group
          </button>
        </div>
      </div>

      {/* CHAT LIST */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {/* ==================== AI CHAT ITEM (FIXED AT TOP) ==================== */}
        <div
          onClick={onSelectAiChat}
          className={`group cursor-pointer rounded-2xl p-4 transition ${
            isAiSelected
              ? "bg-gradient-to-r from-cyan-400 to-purple-500 shadow-lg"
              : "border border-cyan-500/20 bg-[#2b2f46] hover:border-cyan-500/50 hover:bg-[#353a55]"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${
                  isAiSelected
                    ? "bg-white/20 text-white"
                    : "bg-gradient-to-tr from-cyan-400 to-purple-500 text-white"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-7 w-7"
                >
                  <path d="M12 2a1 1 0 011 1v1.053a8.002 8.002 0 017 7.947v1.5a1 1 0 01-1 1h-1v2a4 4 0 01-4 4h-4a4 4 0 01-4-4v-2H5a1 1 0 01-1-1v-1.5a8.002 8.002 0 017-7.947V3a1 1 0 011-1zM9 11a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                </svg>
              </div>

              <div className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-[#23263a] bg-cyan-400" />
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-lg font-semibold text-white">
                  Gemini AI
                </h3>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isAiSelected
                      ? "bg-white/20 text-white"
                      : "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
                  }`}
                >
                  Bot
                </span>
              </div>

              <p
                className={`truncate text-sm ${
                  isAiSelected ? "text-white/90" : "text-cyan-200/70"
                }`}
              >
                Hỏi tôi bất kỳ điều gì...
              </p>
            </div>
          </div>
        </div>

        <div className="my-2 border-b border-white/5" />

        {/* ==================== NORMAL CONVERSATIONS ==================== */}
        {conversations.map((conversation) => {
          const isSelected = selectedConversationId === conversation._id;

          const mySetting = conversation.participantsSettings?.find(
            (setting) => setting.userId === user?._id,
          );

          const unreadCount = mySetting?.unreadCount || 0;
          const hasUnread = unreadCount > 0;

          // Xử lý lấy người trò chuyện cùng nếu không phải nhóm
          const otherUser = conversation.isGroup
            ? null
            : conversation.participants?.find((p) => p._id !== user?._id);

          // Lấy Tên hiển thị
          const displayName = conversation.isGroup
            ? conversation.groupName
            : otherUser?.name;

          // Lấy Avatar
          const avatarUrl = conversation.isGroup
            ? conversation.groupAvatar
            : otherUser?.avatar;

          return (
            <div
              key={conversation._id}
              onClick={() => onSelectConversation(conversation)}
              className={`cursor-pointer rounded-2xl p-4 transition ${
                isSelected
                  ? "bg-gradient-to-r from-cyan-400 to-purple-500 shadow-lg"
                  : "bg-[#2b2f46] hover:bg-[#353a55]"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* AVATAR CONTAINER */}
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/10">
                      <Image
                        src={avatarUrl}
                        alt={displayName || "Avatar"}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white">
                      {displayName?.charAt(0)?.toUpperCase()}
                    </div>
                  )}

                  {/* UNREAD DOT INDICATION */}
                  {hasUnread && !isSelected && (
                    <div className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-[#23263a] bg-rose-500 animate-pulse" />
                  )}
                </div>

                {/* TEXT CONTENT */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`truncate text-lg ${
                        hasUnread && !isSelected
                          ? "font-bold text-white"
                          : "font-semibold text-white/90"
                      }`}
                    >
                      {displayName}
                    </h3>

                    {/* BADGE CHƯA ĐỌC */}
                    {hasUnread && (
                      <span
                        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white shadow ${
                          isSelected ? "bg-white/30" : "bg-rose-500"
                        }`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>

                  <p
                    className={`truncate text-sm ${
                      isSelected
                        ? "text-white/90"
                        : hasUnread
                          ? "font-bold text-white"
                          : "text-gray-400"
                    }`}
                  >
                    {conversation.lastMessage || "Chưa có tin nhắn"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full rounded-xl bg-[#2b2f46] py-3 text-white transition hover:bg-[#353a55]"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
