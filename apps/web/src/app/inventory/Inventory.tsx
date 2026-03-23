"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./Inventory.module.css";

import {
  StockItem,
  InventoryTx,
  ValuationItem,
  LowStockItem,
  Summary,
  TX_TYPE_LABEL,
  fmt,
  today,
} from "./types";
import InventoryForm from "./InventoryForm";
import {
  SummaryCards,
  StockTable,
  TransactionHistory,
  AnalysisTab,
} from "./InventoryTable";

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
      <SummaryCards summary={summary} />

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
        <StockTable
          filteredStock={filteredStock}
          stockSearch={stockSearch}
          onStockSearchChange={setStockSearch}
        />
      )}

      {/* 입출고 등록 탭 */}
      {tab === "create" && canEdit && (
        <InventoryForm
          formTxType={formTxType}
          formProductId={formProductId}
          formQuantity={formQuantity}
          formUnitCost={formUnitCost}
          formDate={formDate}
          formReason={formReason}
          stockList={stockList}
          isPending={createMutation.isPending}
          isError={createMutation.isError}
          errorMessage={(createMutation.error as Error)?.message ?? ""}
          onTxTypeChange={setFormTxType}
          onProductSelect={handleProductSelect}
          onQuantityChange={setFormQuantity}
          onUnitCostChange={setFormUnitCost}
          onDateChange={setFormDate}
          onReasonChange={setFormReason}
          onReset={resetForm}
          onCreate={handleCreate}
        />
      )}

      {/* 입출고 이력 탭 */}
      {tab === "history" && (
        <TransactionHistory
          transactions={transactions}
          stockList={stockList}
          canEdit={canEdit}
          filterTxType={filterTxType}
          filterProductId={filterProductId}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          isDeletePending={deleteMutation.isPending}
          onFilterTxTypeChange={setFilterTxType}
          onFilterProductIdChange={setFilterProductId}
          onFilterStartDateChange={setFilterStartDate}
          onFilterEndDateChange={setFilterEndDate}
          onExportHistory={handleExportHistory}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      {/* 재고 분석 탭 */}
      {tab === "analysis" && (
        <AnalysisTab
          valuation={valuation}
          lowStockItems={lowStockItems}
          onExportValuation={handleExportValuation}
        />
      )}
    </div>
  );
}
