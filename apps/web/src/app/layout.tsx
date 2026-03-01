import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LedgerFlow ERP",
  description: "AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
