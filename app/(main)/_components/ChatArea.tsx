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
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Attachment, Message, MessageType } from "@/types/chat";
import ImagePreviewModal from "./ImagePreviewModal";
import UserAvatar from "@/components/ui/UserAvatar";
import DongSonDrum from "@/components/ui/DongSonDrum";
import { clockVi, dayLabelVi } from "@/lib/timeVi";
import {
  ArrowLeft,
  Bot,
  Download,
  FileText,
  Info,
  Loader2,
  Paperclip,
  SendHorizontal,
  Video,
  X,
} from "lucide-react";
import { mediaUrl } from "@/lib/mediaUrl";

interface ChatAreaProps {
  messages: AIMessage[] | Message[];
  hasMoreMessages: boolean;
  nextCursor: string | null;
  loadingMoreMessages: boolean;
  isAI: boolean;
  /** Điện thoại: quay lại danh sách hội thoại */
  onBack?: () => void;
  /** Mở bảng thông tin hội thoại (màn hình nhỏ hơn xl) */
  onOpenInfo?: () => void;
}

export default function ChatArea({
  messages,
  hasMoreMessages,
  nextCursor,
  loadingMoreMessages,
  isAI,
  onBack,
  onOpenInfo,
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

  // URL xem trước ảnh: tạo 1 lần cho mỗi ảnh & giải phóng khi đổi (tránh rò bộ nhớ)
  const imagePreviews = useMemo(
    () => images.map((image) => URL.createObjectURL(image)),
    [images],
  );
  useEffect(
    () => () => imagePreviews.forEach((url) => URL.revokeObjectURL(url)),
    [imagePreviews],
  );

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
      dispatch(aiMessageComplete(data));
    };

    const handleError = (data: {
      conversationId?: string;
      message: string;
    }) => {
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
        .map((item: Attachment) => mediaUrl(item.url)) || [];

    const clickedIndex = allImages.findIndex(
      (img) => img === mediaUrl(attachment.url),
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

  // Tên hiển thị giống Sidebar: nhóm -> tên nhóm, 1-1 -> tên người đang chat cùng
  const chatPartner = selectedConversation?.isGroup
    ? null
    : selectedConversation?.participants?.find((p) => p._id !== user?._id);
  const chatTitle = selectedConversation?.isGroup
    ? selectedConversation.groupName
    : (chatPartner?.name ?? selectedConversation?.groupName);
  const partnerOnline = chatPartner
    ? onlineUsers.includes(chatPartner._id)
    : isOnline;

  // Tên người gửi trong nhóm
  const senderNames = new Map(
    (selectedConversation?.participants ?? []).map((p) => [p._id, p.name]),
  );

  const hasConversation = isAI
    ? !!selectedAiConversation
    : !!selectedConversation;
  const removeAt = <T,>(list: T[], index: number) =>
    list.filter((_, i) => i !== index);

  const statusText = isAI
    ? "Luôn sẵn sàng hỗ trợ"
    : selectedConversation?.isGroup
      ? `${selectedConversation.participants?.length ?? 0} thành viên`
      : partnerOnline
        ? "Đang hoạt động"
        : "Ngoại tuyến";

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-[#0f1126]/70">
      {/* THANH TIÊU ĐỀ */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#11132a]/80 px-2 py-2.5 backdrop-blur-md sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Quay lại danh sách"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {isAI ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#0f766e] to-[#2dd4bf] shadow-[0_0_16px_rgba(45,212,191,0.4)]">
              <Bot className="h-6 w-6" />
            </div>
          ) : (
            <UserAvatar
              name={chatTitle}
              src={
                selectedConversation?.isGroup
                  ? selectedConversation.groupAvatar
                  : chatPartner?.avatar
              }
              size={44}
              online={selectedConversation?.isGroup ? undefined : partnerOnline}
              ringClassName="border-[#11132a]"
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-bold leading-tight sm:text-lg">
              {isAI
                ? selectedAiConversation?.title || "Gemini AI"
                : chatTitle || "Cuộc trò chuyện"}
            </h2>
            <p
              className={`flex items-center gap-1.5 truncate text-xs sm:text-sm ${
                isAI
                  ? "text-teal-300"
                  : partnerOnline && !selectedConversation?.isGroup
                    ? "text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              {(isAI || (partnerOnline && !selectedConversation?.isGroup)) && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
              {statusText}
            </p>
          </div>
        </div>

        {onOpenInfo && hasConversation && (
          <button
            type="button"
            onClick={onOpenInfo}
            aria-label="Thông tin cuộc trò chuyện"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-[#ffd166] xl:hidden"
          >
            <Info className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* DANH SÁCH TIN NHẮN */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      >
        {loadingMoreMessages && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải tin nhắn cũ…
          </div>
        )}

        {messages.length === 0 && !streamingMessage && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <DongSonDrum className="h-32 w-32 text-[#f4b942]/30" />
            <p className="text-lg font-bold text-white/90">
              {isAI
                ? "Gemini AI sẵn sàng trò chuyện"
                : hasConversation
                  ? "Chưa có tin nhắn nào"
                  : "Chọn một cuộc trò chuyện"}
            </p>
            <p className="max-w-xs text-sm text-slate-400">
              {isAI
                ? "Hỏi bất cứ điều gì: học tập, công việc hay một câu đố vui."
                : hasConversation
                  ? "Hãy gửi lời chào đầu tiên để bắt đầu nhé!"
                  : "Bắt đầu trò chuyện cùng bạn bè hoặc tạo nhóm mới."}
            </p>
          </div>
        )}

        <div className="space-y-1">
          {messages.map((message, index) => {
            const isMe = message.senderId === user?._id;
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const newDay =
              !prev ||
              new Date(prev.createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();
            const firstOfGroup = newDay || prev?.senderId !== message.senderId;
            const lastOfGroup =
              !next ||
              next.senderId !== message.senderId ||
              new Date(next.createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();
            const showSender =
              !isMe && !isAI && selectedConversation?.isGroup && firstOfGroup;
            const senderName = senderNames.get(message.senderId);

            return (
              <div key={message._id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                      {dayLabelVi(message.createdAt)}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}

                <div
                  className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"} ${firstOfGroup ? "mt-3" : ""}`}
                >
                  {/* Avatar người gửi (tin cuối của cụm) */}
                  {!isMe && (
                    <div className="w-8 shrink-0">
                      {lastOfGroup &&
                        (isAI ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-[#0f766e] to-[#2dd4bf]">
                            <Bot className="h-4 w-4" />
                          </div>
                        ) : (
                          <UserAvatar
                            name={senderName || chatTitle}
                            src={
                              selectedConversation?.participants?.find(
                                (p) => p._id === message.senderId,
                              )?.avatar
                            }
                            size={32}
                          />
                        ))}
                    </div>
                  )}

                  <div
                    className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}
                  >
                    {showSender && senderName && (
                      <span className="mb-1 ml-3 text-xs font-semibold text-[#ffd166]">
                        {senderName}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
                        isMe
                          ? `bg-linear-to-br from-[#c81d25] to-[#e8772e] text-white ${lastOfGroup ? "rounded-br-md" : ""}`
                          : isAI
                            ? `border border-teal-400/20 bg-[#13283a] text-teal-50 ${lastOfGroup ? "rounded-bl-md" : ""}`
                            : `border border-white/5 bg-[#1c1f3a] text-slate-100 ${lastOfGroup ? "rounded-bl-md" : ""}`
                      }`}
                    >
                      {message.text && (
                        <p className="whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                      )}

                      {!!message.attachments?.length && (
                        <div
                          className={`flex flex-wrap items-center gap-2 ${message.text ? "mt-2" : ""}`}
                        >
                          {message.attachments.map(
                            (attachment: Attachment, i: number) => {
                              const fileUrl = mediaUrl(attachment.url);
                              if (attachment.type.startsWith("image")) {
                                return (
                                  <button
                                    type="button"
                                    key={i}
                                    onClick={() =>
                                      onClickImage(message, attachment)
                                    }
                                    className="relative h-28 w-28 overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:opacity-85 sm:h-32 sm:w-32"
                                  >
                                    <Image
                                      src={fileUrl}
                                      alt={attachment.name || "Hình ảnh"}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </button>
                                );
                              }
                              if (attachment.type.startsWith("video")) {
                                return (
                                  <video
                                    key={i}
                                    controls
                                    className="max-h-64 max-w-full rounded-xl"
                                  >
                                    <source
                                      src={fileUrl}
                                      type={attachment.type}
                                    />
                                  </video>
                                );
                              }
                              return (
                                <a
                                  key={i}
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex max-w-full items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm transition hover:bg-black/30"
                                >
                                  <FileText className="h-5 w-5 shrink-0 text-[#ffd166]" />
                                  <span className="truncate">
                                    {attachment.name}
                                  </span>
                                  <Download className="h-4 w-4 shrink-0 opacity-70" />
                                </a>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
                    {lastOfGroup && (
                      <span className="mt-1 px-1 text-[10px] text-slate-500">
                        {clockVi(message.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* AI ĐANG TRẢ LỜI */}
          {isAI && streamingConversationId === activeConversationId && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#0f766e] to-[#2dd4bf]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-teal-400/20 bg-[#13283a] px-3.5 py-2 text-[15px] text-teal-50 sm:max-w-[70%]">
                {streamingMessage ? (
                  <p className="whitespace-pre-wrap break-words">
                    {streamingMessage}
                    <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-teal-300 align-middle" />
                  </p>
                ) : (
                  <span className="flex gap-1 py-1.5">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-teal-300"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* TỆP ĐÍNH KÈM CHỜ GỬI */}
      {(!!images.length || !!videos.length || !!files.length) && (
        <div className="shrink-0 overflow-x-auto border-t border-white/10 px-3 py-2.5">
          <div className="flex w-max gap-2">
            {images.map((image, index) => (
              <div
                key={`i${index}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10"
              >
                <Image
                  width={80}
                  height={80}
                  src={imagePreviews[index]}
                  alt={image.name}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  aria-label={`Bỏ ${image.name}`}
                  onClick={() => setImages((prev) => removeAt(prev, index))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 hover:bg-[#c81d25]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {videos.map((video, index) => (
              <div
                key={`v${index}`}
                className="flex h-20 max-w-[200px] items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-sm ring-1 ring-white/10"
              >
                <Video className="h-5 w-5 shrink-0 text-[#ffd166]" />
                <span className="truncate">{video.name}</span>
                <button
                  type="button"
                  aria-label={`Bỏ ${video.name}`}
                  onClick={() => setVideos((prev) => removeAt(prev, index))}
                  className="shrink-0 rounded-full p-1 hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {files.map((file, index) => (
              <div
                key={`f${index}`}
                className="flex h-20 max-w-[200px] items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-sm ring-1 ring-white/10"
              >
                <FileText className="h-5 w-5 shrink-0 text-[#ffd166]" />
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Bỏ ${file.name}`}
                  onClick={() => setFiles((prev) => removeAt(prev, index))}
                  className="shrink-0 rounded-full p-1 hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ô NHẬP TIN NHẮN */}
      <div className="shrink-0 border-t border-white/10 bg-[#11132a]/80 p-2.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-md sm:p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 transition focus-within:border-[#f4b942]/50 focus-within:shadow-[0_0_0_3px_rgba(244,185,66,0.1)]">
          {!isAI && (
            <label
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-[#ffd166]"
              title="Đính kèm ảnh, video hoặc tệp"
            >
              <Paperclip className="h-5 w-5" />
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
            disabled={!hasConversation}
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
            placeholder={
              isAI ? "Hỏi Gemini AI bất cứ điều gì…" : "Nhập tin nhắn…"
            }
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
          />

          <button
            type="button"
            disabled={activeSending || !hasConversation}
            onClick={handleSend}
            aria-label="Gửi tin nhắn"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#c81d25] to-[#e8772e] text-white shadow-[0_3px_0_#7f1118] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SendHorizontal className="h-5 w-5" />
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
