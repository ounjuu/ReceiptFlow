"use client";

import styles from "./Departments.module.css";
import { Department, PnLResult, ComparisonRow, fmt } from "./types";

/* ── 부서 관리 탭 (목록 테이블) ── */

export interface DepartmentListProps {
  departments: Department[];
  canEdit: boolean;
  canDelete: boolean;
  showForm: boolean;
  onToggleForm: () => void;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
  formSlot: React.ReactNode;
}

export function DepartmentList({
  departments,
  canEdit,
  canDelete,
  showForm,
  onToggleForm,
  onEdit,
  onDelete,
  formSlot,
}: DepartmentListProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>부서 목록</h2>
        {canEdit && (
          <button className={styles.primaryBtn} onClick={onToggleForm}>
            {showForm ? "취소" : "부서 등록"}
          </button>
        )}
      </div>

      {showForm && formSlot}

      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>부서명</th>
            <th>담당자</th>
            <th>설명</th>
            <th style={{ textAlign: "right" }}>예산</th>
            {(canEdit || canDelete) && <th>관리</th>}
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id}>
              <td>{d.code}</td>
              <td>{d.name}</td>
              <td>{d.manager || "-"}</td>
              <td>{d.description || "-"}</td>
              <td style={{ textAlign: "right" }}>
                {d.budget != null ? `${fmt(d.budget)}원` : "-"}
              </td>
              {(canEdit || canDelete) && (
                <td>
                  <div className={styles.actions}>
                    {canEdit && (
                      <button className={styles.editBtn} onClick={() => onEdit(d)}>
                        수정
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className={styles.dangerBtn}
                        onClick={() => onDelete(d)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {departments.length === 0 && (
            <tr>
              <td
                colSpan={(canEdit || canDelete) ? 6 : 5}
                style={{ textAlign: "center", color: "var(--text-muted)" }}
              >
                등록된 부서가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── 부서 손익 탭 ── */

export interface DepartmentPnLProps {
  departments: Department[];
  selectedDeptId: string;
  selectedDeptName: string | undefined;
  pnlStartDate: string;
  pnlEndDate: string;
  pnlData: PnLResult | undefined;
  onDeptChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

export function DepartmentPnL({
  departments,
  selectedDeptId,
  selectedDeptName,
  pnlStartDate,
  pnlEndDate,
  pnlData,
  onDeptChange,
  onStartDateChange,
  onEndDateChange,
}: DepartmentPnLProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>부서별 손익 분석</h2>
        <div className={styles.sectionHeaderRight}>
          <select
            className={styles.controlSelect}
            value={selectedDeptId}
            onChange={(e) => onDeptChange(e.target.value)}
          >
            <option value="">부서 선택</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} {d.name}
              </option>
            ))}
          </select>
          <input
            className={styles.formInput}
            type="date"
            value={pnlStartDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            style={{ width: 150 }}
          />
          <span className={styles.unit}>~</span>
          <input
            className={styles.formInput}
            type="date"
            value={pnlEndDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            style={{ width: 150 }}
          />
        </div>
      </div>

      {!selectedDeptId && (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
          부서를 선택하세요
        </p>
      )}

      {selectedDeptId && pnlData && (
        <>
          {/* 요약 */}
          <div className={styles.summaryCards} style={{ marginBottom: 20 }}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>부서</div>
              <div className={styles.summaryValue} style={{ fontSize: "1rem" }}>
                {selectedDeptName}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>총 수익</div>
              <div className={`${styles.summaryValue} ${styles.summaryPositive}`}>
                {fmt(pnlData.totalRevenue)}원
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>총 비용</div>
              <div className={styles.summaryValue}>{fmt(pnlData.totalExpense)}원</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>순이익 (이익률 {pnlData.profitMargin}%)</div>
              <div className={`${styles.summaryValue} ${pnlData.netIncome >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
                {fmt(pnlData.netIncome)}원
              </div>
            </div>
          </div>

          {/* 수익/비용 상세 */}
          <div className={styles.pnlGrid}>
            <div className={styles.pnlCard}>
              <div className={styles.pnlCardTitle}>수익</div>
              {pnlData.revenue.map((r) => (
                <div key={r.code} className={styles.pnlItem}>
                  <span>{r.code} {r.name}</span>
                  <span>{fmt(r.amount)}원</span>
                </div>
              ))}
              {pnlData.revenue.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>수익 내역 없음</div>
              )}
              <div className={styles.pnlTotal}>
                <span>합계</span>
                <span>{fmt(pnlData.totalRevenue)}원</span>
              </div>
            </div>
            <div className={styles.pnlCard}>
              <div className={styles.pnlCardTitle}>비용</div>
              {pnlData.expense.map((r) => (
                <div key={r.code} className={styles.pnlItem}>
                  <span>{r.code} {r.name}</span>
                  <span>{fmt(r.amount)}원</span>
                </div>
              ))}
              {pnlData.expense.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>비용 내역 없음</div>
              )}
              <div className={styles.pnlTotal}>
                <span>합계</span>
                <span>{fmt(pnlData.totalExpense)}원</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 부서 비교 탭 ── */

export interface DepartmentComparisonProps {
  comparison: ComparisonRow[];
  totalRevAll: number;
  totalExpAll: number;
  totalNetAll: number;
  onExport: () => void;
}

export function DepartmentComparison({
  comparison,
  totalRevAll,
  totalExpAll,
  totalNetAll,
  onExport,
}: DepartmentComparisonProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>부서별 손익 비교</h2>
        <div className={styles.sectionHeaderRight}>
          <span className={styles.unit}>(단위: 원)</span>
          <button
            className={styles.downloadBtn}
            onClick={onExport}
            disabled={comparison.length === 0}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>부서명</th>
            <th>담당자</th>
            <th style={{ textAlign: "right" }}>예산</th>
            <th style={{ textAlign: "right" }}>총수익</th>
            <th style={{ textAlign: "right" }}>총비용</th>
            <th style={{ textAlign: "right" }}>순이익</th>
            <th style={{ textAlign: "right" }}>이익률</th>
            <th style={{ textAlign: "right", minWidth: 160 }}>예산소진</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map((r) => {
            const budgetRate = r.budget && r.budget > 0
              ? Math.round((r.totalExpense / r.budget) * 1000) / 10
              : null;
            return (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td>{r.manager || "-"}</td>
                <td style={{ textAlign: "right" }}>
                  {r.budget != null ? fmt(r.budget) : "-"}
                </td>
                <td style={{ textAlign: "right" }}>{fmt(r.totalRevenue)}</td>
                <td style={{ textAlign: "right" }}>{fmt(r.totalExpense)}</td>
                <td style={{ textAlign: "right" }} className={r.netIncome >= 0 ? styles.profitPositive : styles.profitNegative}>
                  {fmt(r.netIncome)}
                </td>
                <td style={{ textAlign: "right" }} className={r.profitMargin >= 0 ? styles.profitPositive : styles.profitNegative}>
                  {r.profitMargin}%
                </td>
                <td style={{ textAlign: "right" }}>
                  {budgetRate != null ? (
                    <div className={styles.rateCell}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${Math.min(budgetRate, 100)}%`,
                            backgroundColor: budgetRate > 100 ? "#ef4444" : budgetRate > 80 ? "#f59e0b" : "#22c55e",
                          }}
                        />
                      </div>
                      <span>{budgetRate}%</span>
                    </div>
                  ) : "-"}
                </td>
              </tr>
            );
          })}
          {comparison.length > 0 && (
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={4}>합계</td>
              <td style={{ textAlign: "right" }}>{fmt(totalRevAll)}</td>
              <td style={{ textAlign: "right" }}>{fmt(totalExpAll)}</td>
              <td style={{ textAlign: "right" }} className={totalNetAll >= 0 ? styles.profitPositive : styles.profitNegative}>
                {fmt(totalNetAll)}
              </td>
              <td colSpan={2}></td>
            </tr>
          )}
          {comparison.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                부서가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
