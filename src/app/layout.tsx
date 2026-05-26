import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SubHub Admin Console",
  description: "SubHub 自托管字幕网关管理控制台",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
