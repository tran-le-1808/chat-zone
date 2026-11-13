"use client";

import { useEffect, useState } from "react";
import { determinismHashes } from "../_lib/tools/determinism";

/**
 * Trang kiểm tra tính xác định (chỉ dùng khi phát triển): tính hash của N cú đánh ngẫu nhiên
 * ngay trong trình duyệt để so với Node (server). Xem chat-zone/scripts/pool-determinism-browser.mjs
 */
export default function DeterminismPage() {
  const [out, setOut] = useState<string>("đang tính…");
  useEffect(() => {
    const n = Number(new URLSearchParams(location.search).get("n") ?? 300);
    const t = setTimeout(() => {
      const t0 = performance.now();
      const hashes = determinismHashes(n);
      setOut(JSON.stringify({ ua: navigator.userAgent, n, ms: Math.round(performance.now() - t0), hashes }));
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (process.env.NODE_ENV === "production") return <p>Không khả dụng</p>;
  return <pre id="out" style={{ whiteSpace: "pre-wrap", fontSize: 10, padding: 8 }}>{out}</pre>;
}
