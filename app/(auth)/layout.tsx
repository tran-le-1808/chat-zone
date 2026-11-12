import DongSonDrum from "@/components/ui/DongSonDrum";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0d0f1e] px-3 py-6 text-white sm:px-4 sm:py-10">
      {/* Nền: ánh đỏ son & vàng kim + mặt trống đồng mờ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#c81d25]/25 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-[#f4b942]/15 blur-[140px]" />
        <DongSonDrum className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 text-[#f4b942]/[0.04]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">{children}</div>
    </div>
  );
}
