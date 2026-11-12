"use client";

import Image from "next/image";
import { useAppSelector } from "@/redux/hooks";
import type { AIMessage } from "@/redux/features/aiSlice";
import type { Attachment, Message } from "@/types/chat";
import UserAvatar from "@/components/ui/UserAvatar";
import DongSonDrum from "@/components/ui/DongSonDrum";
import { Bot, Download, FileText, ImageIcon, Users, X } from "lucide-react";
import { mediaUrl } from "@/lib/mediaUrl";

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Thông tin cuộc trò chuyện: người / thành viên nhóm, ảnh & tệp ĐÃ CHIA SẺ THẬT
 * (lấy từ các tin nhắn đã tải). Màn hình lớn: cột bên phải; nhỏ hơn: ngăn trượt.
 */
export default function RightSidebar({
  messages,
  isAI,
  open,
  onClose,
}: {
  messages: Message[] | AIMessage[];
  isAI: boolean;
  /** Ngăn trượt đang mở (màn hình < xl) */
  open: boolean;
  onClose: () => void;
}) {
  const { selectedConversation } = useAppSelector((state) => state.chat);
  const { user } = useAppSelector((state) => state.auth);
  const { onlineUsers } = useAppSelector((state) => state.users);

  const attachments: Attachment[] = (messages as Message[]).flatMap(
    (m) => m.attachments ?? [],
  );
  const images = attachments
    .filter((a) => a.type.startsWith("image"))
    .reverse();
  const files = attachments
    .filter((a) => !a.type.startsWith("image") && !a.type.startsWith("video"))
    .reverse();

  const partner = selectedConversation?.isGroup
    ? null
    : selectedConversation?.participants?.find((p) => p._id !== user?._id);
  const title = isAI
    ? "Gemini AI"
    : selectedConversation?.isGroup
      ? selectedConversation.groupName
      : partner?.name;

  const content = (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      {/* Hồ sơ */}
      <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-[#f4b942]/15 bg-linear-to-b from-[#c81d25]/15 to-transparent px-4 pb-5 pt-6 text-center">
        <DongSonDrum className="absolute -top-16 h-56 w-56 text-[#f4b942]/10" />
        {isAI ? (
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#0f766e] to-[#2dd4bf] shadow-[0_0_24px_rgba(45,212,191,0.45)]">
            <Bot className="h-10 w-10" />
          </div>
        ) : (
          <UserAvatar
            name={title}
            src={
              selectedConversation?.isGroup
                ? selectedConversation.groupAvatar
                : partner?.avatar
            }
            size={80}
            online={partner ? onlineUsers.includes(partner._id) : undefined}
            className="relative"
          />
        )}
        <h3 className="relative mt-3 text-lg font-extrabold">{title || "—"}</h3>
        <p className="relative text-sm text-slate-400">
          {isAI
            ? "Trợ lý AI · luôn sẵn sàng"
            : selectedConversation?.isGroup
              ? `Nhóm · ${selectedConversation.participants?.length ?? 0} thành viên`
              : partner?.email ||
                (partner && onlineUsers.includes(partner._id)
                  ? "Đang hoạt động"
                  : "Ngoại tuyến")}
        </p>
      </div>

      {/* Thành viên nhóm */}
      {!isAI && selectedConversation?.isGroup && (
        <section className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Users className="h-4 w-4 text-[#ffd166]" />
            Thành viên
          </h4>
          <div className="space-y-2">
            {selectedConversation.participants?.map((p) => (
              <div
                key={p._id}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2"
              >
                <UserAvatar
                  name={p.name}
                  src={p.avatar}
                  size={36}
                  online={onlineUsers.includes(p._id)}
                />
                <span className="truncate text-sm font-semibold">
                  {p.name}
                  {p._id === user?._id && (
                    <span className="ml-1 text-xs text-slate-500">(bạn)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ảnh đã chia sẻ */}
      {!isAI && (
        <section className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <ImageIcon className="h-4 w-4 text-[#ffd166]" />
            Ảnh đã chia sẻ
            <span className="ml-auto text-xs font-semibold normal-case tracking-normal text-slate-500">
              {images.length}
            </span>
          </h4>
          {images.length ? (
            <div className="grid grid-cols-3 gap-2">
              {images.slice(0, 9).map((img, i) => (
                <a
                  key={`${img.url}-${i}`}
                  href={mediaUrl(img.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:opacity-80"
                >
                  <Image
                    src={mediaUrl(img.url)}
                    alt={img.name || "Ảnh"}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 py-5 text-center text-xs text-slate-500">
              Chưa có ảnh nào
            </p>
          )}
        </section>
      )}

      {/* Tệp */}
      {!isAI && (
        <section className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <FileText className="h-4 w-4 text-[#ffd166]" />
            Tệp
            <span className="ml-auto text-xs font-semibold normal-case tracking-normal text-slate-500">
              {files.length}
            </span>
          </h4>
          {files.length ? (
            <div className="space-y-2">
              {files.slice(0, 20).map((f, i) => (
                <a
                  key={`${f.url}-${i}`}
                  href={mediaUrl(f.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 transition hover:bg-white/[0.07]"
                >
                  <FileText className="h-5 w-5 shrink-0 text-[#ffd166]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatSize(f.size)}
                    </p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 text-slate-400" />
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 py-5 text-center text-xs text-slate-500">
              Chưa có tệp nào
            </p>
          )}
        </section>
      )}

      {isAI && (
        <p className="mt-6 rounded-2xl bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-400">
          Gemini AI có thể trả lời câu hỏi, giải thích kiến thức, gợi ý ý tưởng
          và trò chuyện bằng tiếng Việt.
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Màn hình lớn: cột cố định */}
      <aside className="hidden w-[320px] shrink-0 border-l border-white/10 bg-[#11132a]/80 backdrop-blur-md xl:block">
        {content}
      </aside>

      {/* Màn hình nhỏ hơn: ngăn trượt từ phải */}
      <div
        className={`fixed inset-0 z-50 xl:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-[88%] max-w-sm border-l border-[#f4b942]/20 bg-[#11132a] shadow-2xl transition-transform duration-300 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông tin"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-black/40 text-slate-200 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          {content}
        </aside>
      </div>
    </>
  );
}
