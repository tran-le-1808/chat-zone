import Header from "./Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef5f3]">
      <Header />

      <main>{children}</main>
    </div>
  );
}
