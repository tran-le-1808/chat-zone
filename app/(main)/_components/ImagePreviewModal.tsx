"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ImagePreviewModalProps {
  images: string[];

  initialIndex: number;

  open: boolean;

  onClose: () => void;
}

export default function ImagePreviewModal({
  images,
  initialIndex,
  open,
  onClose,
}: ImagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => {
      const current = prev;

      return (current + 1) % images.length;
    });
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => {
      const current = prev;

      return current === 0 ? images.length - 1 : current - 1;
    });
  }, [images.length]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        nextImage();
      }

      if (e.key === "ArrowLeft") {
        prevImage();
      }

      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [nextImage, prevImage, onClose, open]);

  // Khoá cuộn trang phía sau khi đang xem ảnh
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !images[currentIndex] || typeof document === "undefined")
    return null;

  // Portal ra <body>: nếu render bên trong khung có backdrop-blur / transform (cột thông tin,
  // ngăn trượt) thì `fixed` sẽ bị giới hạn trong khung đó thay vì phủ toàn màn hình.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh"
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95"
    >
      <button
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-4 top-4 z-50 text-4xl text-white hover:opacity-70 sm:right-6 sm:top-6"
      >
        ✕
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prevImage();
          }}
          aria-label="Ảnh trước"
          className="absolute left-6 z-50 rounded-full bg-black/40 p-4 text-3xl text-white hover:opacity-70"
        >
          <ArrowLeft />
        </button>
      )}

      <div
        className="relative h-[100dvh] w-screen sm:h-[92vh] sm:w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={images[currentIndex]}
          alt="Preview"
          fill
          unoptimized
          className="object-contain"
        />
      </div>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            nextImage();
          }}
          aria-label="Ảnh sau"
          className="absolute right-6 z-50 rounded-full bg-black/40 p-4 text-3xl text-white hover:opacity-70"
        >
          <ArrowRight />
        </button>
      )}

      <div className="absolute bottom-6 text-sm text-white">
        {currentIndex + 1} / {images.length}
      </div>
    </div>,
    document.body,
  );
}
