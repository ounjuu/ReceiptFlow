"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import { parseXlsx, downloadTemplate } from "@/lib/import-xlsx";
import styles from "./Vendors.module.css";

interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
  createdAt: string;
}

export default function VendorsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [bizNo, setBizNo] = useState("");
  const [error, setError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] } | null>(null);

  // 수정 상태
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBizNo, setEditBizNo] = useState("");

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors", tenantId],
    queryFn: () => apiGet<Vendor[]>(`/vendors?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (body: { tenantId: string; name: string; bizNo?: string }) =>
      apiPost<Vendor>("/vendors", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setName("");
      setBizNo("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; bizNo?: string }) =>
      apiPatch<Vendor>(`/vendors/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;
    createMutation.mutate({
      tenantId: tenantId!,
      name: name.trim(),
      bizNo: bizNo.trim() || undefined,
    });
  };

  const startEdit = (vendor: Vendor) => {
    setEditId(vendor.id);
    setEditName(vendor.name);
    setEditBizNo(vendor.bizNo || "");
  };

  const handleUpdate = () => {
    if (!editId || !editName.trim()) return;
    updateMutation.mutate({
      id: editId,
      name: editName.trim(),
      bizNo: editBizNo.trim() || undefined,
    });
  };

  const handleDelete = (vendor: Vendor) => {
    if (confirm(`"${vendor.name}" 거래처를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(vendor.id);
    }
  };

  const importMutation = useMutation({
    mutationFn: (items: { name: string; bizNo?: string }[]) =>
      apiPost<{ total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] }>("/vendors/batch", { tenantId: tenantId!, items }),
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      if (importRef.current) importRef.current.value = "";
    },
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseXlsx(file);
      const items = rows.map((r) => ({
        name: r["거래처명"] || "",
        bizNo: r["사업자등록번호"] || undefined,
      })).filter((i) => i.name);
      if (items.length === 0) {
        alert("유효한 데이터가 없습니다. 템플릿을 확인해주세요.");
        return;
      }
      importMutation.mutate(items);
    } catch {
      alert("엑셀 파일 파싱에 실패했습니다.");
    }
  };

  return (
    <div>
      <h1 className={styles.title}>거래처 관리</h1>

      {canEdit && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>거래처 등록</h2>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.formRow}>
              <label className={styles.label}>거래처명</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="거래처명"
                required
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>사업자등록번호</label>
              <input
                className={styles.input}
                value={bizNo}
                onChange={(e) => setBizNo(e.target.value)}
                placeholder="000-00-00000"
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "등록 중..." : "등록"}
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>거래처 목록</h2>
          <div className={styles.actions}>
            <button
              className={styles.downloadBtn}
              onClick={() => downloadTemplate("거래처_템플릿", ["거래처명", "사업자등록번호"])}
            >
              템플릿 다운로드
            </button>
            <input type="file" ref={importRef} accept=".xlsx,.xls,.csv" onChange={handleImport} hidden />
            <button
              className={styles.downloadBtn}
              onClick={() => importRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? "업로드 중..." : "엑셀 업로드"}
            </button>
            <button
              className={styles.downloadBtn}
              onClick={() => {
                exportToXlsx("거래처목록", "거래처", ["거래처명", "사업자등록번호", "등록일"], vendors.map((v) => [
                  v.name,
                  v.bizNo || "",
                  new Date(v.createdAt).toLocaleDateString("ko-KR"),
                ]));
              }}
              disabled={vendors.length === 0}
            >
              엑셀 다운로드
            </button>
          </div>
        </div>
        {importResult && (
          <div className={styles.importResult}>
            <div className={styles.importSummary}>
              <span>총 {importResult.total}건</span>
              <span className={styles.importSuccess}>성공 {importResult.success}건</span>
              {importResult.failed > 0 && <span className={styles.importFailed}>실패 {importResult.failed}건</span>}
              <button className={styles.cancelBtn} onClick={() => setImportResult(null)}>닫기</button>
            </div>
            {importResult.failed > 0 && (
              <ul className={styles.importErrors}>
                {importResult.results.filter((r) => r.status === "error").map((r) => (
                  <li key={r.index}>{r.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>거래처명</th>
              <th>사업자등록번호</th>
              <th>등록일</th>
              {(canEdit || canDelete) && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>
                  {editId === vendor.id ? (
                    <input
                      className={styles.editInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  ) : (
                    vendor.name
                  )}
                </td>
                <td>
                  {editId === vendor.id ? (
                    <input
                      className={styles.editInput}
                      value={editBizNo}
                      onChange={(e) => setEditBizNo(e.target.value)}
                    />
                  ) : (
                    vendor.bizNo || "-"
                  )}
                </td>
                <td>{new Date(vendor.createdAt).toLocaleDateString("ko-KR")}</td>
                {(canEdit || canDelete) && (
                  <td>
                    <div className={styles.actions}>
                      {editId === vendor.id ? (
                        <>
                          <button
                            className={styles.saveBtn}
                            onClick={handleUpdate}
                            disabled={updateMutation.isPending}
                          >
                            저장
                          </button>
                          <button
                            className={styles.cancelBtn}
                            onClick={() => setEditId(null)}
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          {canEdit && (
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit(vendor)}
                            >
                              수정
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(vendor)}
                            >
                              삭제
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit || canDelete ? 4 : 3}
                  style={{ textAlign: "center", color: "var(--text-muted)" }}
                >
                  등록된 거래처가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
