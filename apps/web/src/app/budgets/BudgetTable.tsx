"use client";

import styles from "./Budgets.module.css";
import type { BudgetGridRow, VsActualData } from "./types";
import { fmt, now, getRateColor, getProgressColor } from "./types";

/* ── 예산 설정 (월별 그리드) ── */

interface BudgetSettingTableProps {
  year: number;
  setYear: (v: number) => void;
  canEdit: boolean;
  canDelete: boolean;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  budgetGrid: BudgetGridRow[];
  onDeleteRow: (months: Record<number, { id: string; amount: number }>) => void;
  children?: React.ReactNode; // BudgetForm이 children으로 전달됨
}

export function BudgetSettingTable({
  year,
  setYear,
  canEdit,
  canDelete,
  showForm,
  setShowForm,
  budgetGrid,
  onDeleteRow,
  children,
}: BudgetSettingTableProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{year}년 예산 설정</h2>
        <div className={styles.sectionHeaderRight}>
          <select
            className={styles.controlSelect}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
              (y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ),
            )}
          </select>
          {canEdit && (
            <button
              className={styles.primaryBtn}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "취소" : "예산 등록"}
            </button>
          )}
        </div>
      </div>

      {/* 등록 폼 (children) */}
      {showForm && children}

      {/* 계정별 월별 예산 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>계정</th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={i} style={{ textAlign: "right" }}>
                  {i + 1}월
                </th>
              ))}
              <th style={{ textAlign: "right" }}>합계</th>
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {budgetGrid.map((row) => {
              const total = Object.values(row.months).reduce(
                (s, m) => s + m.amount,
                0,
              );
              return (
                <tr key={row.accountId}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.code} {row.name}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = row.months[i + 1];
                    return (
                      <td
                        key={i}
                        style={{
                          textAlign: "right",
                          color: m ? "inherit" : "var(--text-muted)",
                        }}
                      >
                        {m ? fmt(m.amount) : "-"}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {fmt(total)}
                  </td>
                  {canDelete && (
                    <td>
                      <button
                        className={styles.dangerBtn}
                        onClick={() => onDeleteRow(row.months)}
                      >
                        삭제
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {budgetGrid.length === 0 && (
              <tr>
                <td
                  colSpan={canDelete ? 15 : 14}
                  style={{ textAlign: "center", color: "var(--text-muted)" }}
                >
                  등록된 예산이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── 예산 vs 실적 비교 ── */

interface BudgetComparisonTableProps {
  compYear: number;
  setCompYear: (v: number) => void;
  compMonth: number | undefined;
  setCompMonth: (v: number | undefined) => void;
  vsActual: VsActualData | undefined;
  onExport: () => void;
}

export function BudgetComparisonTable({
  compYear,
  setCompYear,
  compMonth,
  setCompMonth,
  vsActual,
  onExport,
}: BudgetComparisonTableProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>예산 vs 실적</h2>
        <div className={styles.sectionHeaderRight}>
          <select
            className={styles.controlSelect}
            value={compYear}
            onChange={(e) => setCompYear(Number(e.target.value))}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
              (y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ),
            )}
          </select>
          <select
            className={styles.controlSelect}
            value={compMonth ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setCompMonth(v ? Number(v) : undefined);
            }}
          >
            <option value="">연간</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <span className={styles.unit}>(단위: 원)</span>
          <button
            className={styles.downloadBtn}
            onClick={onExport}
            disabled={!vsActual || vsActual.rows.length === 0}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>계정코드</th>
            <th>계정명</th>
            <th style={{ textAlign: "right" }}>예산</th>
            <th style={{ textAlign: "right" }}>실적</th>
            <th style={{ textAlign: "right" }}>차이</th>
            <th style={{ textAlign: "right", minWidth: 180 }}>소진율</th>
          </tr>
        </thead>
        <tbody>
          {vsActual?.rows.map((r) => (
            <tr key={r.accountId}>
              <td>{r.accountCode}</td>
              <td>{r.accountName}</td>
              <td style={{ textAlign: "right" }}>{fmt(r.budget)}</td>
              <td style={{ textAlign: "right" }}>{fmt(r.actual)}</td>
              <td
                style={{
                  textAlign: "right",
                  color: r.variance < 0 ? "var(--danger)" : "inherit",
                }}
              >
                {fmt(r.variance)}
              </td>
              <td style={{ textAlign: "right" }}>
                <div className={styles.rateCell}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${Math.min(r.rate, 100)}%`,
                        backgroundColor: getProgressColor(r.rate),
                      }}
                    />
                  </div>
                  <span className={getRateColor(r.rate, styles)}>
                    {r.rate}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
          {vsActual && vsActual.rows.length > 0 && (
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={2}>합계</td>
              <td style={{ textAlign: "right" }}>
                {fmt(vsActual.totalBudget)}
              </td>
              <td style={{ textAlign: "right" }}>
                {fmt(vsActual.totalActual)}
              </td>
              <td
                style={{
                  textAlign: "right",
                  color:
                    vsActual.totalVariance < 0
                      ? "var(--danger)"
                      : "inherit",
                }}
              >
                {fmt(vsActual.totalVariance)}
              </td>
              <td style={{ textAlign: "right" }}>
                <div className={styles.rateCell}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${Math.min(vsActual.totalRate, 100)}%`,
                        backgroundColor: getProgressColor(
                          vsActual.totalRate,
                        ),
                      }}
                    />
                  </div>
                  <span className={getRateColor(vsActual.totalRate, styles)}>
                    {vsActual.totalRate}%
                  </span>
                </div>
              </td>
            </tr>
          )}
          {(!vsActual || vsActual.rows.length === 0) && (
            <tr>
              <td
                colSpan={6}
                style={{ textAlign: "center", color: "var(--text-muted)" }}
              >
                해당 기간의 예산/실적 데이터가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
