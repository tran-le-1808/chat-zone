/**
 * Hoạ tiết mặt trống đồng Đông Sơn (vẽ bằng SVG): ngôi sao nhiều cánh ở tâm,
 * các vành tròn đồng tâm với răng cưa, chấm tròn và chim lạc cách điệu.
 * Dùng làm logo, nền trang trí & màn hình trống.
 */
/**
 * Làm tròn toạ độ: Math.sin/cos ở server (Node) và trình duyệt có thể lệch ở chữ số
 * thập phân cuối -> làm tròn để HTML server & client khớp nhau (tránh lỗi hydration).
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function DongSonDrum({
  className = "",
  rays = 14,
}: {
  className?: string;
  /** Số cánh ngôi sao ở tâm (trống thật thường 12–14 cánh) */
  rays?: number;
}) {
  const cx = 100;
  const star = Array.from({ length: rays * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 30 : 11;
    const a = (i / (rays * 2)) * Math.PI * 2 - Math.PI / 2;
    return `${r2(cx + r * Math.cos(a))},${r2(cx + r * Math.sin(a))}`;
  }).join(" ");
  const teeth = (radius: number, count: number, size: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const a2 = ((i + 0.5) / count) * Math.PI * 2;
      const x1 = r2(cx + radius * Math.cos(a));
      const y1 = r2(cx + radius * Math.sin(a));
      const x2 = r2(cx + (radius + size) * Math.cos(a2));
      const y2 = r2(cx + (radius + size) * Math.sin(a2));
      return `${i === 0 ? "M" : "L"}${x1},${y1} L${x2},${y2}`;
    }).join(" ") + " Z";
  const dots = (radius: number, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return {
        x: r2(cx + radius * Math.cos(a)),
        y: r2(cx + radius * Math.sin(a)),
      };
    });
  // Chim lạc cách điệu bay quanh vành ngoài
  const birds = Array.from({ length: 6 }, (_, i) => (i / 6) * 360);

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <circle cx={cx} cy={cx} r="96" strokeWidth="2" />
      <circle cx={cx} cy={cx} r="88" strokeWidth="1" />
      {birds.map((deg) => (
        <path
          key={deg}
          transform={`rotate(${deg} ${cx} ${cx})`}
          d="M100 18 q8 -5 16 0 q-6 1 -9 5 l-7 -1 q-4 -3 -10 -3 q5 -3 10 -1 Z"
          fill="currentColor"
          stroke="none"
          opacity="0.9"
        />
      ))}
      <circle cx={cx} cy={cx} r="72" strokeWidth="1.2" />
      <path d={teeth(64, 36, 6)} strokeWidth="1" />
      {dots(56, 24).map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r="1.8"
          fill="currentColor"
          stroke="none"
        />
      ))}
      <circle cx={cx} cy={cx} r="48" strokeWidth="1" />
      <circle cx={cx} cy={cx} r="40" strokeWidth="1" strokeDasharray="2 3" />
      <polygon points={star} fill="currentColor" stroke="none" />
    </svg>
  );
}
