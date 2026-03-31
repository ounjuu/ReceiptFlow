"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLocale } from "@/lib/locale";
import { apiGet } from "@/lib/api";
import styles from "./layout.module.css";
import type { TranslationKey } from "@/lib/translations";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  roles?: string[]; // 접근 가능 역할 (미지정 시 전체)
}

interface NavGroup {
  groupKey: string; // CSS 클래스용 / 접기 상태 키
  labelKey: TranslationKey;
  items: NavItem[];
}

// 더존 Smart A 스타일 메뉴 구성
const navGroups: NavGroup[] = [
  {
    groupKey: "home",
    labelKey: "navGroup_home" as TranslationKey,
    items: [
      { href: "/dashboard", labelKey: "nav_dashboard" },
    ],
  },
  {
    groupKey: "accounting",
    labelKey: "navGroup_accounting" as TranslationKey,
    items: [
      { href: "/journals", labelKey: "nav_journals", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/accounts", labelKey: "nav_accounts" },
      { href: "/vendors", labelKey: "nav_vendors" },
      { href: "/vendor-ledger", labelKey: "nav_vendorLedger" },
      { href: "/documents", labelKey: "nav_documents", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/journal-templates", labelKey: "nav_journalTemplates", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/journal-rules", labelKey: "nav_journalRules", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/approvals", labelKey: "nav_approvals", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/closings", labelKey: "nav_closings", roles: ["ADMIN"] },
    ],
  },
  {
    groupKey: "sales",
    labelKey: "navGroup_sales" as TranslationKey,
    items: [
      { href: "/trades", labelKey: "nav_trades", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/tax-invoices", labelKey: "nav_taxInvoices", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/expense-claims", labelKey: "nav_expenseClaims", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/inventory", labelKey: "nav_inventory", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/cost-management", labelKey: "nav_costManagement", roles: ["ADMIN", "ACCOUNTANT"] },
    ],
  },
  {
    groupKey: "finance",
    labelKey: "navGroup_finance" as TranslationKey,
    items: [
      { href: "/reports", labelKey: "nav_reports" },
      { href: "/cash-flow", labelKey: "nav_cashFlow" },
      { href: "/budgets", labelKey: "nav_budgets", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/bank-accounts", labelKey: "nav_bankAccounts" },
      { href: "/fixed-assets", labelKey: "nav_fixedAssets", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/exchange-rates", labelKey: "nav_exchangeRates" },
    ],
  },
  {
    groupKey: "tax",
    labelKey: "navGroup_tax" as TranslationKey,
    items: [
      { href: "/vat-returns", labelKey: "nav_vatReturns" },
      { href: "/tax-filing", labelKey: "nav_taxFiling", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/year-end-settlement", labelKey: "nav_yearEndSettlement", roles: ["ADMIN", "ACCOUNTANT"] },
    ],
  },
  {
    groupKey: "hr",
    labelKey: "navGroup_hr" as TranslationKey,
    items: [
      { href: "/payroll", labelKey: "nav_payroll", roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/departments", labelKey: "nav_departments" },
      { href: "/projects", labelKey: "nav_projects" },
    ],
  },
  {
    groupKey: "admin",
    labelKey: "navGroup_admin" as TranslationKey,
    items: [
      { href: "/members", labelKey: "nav_members", roles: ["ADMIN"] },
      { href: "/audit-logs", labelKey: "nav_auditLogs", roles: ["ADMIN"] },
      { href: "/settings", labelKey: "nav_settings" },
    ],
  },
];

const ROLE_KEYS: Record<string, TranslationKey> = {
  ADMIN: "role_ADMIN",
  ACCOUNTANT: "role_ACCOUNTANT",
  VIEWER: "role_VIEWER",
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

interface DashboardAlerts {
  draftCount: number;
  approvedCount: number;
  pendingDocCount: number;
  closing: { year: number; month: number; isClosed: boolean; daysUntilMonthEnd: number };
  recentLogs: unknown[];
}

interface DashboardKpi {
  trades: { salesTotal: number; salesRemaining: number; purchaseTotal: number; purchaseRemaining: number };
  bankBalance: number;
  expenseClaims: { pendingCount: number; pendingAmount: number };
  inventory: { lowStockCount: number };
  approvals: { pendingCount: number };
  budget: { year: number; totalBudget: number };
}

interface NotifItem {
  type: "warning" | "danger" | "info" | "muted";
  message: string;
  href: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin, role, tenantId } = useAuth();
  const { isDark, setTheme } = useTheme();
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  // 모바일 사이드바 상태
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 그룹 접기/펼치기 상태 (현재 페이지가 속한 그룹은 자동 펼침)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchGroup[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 알림 상태
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const isLoginPage = pathname === "/login";
  const isLoggedIn = !loading && !!user && !isLoginPage;

  const { data: alertsData } = useQuery({
    queryKey: ["notif-alerts", tenantId],
    queryFn: () => apiGet<DashboardAlerts>(`/reports/dashboard-alerts?tenantId=${tenantId}`),
    enabled: isLoggedIn && !!tenantId,
    refetchInterval: 30000,
  });

  const { data: kpiData } = useQuery({
    queryKey: ["notif-kpi", tenantId],
    queryFn: () => apiGet<DashboardKpi>(`/reports/dashboard-kpi?tenantId=${tenantId}`),
    enabled: isLoggedIn && !!tenantId,
    refetchInterval: 30000,
  });

  const notifications = useMemo(() => {
    const items: NotifItem[] = [];
    if (alertsData) {
      if (alertsData.draftCount > 0)
        items.push({ type: "warning", message: t("notif_draftPending", { count: alertsData.draftCount }), href: "/journals" });
      if (alertsData.approvedCount > 0)
        items.push({ type: "info", message: t("notif_approvedPending", { count: alertsData.approvedCount }), href: "/journals" });
      if (!alertsData.closing.isClosed && alertsData.closing.daysUntilMonthEnd <= 5)
        items.push({ type: "danger", message: t("notif_closingDays", { month: alertsData.closing.month, days: alertsData.closing.daysUntilMonthEnd }), href: "/closings" });
      if (alertsData.pendingDocCount > 0)
        items.push({ type: "muted", message: t("notif_pendingDocs", { count: alertsData.pendingDocCount }), href: "/documents" });
    }
    if (kpiData) {
      if (kpiData.approvals.pendingCount > 0)
        items.push({ type: "info", message: t("notif_pendingApprovals", { count: kpiData.approvals.pendingCount }), href: "/approvals" });
      if (kpiData.inventory.lowStockCount > 0)
        items.push({ type: "danger", message: t("notif_lowStock", { count: kpiData.inventory.lowStockCount }), href: "/inventory" });
      if (kpiData.expenseClaims.pendingCount > 0)
        items.push({ type: "warning", message: t("notif_pendingExpense", { count: kpiData.expenseClaims.pendingCount }), href: "/expense-claims" });
      if (kpiData.trades.salesRemaining > 0)
        items.push({ type: "warning", message: t("notif_outstanding", { amount: kpiData.trades.salesRemaining.toLocaleString() }), href: "/trades" });
    }
    return items;
  }, [alertsData, kpiData, t]);

  // 미로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // 페이지 이동 시 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
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
        <span className={styles.loadingText}>{t("header_loading")}</span>
      </div>
    );
  }

  // 미로그인 (리다이렉트 대기)
  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.logo}>LedgerFlow</div>
        <nav className={styles.nav}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(role || ""),
            );
            if (visibleItems.length === 0) return null;

            // 현재 페이지가 이 그룹에 속하면 자동 펼침
            const isActiveGroup = visibleItems.some((item) => pathname.startsWith(item.href));
            const isCollapsed = collapsedGroups.has(group.groupKey) && !isActiveGroup;

            return (
              <div key={group.groupKey} className={styles.navGroup}>
                <button
                  className={`${styles.navGroupLabel} ${isActiveGroup ? styles.navGroupActive : ""}`}
                  onClick={() => toggleGroup(group.groupKey)}
                >
                  <span>{t(group.labelKey)}</span>
                  <svg
                    className={`${styles.navGroupArrow} ${isCollapsed ? styles.navGroupArrowCollapsed : ""}`}
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {!isCollapsed && visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navLink} ${pathname.startsWith(item.href) ? styles.navLinkActive : ""}`}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen((v) => !v)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className={styles.headerTitle}>LedgerFlow ERP</span>
          <div className={styles.searchBar} ref={searchRef}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder={t("header_search")}
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            />
            {searching && <span className={styles.searchSpinner}>{t("header_searching")}</span>}
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
                  {t("header_viewAll")}
                </div>
              </div>
            )}
          </div>
          <div className={styles.notifWrapper} ref={notifRef}>
            <button
              className={styles.notifBtn}
              onClick={() => setShowNotif((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifications.length > 0 && (
                <span className={styles.notifBadge}>{notifications.length}</span>
              )}
            </button>
            {showNotif && (
              <div className={styles.notifDropdown}>
                <div className={styles.notifHeader}>{t("header_notifications")}</div>
                {notifications.length === 0 ? (
                  <div className={styles.notifEmpty}>{t("header_noNotifications")}</div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={i}
                      className={`${styles.notifItem} ${styles[`notif_${n.type}`]}`}
                      onClick={() => {
                        setShowNotif(false);
                        router.push(n.href);
                      }}
                    >
                      <span className={styles.notifDot} />
                      <span className={styles.notifMessage}>{n.message}</span>
                      <span className={styles.notifArrow}>&rsaquo;</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className={styles.themeBtn}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? t("header_lightMode") : t("header_darkMode")}
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <div className={styles.userArea}>
            {role && (
              <span className={styles.roleBadge}>
                {ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role}
              </span>
            )}
            <span className={styles.userName}>{user.name}</span>
            <button className={styles.logoutBtn} onClick={logout}>
              {t("header_logout")}
            </button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
