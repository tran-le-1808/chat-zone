"use client";

import React, { useEffect, useRef, useState } from "react";
import { INITIAL_PLAYERS } from "@/types/game.types";
import { useRoom } from "../_context/RoomContext";
import PlayerAvatar from "./PlayerAvatar";

const QUICK_EMOJIS = ["🎲", "😂", "😭", "🔥", "💸", "👏", "😡", "🏆"];

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

interface GameChatProps {
  /** floating: khung nổi trên bàn cờ; inline: nằm trong bố cục phòng chờ */
  variant?: "floating" | "inline";
}

export default function GameChat({ variant = "floating" }: GameChatProps) {
  const { room, chat, myUserId, sendChat } = useRoom();

  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [seenCount, setSeenCount] = useState(chat.length);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isFloating = variant === "floating";
  const onlineCount = room?.players.filter((p) => p.connected).length ?? 0;

  const unread = open ? 0 : Math.max(chat.length - seenCount, 0);

  // Cuộn xuống tin mới nhất
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, chat.length]);

  const toggleOpen = () => {
    setOpen((prev) => !prev);
    setSeenCount(chat.length);
  };

  const handleSend = (content = text) => {
    if (!content.trim()) return;
    sendChat(content);
    if (content === text) setText("");
  };

  if (isFloating && !open) {
    return (
      <button
        onClick={toggleOpen}
        className="absolute right-4 top-1/2 z-40 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-2xl text-white shadow-2xl transition hover:opacity-90 active:scale-95"
        aria-label="Mở khung chat"
      >
        💬
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#262a40] shadow-2xl ${
        isFloating
          ? "absolute right-4 top-1/2 z-40 h-[52vh] max-h-[520px] w-80 -translate-y-1/2"
          : "h-full min-h-[420px] w-full"
      }`}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-lg">
            💬
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Chat phòng</h2>
            <p className="text-xs text-green-400">{onlineCount} đang online</p>
          </div>
        </div>

        {isFloating && (
          <button
            onClick={toggleOpen}
            aria-label="Thu gọn khung chat"
            className="rounded-xl px-2 py-1 text-sm text-gray-300 hover:bg-white/10"
          >
            ✕
          </button>
        )}
      </div>

      {/* MESSAGES LIST */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {chat.length === 0 && (
          <p className="pt-6 text-center text-xs text-gray-500">
            Chưa có tin nhắn nào. Hãy chào mọi người một câu! 👋
          </p>
        )}
        {chat.map((message) => {
          const isMe = message.userId === myUserId;
          const preset = INITIAL_PLAYERS[message.seat];
          const color = preset?.color ?? "#22d3ee";

          return (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
            >
              <PlayerAvatar
                name={message.name}
                avatar={message.avatar}
                color={color}
                size={28}
              />
              <div
                className={`max-w-[75%] rounded-3xl px-3 py-2 text-white ${
                  isMe ? "bg-blue-800" : "bg-[#323751]"
                }`}
              >
                {!isMe && (
                  <div
                    className="mb-0.5 text-[11px] font-bold"
                    style={{ color }}
                  >
                    {message.name}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">
                  {message.text}
                </p>
                <div className="mt-0.5 text-right text-[10px] text-white/40">
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* QUICK EMOJIS */}
      <div className="flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-2">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSend(emoji)}
            className="shrink-0 rounded-xl bg-[#323751] px-2 py-1 text-base transition hover:bg-[#3d4363] active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* INPUT CONTROLS */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          <input
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Nhắn gì đó..."
            className="min-w-0 flex-1 rounded-2xl border border-cyan-400 bg-[#2b2f46] px-3 py-2.5 text-sm text-white outline-none"
          />

          <button
            onClick={() => handleSend()}
            disabled={!text.trim()}
            aria-label="Gửi"
            className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 p-3 text-white transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12L2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
