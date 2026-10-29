import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "가짜 예술가",
  description: "한 명의 가짜 예술가를 찾아라",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "가짜 예술가" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#E11D48",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans">
        {children}
        {/* 광배월드 공용 스크립트: 광배월드에서 온 경우에만 동작 (돌아가기 버튼·다음 게임 따라가기) */}
        <Script src="https://kwangbban.vercel.app/hub.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
