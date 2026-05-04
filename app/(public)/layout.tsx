import { PublicNav } from "@/components/public/public-nav";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PublicNav />
      <main>{children}</main>
    </div>
  );
}
