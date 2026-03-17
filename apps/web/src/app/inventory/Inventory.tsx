"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Inventory.module.css";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
}

interface StockItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  currentStock: number;
  avgCost: number;
  stockValue: number;
  safetyStock: number;
  isLow: boolean;
}

interface InventoryTx {
  id: string;
  txNo: string;
  txType: string;
  txDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string | null;
  beforeStock: number;
  afterStock: number;
  product: Product;
  createdAt: string;
}

interface Summary {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  zeroStockCount: number;
}

interface ValuationItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  currentStock: number;
  avgCost: number;
  valuationAmount: number;
}

interface LowStockItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  currentStock: number;
  safetyStock: number;
  shortage: number;
  avgCost: number;
}

const TX_TYPE_LABEL: Record<string, string> = {
  IN: "입고",
  OUT: "출고",
  ADJUST: "조정",
};

const TX_TYPE_STYLE: Record<string, string> = {
  IN: "badgeIn",
  OUT: "badgeOut",
  ADJUST: "badgeAdjust",
};

const fmt = (n: number) => n.toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

export default function InventoryPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"stock" | "create" | "history" | "analysis">("stock");

  // 입출고 등록 폼
  const [formTxType, setFormTxType] = useState("IN");
  const [formProductId, setFormProductId] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUnitCost, setFormUnitCost] = useState("");
  const [formDate, setFormDate] = useState(today());
  const [formReason, setFormReason] = useState("");

  // 이력 필터
  const [filterProductId, setFilterProductId] = useState("");
  const [filterTxType, setFilterTxType] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // 재고 검색
  const [stockSearch, setStockSearch] = useState("");

  // 데이터 조회
  const { data: summary } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: () => apiGet<Summary>(`/inventory/summary?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: stockList = [] } = useQuery({
    queryKey: ["inventory-stock"],
    queryFn: () => apiGet<StockItem[]>(`/inventory/stock?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["inventory-transactions", filterProductId, filterTxType, filterStartDate, filterEndDate],
    queryFn: () => {
      let url = `/inventory/transactions?tenantId=${tenantId}`;
      if (filterProductId) url += `&productId=${filterProductId}`;
      if (filterTxType) url += `&txType=${filterTxType}`;
      if (filterStartDate) url += `&startDate=${filterStartDate}`;
      if (filterEndDate) url += `&endDate=${filterEndDate}`;
      return apiGet<InventoryTx[]>(url);
    },
    enabled: !!tenantId && tab === "history",
  });

  const { data: valuation } = useQuery({
    queryKey: ["inventory-valuation"],
    queryFn: () => apiGet<{ items: ValuationItem[]; totalValuation: number }>(`/inventory/valuation?tenantId=${tenantId}`),
    enabled: !!tenantId && tab === "analysis",
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["inventory-stock-low"],
    queryFn: () => apiGet<LowStockItem[]>(`/inventory/stock-low?tenantId=${tenantId}`),
    enabled: !!tenantId && tab === "analysis",
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-valuation"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-stock-low"] });
  };

  // 입출고 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/inventory/transactions", data),
    onSuccess: () => {
      invalidateAll();
      resetForm();
      setTab("history");
    },
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/inventory/transactions/${id}`),
    onSuccess: invalidateAll,
  });

  const resetForm = () => {
    setFormTxType("IN");
    setFormProductId("");
    setFormQuantity("");
    setFormUnitCost("");
    setFormDate(today());
    setFormReason("");
  };

  const handleCreate = () => {
    if (!formProductId || !formQuantity || !formUnitCost) return;
    createMutation.mutate({
      tenantId,
      txType: formTxType,
      txDate: formDate,
      productId: formProductId,
      quantity: Number(formQuantity),
      unitCost: Number(formUnitCost),
      reason: formReason || undefined,
    });
  };

  const handleExportHistory = () => {
    const headers = ["번호", "유형", "일자", "품목", "수량", "단가", "총액", "변동전", "변동후", "사유"];
    const rows = transactions.map((t) => [
      t.txNo,
      TX_TYPE_LABEL[t.txType] || t.txType,
      new Date(t.txDate).toLocaleDateString("ko-KR"),
      t.product.name,
      t.quantity,
      t.unitCost,
      t.totalCost,
      t.beforeStock,
      t.afterStock,
      t.reason || "",
    ]);
    exportToXlsx("입출고이력", "입출고", headers, rows);
  };

  const handleExportValuation = () => {
    if (!valuation) return;
    const headers = ["코드", "품목명", "카테고리", "단위", "수량", "이동평균단가", "평가금액"];
    const rows = valuation.items.map((v) => [
      v.code, v.name, v.category || "", v.unit || "", v.currentStock, v.avgCost, v.valuationAmount,
    ]);
    exportToXlsx("재고평가", "재고평가", headers, rows);
  };

  // 품목 선택 시 단가 자동입력
  const handleProductSelect = (productId: string) => {
    setFormProductId(productId);
    const found = stockList.find((s) => s.id === productId);
    if (found && found.avgCost > 0 && formTxType !== "IN") {
      setFormUnitCost(String(found.avgCost));
    }
  };

  const filteredStock = stockSearch
    ? stockList.filter(
        (s) =>
          s.code.toLowerCase().includes(stockSearch.toLowerCase()) ||
          s.name.toLowerCase().includes(stockSearch.toLowerCase()),
      )
    : stockList;

  return (
    <div>
      <h1 className={styles.title}>재고 관리</h1>
      <p className={styles.subtitle}>품목별 입고/출고/재고실사 관리 및 재고 평가</p>

      {/* 요약 카드 */}
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

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "stock" ? styles.tabActive : ""}`} onClick={() => setTab("stock")}>
          현재 재고
        </button>
        {canEdit && (
          <button className={`${styles.tab} ${tab === "create" ? styles.tabActive : ""}`} onClick={() => setTab("create")}>
            입출고 등록
          </button>
        )}
        <button className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`} onClick={() => setTab("history")}>
          입출고 이력
        </button>
        <button className={`${styles.tab} ${tab === "analysis" ? styles.tabActive : ""}`} onClick={() => setTab("analysis")}>
          재고 분석
        </button>
      </div>

      {/* 현재 재고 탭 */}
      {tab === "stock" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>현재 재고 현황</h2>
            <input
              className={styles.searchInput}
              placeholder="품목 검색..."
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
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
      )}

      {/* 입출고 등록 탭 */}
      {tab === "create" && canEdit && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>입출고 등록</h2>
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>유형</label>
              <select
                className={styles.formSelect}
                value={formTxType}
                onChange={(e) => setFormTxType(e.target.value)}
              >
                <option value="IN">입고</option>
                <option value="OUT">출고</option>
                <option value="ADJUST">재고 조정 (실사)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>일자</label>
              <input
                className={styles.formInput}
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>품목</label>
              <select
                className={styles.formSelect}
                value={formProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
              >
                <option value="">선택</option>
                {stockList.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name} (재고: {s.currentStock})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                {formTxType === "ADJUST" ? "실사 수량" : "수량"}
              </label>
              <input
                className={styles.formInput}
                type="number"
                value={formQuantity}
                onChange={(e) => setFormQuantity(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>단가</label>
              <input
                className={styles.formInput}
                type="number"
                value={formUnitCost}
                onChange={(e) => setFormUnitCost(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>총액</label>
              <input
                className={styles.formInput}
                type="text"
                value={formQuantity && formUnitCost ? `${fmt(Number(formQuantity) * Number(formUnitCost))}원` : ""}
                readOnly
              />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>사유</label>
              <input
                className={styles.formInput}
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="입고/출고/조정 사유 (선택)"
              />
            </div>
            <div className={styles.formActions}>
              <button className={styles.secondaryBtn} onClick={resetForm}>초기화</button>
              <button
                className={styles.primaryBtn}
                onClick={handleCreate}
                disabled={createMutation.isPending || !formProductId || !formQuantity || !formUnitCost}
              >
                {createMutation.isPending ? "처리 중..." : `${TX_TYPE_LABEL[formTxType] || formTxType} 등록`}
              </button>
            </div>
          </div>
          {createMutation.isError && (
            <div className={styles.errorMsg}>
              {(createMutation.error as Error).message}
            </div>
          )}
        </div>
      )}

      {/* 입출고 이력 탭 */}
      {tab === "history" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>입출고 이력</h2>
            <button className={styles.downloadBtn} onClick={handleExportHistory} disabled={transactions.length === 0}>
              엑셀 다운로드
            </button>
          </div>

          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={filterTxType}
              onChange={(e) => setFilterTxType(e.target.value)}
            >
              <option value="">전체 유형</option>
              <option value="IN">입고</option>
              <option value="OUT">출고</option>
              <option value="ADJUST">조정</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
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
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ width: 150 }}
            />
            <span className={styles.filterSep}>~</span>
            <input
              className={styles.formInput}
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
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
                          if (confirm("삭제하시겠습니까? (최근 건만 가능)")) deleteMutation.mutate(t.id);
                        }}
                        disabled={deleteMutation.isPending}
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
      )}

      {/* 재고 분석 탭 */}
      {tab === "analysis" && (
        <>
          {/* 재고 평가 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>재고 평가표</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={styles.filterSep}>총 평가액: <strong>{fmt(valuation?.totalValuation ?? 0)}원</strong></span>
                <button className={styles.downloadBtn} onClick={handleExportValuation} disabled={!valuation || valuation.items.length === 0}>
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
      )}
    </div>
  );
}
