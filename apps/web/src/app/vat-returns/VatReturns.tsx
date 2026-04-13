"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import type { VatReturn } from "./types";
import { vatFmt as fmt } from "./types";
import VatReturnsTable from "./VatReturnsTable";
import styles from "./VatReturns.module.css";

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "FINALIZED": return { text: "확정", cls: styles.statusFinalized };
    default: return { text: status, cls: "" };
  }
}

export default function VatReturnsPage() {
  const { tenantId } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const { data, isLoading } = useQuery({
    queryKey: ["vatReturn", year, quarter],
    queryFn: () =>
      apiGet<VatReturn>(
        `/tax-invoices/report/vat-return?tenantId=${tenantId}&year=${year}&quarter=${quarter}`,
      ),
    enabled: !!tenantId,
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const handleExport = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // 매출 시트
    const salesHeaders = ["번호", "세금계산서번호", "일자", "사업자번호", "거래처", "공급가액", "세액", "합계", "상태"];
    const salesRows = data.sales.invoices.map((inv, i) => [
      i + 1,
      inv.invoiceNo || "",
      new Date(inv.invoiceDate).toLocaleDateString("ko-KR"),
      inv.bizNo,
      inv.name,
      inv.supplyAmount,
      inv.taxAmount,
      inv.totalAmount,
      statusLabel(inv.status).text,
    ]);
    salesRows.push(["", "", "", "", "합계", data.sales.supplyAmount, data.sales.taxAmount, data.sales.supplyAmount + data.sales.taxAmount, ""]);
    const ws1 = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows]);
    XLSX.utils.book_append_sheet(wb, ws1, "매출 세금계산서");

    // 매입 시트
    const purchaseRows = data.purchase.invoices.map((inv, i) => [
      i + 1,
      inv.invoiceNo || "",
      new Date(inv.invoiceDate).toLocaleDateString("ko-KR"),
      inv.bizNo,
      inv.name,
      inv.supplyAmount,
      inv.taxAmount,
      inv.totalAmount,
      statusLabel(inv.status).text,
    ]);
    purchaseRows.push(["", "", "", "", "합계", data.purchase.supplyAmount, data.purchase.taxAmount, data.purchase.supplyAmount + data.purchase.taxAmount, ""]);
    const ws2 = XLSX.utils.aoa_to_sheet([salesHeaders, ...purchaseRows]);
    XLSX.utils.book_append_sheet(wb, ws2, "매입 세금계산서");

    // 요약 시트
    const summaryData = [
      ["부가세 신고 요약"],
      [`${data.year}년 ${data.quarter}분기`],
      [],
      ["구분", "건수", "공급가액", "세액"],
      ["매출", data.sales.invoiceCount, data.sales.supplyAmount, data.sales.taxAmount],
      ["매입", data.purchase.invoiceCount, data.purchase.supplyAmount, data.purchase.taxAmount],
      [],
      ["납부세액 계산"],
      ["매출세액", data.outputTax],
      ["매입세액", data.inputTax],
      ["납부(환급)세액", data.netTax],
      [],
      ["전표 교차검증"],
      ["부가세예수금 (25500)", data.journalValidation.vatPayable],
      ["부가세대급금 (13500)", data.journalValidation.vatReceivable],
      ["검증결과", data.journalValidation.isMatched ? "일치" : "불일치"],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, "요약");

    XLSX.writeFile(wb, `부가세신고서_${data.year}_${data.quarter}Q.xlsx`);
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>부가세 신고서</h1>
        <div className={styles.controls}>
          <select
            className={styles.select}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
          >
            <option value={1}>1분기 (1~3월)</option>
            <option value={2}>2분기 (4~6월)</option>
            <option value={3}>3분기 (7~9월)</option>
            <option value={4}>4분기 (10~12월)</option>
          </select>
          <button
            className={styles.downloadBtn}
            onClick={handleExport}
            disabled={!data}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      {isLoading && <div className={styles.loading}>데이터를 불러오는 중...</div>}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className={styles.summarySection}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>매출 공급가액</div>
              <div className={styles.summaryValue}>{fmt(data.sales.supplyAmount)}</div>
              <div className={styles.summaryCount}>{data.sales.invoiceCount}건</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>매입 공급가액</div>
              <div className={styles.summaryValue}>{fmt(data.purchase.supplyAmount)}</div>
              <div className={styles.summaryCount}>{data.purchase.invoiceCount}건</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>매출세액</div>
              <div className={styles.summaryValue}>{fmt(data.outputTax)}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>매입세액</div>
              <div className={styles.summaryValue}>{fmt(data.inputTax)}</div>
            </div>
          </div>

          {/* 납부세액 계산 */}
          <div className={styles.calcSection}>
            <div className={styles.calcTitle}>납부세액 계산</div>
            <div className={styles.calcGrid}>
              <div className={styles.calcItem}>
                <div className={styles.calcItemLabel}>매출세액</div>
                <div className={styles.calcItemValue}>{fmt(data.outputTax)}</div>
              </div>
              <div className={styles.calcOp}>-</div>
              <div className={styles.calcItem}>
                <div className={styles.calcItemLabel}>매입세액</div>
                <div className={styles.calcItemValue}>{fmt(data.inputTax)}</div>
              </div>
              <div className={styles.calcOp}>=</div>
              <div className={styles.calcItem}>
                <div className={styles.calcItemLabel}>납부(환급)세액</div>
                <div className={`${styles.calcItemValue} ${data.netTax >= 0 ? styles.positive : styles.negative}`}>
                  {data.netTax >= 0 ? "" : "-"}{fmt(Math.abs(data.netTax))}
                </div>
                <span className={`${styles.refundBadge} ${data.isRefund ? styles.refundYes : styles.refundNo}`}>
                  {data.isRefund ? "환급" : "납부"}
                </span>
              </div>
            </div>
          </div>

          {/* 교차검증 */}
          <div className={styles.validationSection}>
            <div className={styles.validationTitle}>전표 교차검증</div>
            <div className={styles.validationGrid}>
              <div className={styles.validationItem}>
                <span className={styles.validationLabel}>부가세예수금 (25500) 대변잔액</span>
                <span className={styles.validationValue}>{fmt(data.journalValidation.vatPayable)}</span>
              </div>
              <div className={styles.validationItem}>
                <span className={styles.validationLabel}>매출세액 합계</span>
                <span className={styles.validationValue}>{fmt(data.outputTax)}</span>
              </div>
              <div className={styles.validationItem}>
                <span className={styles.validationLabel}>부가세대급금 (13500) 차변잔액</span>
                <span className={styles.validationValue}>{fmt(data.journalValidation.vatReceivable)}</span>
              </div>
              <div className={styles.validationItem}>
                <span className={styles.validationLabel}>매입세액 합계</span>
                <span className={styles.validationValue}>{fmt(data.inputTax)}</span>
              </div>
            </div>
            <div className={`${styles.validationResult} ${data.journalValidation.isMatched ? styles.matched : styles.mismatched}`}>
              <span className={styles.validationIcon}>
                {data.journalValidation.isMatched ? "✓" : "✗"}
              </span>
              <span className={styles.validationText}>
                {data.journalValidation.isMatched
                  ? "세금계산서 합계와 전표 부가세 계정 잔액이 일치합니다"
                  : "세금계산서 합계와 전표 부가세 계정 잔액이 불일치합니다. 전표를 확인해주세요"}
              </span>
            </div>
          </div>

          {/* 매출 세금계산서 목록 */}
          <VatReturnsTable
            title="매출 세금계산서"
            subtitle={`${data.year}년 ${data.quarter}분기 매출 세금계산서 목록`}
            invoices={data.sales.invoices}
            totalSupply={data.sales.supplyAmount}
            totalTax={data.sales.taxAmount}
          />

          {/* 매입 세금계산서 목록 */}
          <VatReturnsTable
            title="매입 세금계산서"
            subtitle={`${data.year}년 ${data.quarter}분기 매입 세금계산서 목록`}
            invoices={data.purchase.invoices}
            totalSupply={data.purchase.supplyAmount}
            totalTax={data.purchase.taxAmount}
          />
        </>
      )}
    </div>
  );
}
