"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadTemplate } from "@/lib/import-xlsx";
import { parseXlsx } from "@/lib/import-xlsx";
import styles from "./CostManagement.module.css";
import type { Product, ImportResult } from "./types";
import { fmt } from "./types";
import CostForm from "./CostForm";
import CostTable from "./CostTable";

export default function CostManagementPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"manage" | "analysis" | "variance">("manage");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 품목 폼
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formStdCost, setFormStdCost] = useState("");
  const [formSafetyStock, setFormSafetyStock] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formError, setFormError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // 분석 필터
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [analysisView, setAnalysisView] = useState<"item" | "vendor" | "project" | "dept">("item");

  // 품목 목록
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>(`/cost-management/products?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 분석 데이터
  const dateParams = [
    startDate && `startDate=${startDate}`,
    endDate && `endDate=${endDate}`,
  ].filter(Boolean).join("&");
  const qp = `tenantId=${tenantId}${dateParams ? `&${dateParams}` : ""}`;

  const { data: itemData } = useQuery({
    queryKey: ["cost-by-item", startDate, endDate],
    queryFn: () => apiGet<{ items: { itemName: string; totalQty: number; totalAmount: number; avgUnitCost: number; tradeCount: number }[]; totalAmount: number }>(`/cost-management/analysis/by-item?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "item",
  });

  const { data: vendorData } = useQuery({
    queryKey: ["cost-by-vendor", startDate, endDate],
    queryFn: () => apiGet<{ vendors: { vendorId: string; vendorName: string; bizNo: string | null; totalAmount: number; tradeCount: number }[]; totalAmount: number }>(`/cost-management/analysis/by-vendor?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "vendor",
  });

  const { data: projectData } = useQuery({
    queryKey: ["cost-by-project", startDate, endDate],
    queryFn: () => apiGet<{ projects: { projectId: string; code: string; name: string; totalCost: number }[]; totalCost: number }>(`/cost-management/analysis/by-project?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "project",
  });

  const { data: deptData } = useQuery({
    queryKey: ["cost-by-dept", startDate, endDate],
    queryFn: () => apiGet<{ departments: { departmentId: string; code: string; name: string; totalCost: number }[]; totalCost: number }>(`/cost-management/analysis/by-department?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "dept",
  });

  const { data: varianceData } = useQuery({
    queryKey: ["cost-variance", startDate, endDate],
    queryFn: () => apiGet<{ variances: { itemName: string; productCode: string | null; category: string | null; unit: string | null; quantity: number; standardCost: number | null; actualUnitCost: number; standardTotal: number | null; actualTotal: number; variance: number | null; varianceRate: number | null }[]; totalActual: number; totalStandard: number; totalVariance: number }>(
      `/cost-management/analysis/variance?${qp}`,
    ),
    enabled: !!tenantId && tab === "variance",
  });

  // CRUD mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/cost-management/products", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); resetForm(); },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPatch(`/cost-management/products/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); resetForm(); },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/cost-management/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const importMutation = useMutation({
    mutationFn: (items: { code: string; name: string; category?: string; unit?: string; standardCost?: number; safetyStock?: number }[]) =>
      apiPost<ImportResult>("/cost-management/products/batch", { tenantId: tenantId!, items }),
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (importRef.current) importRef.current.value = "";
    },
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseXlsx(file);
      const items = rows.map((r) => ({
        code: r["코드"] || "",
        name: r["품목명"] || "",
        category: r["카테고리"] || undefined,
        unit: r["단위"] || undefined,
        standardCost: r["표준원가"] ? Number(r["표준원가"]) : undefined,
        safetyStock: r["안전재고"] ? Number(r["안전재고"]) : undefined,
      })).filter((i) => i.code && i.name);
      if (items.length === 0) { alert("유효한 데이터가 없습니다."); return; }
      importMutation.mutate(items);
    } catch { alert("엑셀 파일 파싱에 실패했습니다."); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormCode(""); setFormName(""); setFormCategory("");
    setFormUnit(""); setFormStdCost(""); setFormSafetyStock(""); setFormDesc(""); setFormError("");
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setShowForm(true);
    setFormCode(p.code);
    setFormName(p.name);
    setFormCategory(p.category || "");
    setFormUnit(p.unit || "");
    setFormStdCost(p.standardCost != null ? String(p.standardCost) : "");
    setFormSafetyStock(p.safetyStock > 0 ? String(p.safetyStock) : "");
    setFormDesc(p.description || "");
    setFormError("");
  };

  const handleSubmit = () => {
    setFormError("");
    if (!formCode || !formName) { setFormError("코드와 이름은 필수입니다"); return; }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          name: formName,
          category: formCategory || undefined,
          unit: formUnit || undefined,
          standardCost: formStdCost ? Number(formStdCost) : undefined,
          safetyStock: formSafetyStock ? Number(formSafetyStock) : 0,
          description: formDesc || undefined,
        },
      });
    } else {
      createMutation.mutate({
        tenantId,
        code: formCode,
        name: formName,
        category: formCategory || undefined,
        unit: formUnit || undefined,
        standardCost: formStdCost ? Number(formStdCost) : undefined,
        safetyStock: formSafetyStock ? Number(formSafetyStock) : 0,
        description: formDesc || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleDelete = (p: Product) => {
    if (confirm(`${p.name}을(를) 삭제하시겠습니까?`)) deleteMutation.mutate(p.id);
  };

  return (
    <div>
      <h1 className={styles.title}>원가 관리</h1>
      <p className={styles.subtitle}>품목별 원가 추적, 원가 분석, 표준원가 대비 차이 분석</p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>등록 품목</div>
          <div className={styles.summaryValue}>{products.length}개</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>품목별 매입원가</div>
          <div className={styles.summaryValue}>{fmt(itemData?.totalAmount ?? 0)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>표준원가 합계</div>
          <div className={styles.summaryValue}>{fmt(varianceData?.totalStandard ?? 0)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>원가 차이</div>
          <div className={`${styles.summaryValue} ${(varianceData?.totalVariance ?? 0) > 0 ? styles.negative : styles.positive}`}>
            {fmt(varianceData?.totalVariance ?? 0)}원
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "manage" ? styles.tabActive : ""}`} onClick={() => setTab("manage")}>
          품목 관리
        </button>
        <button className={`${styles.tab} ${tab === "analysis" ? styles.tabActive : ""}`} onClick={() => setTab("analysis")}>
          원가 분석
        </button>
        <button className={`${styles.tab} ${tab === "variance" ? styles.tabActive : ""}`} onClick={() => setTab("variance")}>
          원가 차이분석
        </button>
      </div>

      {/* 품목 관리 탭 */}
      {tab === "manage" && (
        <div className={styles.section}>
          <CostForm
            showForm={showForm}
            editingId={editingId}
            formCode={formCode}
            formName={formName}
            formCategory={formCategory}
            formUnit={formUnit}
            formStdCost={formStdCost}
            formSafetyStock={formSafetyStock}
            formDesc={formDesc}
            formError={formError}
            isPending={isPending}
            importPending={importMutation.isPending}
            importResult={importResult}
            importRef={importRef}
            canEdit={canEdit}
            onFormCodeChange={setFormCode}
            onFormNameChange={setFormName}
            onFormCategoryChange={setFormCategory}
            onFormUnitChange={setFormUnit}
            onFormStdCostChange={setFormStdCost}
            onFormSafetyStockChange={setFormSafetyStock}
            onFormDescChange={setFormDesc}
            onToggleForm={() => { if (showForm) resetForm(); else setShowForm(true); }}
            onResetForm={resetForm}
            onSubmit={handleSubmit}
            onImport={handleImport}
            onDownloadTemplate={() => downloadTemplate("품목_템플릿", ["코드", "품목명", "카테고리", "단위", "표준원가", "안전재고"])}
            onClearImportResult={() => setImportResult(null)}
          />
        </div>
      )}

      <CostTable
        tab={tab}
        analysisView={analysisView}
        products={products}
        canEdit={canEdit}
        canDelete={canDelete}
        onStartEdit={startEdit}
        onDelete={handleDelete}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onAnalysisViewChange={setAnalysisView}
        itemData={itemData}
        vendorData={vendorData}
        projectData={projectData}
        deptData={deptData}
        varianceData={varianceData}
      />
    </div>
  );
}
