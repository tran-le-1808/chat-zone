"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";
import API from "@/lib/api";
import { mediaUrl } from "@/lib/mediaUrl";
import type { Message } from "@/types/chat";
import ImagePreviewModal from "./ImagePreviewModal";

interface MediaItem {
  messageId: string;
  url: string;
  name: string;
  type: string;
  createdAt: string;
}

const PAGE = 5;

/**
 * "Ảnh đã chia sẻ": lấy thẳng từ máy chủ (không phụ thuộc các tin đã tải), mới nhất trước,
 * 5 ảnh mỗi lần, có "Xem thêm". Bấm ảnh -> mở trình xem ảnh (modal), không rời trang.
 */
export default function SharedImages({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: Message[];
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  // Tin có ảnh mới nhất đã lưu ở máy chủ: đổi (gửi / nhận ảnh mới, thu hồi) -> tải lại trang đầu
  const latestImageKey = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m._id.startsWith("temp-") || m.clientStatus) continue;
      if (m.attachments?.some((a) => a.type.startsWith("image"))) return m._id;
    }
    return "";
  }, [messages]);
  const recalledCount = useMemo(
    () => messages.filter((m) => m.recalledAt).length,
    [messages],
  );

  const load = async (offset: number) => {
    setLoading(true);
    try {
      const res = await API.get<{
        items: MediaItem[];
        hasMore: boolean;
        nextOffset: number | null;
      }>(`/chat/conversations/${conversationId}/media`, {
        params: { kind: "image", offset, limit: PAGE },
      });
      setItems((prev) =>
        offset === 0 ? res.data.items : [...prev, ...res.data.items],
      );
      setNextOffset(res.data.hasMore ? res.data.nextOffset : null);
    } catch {
      if (offset === 0) setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) void load(0);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, latestImageKey, recalledCount]);

  return (
    <section className="mt-6">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
        <ImageIcon className="h-4 w-4 text-[#ffd166]" />
        Ảnh đã chia sẻ
        {loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />}
      </h4>
      {items.length ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {items.map((img, i) => (
              <button
                type="button"
                key={`${img.messageId}-${img.url}`}
                onClick={() => setViewer(i)}
                aria-label={`Xem ảnh ${img.name || i + 1}`}
                className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:opacity-80"
              >
                <Image
                  src={mediaUrl(img.url)}
                  alt={img.name || "Ảnh"}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </button>
            ))}
          </div>
          {nextOffset !== null && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(nextOffset)}
              className="mt-3 w-full rounded-xl border border-white/10 py-2 text-xs font-semibold text-[#ffd166] transition hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? "Đang tải…" : "Xem thêm ảnh"}
            </button>
          )}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/10 py-5 text-center text-xs text-slate-500">
          {loading ? "Đang tải ảnh…" : "Chưa có ảnh nào"}
        </p>
      )}

      {viewer !== null && (
        <ImagePreviewModal
          key={viewer}
          open
          images={items.map((it) => mediaUrl(it.url))}
          initialIndex={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
