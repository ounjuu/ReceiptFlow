"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
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
  { href: "/departments", label: "부서별 손익" },
  { href: "/trades", label: "매출/매입" },
  { href: "/cost-management", label: "원가 관리" },
  { href: "/inventory", label: "재고 관리" },
  { href: "/expense-claims", label: "경비 정산" },
  { href: "/bank-accounts", label: "은행/계좌" },
  { href: "/vat-returns", label: "부가세 신고" },
  { href: "/exchange-rates", label: "환율 관리" },
  { href: "/journal-templates", label: "반복 전표" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자",
  ACCOUNTANT: "회계담당",
  VIEWER: "열람자",
};

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

interface SearchGroup {
  entity: string;
  label: string;
  items: SearchItem[];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin, role, tenantId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchGroup[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isLoginPage = pathname === "/login";

  // 미로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !tenantId) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      setSearching(true);
      try {
        const data = await apiGet<{ results: SearchGroup[]; totalCount: number }>(
          `/search?tenantId=${tenantId}&q=${encodeURIComponent(q.trim())}&limit=5`,
        );
        setSearchResults(data.results);
        setShowDropdown(data.results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [tenantId],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleItemClick = (link: string) => {
    setShowDropdown(false);
    setSearchQuery("");
    router.push(link);
  };

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
          <div className={styles.searchBar} ref={searchRef}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="통합 검색 (거래처, 전표, 계정과목...)"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            />
            {searching && <span className={styles.searchSpinner}>검색 중...</span>}
            {showDropdown && searchResults.length > 0 && (
              <div className={styles.searchDropdown}>
                {searchResults.map((group) => (
                  <div key={group.entity} className={styles.searchGroup}>
                    <div className={styles.searchGroupLabel}>{group.label}</div>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className={styles.searchItem}
                        onClick={() => handleItemClick(item.link)}
                      >
                        <span className={styles.searchItemTitle}>{item.title}</span>
                        {item.subtitle && (
                          <span className={styles.searchItemSub}>{item.subtitle}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                <div
                  className={styles.searchViewAll}
                  onClick={() => {
                    setShowDropdown(false);
                    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  }}
                >
                  전체 결과 보기
                </div>
              </div>
            )}
          </div>
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
