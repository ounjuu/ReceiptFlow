"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import styles from "./layout.module.css";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/documents", label: "영수증 관리" },
  { href: "/journals", label: "전표 관리" },
  { href: "/reports", label: "재무제표" },
  { href: "/accounts", label: "계정과목" },
  { href: "/vendors", label: "거래처" },
  { href: "/vendor-ledger", label: "거래처 원장" },
  { href: "/closings", label: "결산" },
  { href: "/cash-flow", label: "자금 관리" },
  { href: "/tax-invoices", label: "세금계산서" },
  { href: "/approvals", label: "전자결재" },
  { href: "/fixed-assets", label: "고정자산" },
  { href: "/payroll", label: "급여 관리" },
  { href: "/budgets", label: "예산 관리" },
  { href: "/projects", label: "프로젝트 손익" },
  { href: "/trades", label: "매출/매입" },
  { href: "/exchange-rates", label: "환율 관리" },
  { href: "/journal-templates", label: "반복 전표" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자",
  ACCOUNTANT: "회계담당",
  VIEWER: "열람자",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  // 미로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // 로그인 페이지: 사이드바/헤더 없이 렌더링
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 로딩 중
  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <span className={styles.loadingText}>로딩 중...</span>
      </div>
    );
  }

  // 미로그인 (리다이렉트 대기)
  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>LedgerFlow</div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link href="/members" className={styles.navLink}>
                멤버 관리
              </Link>
              <Link href="/audit-logs" className={styles.navLink}>
                감사 로그
              </Link>
            </>
          )}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <span>LedgerFlow ERP</span>
          <div className={styles.userArea}>
            {role && (
              <span className={styles.roleBadge}>
                {ROLE_LABEL[role] || role}
              </span>
            )}
            <span className={styles.userName}>{user.name}</span>
            <button className={styles.logoutBtn} onClick={logout}>
              로그아웃
            </button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
