"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import { parseXlsx, downloadTemplate } from "@/lib/import-xlsx";
import { creditRatingLabel, type Vendor, type ImportResult } from "./types";
import VendorForm from "./VendorForm";
import VendorTable from "./VendorTable";
import styles from "./Vendors.module.css";

interface VendorCreateBody {
  tenantId: string;
  name: string;
  bizNo?: string;
  creditRating?: string;
  creditLimit?: number;
  note?: string;
}

interface VendorUpdateBody {
  id: string;
  name: string;
  bizNo?: string;
  creditRating?: string | null;
  creditLimit?: number;
  note?: string | null;
}

export default function VendorsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [bizNo, setBizNo] = useState("");
  const [creditRating, setCreditRating] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // 수정 상태
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBizNo, setEditBizNo] = useState("");
  const [editCreditRating, setEditCreditRating] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors", tenantId],
    queryFn: () => apiGet<Vendor[]>(`/vendors?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (body: VendorCreateBody) =>
      apiPost<Vendor>("/vendors", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setName("");
      setBizNo("");
      setCreditRating("");
      setCreditLimit("");
      setNote("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: VendorUpdateBody) =>
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
      creditRating: creditRating || undefined,
      creditLimit: creditLimit ? Number(creditLimit) : undefined,
      note: note.trim() || undefined,
    });
  };

  const startEdit = (vendor: Vendor) => {
    setEditId(vendor.id);
    setEditName(vendor.name);
    setEditBizNo(vendor.bizNo || "");
    setEditCreditRating(vendor.creditRating || "");
    setEditCreditLimit(vendor.creditLimit ? String(vendor.creditLimit) : "");
    setEditNote(vendor.note || "");
  };

  const handleUpdate = () => {
    if (!editId || !editName.trim()) return;
    updateMutation.mutate({
      id: editId,
      name: editName.trim(),
      bizNo: editBizNo.trim() || undefined,
      creditRating: editCreditRating || null,
      creditLimit: editCreditLimit ? Number(editCreditLimit) : 0,
      note: editNote.trim() || null,
    });
  };

  const handleDelete = (vendor: Vendor) => {
    if (confirm(`"${vendor.name}" 거래처를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(vendor.id);
    }
  };

  const importMutation = useMutation({
    mutationFn: (items: { name: string; bizNo?: string }[]) =>
      apiPost<ImportResult>("/vendors/batch", { tenantId: tenantId!, items }),
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
        <VendorForm
          name={name}
          bizNo={bizNo}
          creditRating={creditRating}
          creditLimit={creditLimit}
          note={note}
          onNameChange={setName}
          onBizNoChange={setBizNo}
          onCreditRatingChange={setCreditRating}
          onCreditLimitChange={setCreditLimit}
          onNoteChange={setNote}
          onSubmit={handleCreate}
          isPending={createMutation.isPending}
          error={error}
        />
      )}

      <VendorTable
        vendors={vendors}
        canEdit={canEdit}
        canDelete={canDelete}
        editId={editId}
        editName={editName}
        editBizNo={editBizNo}
        editCreditRating={editCreditRating}
        editCreditLimit={editCreditLimit}
        editNote={editNote}
        onEditNameChange={setEditName}
        onEditBizNoChange={setEditBizNo}
        onEditCreditRatingChange={setEditCreditRating}
        onEditCreditLimitChange={setEditCreditLimit}
        onEditNoteChange={setEditNote}
        onStartEdit={startEdit}
        onUpdate={handleUpdate}
        onCancelEdit={() => setEditId(null)}
        onDelete={handleDelete}
        updatePending={updateMutation.isPending}
        importRef={importRef}
        importPending={importMutation.isPending}
        importResult={importResult}
        onImport={handleImport}
        onClearImportResult={() => setImportResult(null)}
        onDownloadTemplate={() => downloadTemplate("거래처_템플릿", ["거래처명", "사업자등록번호"])}
        onExport={() => {
          exportToXlsx(
            "거래처목록",
            "거래처",
            ["거래처명", "사업자등록번호", "신용등급", "거래한도", "메모", "등록일"],
            vendors.map((v) => [
              v.name,
              v.bizNo || "",
              creditRatingLabel(v.creditRating),
              Number(v.creditLimit || 0).toLocaleString(),
              v.note || "",
              new Date(v.createdAt).toLocaleDateString("ko-KR"),
            ])
          );
        }}
      />
    </div>
  );
}
