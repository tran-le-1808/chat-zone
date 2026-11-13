import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReduxProvider from "@/redux/provider";
import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import MainLayout from "@/components/layout/MainLayout";
import AuthInitializer from "@/components/providers/AuthInitializer";
import SocketProvider from "@/components/providers/SocketProvider";
import { beVietnam } from "@/lib/fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat Zone — Trò chuyện & chơi game cùng bạn bè",
  description:
    "Nhắn tin thời gian thực, trợ lý Gemini AI, Cờ Tỷ Phú và Bida online cùng bạn bè.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className={`${beVietnam.className} flex min-h-full flex-col bg-[#0d0f1e]`}
      >
        <ReduxProvider>
          <SocketProvider>
            <AuthInitializer />
            {children}
          </SocketProvider>
        </ReduxProvider>
        <Toaster position="top-right" richColors closeButton />
        <ConfirmHost />
      </body>
    </html>
  );
}
