import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "say.mine — 내 이야기로 시작하는 영어",
  description: "설문과 실제 경험으로 만드는 OPIc 말하기 노트.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
