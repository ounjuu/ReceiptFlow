"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import styles from "./AnomalyDetection.module.css";

interface AmountAnomaly {
  journalEntryId: string;
  date: string;
  description: string | null;
  accountCode: string;
  accountName: string;
  amount: number;
  average: number;
  stdDev: number;
  deviationRate: number;
}

interface VendorAnomaly {
  journalEntryId: string;
  date: string;
  vendorName: string;
  amount: number;
}

interface TimeAnomaly {
  journalEntryId: string;
  date: string;
  description: string | null;
  dayOfWeek: string;
}

interface DuplicateSuspect {
  journalEntryIds: string[];
  date: string;
  vendorName: string;
  amount: number;
  count: number;
}

interface AnomalyResult {
  summary: {
    totalAnomalies: number;
    amountAnomalies: number;
    vendorAnomalies: number;
    timeAnomalies: number;
    duplicateSuspects: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  };
  amountAnomalies: AmountAnomaly[];
  vendorAnomalies: VendorAnomaly[];
  timeAnomalies: TimeAnomaly[];
  duplicateSuspects: DuplicateSuspect[];
  analyzedAt: string;
}

type TabKey = "amount" | "vendor" | "time" | "duplicate";

const RISK_LABEL: Record<string, string> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
};

export default function AnomalyDetection() {
  const { tenantId } = useAuth();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabKey>("amount");
  const [enabled, setEnabled] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["anomaly-detection", tenantId],
    queryFn: () =>
      apiGet<AnomalyResult>(`/reports/anomalies?tenantId=${tenantId}`),
    enabled: !!tenantId && enabled,
  });

  const handleRun = () => {
    if (enabled) {
      refetch();
    } else {
      setEnabled(true);
    }
  };

  const fmt = (n: number) => n.toLocaleString();
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    {
      key: "amount",
      label: t("anomaly_tabAmount"),
      count: data?.summary.amountAnomalies ?? 0,
    },
    {
      key: "vendor",
      label: t("anomaly_tabVendor"),
      count: data?.summary.vendorAnomalies ?? 0,
    },
    {
      key: "time",
      label: t("anomaly_tabTime"),
      count: data?.summary.timeAnomalies ?? 0,
    },
    {
      key: "duplicate",
      label: t("anomaly_tabDuplicate"),
      count: data?.summary.duplicateSuspects ?? 0,
    },
  ];

  const deviationClass = (rate: number) => {
    if (rate >= 4) return styles.deviationHigh;
    if (rate >= 3) return styles.deviationMedium;
    return "";
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("anomaly_title")}</h1>
        <button
          className={styles.runBtn}
          onClick={handleRun}
          disabled={isFetching}
        >
          {isFetching ? t("anomaly_analyzing") : t("anomaly_runBtn")}
        </button>

        {data && (
          <>
            <span
              className={`${styles.riskBadge} ${styles[`risk${data.summary.riskLevel}`]}`}
            >
              {t("anomaly_riskLevel")}: {RISK_LABEL[data.summary.riskLevel]}
            </span>
            <span className={styles.analyzedAt}>
              {t("anomaly_analyzedAt")}: {new Date(data.analyzedAt).toLocaleString("ko-KR")}
            </span>
          </>
        )}
      </div>

      {!data && !isFetching && (
        <div className={styles.empty}>{t("anomaly_clickToAnalyze")}</div>
      )}

      {isFetching && !data && (
        <div className={styles.loading}>{t("anomaly_analyzing")}</div>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>{t("anomaly_totalDetected")}</div>
              <div
                className={`${styles.summaryValue} ${data.summary.totalAnomalies > 0 ? styles.summaryDanger : ""}`}
              >
                {data.summary.totalAnomalies}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>{t("anomaly_tabAmount")}</div>
              <div
                className={`${styles.summaryValue} ${data.summary.amountAnomalies > 0 ? styles.summaryWarning : ""}`}
              >
                {data.summary.amountAnomalies}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>{t("anomaly_tabVendor")}</div>
              <div
                className={`${styles.summaryValue} ${data.summary.vendorAnomalies > 0 ? styles.summaryWarning : ""}`}
              >
                {data.summary.vendorAnomalies}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>{t("anomaly_tabTime")}</div>
              <div
                className={`${styles.summaryValue} ${data.summary.timeAnomalies > 0 ? styles.summaryInfo : ""}`}
              >
                {data.summary.timeAnomalies}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>{t("anomaly_tabDuplicate")}</div>
              <div
                className={`${styles.summaryValue} ${data.summary.duplicateSuspects > 0 ? styles.summaryDanger : ""}`}
              >
                {data.summary.duplicateSuspects}
              </div>
            </div>
          </div>

          {/* 탭 */}
          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span
                  className={`${styles.tabBadge} ${activeTab === tab.key ? styles.tabBadgeActive : ""}`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 금액 이상 */}
          {activeTab === "amount" && (
            <div className={styles.section}>
              {data.amountAnomalies.length === 0 ? (
                <div className={styles.empty}>{t("anomaly_noAmountAnomalies")}</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("anomaly_colDate")}</th>
                      <th>{t("anomaly_colDescription")}</th>
                      <th>{t("anomaly_colAccount")}</th>
                      <th style={{ textAlign: "right" }}>{t("anomaly_colAmount")}</th>
                      <th style={{ textAlign: "right" }}>{t("anomaly_colAverage")}</th>
                      <th style={{ textAlign: "right" }}>{t("anomaly_colDeviationRate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.amountAnomalies.map((a, i) => (
                      <tr key={i}>
                        <td>{fmtDate(a.date)}</td>
                        <td>{a.description || "-"}</td>
                        <td>{a.accountCode} {a.accountName}</td>
                        <td className={styles.amountCell}>
                          {fmt(a.amount)}{t("anomaly_won")}
                        </td>
                        <td className={styles.amountCell}>
                          {fmt(a.average)}{t("anomaly_won")}
                        </td>
                        <td
                          className={`${styles.amountCell} ${deviationClass(a.deviationRate)}`}
                        >
                          {a.deviationRate.toFixed(1)}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 신규 거래처 */}
          {activeTab === "vendor" && (
            <div className={styles.section}>
              <div className={styles.sectionInfo}>
                {t("anomaly_vendorInfo")}
              </div>
              {data.vendorAnomalies.length === 0 ? (
                <div className={styles.empty}>{t("anomaly_noVendorAnomalies")}</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("anomaly_colDate")}</th>
                      <th>{t("anomaly_colVendor")}</th>
                      <th style={{ textAlign: "right" }}>{t("anomaly_colAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendorAnomalies.map((v, i) => (
                      <tr key={i}>
                        <td>{fmtDate(v.date)}</td>
                        <td>{v.vendorName}</td>
                        <td className={styles.amountCell}>
                          {fmt(v.amount)}{t("anomaly_won")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 시간 이상 */}
          {activeTab === "time" && (
            <div className={styles.section}>
              {data.timeAnomalies.length === 0 ? (
                <div className={styles.empty}>{t("anomaly_noTimeAnomalies")}</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("anomaly_colDate")}</th>
                      <th>{t("anomaly_colDayOfWeek")}</th>
                      <th>{t("anomaly_colDescription")}</th>
                      <th>{t("anomaly_colNote")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timeAnomalies.map((a, i) => (
                      <tr key={i}>
                        <td>{fmtDate(a.date)}</td>
                        <td>
                          <span className={styles.weekendBadge}>
                            {a.dayOfWeek}
                          </span>
                        </td>
                        <td>{a.description || "-"}</td>
                        <td>{t("anomaly_weekendNote")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 중복 의심 */}
          {activeTab === "duplicate" && (
            <div className={styles.section}>
              {data.duplicateSuspects.length === 0 ? (
                <div className={styles.empty}>{t("anomaly_noDuplicates")}</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("anomaly_colDate")}</th>
                      <th>{t("anomaly_colVendor")}</th>
                      <th style={{ textAlign: "right" }}>{t("anomaly_colAmount")}</th>
                      <th style={{ textAlign: "center" }}>{t("anomaly_colCount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.duplicateSuspects.map((d, i) => (
                      <tr key={i}>
                        <td>{d.date}</td>
                        <td>{d.vendorName}</td>
                        <td className={styles.amountCell}>
                          {fmt(d.amount)}{t("anomaly_won")}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={styles.duplicateCount}>
                            {d.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
