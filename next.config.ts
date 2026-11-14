import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tắt chấm chỉ báo "N" của Next.js (không để lọt vào giao diện chơi)
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "http",

        hostname: "localhost",

        port: "8000",

        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**", // Cho phép tất cả đường dẫn ảnh từ Cloudinary
      },
    ],
  },
};

export default nextConfig;
