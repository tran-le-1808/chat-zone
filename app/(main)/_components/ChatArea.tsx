"use client";

import {
  addMessage,
  loadMoreMessages,
  sendMessage,
} from "@/redux/features/chatSlice";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { socket } from "@/lib/socket";

import Image from "next/image";

import { ChangeEvent, useEffect, useRef, useState } from "react";

import { Message, MessageType } from "@/types/chat";
import ImagePreviewModal from "./ImagePreviewModal";

interface ChatAreaProps {
  messages: Message[];
  hasMoreMessages: boolean;
  nextCursor: string | null;
  loadingMoreMessages: boolean;
}

export default function ChatArea({
  messages,
  hasMoreMessages,
  nextCursor,
  loadingMoreMessages,
}: ChatAreaProps) {
  const dispatch = useAppDispatch();

  const {
    selectedConversation,

    selectedUser,

    sending,
  } = useAppSelector((state) => state.chat);

  const { user } = useAppSelector((state) => state.auth);

  const { onlineUsers } = useAppSelector((state) => state.users);

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

  useEffect(() => {
    if (!selectedConversation?._id) return;

    socket.emit("joinConversation", selectedConversation._id);
  }, [selectedConversation?._id]);

  useEffect(() => {
    socket.on("newMessage", (message) => {
      if (message.senderId === user?._id) {
        return;
      }

      dispatch(addMessage(message));
    });

    return () => {
      socket.off("newMessage");
    };
  }, [dispatch, user?._id]);

  useEffect(() => {
    if (!messages.length) return;

    if (shouldKeepScrollPositionRef.current) {
      shouldKeepScrollPositionRef.current = false;
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }, [messages]);

  const handleLoadMore = async () => {
    const container = messagesContainerRef.current;

    if (
      !container ||
      !selectedConversation?._id ||
      !hasMoreMessages ||
      !nextCursor ||
      loadingMoreMessages
    ) {
      return;
    }

    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    shouldKeepScrollPositionRef.current = true;

    await dispatch(
      loadMoreMessages({
        conversationId: selectedConversation._id,
        before: nextCursor,
      }),
    );

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
    message: Message,
    attachment: (typeof message.attachments)[0],
  ) => {
    const allImages =
      message.attachments
        ?.filter((item) => item.type.startsWith("image"))
        .map((item) => `${process.env.NEXT_PUBLIC_API_URL}${item.url}`) || [];

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

  const handleSend = async () => {
    if (!text.trim() && !images.length && !videos.length && !files.length) {
      return;
    }

    if (!selectedConversation || !user?._id) {
      return;
    }

    const formData = new FormData();

    formData.append("senderId", user._id);

    formData.append("receiverId", selectedUser?._id || "");

    formData.append("conversationId", selectedConversation._id);

    formData.append("text", text);

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
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col bg-[#262a40] w-full xl:max-w-[calc(100vw-640px)]">
      {/* TOP */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-8 md:py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-cyan-400 to-purple-500 text-lg font-bold text-white">
            {selectedConversation?.groupName?.charAt(0) || "U"}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">
              {selectedConversation?.groupName}
            </h2>

            <p
              className={`text-sm ${
                isOnline ? "text-green-400" : "text-gray-400"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
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
                {message.text && <p>{message.text}</p>}

                {/* ATTACHMENTS */}
                {!!message.attachments?.length && (
                  <div className="gap-2 flex flex-wrap items-center mt-2">
                    {message.attachments.map((attachment, index) => {
                      if (attachment.type.startsWith("image")) {
                        const fileUrl = `${process.env.NEXT_PUBLIC_API_URL}${attachment.url}`;
                        return (
                          <div
                            className="relative h-20 w-20 overflow-hidden rounded-lg"
                            key={index}
                          >
                            <Image
                              src={fileUrl}
                              alt={attachment.name}
                              fill
                              className="cursor-pointer object-cover shadow hover:opacity-80"
                              unoptimized
                              onClick={() => onClickImage(message, attachment)}
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
                          className=" rounded-xl bg-white/10 p-3 text-sm hover:opacity-80 flex items-center"
                        >
                          📄 {attachment.name}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* PREVIEW */}
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

      {/* INPUT */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
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

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (sending) return;
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type something..."
            className="flex-1 rounded-2xl border border-cyan-400 bg-[#2b2f46] px-4 py-3 text-white outline-none"
          />

          <button
            disabled={sending}
            onClick={handleSend}
            className="rounded-2xl bg-linear-to-r from-cyan-400 to-purple-500 px-5 py-3 text-white disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
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
