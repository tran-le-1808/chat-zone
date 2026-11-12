import Image from "next/image";

/** Màu nền avatar theo tên (ổn định, tông sơn mài Việt) khi không có ảnh */
const PALETTES = [
  "from-[#c81d25] to-[#f4a259]",
  "from-[#0f766e] to-[#5eead4]",
  "from-[#b45309] to-[#facc15]",
  "from-[#7c2d12] to-[#fb923c]",
  "from-[#1e3a8a] to-[#38bdf8]",
  "from-[#831843] to-[#f472b6]",
];

const paletteFor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
};

export default function UserAvatar({
  name,
  src,
  size = 48,
  online,
  ringClassName = "border-[#15182c]",
  className = "",
}: {
  name?: string;
  src?: string | null;
  size?: number;
  /** undefined = không hiện chấm trạng thái */
  online?: boolean;
  ringClassName?: string;
  className?: string;
}) {
  const dot = Math.max(10, Math.round(size * 0.26));
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-white/10">
          <Image
            src={src}
            alt={name || "Ảnh đại diện"}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-linear-to-br font-bold text-white ring-1 ring-white/10 ${paletteFor(name)}`}
          style={{ fontSize: size * 0.4 }}
        >
          {name?.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 ${ringClassName} ${
            online
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "bg-slate-500"
          }`}
          style={{ width: dot, height: dot }}
          aria-label={online ? "Đang hoạt động" : "Ngoại tuyến"}
        />
      )}
    </div>
  );
}
