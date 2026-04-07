"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./SummaryCodes.module.css";

interface SummaryCode {
  id: string;
  code: string;
  description: string;
  category: string;
}

const CATEGORIES = [
  { code: "GENERAL", name: "일반" },
  { code: "PURCHASE", name: "매입" },
  { code: "SALES", name: "매출" },
  { code: "CASH", name: "자금" },
];

function categoryLabel(cat: string) {
  return CATEGORIES.find((c) => c.code === cat)?.name || cat;
}

export default function SummaryCodesPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const { data: codes = [] } = useQuery({
    queryKey: ["summary-codes", filterCategory],
    queryFn: () =>
      apiGet<SummaryCode[]>(
        `/summary-codes?tenantId=${tenantId}${filterCategory ? `&category=${filterCategory}` : ""}`,
      ),
  });

  const filteredCodes = search
    ? codes.filter(
        (c) =>
          c.code.includes(search) ||
          c.description.toLowerCase().includes(search.toLowerCase()),
      )
    : codes;

  const createMutation = useMutation({
    mutationFn: (body: { code: string; description: string; category: string }) =>
      apiPost<SummaryCode>("/summary-codes", { ...body, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary-codes"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { description?: string; category?: string } }) =>
      apiPatch<SummaryCode>(`/summary-codes/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary-codes"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/summary-codes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["summary-codes"] }),
  });

  const resetForm = () => {
    setFormMode("none");
    setEditingId(null);
    setCode("");
    setDescription("");
    setCategory("GENERAL");
    setError("");
  };

  const startEdit = (item: SummaryCode) => {
    setFormMode("edit");
    setEditingId(item.id);
    setCode(item.code);
    setDescription(item.description);
    setCategory(item.category);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code.trim()) {
      setError("코드를 입력해주세요");
      return;
    }
    if (!description.trim()) {
      setError("적요 내용을 입력해주세요");
      return;
    }

    if (formMode === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, body: { description, category } });
    } else {
      createMutation.mutate({ code, description, category });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("이 적요 코드를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>적요 코드 관리</h1>
        {formMode === "none" && canEdit && (
          <button className={styles.addBtn} onClick={() => setFormMode("create")}>
            적요 코드 추가
          </button>
        )}
      </div>

      {formMode !== "none" && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            {formMode === "edit" ? "적요 코드 수정" : "적요 코드 등록"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>코드</label>
                <input
                  className={styles.input}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="예: 001"
                  disabled={formMode === "edit"}
                  style={{ width: 100 }}
                />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>적요 내용</label>
                <input
                  className={styles.input}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 사무용품 구매"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>카테고리</label>
                <select
                  className={styles.select}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.submitBtn} disabled={isPending}>
                {isPending ? "저장 중..." : formMode === "edit" ? "수정 저장" : "등록"}
              </button>
              <button type="button" className={styles.cancelBtn} onClick={resetForm}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.tableSection}>
        <div className={styles.filterRow}>
          <input
            className={styles.filterInput}
            type="text"
            placeholder="코드 또는 내용으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={styles.select}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">전체 카테고리</option>
            {CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 80 }}>코드</th>
              <th>적요 내용</th>
              <th style={{ width: 100 }}>카테고리</th>
              <th style={{ width: 120 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredCodes.map((item) => (
              <tr key={item.id}>
                <td className={styles.codeCell}>{item.code}</td>
                <td>{item.description}</td>
                <td>
                  <span className={styles.categoryBadge}>
                    {categoryLabel(item.category)}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    {canEdit && (
                      <button className={styles.editBtn} onClick={() => startEdit(item)}>
                        수정
                      </button>
                    )}
                    {canDelete && (
                      <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredCodes.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.emptyRow}>
                  {search ? "검색 결과가 없습니다" : "등록된 적요 코드가 없습니다"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
