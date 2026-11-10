"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Image from "next/image";

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

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh!");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const displayImage = preview || currentAvatar;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex h-32 w-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-2 transition ${
          isDragging
            ? "border-cyan-400 bg-cyan-400/10 scale-105"
            : "border-cyan-400/50 hover:border-cyan-400 bg-[#2b2f46]"
        }`}
      >
        {displayImage ? (
          <Image
            src={displayImage}
            alt="Avatar"
            fill
            className="object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-cyan-400">
            {name?.charAt(0).toUpperCase() || "U"}
          </span>
        )}

        {/* Overlay hover hướng dẫn kéo thả */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition hover:opacity-100 text-xs text-center p-2 text-white">
          <span>Kéo thả ảnh vào đây</span>
          <span className="text-[10px] text-gray-300">hoặc Click để chọn</span>
        </div>
      </div>

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
