"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { useLocale } from "@/lib/locale";
import { exportToXlsx } from "@/lib/export-xlsx";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/lib/Pagination";
import styles from "./VendorSummary.module.css";

interface VendorRow {
  vendorId: string;
  vendorName: string;
  bizNo: string | null;
  salesAmount: number;
  purchaseAmount: number;
  netAmount: number;
  transactionCount: number;
}

interface VendorSummaryData {
  vendors: VendorRow[];
  totalSales: number;
  totalPurchase: number;
  totalNet: number;
}

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

export default function VendorSummary() {
  const { tenantId } = useAuth();
  const { t } = useLocale();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = [
    `tenantId=${tenantId}`,
    startDate && `startDate=${startDate}`,
    endDate && `endDate=${endDate}`,
  ].filter(Boolean).join("&");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-summary", queryParams],
    queryFn: () =>
      apiGet<VendorSummaryData>(`/reports/vendor-summary?${queryParams}`),
    enabled: !!tenantId,
  });

  const allVendors = data?.vendors ?? [];
  const { pageData: pagedVendors, page, totalPages, total, setPage } = usePagination(allVendors, 50);

  const handleDownload = () => {
    if (!data) return;

    const rows = data.vendors.map((v) => [
      v.vendorName,
      v.bizNo ?? "",
      v.salesAmount,
      v.purchaseAmount,
      v.netAmount,
      v.transactionCount,
    ]);

    // 합계 행
    rows.push([
      "합계",
      "",
      data.totalSales,
      data.totalPurchase,
      data.totalNet,
      data.vendors.reduce((sum, v) => sum + v.transactionCount, 0),
    ]);

    exportToXlsx(
      "거래처별현황",
      "거래처별현황",
      ["거래처명", "사업자번호", "매출", "매입", "순액", "건수"],
      rows,
    );
  };

  return (
    <div>
      <h1 className={styles.title}>{t("vendorSummary_title")}</h1>
      <p className={styles.subtitle}>{t("vendorSummary_subtitle")}</p>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>{t("vendorSummary_period")}</span>
        <input
          className={styles.filterInput}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span className={styles.filterSep}>~</span>
        <input
          className={styles.filterInput}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        {(startDate || endDate) && (
          <button
            className={styles.filterClear}
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            {t("vendorSummary_reset")}
          </button>
        )}
      </div>

      {/* 요약 카드 */}
      {data && (
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCardLabel}>{t("vendorSummary_vendorCount")}</div>
            <div className={styles.summaryCardValue}>{data.vendors.length}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCardLabel}>{t("vendorSummary_totalSales")}</div>
            <div className={`${styles.summaryCardValue} ${styles.blue}`}>{fmt(data.totalSales)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCardLabel}>{t("vendorSummary_totalPurchase")}</div>
            <div className={`${styles.summaryCardValue} ${styles.red}`}>{fmt(data.totalPurchase)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCardLabel}>{t("vendorSummary_totalNet")}</div>
            <div className={`${styles.summaryCardValue} ${data.totalNet >= 0 ? styles.blue : styles.red}`}>
              {fmt(data.totalNet)}
            </div>
          </div>
        </div>
      )}

      <div className={styles.headerRow}>
        <span className={styles.unit}>{t("vendorSummary_unit")}</span>
        <button className={styles.downloadBtn} onClick={handleDownload} disabled={!data}>
          {t("vendorSummary_download")}
        </button>
      </div>

      {isLoading && <p className={styles.loading}>{t("vendorSummary_loading")}</p>}

      {data && data.vendors.length === 0 && (
        <p className={styles.empty}>{t("vendorSummary_empty")}</p>
      )}

      {data && data.vendors.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("vendorSummary_colVendor")}</th>
                <th>{t("vendorSummary_colBizNo")}</th>
                <th className={styles.textRight}>{t("vendorSummary_colSales")}</th>
                <th className={styles.textRight}>{t("vendorSummary_colPurchase")}</th>
                <th className={styles.textRight}>{t("vendorSummary_colNet")}</th>
                <th className={styles.textRight}>{t("vendorSummary_colCount")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedVendors.map((v) => (
                <tr key={v.vendorId}>
                  <td>{v.vendorName}</td>
                  <td>{v.bizNo ?? "-"}</td>
                  <td className={`${styles.textRight} ${styles.blue}`}>{fmt(v.salesAmount)}</td>
                  <td className={`${styles.textRight} ${styles.red}`}>{fmt(v.purchaseAmount)}</td>
                  <td className={`${styles.textRight} ${v.netAmount >= 0 ? styles.blue : styles.red}`}>
                    {fmt(v.netAmount)}
                  </td>
                  <td className={styles.textRight}>{v.transactionCount}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td>{t("vendorSummary_total")}</td>
                <td></td>
                <td className={`${styles.textRight} ${styles.blue}`}>{fmt(data.totalSales)}</td>
                <td className={`${styles.textRight} ${styles.red}`}>{fmt(data.totalPurchase)}</td>
                <td className={`${styles.textRight} ${data.totalNet >= 0 ? styles.blue : styles.red}`}>
                  {fmt(data.totalNet)}
                </td>
                <td className={styles.textRight}>
                  {data.vendors.reduce((sum, v) => sum + v.transactionCount, 0)}
                </td>
              </tr>
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
