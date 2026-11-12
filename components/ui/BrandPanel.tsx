import { Bot, Gamepad2, MessagesSquare, Mic } from "lucide-react";
import DongSonDrum from "./DongSonDrum";
import { ui } from "./styles";

const FEATURES = [
  { icon: MessagesSquare, text: "Nhắn tin & gửi ảnh thời gian thực" },
  { icon: Bot, text: "Trò chuyện cùng trợ lý Gemini AI" },
  { icon: Gamepad2, text: "Cờ Tỷ Phú & Bida Carom online" },
  { icon: Mic, text: "Voice chat ngay trong phòng chơi" },
];

/** Logo Chat Zone (dùng ở trang đăng nhập / 404 trên điện thoại) */
export function BrandLogo({ size = 48 }: { size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-[#c81d25] to-[#f4b942] shadow-[0_0_22px_rgba(244,185,66,0.4)]"
      style={{ width: size, height: size }}
    >
      <DongSonDrum className="absolute h-[140%] w-[140%] animate-[spin_40s_linear_infinite] text-white/25" />
      <MessagesSquare
        className="relative text-white"
        style={{ width: size * 0.48, height: size * 0.48 }}
        strokeWidth={2.4}
      />
    </div>
  );
}

/** Khối giới thiệu thương hiệu (cột trái trang đăng nhập / đăng ký) */
export default function BrandPanel({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative hidden w-[46%] flex-col justify-between gap-8 overflow-hidden bg-linear-to-br from-[#7f1118] via-[#a3241c] to-[#c2621f] p-10 md:flex">
      <DongSonDrum className="absolute -bottom-40 -right-40 h-[520px] w-[520px] animate-[spin_120s_linear_infinite] text-[#ffd166]/15" />
      <div className="relative flex items-center gap-3">
        <BrandLogo size={52} />
        <div>
          <p className="text-2xl font-extrabold tracking-tight">Chat Zone</p>
          <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd166]/80">
            Kết nối · Trò chuyện · Chơi game
          </p>
        </div>
      </div>

      <div className="relative">
        <h1 className="text-3xl font-extrabold leading-tight text-balance">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{subtitle}</p>
        <ul className="mt-6 space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 text-sm font-medium"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-[#ffd166]">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className={`relative text-xs font-bold ${ui.goldText}`}>
        Thiết kế với cảm hứng trống đồng Đông Sơn
      </p>
    </div>
  );
}
