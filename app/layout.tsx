import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReduxProvider from "@/redux/provider";
import { Toaster } from "sonner";
import MainLayout from "@/components/layout/MainLayout";
import AuthInitializer from "@/components/providers/AuthInitializer";
import SocketProvider from "@/components/providers/SocketProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat Zone",
  description: "Chat Zone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ReduxProvider>
          <SocketProvider>
            <AuthInitializer />
            {children}
          </SocketProvider>
        </ReduxProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
