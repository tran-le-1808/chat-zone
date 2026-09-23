"use client";

import {
  addMessage,
  loadMoreMessages,
  sendMessage,
} from "@/redux/features/chatSlice";

import {
  AIMessage,
  addAIMessage,
  loadMoreAIMessages,
  sendAIMessage,
  aiMessageStart,
  aiMessageChunk,
  aiMessageComplete,
  aiMessageError,
} from "@/redux/features/aiSlice";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { socket } from "@/lib/socket";
import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Attachment, Message, MessageType } from "@/types/chat";
import ImagePreviewModal from "./ImagePreviewModal";

interface ChatAreaProps {
  messages: AIMessage[] | Message[];
  hasMoreMessages: boolean;
  nextCursor: string | null;
  loadingMoreMessages: boolean;
  isAI: boolean;
}

export default function ChatArea({
  messages,
  hasMoreMessages,
  nextCursor,
  loadingMoreMessages,
  isAI,
}: ChatAreaProps) {
  const dispatch = useAppDispatch();

  // Redux Normal Chat State
  const {
    selectedConversation,
    selectedUser,
    sending: chatSending,
  } = useAppSelector((state) => state.chat);

  // Redux AI State
  const {
    selectedConversation: selectedAiConversation,
    sending: aiSending,
    streaming,
    streamingMessage,
    streamingConversationId,
  } = useAppSelector((state) => state.ai);

  const { user } = useAppSelector((state) => state.auth);
  const { onlineUsers } = useAppSelector((state) => state.users);

  const activeSending = isAI ? aiSending || streaming : chatSending;
  const activeConversationId = isAI
    ? selectedAiConversation?._id
    : selectedConversation?._id;

  const isOnline = onlineUsers.includes(selectedUser?._id || "");

  const [text, setText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldKeepScrollPositionRef = useRef(false);

  // SOCKET: Join conversation (User-to-user)
  useEffect(() => {
    if (isAI || !selectedConversation?._id) return;
    socket.emit("joinConversation", selectedConversation._id);
  }, [isAI, selectedConversation?._id]);

  useEffect(() => {
    if (isAI) return;

    const handleNewMessage = (message: Message) => {
      if (message.senderId === user?._id) return;
      dispatch(addMessage(message));
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [isAI, dispatch, user?._id]);

  // SOCKET: AI Streaming Listeners
  useEffect(() => {
    if (!isAI) return;

    const handleStart = (data: { conversationId: string }) => {
      dispatch(aiMessageStart(data));
    };

    const handleChunk = (data: { conversationId: string; chunk: string }) => {
      dispatch(aiMessageChunk(data));
    };

    const handleComplete = (data: {
      conversationId: string;
      message?: AIMessage;
    }) => {
      console.log("🚀 ~ aiMessageComplete received:", data);
      dispatch(aiMessageComplete(data));
    };

    const handleError = (data: {
      conversationId?: string;
      message: string;
    }) => {
      console.error("🚀 ~ aiMessageError received:", data);
      dispatch(aiMessageError(data));
    };

    socket.on("aiMessageStart", handleStart);
    socket.on("aiMessageChunk", handleChunk);
    socket.on("aiMessageComplete", handleComplete);
    socket.on("aiMessageError", handleError);

    return () => {
      socket.off("aiMessageStart", handleStart);
      socket.off("aiMessageChunk", handleChunk);
      socket.off("aiMessageComplete", handleComplete);
      socket.off("aiMessageError", handleError);
    };
  }, [isAI, dispatch]);

  // SCROLL TO BOTTOM
  useEffect(() => {
    if (!messages.length && !streamingMessage) return;

    if (shouldKeepScrollPositionRef.current) {
      shouldKeepScrollPositionRef.current = false;
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }, [messages, streamingMessage]);

  // LOAD MORE MESSAGES
  const handleLoadMore = async () => {
    const container = messagesContainerRef.current;

    if (
      !container ||
      !activeConversationId ||
      !hasMoreMessages ||
      !nextCursor ||
      loadingMoreMessages
    ) {
      return;
    }

    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    shouldKeepScrollPositionRef.current = true;

    if (isAI) {
      await dispatch(
        loadMoreAIMessages({
          conversationId: activeConversationId,
          before: nextCursor,
        }),
      );
    } else {
      await dispatch(
        loadMoreMessages({
          conversationId: activeConversationId,
          before: nextCursor,
        }),
      );
    }

    requestAnimationFrame(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop =
        newScrollHeight - previousScrollHeight + previousScrollTop;
    });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearTop = container.scrollTop <= 100;
    if (isNearTop && hasMoreMessages && !loadingMoreMessages) {
      handleLoadMore();
    }
  };

  const onClickImage = (
    message: Message | AIMessage,
    attachment: Attachment,
  ) => {
    const allImages =
      message.attachments
        ?.filter((item: Attachment) => item.type.startsWith("image"))
        .map(
          (item: Attachment) => `${process.env.NEXT_PUBLIC_API_URL}${item.url}`,
        ) || [];

    const clickedIndex = allImages.findIndex(
      (img) => img === `${process.env.NEXT_PUBLIC_API_URL}${attachment.url}`,
    );

    setPreviewImages(allImages);
    setPreviewIndex(clickedIndex);
    setPreviewOpen(true);
  };

  const handleSelectFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const imageFiles: File[] = [];
    const videoFiles: File[] = [];
    const normalFiles: File[] = [];

    selectedFiles.forEach((file) => {
      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      } else if (file.type.startsWith("video/")) {
        videoFiles.push(file);
      } else {
        normalFiles.push(file);
      }
    });

    setImages((prev) => [...prev, ...imageFiles]);
    setVideos((prev) => [...prev, ...videoFiles]);
    setFiles((prev) => [...prev, ...normalFiles]);
  };

  // SEND MESSAGE
  const handleSend = async () => {
    const contentText = text.trim();
    if (!contentText && !images.length && !videos.length && !files.length) {
      return;
    }

    if (!activeConversationId || !user?._id) {
      return;
    }

    //
    // AI CHAT FLOW
    //
    if (isAI) {
      // Clear input form
      setText("");
      setImages([]);
      setVideos([]);
      setFiles([]);

      // Kiểm tra nếu Socket đang kết nối -> Dùng Streaming qua Socket
      if (socket.connected) {
        // 1. Thêm tin nhắn của User vào giao diện UI
        const userTempMsg: AIMessage = {
          _id: `temp-user-${Date.now()}`,
          conversationId: activeConversationId,
          senderId: user._id,
          text: contentText,
          attachments: [],
          createdAt: new Date().toISOString(),
        };
        dispatch(addAIMessage(userTempMsg));

        // 2. Bắn event lên Server Socket
        socket.emit("aiMessage", {
          conversationId: activeConversationId,
          content: contentText,
        });
      } else {
        // Fallback: Nếu Socket không kết nối -> Gọi HTTP API
        try {
          await dispatch(
            sendAIMessage({
              conversationId: activeConversationId,
              content: contentText,
            }),
          ).unwrap();
        } catch (error) {
          console.error("AI Send API Error:", error);
        }
      }
      return;
    }

    //
    // NORMAL CHAT FLOW
    //
    const formData = new FormData();
    formData.append("senderId", user._id);
    formData.append("conversationId", activeConversationId);
    formData.append("text", text);

    if (selectedUser?._id) {
      formData.append("receiverId", selectedUser._id);
    }

    let type: MessageType = MessageType.TEXT;
    const hasMedia = images.length > 0 || videos.length > 0 || files.length > 0;

    if (text.trim() && hasMedia) {
      type = MessageType.MIXED;
    } else if (images.length > 0) {
      type = MessageType.IMAGE;
    } else if (videos.length > 0) {
      type = MessageType.VIDEO;
    } else if (files.length > 0) {
      type = MessageType.FILE;
    }

    formData.append("type", type);

    [...images, ...videos, ...files].forEach((file) => {
      formData.append("files", file);
    });

    try {
      await dispatch(sendMessage(formData));
      setText("");
      setImages([]);
      setVideos([]);
      setFiles([]);
    } catch (error) {
      console.error("Normal Send Error:", error);
    }
  };

  return (
    <div className="flex flex-col bg-[#262a40] w-full xl:max-w-[calc(100vw-640px)]">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-8 md:py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-lg font-bold text-white">
            {isAI ? "🤖" : selectedConversation?.groupName?.charAt(0) || "U"}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">
              {isAI
                ? selectedAiConversation?.title || "AI Assistant"
                : selectedConversation?.groupName}
            </h2>

            <p
              className={`text-sm ${
                isAI
                  ? "text-cyan-400"
                  : isOnline
                    ? "text-green-400"
                    : "text-gray-400"
              }`}
            >
              {isAI ? "Always active" : isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>

      {/* MESSAGES LIST */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 space-y-6 overflow-y-auto p-4 md:p-8 pb-0 md:pb-0"
      >
        {loadingMoreMessages && (
          <div className="py-2 text-center text-sm text-gray-400">
            Loading older messages...
          </div>
        )}
        {messages.map((message) => {
          const isMe = message.senderId === user?._id;

          return (
            <div
              key={message._id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-3xl px-3 py-2 text-white ${
                  isMe ? "bg-blue-800" : "bg-[#323751]"
                }`}
              >
                {/* TEXT */}
                {message.text && (
                  <p className="whitespace-pre-wrap">{message.text}</p>
                )}

                {/* ATTACHMENTS */}
                {!!message.attachments?.length && (
                  <div className="gap-2 flex flex-wrap items-center mt-2">
                    {message.attachments.map(
                      (attachment: Attachment, index: number) => {
                        if (attachment.type.startsWith("image")) {
                          const fileUrl = `${process.env.NEXT_PUBLIC_API_URL}${attachment.url}`;
                          return (
                            <div
                              className="relative h-20 w-20 overflow-hidden rounded-lg"
                              key={index}
                            >
                              <Image
                                src={fileUrl}
                                alt={attachment.name || "image"}
                                fill
                                className="cursor-pointer object-cover shadow hover:opacity-80"
                                unoptimized
                                onClick={() =>
                                  onClickImage(message, attachment)
                                }
                              />
                            </div>
                          );
                        }

                        if (attachment.type.startsWith("video")) {
                          return (
                            <video
                              key={index}
                              controls
                              className="max-w-full rounded-2xl hover:opacity-80"
                            >
                              <source
                                src={`${process.env.NEXT_PUBLIC_API_URL}${attachment.url}`}
                                type={attachment.type}
                              />
                            </video>
                          );
                        }

                        return (
                          <a
                            key={index}
                            href={`${process.env.NEXT_PUBLIC_API_URL}${attachment.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-white/10 p-3 text-sm hover:opacity-80 flex items-center"
                          >
                            📄 {attachment.name}
                          </a>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* STREAMING AI MESSAGE */}
        {isAI && streamingConversationId === activeConversationId && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-3xl bg-[#323751] px-4 py-3 text-white">
              <p className="whitespace-pre-wrap">
                {streamingMessage}
                <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse" />
              </p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* PREVIEW ATTACHMENTS */}
      {!!images.length && (
        <div className="overflow-x-auto px-4 py-3">
          <div className="flex gap-2 w-max">
            {images.map((image, index) => {
              const previewUrl = URL.createObjectURL(image);

              return (
                <div
                  key={index}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10"
                >
                  <Image
                    width={40}
                    height={40}
                    src={previewUrl}
                    alt={image.name}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setImages((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      );
                    }}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:opacity-80"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!!videos.length && (
        <div className="overflow-x-auto px-4 py-2">
          <div className="flex gap-2 w-max">
            {videos.map((video, index) => (
              <div
                key={index}
                className="rounded-lg bg-[#323751] px-3 py-2 text-sm text-white"
              >
                🎥 {video.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!files.length && (
        <div className="overflow-x-auto px-4 py-2">
          <div className="flex gap-2 w-max">
            {files.map((file, index) => (
              <div
                key={index}
                className="rounded-lg bg-[#323751] px-3 py-2 text-sm text-white"
              >
                📄 {file.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INPUT CONTROLS */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          {!isAI && (
            <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl bg-[#323751] text-2xl text-white">
              +
              <input
                type="file"
                multiple
                hidden
                onChange={handleSelectFiles}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              />
            </label>
          )}

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (activeSending) return;
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isAI ? "Ask AI anything..." : "Type something..."}
            className="flex-1 rounded-2xl border border-cyan-400 bg-[#2b2f46] px-4 py-3 text-white outline-none"
          />

          <button
            disabled={activeSending}
            onClick={handleSend}
            className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 p-3.5 text-white transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeSending ? (
              <svg
                className="h-5 w-5 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12L2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {previewOpen && (
        <ImagePreviewModal
          open={previewOpen}
          images={previewImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
