import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";
import { AppShell } from "./app-shell";

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"light";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");var l=localStorage.getItem("locale");if(l==="en")document.documentElement.lang="en"}catch(e){}})()`,
          }}
        />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
