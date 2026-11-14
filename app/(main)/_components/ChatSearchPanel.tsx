"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import API from "@/lib/api";
import { clockVi, dayLabelVi } from "@/lib/timeVi";

interface Item {
  messageId: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: string;
  createdAt: string;
}

/** Chuẩn hoá KHÔNG gộp khoảng trắng -> độ dài giữ nguyên, dùng để tô sáng đúng vị trí */
const foldVi = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

function Highlight({ text, q }: { text: string; q: string }) {
  const needle = foldVi(q).trim();
  const idx = needle ? foldVi(text).indexOf(needle) : -1;
  if (idx < 0 || foldVi(text).length !== text.length) return <>{text}</>;
  const start = Math.max(0, idx - 24);
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, idx)}
      <mark className="rounded bg-[#f4b942]/40 px-0.5 text-white">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length, idx + needle.length + 60)}
    </>
  );
}

/** Tìm tin nhắn trong hội thoại đang mở (không phân biệt dấu); bấm kết quả để nhảy tới tin */
export default function ChatSearchPanel({
  conversationId,
  senderName,
  onPick,
  onClose,
}: {
  conversationId: string;
  senderName: (senderId: string) => string;
  onPick: (messageId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const run = async (query: string, after: string | null) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await API.get<{
        items: Item[];
        hasMore: boolean;
        nextCursor: string | null;
      }>("/chat/search/messages", {
        params: {
          q: query,
          conversationId,
          cursor: after ?? undefined,
          limit: 20,
        },
        signal: ctrl.signal,
      });
      setItems((prev) =>
        after ? [...prev, ...res.data.items] : res.data.items,
      );
      setCursor(res.data.hasMore ? res.data.nextCursor : null);
      setDone(true);
    } catch (e) {
      if ((e as { code?: string }).code !== "ERR_CANCELED") setDone(true);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  // Chờ gõ 300 ms rồi mới tìm; gõ tiếp thì huỷ yêu cầu cũ
  useEffect(() => {
    const query = q.trim();
    // Chờ gõ 300 ms; ô trống thì chỉ huỷ yêu cầu cũ (danh sách rỗng được suy ra lúc hiển thị)
    const t = setTimeout(
      () => {
        if (!query) {
          abortRef.current?.abort();
          setItems([]);
          setDone(false);
          setCursor(null);
          return;
        }
        void run(query, null);
      },
      query ? 300 : 0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, conversationId]);

  return (
    <div className="flex max-h-[45%] shrink-0 flex-col border-b border-white/10 bg-[#13152e]/98 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 p-2.5">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Tìm trong cuộc trò chuyện (không cần gõ dấu)…"
          aria-label="Tìm tin nhắn"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng tìm kiếm"
          className="rounded-full p-1 text-slate-300 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-y-auto">
        {done && !loading && q.trim() && items.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            Không tìm thấy tin nhắn nào
          </p>
        )}
        {items.map((it) => (
          <button
            key={it.messageId}
            type="button"
            onClick={() => onPick(it.messageId)}
            className="block w-full border-t border-white/5 px-4 py-2.5 text-left transition hover:bg-white/5"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-[#ffd166]">
                {senderName(it.senderId)}
              </span>
              <span>
                {dayLabelVi(it.createdAt)} · {clockVi(it.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 break-words text-sm text-slate-100">
              <Highlight text={it.text} q={q} />
            </p>
          </button>
        ))}
        {cursor && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void run(q.trim(), cursor)}
            className="w-full border-t border-white/5 py-2.5 text-sm text-[#ffd166] hover:bg-white/5 disabled:opacity-50"
          >
            Xem thêm kết quả
          </button>
        )}
      </div>
    </div>
  );
}
