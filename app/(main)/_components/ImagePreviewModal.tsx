"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  if (!open || !images[currentIndex]) return null;

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/90">
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-50 text-4xl text-white hover:opacity-70"
      >
        ✕
      </button>

      {images.length > 1 && (
        <button
          onClick={prevImage}
          className="absolute left-6 z-50 rounded-full bg-black/40 p-4 text-3xl text-white hover:opacity-70"
        >
          <ArrowLeft />
        </button>
      )}

      <div className="relative h-[90vh] w-[90vw]">
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
          onClick={nextImage}
          className="absolute right-6 z-50 rounded-full bg-black/40 p-4 text-3xl text-white hover:opacity-70"
        >
          <ArrowRight />
        </button>
      )}

      <div className="absolute bottom-6 text-sm text-white">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
