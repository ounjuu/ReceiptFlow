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
            <Link href="/members" className={styles.navLink}>
              멤버 관리
            </Link>
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
