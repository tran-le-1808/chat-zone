"use client";

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
}: SidebarProps) {
  const { user } = useAppSelector((state) => state.auth);
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
            className="flex-1 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-white"
          >
            New Chat
          </button>

          <button
            onClick={onCreateGroup}
            className="flex-1 rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Group
          </button>
        </div>
      </div>

      {/* CHAT LIST */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {conversations.map((conversation) => {
          const mySetting = conversation.participantsSettings?.find(
            (setting) => setting.userId === user?._id,
          );

          const hasUnread = (mySetting?.unreadCount || 0) > 0;

          return (
            <div
              key={conversation._id}
              onClick={() => onSelectConversation(conversation)}
              className={`cursor-pointer rounded-2xl p-4 transition ${
                selectedConversationId === conversation._id
                  ? "bg-gradient-to-r from-cyan-400 to-purple-500 shadow-lg"
                  : "bg-[#2b2f46] hover:bg-[#353a55]"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white">
                    {(conversation.groupName || "C").charAt(0)}
                  </div>

                  {/* GREEN DOT */}
                  {hasUnread && (
                    <div className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-[#23263a] bg-green-400" />
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-lg font-semibold text-white">
                      {conversation.groupName}
                    </h3>

                    {hasUnread && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-green-400 px-2 text-xs font-bold text-white">
                        {mySetting?.unreadCount}
                      </span>
                    )}
                  </div>

                  <p
                    className={`truncate text-sm ${
                      hasUnread ? "font-semibold text-white" : "text-gray-300"
                    }`}
                  >
                    {conversation.lastMessage}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full rounded-xl bg-[#2b2f46] py-3 text-white hover:bg-[#353a55]"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
