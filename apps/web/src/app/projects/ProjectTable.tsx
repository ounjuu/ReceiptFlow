"use client";

import styles from "./Projects.module.css";
import { Project, PnLResult, ComparisonRow, fmt, statusLabel } from "./types";

// --- 프로젝트 관리 테이블 ---

export interface ProjectListTableProps {
  projects: Project[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

export function ProjectListTable({
  projects,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: ProjectListTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>코드</th>
          <th>프로젝트명</th>
          <th>상태</th>
          <th>시작일</th>
          <th>종료일</th>
          <th>담당자</th>
          <th style={{ textAlign: "right" }}>예산</th>
          {(canEdit || canDelete) && <th>관리</th>}
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => {
          const s = statusLabel(p.status);
          return (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td>
                <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
              </td>
              <td>{new Date(p.startDate).toLocaleDateString("ko-KR")}</td>
              <td>{p.endDate ? new Date(p.endDate).toLocaleDateString("ko-KR") : "-"}</td>
              <td>{p.manager || "-"}</td>
              <td style={{ textAlign: "right" }}>
                {p.budget != null ? `${fmt(p.budget)}원` : "-"}
              </td>
              {(canEdit || canDelete) && (
                <td>
                  <div className={styles.actions}>
                    {canEdit && (
                      <button className={styles.editBtn} onClick={() => onEdit(p)}>
                        수정
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className={styles.dangerBtn}
                        onClick={() => onDelete(p)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          );
        })}
        {projects.length === 0 && (
          <tr>
            <td
              colSpan={(canEdit || canDelete) ? 8 : 7}
              style={{ textAlign: "center", color: "var(--text-muted)" }}
            >
              등록된 프로젝트가 없습니다
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// --- 프로젝트 손익 ---

export interface ProjectPnLProps {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | undefined;
  pnlStartDate: string;
  pnlEndDate: string;
  pnlData: PnLResult | undefined;
  onSelectedProjectIdChange: (v: string) => void;
  onPnlStartDateChange: (v: string) => void;
  onPnlEndDateChange: (v: string) => void;
}

export function ProjectPnL({
  projects,
  selectedProjectId,
  selectedProject,
  pnlStartDate,
  pnlEndDate,
  pnlData,
  onSelectedProjectIdChange,
  onPnlStartDateChange,
  onPnlEndDateChange,
}: ProjectPnLProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>프로젝트별 손익 분석</h2>
        <div className={styles.sectionHeaderRight}>
          <select
            className={styles.controlSelect}
            value={selectedProjectId}
            onChange={(e) => onSelectedProjectIdChange(e.target.value)}
          >
            <option value="">프로젝트 선택</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} {p.name}
              </option>
            ))}
          </select>
          <input
            className={styles.formInput}
            type="date"
            value={pnlStartDate}
            onChange={(e) => onPnlStartDateChange(e.target.value)}
            style={{ width: 150 }}
          />
          <span className={styles.unit}>~</span>
          <input
            className={styles.formInput}
            type="date"
            value={pnlEndDate}
            onChange={(e) => onPnlEndDateChange(e.target.value)}
            style={{ width: 150 }}
          />
        </div>
      </div>

      {!selectedProjectId && (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
          프로젝트를 선택하세요
        </p>
      )}

      {selectedProjectId && pnlData && (
        <>
          {/* 요약 */}
          <div className={styles.summaryCards} style={{ marginBottom: 20 }}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>프로젝트</div>
              <div className={styles.summaryValue} style={{ fontSize: "1rem" }}>
                {selectedProject?.name}
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

// --- 프로젝트 비교 ---

export interface ProjectComparisonProps {
  comparison: ComparisonRow[];
  totalRevAll: number;
  totalExpAll: number;
  totalNetAll: number;
  onExport: () => void;
}

export function ProjectComparison({
  comparison,
  totalRevAll,
  totalExpAll,
  totalNetAll,
  onExport,
}: ProjectComparisonProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>프로젝트별 손익 비교</h2>
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
            <th>프로젝트명</th>
            <th>상태</th>
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
            const s = statusLabel(r.status);
            const budgetRate = r.budget && r.budget > 0
              ? Math.round((r.totalExpense / r.budget) * 1000) / 10
              : null;
            return (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td>
                  <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                </td>
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
                프로젝트가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
