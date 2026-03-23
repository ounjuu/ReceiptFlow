"use client";

import { useRouter } from "next/navigation";
import type { TranslationKey } from "@/lib/translations";
import styles from "./Dashboard.module.css";
import {
  COLORS,
  fmt,
  type DashboardSummary,
  type DashboardKpi,
  type AlertItem,
} from "./types";

// --- 알림 배너 ---

export interface DashboardAlertsProps {
  alertItems: AlertItem[];
}

export function DashboardAlertsBanner({ alertItems }: DashboardAlertsProps) {
  const router = useRouter();

  if (alertItems.length === 0) return null;

  return (
    <div className={styles.alertsSection}>
      {alertItems.map((item, i) => (
        <div
          key={i}
          className={`${styles.alertItem} ${styles[`alert_${item.type}`]}`}
          onClick={() => router.push(item.href)}
        >
          <span className={styles.alertIcon}>{item.icon}</span>
          <span className={styles.alertMessage}>{item.message}</span>
          <span className={styles.alertArrow}>&rarr;</span>
        </div>
      ))}
    </div>
  );
}

// --- KPI 카드 Row 1: 재무 ---

export interface FinancialCardsProps {
  kpi: DashboardKpi | undefined;
  summary: DashboardSummary | undefined;
  t: (key: TranslationKey, params?: Record<string, unknown>) => string;
}

export function FinancialCards({ kpi, summary, t }: FinancialCardsProps) {
  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_monthlySales")}</div>
        <div className={styles.cardValue} style={{ color: COLORS.primary }}>
          ₩{fmt(kpi?.trades.salesTotal || 0)}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_monthlyPurchase")}</div>
        <div className={styles.cardValue} style={{ color: COLORS.warning }}>
          ₩{fmt(kpi?.trades.purchaseTotal || 0)}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_netIncome")}</div>
        <div
          className={styles.cardValue}
          style={{ color: summary && summary.netIncome >= 0 ? COLORS.success : COLORS.danger }}
        >
          {summary ? `₩${fmt(summary.netIncome)}` : "-"}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_bankBalance")}</div>
        <div className={styles.cardValue} style={{ color: COLORS.primary }}>
          ₩{fmt(kpi?.bankBalance || 0)}
        </div>
      </div>
    </div>
  );
}

// --- KPI 카드 Row 2: 운영 ---

export interface OperationalCardsProps {
  kpi: DashboardKpi | undefined;
  t: (key: TranslationKey, params?: Record<string, unknown>) => string;
}

export function OperationalCards({ kpi, t }: OperationalCardsProps) {
  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_receivable")}</div>
        <div
          className={styles.cardValue}
          style={{ color: (kpi?.trades.salesRemaining || 0) > 0 ? COLORS.danger : COLORS.success }}
        >
          ₩{fmt(kpi?.trades.salesRemaining || 0)}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_payable")}</div>
        <div
          className={styles.cardValue}
          style={{ color: (kpi?.trades.purchaseRemaining || 0) > 0 ? COLORS.warning : COLORS.success }}
        >
          ₩{fmt(kpi?.trades.purchaseRemaining || 0)}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_pendingExpense")}</div>
        <div className={styles.cardValue}>
          {t("dash_count", { count: kpi?.expenseClaims.pendingCount || 0 })}
        </div>
        {kpi && kpi.expenseClaims.pendingAmount > 0 && (
          <div className={styles.cardSub}>{t("dash_amount", { amount: fmt(kpi.expenseClaims.pendingAmount) })}</div>
        )}
      </div>
      <div className={styles.card}>
        <div className={styles.cardLabel}>{t("dash_pendingApproval")}</div>
        <div className={styles.cardValue}>
          {t("dash_count", { count: kpi?.approvals.pendingCount || 0 })}
        </div>
      </div>
    </div>
  );
}
