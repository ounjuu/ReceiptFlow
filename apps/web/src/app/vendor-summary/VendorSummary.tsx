"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { useLocale } from "@/lib/locale";
import { exportToXlsx } from "@/lib/export-xlsx";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/lib/Pagination";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import styles from "./VendorSummary.module.css";
import { fmtKR as fmt } from "@/lib/formatters";

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

      {/* 차트 섹션 */}
      {data && data.vendors.length > 0 && (
        <div className={styles.chartGrid}>
          {/* 매출 TOP 10 */}
          <div className={styles.chartSection}>
            <h2 className={styles.chartTitle}>매출 TOP 10</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[...data.vendors]
                  .sort((a, b) => b.salesAmount - a.salesAmount)
                  .slice(0, 10)
                  .map((v) => ({
                    name: v.vendorName.length > 8 ? v.vendorName.slice(0, 8) + "…" : v.vendorName,
                    매출: v.salesAmount,
                  }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => `₩${(v / 10000).toFixed(0)}만`} />
                <YAxis type="category" dataKey="name" width={90} fontSize={11} />
                <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, "매출"]} />
                <Bar dataKey="매출" radius={[0, 4, 4, 0]}>
                  {[...data.vendors]
                    .sort((a, b) => b.salesAmount - a.salesAmount)
                    .slice(0, 10)
                    .map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#2563eb" : i < 3 ? "#60a5fa" : "#93c5fd"} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 매출 vs 매입 비교 */}
          <div className={styles.chartSection}>
            <h2 className={styles.chartTitle}>거래처별 매출 vs 매입</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[...data.vendors]
                  .sort((a, b) => (b.salesAmount + b.purchaseAmount) - (a.salesAmount + a.purchaseAmount))
                  .slice(0, 10)
                  .map((v) => ({
                    name: v.vendorName.length > 6 ? v.vendorName.slice(0, 6) + "…" : v.vendorName,
                    매출: v.salesAmount,
                    매입: v.purchaseAmount,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4f0" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `₩${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, ""]} />
                <Legend />
                <Bar dataKey="매출" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="매입" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
