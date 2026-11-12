"use client";

import { useEffect, useRef, useState, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentAvatar?: string;
  name?: string;
  onFileSelect: (file: File | null) => void;
}

export default function AvatarUpload({
  currentAvatar,
  name,
  onFileSelect,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Giải phóng URL xem trước cũ
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh!");
      return;
    }
    setPreview(URL.createObjectURL(file));
    onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const displayImage = preview || currentAvatar;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        aria-label="Đổi ảnh đại diện"
        className={`group relative h-28 w-28 rounded-full bg-linear-to-br from-[#ffd166] via-[#f4b942] to-[#c81d25] p-[3px] shadow-[0_0_24px_rgba(244,185,66,0.35)] transition sm:h-32 sm:w-32 ${
          isDragging ? "scale-105" : ""
        }`}
      >
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#11132a]">
          {displayImage ? (
            <Image
              src={displayImage}
              alt="Ảnh đại diện"
              fill
              className="object-cover"
            />
          ) : (
            <span className="text-4xl font-extrabold text-[#ffd166]">
              {name?.charAt(0).toUpperCase() || "U"}
            </span>
          )}
          <span
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-[11px] font-semibold text-white transition ${
              isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Camera className="h-5 w-5" />
            Thả ảnh vào đây
          </span>
        </span>
        <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#11132a] bg-linear-to-br from-[#c81d25] to-[#e8772e] text-white">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      <p className="text-xs text-slate-500">
        Nhấn hoặc kéo thả ảnh để đổi avatar
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
