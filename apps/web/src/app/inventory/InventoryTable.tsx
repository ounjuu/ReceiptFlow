"use client";

import {
  StockItem,
  InventoryTx,
  ValuationItem,
  LowStockItem,
  Summary,
  TX_TYPE_LABEL,
  TX_TYPE_STYLE,
  fmt,
} from "./types";
import styles from "./Inventory.module.css";

/* ─── 현재 재고 ─── */

export interface StockTableProps {
  filteredStock: StockItem[];
  stockSearch: string;
  onStockSearchChange: (value: string) => void;
}

export function StockTable({ filteredStock, stockSearch, onStockSearchChange }: StockTableProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>현재 재고 현황</h2>
        <input
          className={styles.searchInput}
          placeholder="품목 검색..."
          value={stockSearch}
          onChange={(e) => onStockSearchChange(e.target.value)}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>품목명</th>
            <th>카테고리</th>
            <th>단위</th>
            <th style={{ textAlign: "right" }}>현재고</th>
            <th style={{ textAlign: "right" }}>이동평균단가</th>
            <th style={{ textAlign: "right" }}>재고금액</th>
            <th style={{ textAlign: "right" }}>안전재고</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {filteredStock.map((s) => (
            <tr key={s.id} className={s.isLow ? styles.lowStockRow : ""}>
              <td>{s.code}</td>
              <td>{s.name}</td>
              <td>{s.category || "-"}</td>
              <td>{s.unit || "-"}</td>
              <td style={{ textAlign: "right" }}>{fmt(s.currentStock)}</td>
              <td style={{ textAlign: "right" }}>{fmt(s.avgCost)}원</td>
              <td style={{ textAlign: "right" }}>{fmt(s.stockValue)}원</td>
              <td style={{ textAlign: "right" }}>{s.safetyStock > 0 ? fmt(s.safetyStock) : "-"}</td>
              <td>
                {s.currentStock === 0 ? (
                  <span className={`${styles.badge} ${styles.badgeOut}`}>재고없음</span>
                ) : s.isLow ? (
                  <span className={`${styles.badge} ${styles.badgeLow}`}>부족</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeOk}`}>정상</span>
                )}
              </td>
            </tr>
          ))}
          {filteredStock.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                등록된 품목이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── 입출고 이력 ─── */

export interface TransactionHistoryProps {
  transactions: InventoryTx[];
  stockList: StockItem[];
  canEdit: boolean;
  filterTxType: string;
  filterProductId: string;
  filterStartDate: string;
  filterEndDate: string;
  isDeletePending: boolean;
  onFilterTxTypeChange: (value: string) => void;
  onFilterProductIdChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
  onExportHistory: () => void;
  onDelete: (id: string) => void;
}

export function TransactionHistory({
  transactions,
  stockList,
  canEdit,
  filterTxType,
  filterProductId,
  filterStartDate,
  filterEndDate,
  isDeletePending,
  onFilterTxTypeChange,
  onFilterProductIdChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onExportHistory,
  onDelete,
}: TransactionHistoryProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>입출고 이력</h2>
        <button className={styles.downloadBtn} onClick={onExportHistory} disabled={transactions.length === 0}>
          엑셀 다운로드
        </button>
      </div>

      <div className={styles.filterRow}>
        <select
          className={styles.filterSelect}
          value={filterTxType}
          onChange={(e) => onFilterTxTypeChange(e.target.value)}
        >
          <option value="">전체 유형</option>
          <option value="IN">입고</option>
          <option value="OUT">출고</option>
          <option value="ADJUST">조정</option>
        </select>
        <select
          className={styles.filterSelect}
          value={filterProductId}
          onChange={(e) => onFilterProductIdChange(e.target.value)}
        >
          <option value="">전체 품목</option>
          {stockList.map((s) => (
            <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
          ))}
        </select>
        <input
          className={styles.formInput}
          type="date"
          value={filterStartDate}
          onChange={(e) => onFilterStartDateChange(e.target.value)}
          style={{ width: 150 }}
        />
        <span className={styles.filterSep}>~</span>
        <input
          className={styles.formInput}
          type="date"
          value={filterEndDate}
          onChange={(e) => onFilterEndDateChange(e.target.value)}
          style={{ width: 150 }}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>번호</th>
            <th>유형</th>
            <th>일자</th>
            <th>품목</th>
            <th style={{ textAlign: "right" }}>수량</th>
            <th style={{ textAlign: "right" }}>단가</th>
            <th style={{ textAlign: "right" }}>총액</th>
            <th style={{ textAlign: "right" }}>변동전</th>
            <th style={{ textAlign: "right" }}>변동후</th>
            <th>사유</th>
            {canEdit && <th>작업</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{t.txNo}</td>
              <td>
                <span className={`${styles.badge} ${styles[TX_TYPE_STYLE[t.txType]] || ""}`}>
                  {TX_TYPE_LABEL[t.txType] || t.txType}
                </span>
              </td>
              <td>{new Date(t.txDate).toLocaleDateString("ko-KR")}</td>
              <td>{t.product.name}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.quantity)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.unitCost)}원</td>
              <td style={{ textAlign: "right" }}>{fmt(t.totalCost)}원</td>
              <td style={{ textAlign: "right" }}>{fmt(t.beforeStock)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.afterStock)}</td>
              <td>{t.reason || "-"}</td>
              {canEdit && (
                <td>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => {
                      if (confirm("삭제하시겠습니까? (최근 건만 가능)")) onDelete(t.id);
                    }}
                    disabled={isDeletePending}
                  >
                    삭제
                  </button>
                </td>
              )}
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 11 : 10} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                입출고 내역이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── 요약 카드 ─── */

export interface SummaryCardsProps {
  summary: Summary | undefined;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className={styles.summaryCards}>
      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>총 품목 수</div>
        <div className={styles.summaryValue}>{summary?.totalProducts ?? 0}개</div>
      </div>
      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>재고 총액</div>
        <div className={styles.summaryValue}>{fmt(summary?.totalStockValue ?? 0)}원</div>
      </div>
      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>안전재고 미달</div>
        <div className={`${styles.summaryValue} ${(summary?.lowStockCount ?? 0) > 0 ? styles.negative : ""}`}>
          {summary?.lowStockCount ?? 0}건
        </div>
      </div>
      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>재고 없음</div>
        <div className={`${styles.summaryValue} ${(summary?.zeroStockCount ?? 0) > 0 ? styles.negative : ""}`}>
          {summary?.zeroStockCount ?? 0}건
        </div>
      </div>
    </div>
  );
}

/* ─── 재고 분석 (평가표 + 안전재고 미달) ─── */

export interface AnalysisTabProps {
  valuation: { items: ValuationItem[]; totalValuation: number } | undefined;
  lowStockItems: LowStockItem[];
  onExportValuation: () => void;
}

export function AnalysisTab({ valuation, lowStockItems, onExportValuation }: AnalysisTabProps) {
  return (
    <>
      {/* 재고 평가 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>재고 평가표</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={styles.filterSep}>총 평가액: <strong>{fmt(valuation?.totalValuation ?? 0)}원</strong></span>
            <button className={styles.downloadBtn} onClick={onExportValuation} disabled={!valuation || valuation.items.length === 0}>
              엑셀 다운로드
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>품목명</th>
              <th>카테고리</th>
              <th>단위</th>
              <th style={{ textAlign: "right" }}>수량</th>
              <th style={{ textAlign: "right" }}>이동평균단가</th>
              <th style={{ textAlign: "right" }}>평가금액</th>
            </tr>
          </thead>
          <tbody>
            {valuation?.items.map((v) => (
              <tr key={v.id}>
                <td>{v.code}</td>
                <td>{v.name}</td>
                <td>{v.category || "-"}</td>
                <td>{v.unit || "-"}</td>
                <td style={{ textAlign: "right" }}>{fmt(v.currentStock)}</td>
                <td style={{ textAlign: "right" }}>{fmt(v.avgCost)}원</td>
                <td style={{ textAlign: "right" }}>{fmt(v.valuationAmount)}원</td>
              </tr>
            ))}
            {(!valuation || valuation.items.length === 0) && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  재고가 있는 품목이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 안전재고 미달 */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>안전재고 미달 품목</h2>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>품목명</th>
              <th>카테고리</th>
              <th style={{ textAlign: "right" }}>현재고</th>
              <th style={{ textAlign: "right" }}>안전재고</th>
              <th style={{ textAlign: "right" }}>부족수량</th>
              <th style={{ textAlign: "right" }}>추정 발주금액</th>
            </tr>
          </thead>
          <tbody>
            {lowStockItems.map((l) => (
              <tr key={l.id}>
                <td>{l.code}</td>
                <td>{l.name}</td>
                <td>{l.category || "-"}</td>
                <td style={{ textAlign: "right" }}>{fmt(l.currentStock)}</td>
                <td style={{ textAlign: "right" }}>{fmt(l.safetyStock)}</td>
                <td style={{ textAlign: "right", color: "#dc2626", fontWeight: 600 }}>{fmt(l.shortage)}</td>
                <td style={{ textAlign: "right" }}>{fmt(l.shortage * l.avgCost)}원</td>
              </tr>
            ))}
            {lowStockItems.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  안전재고 미달 품목이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
