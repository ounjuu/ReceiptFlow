"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  standardCost: number | null;
  description: string | null;
}

interface ItemCost {
  itemName: string;
  totalQty: number;
  totalAmount: number;
  avgUnitCost: number;
  tradeCount: number;
}

interface VendorCost {
  vendorId: string;
  vendorName: string;
  bizNo: string | null;
  totalAmount: number;
  tradeCount: number;
}

interface ProjectCost {
  projectId: string;
  code: string;
  name: string;
  totalCost: number;
}

interface DeptCost {
  departmentId: string;
  code: string;
  name: string;
  totalCost: number;
}

interface VarianceRow {
  itemName: string;
  productCode: string | null;
  category: string | null;
  unit: string | null;
  quantity: number;
  standardCost: number | null;
  actualUnitCost: number;
  standardTotal: number | null;
  actualTotal: number;
  variance: number | null;
  varianceRate: number | null;
}

const fmt = (n: number) => n.toLocaleString();

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
  const [formDesc, setFormDesc] = useState("");
  const [formError, setFormError] = useState("");

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
    queryFn: () => apiGet<{ items: ItemCost[]; totalAmount: number }>(`/cost-management/analysis/by-item?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "item",
  });

  const { data: vendorData } = useQuery({
    queryKey: ["cost-by-vendor", startDate, endDate],
    queryFn: () => apiGet<{ vendors: VendorCost[]; totalAmount: number }>(`/cost-management/analysis/by-vendor?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "vendor",
  });

  const { data: projectData } = useQuery({
    queryKey: ["cost-by-project", startDate, endDate],
    queryFn: () => apiGet<{ projects: ProjectCost[]; totalCost: number }>(`/cost-management/analysis/by-project?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "project",
  });

  const { data: deptData } = useQuery({
    queryKey: ["cost-by-dept", startDate, endDate],
    queryFn: () => apiGet<{ departments: DeptCost[]; totalCost: number }>(`/cost-management/analysis/by-department?${qp}`),
    enabled: !!tenantId && tab === "analysis" && analysisView === "dept",
  });

  const { data: varianceData } = useQuery({
    queryKey: ["cost-variance", startDate, endDate],
    queryFn: () => apiGet<{ variances: VarianceRow[]; totalActual: number; totalStandard: number; totalVariance: number }>(
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

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormCode(""); setFormName(""); setFormCategory("");
    setFormUnit(""); setFormStdCost(""); setFormDesc(""); setFormError("");
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setShowForm(true);
    setFormCode(p.code);
    setFormName(p.name);
    setFormCategory(p.category || "");
    setFormUnit(p.unit || "");
    setFormStdCost(p.standardCost != null ? String(p.standardCost) : "");
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
        description: formDesc || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // 날짜 필터 UI
  const dateFilter = (
    <div className={styles.filterRow}>
      <input className={styles.formInput} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 150 }} />
      <span className={styles.unit}>~</span>
      <input className={styles.formInput} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 150 }} />
    </div>
  );

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
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>품목 목록</h2>
            {canEdit && (
              <button className={styles.primaryBtn} onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
                {showForm ? "취소" : "품목 등록"}
              </button>
            )}
          </div>

          {showForm && (
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>코드 *</label>
                <input className={styles.formInput} value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="P-001" readOnly={!!editingId} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름 *</label>
                <input className={styles.formInput} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="품목명" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>카테고리</label>
                <input className={styles.formInput} value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="직접재료, 부품 등" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>단위</label>
                <input className={styles.formInput} value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="EA, KG, M" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>표준원가</label>
                <input className={styles.formInput} type="number" value={formStdCost} onChange={(e) => setFormStdCost(e.target.value)} placeholder="0" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>설명</label>
                <input className={styles.formInput} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="설명" />
              </div>
              {formError && <div className={styles.formGroupFull} style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{formError}</div>}
              <div className={styles.formActions}>
                <button className={styles.secondaryBtn} onClick={resetForm}>취소</button>
                <button className={styles.primaryBtn} onClick={handleSubmit} disabled={isPending}>
                  {isPending ? "저장 중..." : editingId ? "수정" : "등록"}
                </button>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>코드</th>
                <th>품목명</th>
                <th>카테고리</th>
                <th>단위</th>
                <th style={{ textAlign: "right" }}>표준원가</th>
                <th>설명</th>
                {(canEdit || canDelete) && <th>관리</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.category || "-"}</td>
                  <td>{p.unit || "-"}</td>
                  <td style={{ textAlign: "right" }}>{p.standardCost != null ? `${fmt(p.standardCost)}원` : "-"}</td>
                  <td>{p.description || "-"}</td>
                  {(canEdit || canDelete) && (
                    <td>
                      <div className={styles.actions}>
                        {canEdit && <button className={styles.editBtn} onClick={() => startEdit(p)}>수정</button>}
                        {canDelete && (
                          <button className={styles.dangerBtn} onClick={() => { if (confirm(`${p.name}을(를) 삭제하시겠습니까?`)) deleteMutation.mutate(p.id); }}>
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={(canEdit || canDelete) ? 7 : 6} style={{ textAlign: "center", color: "var(--text-muted)" }}>등록된 품목이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 원가 분석 탭 */}
      {tab === "analysis" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>원가 분석</h2>
            {dateFilter}
          </div>

          <div className={styles.subTabs}>
            {([["item", "품목별"], ["vendor", "거래처별"], ["project", "프로젝트별"], ["dept", "부서별"]] as const).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.subTab} ${analysisView === key ? styles.subTabActive : ""}`}
                onClick={() => setAnalysisView(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 품목별 */}
          {analysisView === "item" && itemData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 매입원가: {fmt(itemData.totalAmount)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("품목별_원가분석", "품목별", ["품목명", "수량", "총액", "평균단가", "건수"],
                    itemData.items.map((i) => [i.itemName, i.totalQty, i.totalAmount, i.avgUnitCost, i.tradeCount]));
                }} disabled={itemData.items.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>품목명</th><th style={{ textAlign: "right" }}>수량</th><th style={{ textAlign: "right" }}>총액</th><th style={{ textAlign: "right" }}>평균단가</th><th style={{ textAlign: "right" }}>매입건수</th></tr></thead>
                <tbody>
                  {itemData.items.map((i) => (
                    <tr key={i.itemName}><td>{i.itemName}</td><td style={{ textAlign: "right" }}>{fmt(i.totalQty)}</td><td style={{ textAlign: "right" }}>{fmt(i.totalAmount)}원</td><td style={{ textAlign: "right" }}>{fmt(i.avgUnitCost)}원</td><td style={{ textAlign: "right" }}>{i.tradeCount}</td></tr>
                  ))}
                  {itemData.items.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* 거래처별 */}
          {analysisView === "vendor" && vendorData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 매입원가: {fmt(vendorData.totalAmount)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("거래처별_원가분석", "거래처별", ["거래처", "사업자번호", "총액", "건수"],
                    vendorData.vendors.map((v) => [v.vendorName, v.bizNo || "", v.totalAmount, v.tradeCount]));
                }} disabled={vendorData.vendors.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>거래처</th><th>사업자번호</th><th style={{ textAlign: "right" }}>총 매입액</th><th style={{ textAlign: "right" }}>거래건수</th></tr></thead>
                <tbody>
                  {vendorData.vendors.map((v) => (
                    <tr key={v.vendorId}><td>{v.vendorName}</td><td>{v.bizNo || "-"}</td><td style={{ textAlign: "right" }}>{fmt(v.totalAmount)}원</td><td style={{ textAlign: "right" }}>{v.tradeCount}</td></tr>
                  ))}
                  {vendorData.vendors.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* 프로젝트별 */}
          {analysisView === "project" && projectData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 비용: {fmt(projectData.totalCost)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("프로젝트별_원가분석", "프로젝트별", ["코드", "프로젝트명", "비용"],
                    projectData.projects.map((p) => [p.code, p.name, p.totalCost]));
                }} disabled={projectData.projects.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>코드</th><th>프로젝트명</th><th style={{ textAlign: "right" }}>비용</th></tr></thead>
                <tbody>
                  {projectData.projects.map((p) => (
                    <tr key={p.projectId}><td>{p.code}</td><td>{p.name}</td><td style={{ textAlign: "right" }}>{fmt(p.totalCost)}원</td></tr>
                  ))}
                  {projectData.projects.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* 부서별 */}
          {analysisView === "dept" && deptData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 비용: {fmt(deptData.totalCost)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("부서별_원가분석", "부서별", ["코드", "부서명", "비용"],
                    deptData.departments.map((d) => [d.code, d.name, d.totalCost]));
                }} disabled={deptData.departments.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>코드</th><th>부서명</th><th style={{ textAlign: "right" }}>비용</th></tr></thead>
                <tbody>
                  {deptData.departments.map((d) => (
                    <tr key={d.departmentId}><td>{d.code}</td><td>{d.name}</td><td style={{ textAlign: "right" }}>{fmt(d.totalCost)}원</td></tr>
                  ))}
                  {deptData.departments.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* 원가 차이분석 탭 */}
      {tab === "variance" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>표준원가 vs 실제원가</h2>
            <div className={styles.sectionHeaderRight}>
              {dateFilter}
              <button className={styles.downloadBtn} onClick={() => {
                if (!varianceData) return;
                exportToXlsx("원가차이분석", "차이분석",
                  ["품목명", "코드", "카테고리", "수량", "표준단가", "실제단가", "표준총액", "실제총액", "차이", "차이율(%)"],
                  varianceData.variances.map((v) => [
                    v.itemName, v.productCode || "-", v.category || "-", v.quantity,
                    v.standardCost ?? "-", v.actualUnitCost, v.standardTotal ?? "-",
                    v.actualTotal, v.variance ?? "-", v.varianceRate ?? "-",
                  ]));
              }} disabled={!varianceData || varianceData.variances.length === 0}>엑셀 다운로드</button>
            </div>
          </div>

          {varianceData && (
            <>
              <div className={styles.summaryCards} style={{ marginBottom: 20 }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>표준원가 합계</div>
                  <div className={styles.summaryValue}>{fmt(varianceData.totalStandard)}원</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>실제원가 합계</div>
                  <div className={styles.summaryValue}>{fmt(varianceData.totalActual)}원</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 차이</div>
                  <div className={`${styles.summaryValue} ${varianceData.totalVariance > 0 ? styles.negative : styles.positive}`}>
                    {varianceData.totalVariance > 0 ? "+" : ""}{fmt(varianceData.totalVariance)}원
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>차이율</div>
                  <div className={`${styles.summaryValue} ${varianceData.totalVariance > 0 ? styles.negative : styles.positive}`}>
                    {varianceData.totalStandard > 0
                      ? `${Math.round((varianceData.totalVariance / varianceData.totalStandard) * 1000) / 10}%`
                      : "-"}
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>품목명</th>
                    <th>코드</th>
                    <th>카테고리</th>
                    <th style={{ textAlign: "right" }}>수량</th>
                    <th style={{ textAlign: "right" }}>표준단가</th>
                    <th style={{ textAlign: "right" }}>실제단가</th>
                    <th style={{ textAlign: "right" }}>표준총액</th>
                    <th style={{ textAlign: "right" }}>실제총액</th>
                    <th style={{ textAlign: "right" }}>차이</th>
                    <th style={{ textAlign: "right" }}>차이율</th>
                  </tr>
                </thead>
                <tbody>
                  {varianceData.variances.map((v) => (
                    <tr key={v.itemName}>
                      <td>{v.itemName}</td>
                      <td>{v.productCode || "-"}</td>
                      <td>{v.category || "-"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(v.quantity)}{v.unit ? ` ${v.unit}` : ""}</td>
                      <td style={{ textAlign: "right" }}>{v.standardCost != null ? `${fmt(v.standardCost)}원` : <span className={styles.noStandard}>미설정</span>}</td>
                      <td style={{ textAlign: "right" }}>{fmt(v.actualUnitCost)}원</td>
                      <td style={{ textAlign: "right" }}>{v.standardTotal != null ? `${fmt(v.standardTotal)}원` : "-"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(v.actualTotal)}원</td>
                      <td style={{ textAlign: "right" }}>
                        {v.variance != null ? (
                          <span className={v.variance > 0 ? styles.variancePositive : v.variance < 0 ? styles.varianceNegative : styles.varianceZero}>
                            {v.variance > 0 ? "+" : ""}{fmt(v.variance)}원
                          </span>
                        ) : "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {v.varianceRate != null ? (
                          <span className={v.varianceRate > 0 ? styles.variancePositive : v.varianceRate < 0 ? styles.varianceNegative : styles.varianceZero}>
                            {v.varianceRate > 0 ? "+" : ""}{v.varianceRate}%
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                  {varianceData.variances.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)" }}>매입 데이터가 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
