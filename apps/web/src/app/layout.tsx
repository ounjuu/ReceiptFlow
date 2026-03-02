import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "LedgerFlow ERP",
  description: "AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템",
};

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/documents", label: "영수증 관리" },
  { href: "/journals", label: "전표 관리" },
  { href: "/reports", label: "재무제표" },
  { href: "/accounts", label: "계정과목" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <div className={styles.container}>
            <aside className={styles.sidebar}>
              <div className={styles.logo}>LedgerFlow</div>
              <nav className={styles.nav}>
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className={styles.navLink}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>
            <div className={styles.main}>
              <header className={styles.header}>LedgerFlow ERP</header>
              <main className={styles.content}>{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
