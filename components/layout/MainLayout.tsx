import DongSonDrum from "@/components/ui/DongSonDrum";
import Header from "./Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0d0f1e] text-white">
      {/* Nền: ánh đỏ son & vàng kim + mặt trống đồng mờ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#c81d25]/20 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-[#f4b942]/10 blur-[140px]" />
        <DongSonDrum className="absolute -right-40 top-1/2 h-[720px] w-[720px] -translate-y-1/2 text-[#f4b942]/[0.035]" />
      </div>

      <Header />

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
