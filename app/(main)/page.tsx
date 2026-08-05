"use client";

import { useEffect, useState } from "react";

import ChatArea from "./_components/ChatArea";
import RightSidebar from "./_components/RightSidebar";
import Sidebar from "./_components/Sidebar";

import {
  getConversations,
  getMessages,
  setSelectedConversation,
  setSelectedUser,
} from "@/redux/features/chatSlice";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import NewChatModal from "./_components/NewChatModal";
import useDebounce from "@/hooks/useDebounce";
export default function Home() {
  const dispatch = useAppDispatch();

  const {
    conversations,
    messages,
    selectedConversation,
    hasMore,
    hasMoreMessages,
    nextCursor,
    loadingMoreMessages,
  } = useAppSelector((state) => state.chat);

  const { user } = useAppSelector((state) => state.auth);

  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [openNewChat, setOpenNewChat] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  //
  // LOAD CONVERSATIONS
  //
  useEffect(() => {
    if (!user?._id) return;
    dispatch(
      getConversations({
        userId: user._id,
        page,
        limit: 10,
        search: debouncedSearch,
      }),
    );
  }, [dispatch, user?._id, page, debouncedSearch]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      dispatch(setSelectedConversation(conversations[0]));
    }
  }, [conversations, selectedConversation, dispatch]);

  useEffect(() => {
    if (!selectedConversation?._id || !user?._id) return;

    const otherUser = selectedConversation.participants.find(
      (participant) => participant._id !== user._id,
    );

    if (otherUser) {
      dispatch(setSelectedUser(otherUser));
    }

    dispatch(getMessages(selectedConversation._id));
  }, [dispatch, selectedConversation, user?._id]);

  return (
    <>
      <NewChatModal open={openNewChat} onClose={() => setOpenNewChat(false)} />
      <div className="flex h-[calc(100vh-88px)] overflow-hidden bg-[#1f2235]">
        {/* SIDEBAR */}
        <div className="hidden md:block shrink-0">
          <Sidebar
            conversations={conversations}
            selectedConversationId={selectedConversation?._id}
            hasMore={hasMore}
            onSelectConversation={(conversation) => {
              dispatch(setSelectedConversation(conversation));
            }}
            onSearch={(keyword) => {
              setPage(1);

              setSearch(keyword);
            }}
            onLoadMore={() => {
              setPage((prev) => prev + 1);
            }}
            onNewChat={() => {
              setOpenNewChat(true);
            }}
            onCreateGroup={() => {
              console.log("CREATE GROUP");
            }}
          />
        </div>

        {/* CHAT AREA */}

        <ChatArea
          messages={messages}
          hasMoreMessages={hasMoreMessages}
          nextCursor={nextCursor}
          loadingMoreMessages={loadingMoreMessages}
        />

        {/* RIGHT SIDEBAR */}

        <RightSidebar />
      </div>
    </>
  );
}
