import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "忆梦博客管理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
