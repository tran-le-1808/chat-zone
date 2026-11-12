"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import ChatArea from "./_components/ChatArea";
import RightSidebar from "./_components/RightSidebar";
import Sidebar from "./_components/Sidebar";
import NewChatModal from "./_components/NewChatModal";
import CreateGroupModal from "./_components/CreateGroupModal";

import {
  getConversations,
  getMessages,
  setSelectedConversation,
  setSelectedUser,
  updateConversationFromSocket,
  addConversationFromSocket,
} from "@/redux/features/chatSlice";
import {
  getAIConversations,
  createAIConversation,
  getAIMessages,
  setSelectedAIConversation,
} from "@/redux/features/aiSlice";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import useDebounce from "@/hooks/useDebounce";
import { socket } from "@/lib/socket"; // Import instance socket từ lib của bạn
import { Conversation, Message } from "@/types/chat";
import { goToConversation } from "@/lib/chatNav";

function HomeContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();

  const conversationId = searchParams.get("conversationId");
  const isAiMode = conversationId === "ai-chat";

  // Chat Slice State
  const {
    conversations,
    messages,
    selectedConversation,
    hasMore,
    hasMoreMessages,
    nextCursor,
    loadingMoreMessages,
  } = useAppSelector((state) => state.chat);

  // AI Slice State
  const {
    messages: aiMessages,
    selectedConversation: selectedAiConversation,
    hasMoreMessages: aiHasMoreMessages,
    nextCursor: aiNextCursor,
    loadingMoreMessages: aiLoadingMoreMessages,
  } = useAppSelector((state) => state.ai);

  const { user } = useAppSelector((state) => state.auth);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [openNewChat, setOpenNewChat] = useState(false);
  const [openCreateGroup, setOpenCreateGroup] = useState(false);
  // Ngăn trượt thông tin hội thoại (màn hình < xl)
  const [infoOpen, setInfoOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  // 1. WEBSOCKET REALTIME SYNC (Tin nhắn mới & Tạo Group mới)
  useEffect(() => {
    if (!user?._id) return;

    if (!socket.connected) {
      socket.connect();
    }

    // Join room cá nhân để nhận thông báo realtime
    socket.emit("joinUserRoom", user._id);

    // Lắng nghe khi có tin nhắn mới gửi tới
    const handleNewMessage = (message: Message) => {
      dispatch(
        updateConversationFromSocket({
          conversationId: message.conversationId,
          lastMessage:
            message.text ||
            (message.attachments?.length ? "📎 Attachment" : ""),
          lastMessageAt: message.createdAt || new Date().toISOString(),
        }),
      );
    };

    // Lắng nghe khi có cuộc trò chuyện/nhóm mới được tạo
    const handleConversationUpdated = (data: {
      conversation?: Conversation;
      conversationId?: string;
    }) => {
      if (data.conversation) {
        dispatch(addConversationFromSocket(data.conversation));
      } else {
        // Nếu backend chỉ trả về ID, re-fetch lại danh sách cuộc trò chuyện
        dispatch(
          getConversations({
            userId: user._id,
            page: 1,
            limit: 10,
            search: "",
          }),
        );
      }
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("conversationUpdated", handleConversationUpdated);
    socket.on("newGroupCreated", handleConversationUpdated);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("conversationUpdated", handleConversationUpdated);
      socket.off("newGroupCreated", handleConversationUpdated);
    };
  }, [user?._id, dispatch]);

  // 2. LOAD AI CONVERSATIONS OR CREATE FIRST ONE
  useEffect(() => {
    if (!isAiMode) return;

    const initializeAiChat = async () => {
      const resultAction = await dispatch(getAIConversations());

      if (getAIConversations.fulfilled.match(resultAction)) {
        const conversationsList = resultAction.payload.conversations ?? [];

        if (conversationsList.length === 0) {
          const createAction = await dispatch(
            createAIConversation({ title: "AI Assistant" }),
          );

          if (createAIConversation.fulfilled.match(createAction)) {
            const newConv = createAction.payload;
            dispatch(setSelectedAIConversation(newConv));
            goToConversation(newConv._id, { replace: true });
          }
        } else {
          dispatch(setSelectedAIConversation(conversationsList[0]));
        }
      }
    };

    initializeAiChat();
  }, [isAiMode, dispatch]);

  // 3. FETCH AI MESSAGES
  useEffect(() => {
    if (selectedAiConversation?._id) {
      dispatch(getAIMessages(selectedAiConversation._id));
    }
  }, [selectedAiConversation?._id, dispatch]);

  // 4. REGULAR USER CONVERSATIONS ROUTE
  useEffect(() => {
    if (!conversationId || isAiMode) return;

    const conversation = conversations.find(
      (item) => item._id === conversationId,
    );

    if (conversation) {
      dispatch(setSelectedConversation(conversation));
    }
  }, [conversationId, conversations, isAiMode, dispatch]);

  // Fetch Normal Conversations
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

  // Auto-select first normal conversation
  useEffect(() => {
    if (!isAiMode && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(
        (item) => item._id === conversationId,
      );

      dispatch(setSelectedConversation(conversation || conversations[0]));
    }
  }, [conversations, selectedConversation, conversationId, isAiMode, dispatch]);

  // Người đang chat cùng (hội thoại 1-1)
  useEffect(() => {
    if (isAiMode || !selectedConversation || !user?._id) return;
    const otherUser = selectedConversation.isGroup
      ? null
      : selectedConversation.participants?.find(
          (participant) => participant._id !== user._id,
        );
    dispatch(setSelectedUser(otherUser ?? null));
  }, [dispatch, selectedConversation, user?._id, isAiMode]);

  // Fetch Normal Chat Messages & Join Socket Room
  // Chỉ chạy khi ID hội thoại đổi (không chạy lại mỗi khi object hội thoại được cập nhật
  // do tải lại danh sách / tin nhắn mới qua socket -> tránh gọi API thừa & phản hồi cũ ghi đè)
  const selectedConversationId = selectedConversation?._id;
  useEffect(() => {
    if (isAiMode || !selectedConversationId || !user?._id) return;

    // Join room conversation cụ thể
    socket.emit("joinConversation", selectedConversationId);

    dispatch(getMessages(selectedConversationId));
  }, [dispatch, selectedConversationId, user?._id, isAiMode]);

  return (
    <>
      <NewChatModal open={openNewChat} onClose={() => setOpenNewChat(false)} />
      <CreateGroupModal
        open={openCreateGroup}
        onClose={() => setOpenCreateGroup(false)}
      />
      {/* Điện thoại: hiện DANH SÁCH hoặc KHUNG CHAT (theo ?conversationId);
          từ md: danh sách + khung chat; xl: thêm cột thông tin */}
      <div className="flex h-full min-h-0 overflow-hidden">
        <div
          className={`${conversationId ? "hidden md:flex" : "flex"} h-full w-full shrink-0 md:w-[320px] xl:w-[350px]`}
        >
          <Sidebar
            conversations={conversations}
            selectedConversationId={
              isAiMode ? "ai-chat" : selectedConversation?._id
            }
            hasMore={hasMore}
            onSelectConversation={(conversation) => {
              setInfoOpen(false);
              goToConversation(conversation._id);
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
              setOpenCreateGroup(true);
            }}
            onSelectAiChat={() => {
              setInfoOpen(false);
              goToConversation("ai-chat");
            }}
          />
        </div>

        <div
          className={`${conversationId ? "flex" : "hidden md:flex"} h-full min-w-0 flex-1`}
        >
          <ChatArea
            messages={isAiMode ? aiMessages : messages}
            hasMoreMessages={isAiMode ? aiHasMoreMessages : hasMoreMessages}
            nextCursor={isAiMode ? aiNextCursor : nextCursor}
            loadingMoreMessages={
              isAiMode ? aiLoadingMoreMessages : loadingMoreMessages
            }
            isAI={isAiMode}
            onBack={() => {
              setInfoOpen(false);
              goToConversation(null);
            }}
            onOpenInfo={() => setInfoOpen(true)}
          />
        </div>

        <RightSidebar
          messages={isAiMode ? aiMessages : messages}
          isAI={isAiMode}
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
        />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
