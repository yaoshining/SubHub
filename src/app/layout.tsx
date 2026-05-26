import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SubHub Admin Console",
  description: "SubHub 自托管字幕网关管理控制台"
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#0B1020"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
