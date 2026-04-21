"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmt } from "@/lib/formatters";
import styles from "./Bom.module.css";

// ─── 타입 ───

interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
}

interface BomItem {
  id: string;
  child: Product & { standardCost: number | null };
  quantity: number;
  unit: string | null;
  note: string | null;
  lineCost: number;
}

interface BomDetail {
  parent: Product;
  items: BomItem[];
  totalCost: number;
}

interface Assembly {
  id: string;
  code: string;
  name: string;
  category: string | null;
  bomItemCount: number;
}

interface RequirementLine {
  childId: string;
  code: string;
  name: string;
  unit: string | null;
  unitQty: number;
  requiredQty: number;
  currentStock: number;
  shortage: number;
}

interface RequirementResult {
  parentId: string;
  productionQty: number;
  lines: RequirementLine[];
}

// ─── 메인 컴포넌트 ───

export default function BomPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  // 선택된 조립품
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  // 부품 추가 폼
  const [addChildId, setAddChildId] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addUnit, setAddUnit] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addError, setAddError] = useState("");

  // 인라인 수량 편집
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  // 자재소요량
  const [reqQty, setReqQty] = useState("");
  const [reqResult, setReqResult] = useState<RequirementResult | null>(null);
  const [reqLoading, setReqLoading] = useState(false);

  // ─── 데이터 조회 ───

  // 조립품 목록
  const { data: assemblies = [] } = useQuery({
    queryKey: ["bom-assemblies", tenantId],
    queryFn: () => apiGet<Assembly[]>(`/bom/assemblies?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 전체 품목 목록 (부품 선택 + 미등록 제품 선택용)
  const { data: allProducts = [] } = useQuery({
    queryKey: ["bom-all-products", tenantId],
    queryFn: () => apiGet<Product[]>(`/inventory/products?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 선택된 조립품의 BOM
  const { data: bomDetail } = useQuery({
    queryKey: ["bom-detail", selectedId],
    queryFn: () => apiGet<BomDetail>(`/bom/${selectedId}`),
    enabled: !!selectedId,
  });

  // ─── Mutations ───

  const addItemMutation = useMutation({
    mutationFn: (data: { childId: string; quantity: number; unit?: string; note?: string }) =>
      apiPost(`/bom/${selectedId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["bom-assemblies"] });
      resetAddForm();
    },
    onError: (err: Error) => setAddError(err.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { quantity?: number; unit?: string; note?: string } }) =>
      apiPatch(`/bom/items/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-detail", selectedId] });
      setEditingItemId(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiDelete(`/bom/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["bom-assemblies"] });
    },
  });

  // ─── 핸들러 ───

  const resetAddForm = () => {
    setAddChildId("");
    setAddQuantity("");
    setAddUnit("");
    setAddNote("");
    setAddError("");
  };

  const handleAddItem = () => {
    setAddError("");
    if (!addChildId || !addQuantity) {
      setAddError("부품과 수량은 필수입니다");
      return;
    }
    if (Number(addQuantity) <= 0) {
      setAddError("수량은 0보다 커야 합니다");
      return;
    }
    addItemMutation.mutate({
      childId: addChildId,
      quantity: Number(addQuantity),
      unit: addUnit || undefined,
      note: addNote || undefined,
    });
  };

  const startInlineEdit = (item: BomItem) => {
    setEditingItemId(item.id);
    setEditQuantity(String(item.quantity));
  };

  const saveInlineEdit = (itemId: string) => {
    const qty = Number(editQuantity);
    if (qty <= 0) return;
    updateItemMutation.mutate({ itemId, data: { quantity: qty } });
  };

  const cancelInlineEdit = () => {
    setEditingItemId(null);
    setEditQuantity("");
  };

  const handleDeleteItem = (item: BomItem) => {
    if (confirm(`${item.child.name} 부품을 BOM에서 삭제하시겠습니까?`)) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const handleCalcRequirement = async () => {
    if (!selectedId || !reqQty || Number(reqQty) <= 0) return;
    setReqLoading(true);
    try {
      const data = await apiGet<RequirementResult>(`/bom/${selectedId}/requirement?qty=${reqQty}`);
      setReqResult(data);
    } catch {
      setReqResult(null);
    } finally {
      setReqLoading(false);
    }
  };

  // 조립품 선택 (기존 목록 또는 전체 품목에서)
  const handleSelectAssembly = (productId: string) => {
    setSelectedId(productId);
    setReqResult(null);
    setReqQty("");
    resetAddForm();
    cancelInlineEdit();
  };

  // ─── 필터 ───

  const filteredAssemblies = searchText
    ? assemblies.filter(
        (a) =>
          a.name.toLowerCase().includes(searchText.toLowerCase()) ||
          a.code.toLowerCase().includes(searchText.toLowerCase()),
      )
    : assemblies;

  // BOM에 이미 등록된 부품 ID (중복 방지)
  const existingChildIds = new Set(bomDetail?.items.map((i) => i.child.id) ?? []);

  // 부품 선택 시 현재 조립품 자체와 이미 등록된 부품 제외
  const availableChildren = allProducts.filter(
    (p) => p.id !== selectedId && !existingChildIds.has(p.id),
  );

  // 전체 품목 중 조립품 목록에 없는 제품 (BOM 미등록)
  const assemblyIds = new Set(assemblies.map((a) => a.id));
  const unregisteredProducts = allProducts.filter((p) => !assemblyIds.has(p.id));

  return (
    <div>
      <h1 className={styles.title}>BOM 관리</h1>
      <p className={styles.subtitle}>부품 구성표(Bill of Materials) - 조립품별 부품 구성 및 자재소요량 계산</p>

      <div className={styles.layout}>
        {/* 좌측: 조립품 목록 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelTitle}>조립품 목록</div>
          <input
            className={styles.searchInput}
            placeholder="조립품 검색..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <ul className={styles.assemblyList}>
            {filteredAssemblies.map((a) => (
              <li
                key={a.id}
                className={`${styles.assemblyItem} ${selectedId === a.id ? styles.assemblyItemActive : ""}`}
                onClick={() => handleSelectAssembly(a.id)}
              >
                <span>{a.name}</span>
                <span className={styles.assemblyCode}>{a.code} | 부품 {a.bomItemCount}개</span>
              </li>
            ))}
            {filteredAssemblies.length === 0 && (
              <li className={styles.emptyList}>조립품이 없습니다</li>
            )}
          </ul>

          {/* 전체 품목에서 선택하여 BOM 등록 */}
          {unregisteredProducts.length > 0 && (
            <div className={styles.allProductsSection}>
              <div className={styles.allProductsLabel}>BOM 미등록 제품 선택</div>
              <select
                className={styles.allProductsSelect}
                value=""
                onChange={(e) => {
                  if (e.target.value) handleSelectAssembly(e.target.value);
                }}
              >
                <option value="">-- 제품 선택 --</option>
                {unregisteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 우측: BOM 상세 */}
        {selectedId ? (
          <div className={styles.rightPanel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {bomDetail?.parent.name ?? "로딩 중..."} BOM
              </h2>
              <div className={styles.totalCost}>
                총 원가: <span className={styles.totalCostValue}>{fmt(bomDetail?.totalCost ?? 0)}원</span>
              </div>
            </div>

            {/* 부품 추가 폼 */}
            {canEdit && (
              <>
                {addError && <div className={styles.errorMsg}>{addError}</div>}
                <div className={styles.addForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>부품</label>
                    <select
                      className={styles.formSelect}
                      value={addChildId}
                      onChange={(e) => setAddChildId(e.target.value)}
                    >
                      <option value="">-- 부품 선택 --</option>
                      {availableChildren.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>수량</label>
                    <input
                      className={`${styles.formInput} ${styles.formInputSmall}`}
                      type="number"
                      min="0.01"
                      step="any"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>단위</label>
                    <input
                      className={`${styles.formInput} ${styles.formInputSmall}`}
                      type="text"
                      placeholder="EA"
                      value={addUnit}
                      onChange={(e) => setAddUnit(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>메모</label>
                    <input
                      className={`${styles.formInput} ${styles.formInputMemo}`}
                      type="text"
                      placeholder="비고"
                      value={addNote}
                      onChange={(e) => setAddNote(e.target.value)}
                    />
                  </div>
                  <button
                    className={styles.primaryBtn}
                    onClick={handleAddItem}
                    disabled={addItemMutation.isPending}
                  >
                    {addItemMutation.isPending ? "추가 중..." : "부품 추가"}
                  </button>
                </div>
              </>
            )}

            {/* BOM 테이블 */}
            <table>
              <thead>
                <tr>
                  <th>부품코드</th>
                  <th>부품명</th>
                  <th style={{ textAlign: "right" }}>수량</th>
                  <th>단위</th>
                  <th style={{ textAlign: "right" }}>단가</th>
                  <th style={{ textAlign: "right" }}>소계</th>
                  <th>메모</th>
                  {canEdit && <th style={{ textAlign: "center" }}>관리</th>}
                </tr>
              </thead>
              <tbody>
                {bomDetail?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.child.code}</td>
                    <td>{item.child.name}</td>
                    <td style={{ textAlign: "right" }}>
                      {editingItemId === item.id ? (
                        <input
                          className={styles.inlineInput}
                          type="number"
                          min="0.01"
                          step="any"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInlineEdit(item.id);
                            if (e.key === "Escape") cancelInlineEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          style={{ cursor: canEdit ? "pointer" : "default" }}
                          onClick={() => canEdit && startInlineEdit(item)}
                          title={canEdit ? "클릭하여 수량 편집" : ""}
                        >
                          {fmt(item.quantity)}
                        </span>
                      )}
                    </td>
                    <td>{item.unit || "-"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(item.child.standardCost ?? 0)}원</td>
                    <td style={{ textAlign: "right" }}>{fmt(item.lineCost)}원</td>
                    <td>{item.note || "-"}</td>
                    {canEdit && (
                      <td style={{ textAlign: "center" }}>
                        <div className={styles.actionBtns}>
                          {editingItemId === item.id ? (
                            <>
                              <button
                                className={styles.saveBtn}
                                onClick={() => saveInlineEdit(item.id)}
                                disabled={updateItemMutation.isPending}
                              >
                                저장
                              </button>
                              <button className={styles.cancelBtn} onClick={cancelInlineEdit}>
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              className={styles.dangerBtn}
                              onClick={() => handleDeleteItem(item)}
                              disabled={deleteItemMutation.isPending}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {(!bomDetail || bomDetail.items.length === 0) && (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      등록된 부품이 없습니다. 위 폼에서 부품을 추가하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* 자재소요량 계산 섹션 */}
            {bomDetail && bomDetail.items.length > 0 && (
              <div className={styles.requirementSection}>
                <h3 className={styles.requirementTitle}>자재소요량 계산</h3>
                <div className={styles.requirementForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>생산 수량</label>
                    <input
                      className={`${styles.formInput} ${styles.formInputSmall}`}
                      type="number"
                      min="1"
                      value={reqQty}
                      onChange={(e) => setReqQty(e.target.value)}
                      placeholder="수량"
                    />
                  </div>
                  <button
                    className={styles.secondaryBtn}
                    onClick={handleCalcRequirement}
                    disabled={reqLoading || !reqQty}
                  >
                    {reqLoading ? "계산 중..." : "계산"}
                  </button>
                </div>

                {reqResult && (
                  <table>
                    <thead>
                      <tr>
                        <th>부품코드</th>
                        <th>부품명</th>
                        <th>단위</th>
                        <th style={{ textAlign: "right" }}>단위당 소요</th>
                        <th style={{ textAlign: "right" }}>필요 수량</th>
                        <th style={{ textAlign: "right" }}>현재 재고</th>
                        <th style={{ textAlign: "right" }}>부족분</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqResult.lines.map((line) => (
                        <tr key={line.childId}>
                          <td>{line.code}</td>
                          <td>{line.name}</td>
                          <td>{line.unit || "-"}</td>
                          <td style={{ textAlign: "right" }}>{fmt(line.unitQty)}</td>
                          <td style={{ textAlign: "right" }}>{fmt(line.requiredQty)}</td>
                          <td style={{ textAlign: "right" }}>{fmt(line.currentStock)}</td>
                          <td style={{ textAlign: "right" }}>
                            {line.shortage > 0 ? (
                              <span className={styles.shortage}>-{fmt(line.shortage)}</span>
                            ) : (
                              <span className={styles.sufficient}>충분</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.rightPanelEmpty}>
            좌측에서 조립품을 선택하거나, BOM 미등록 제품을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
