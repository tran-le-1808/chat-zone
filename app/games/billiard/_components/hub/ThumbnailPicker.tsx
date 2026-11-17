"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import API from "@/lib/api";
import { getApiErrorMessage } from "@/lib/get-api-error";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Chọn ảnh bìa giải đấu từ máy -> tải lên Cloudinary qua backend (POST /billiard/tournaments/thumbnail).
 * Trả về URL Cloudinary qua onChange; server chỉ chấp nhận URL do chính hệ thống tải lên.
 */
export default function ThumbnailPicker({ value, onChange, onBusy }: { value: string; onChange: (url: string) => void; onBusy?: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return toast.error("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");
    if (file.size > MAX_BYTES) return toast.error("Ảnh tối đa 5MB");
    const form = new FormData();
    form.append("file", file);
    setProgress(0);
    onBusy?.(true);
    try {
      const res = await API.post<{ url: string }>("/billiard/tournaments/thumbnail", form, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      onChange(res.data.url);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không tải được ảnh lên"));
    } finally {
      setProgress(null);
      onBusy?.(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Ảnh giải đấu" className="aspect-[1200/630] w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => input.current?.click()} disabled={progress !== null} className="rounded-lg bg-black/60 px-2 py-1 text-xs font-bold">
              Đổi ảnh
            </button>
            <button type="button" onClick={() => onChange("")} disabled={progress !== null} className="rounded-lg bg-black/60 p-1.5" aria-label="Bỏ ảnh">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
          className="flex aspect-[1200/630] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-sm text-slate-300 hover:border-[#f4b942]/50 disabled:opacity-60"
        >
          {progress !== null ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          {progress !== null ? `Đang tải lên… ${progress}%` : "Chọn ảnh từ máy (JPG / PNG / WEBP, ≤ 5MB)"}
        </button>
      )}
      {progress !== null && value && <p className="mt-1 text-xs text-slate-400">Đang tải ảnh mới… {progress}%</p>}
    </div>
  );
}
