export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0c29] px-4 py-10">
      {/* AMBIENT BLOBS */}
      <div className="absolute top-[-100px] left-[-100px] h-[350px] w-[350px] rounded-full bg-violet-600/20 blur-[80px]" />
      <div className="absolute right-[-100px] bottom-[-100px] h-[350px] w-[350px] rounded-full bg-cyan-500/15 blur-[80px]" />
      <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />

      {/* GRID */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fff 1px, transparent 1px),
            linear-gradient(to bottom, #fff 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* GLASS CARD */}
      <div className="relative z-10 w-full max-w-3xl rounded-[20px]  shadow-2xl backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
