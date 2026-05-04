import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spring Meadow Community",
  description: "Official public website for Spring Meadow Community.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
