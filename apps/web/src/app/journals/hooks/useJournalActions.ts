import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "@/lib/api";
import { parseXlsx } from "@/lib/import-xlsx";
import { JournalEntry, JournalAttachment } from "../types";

export function useJournalActions(tenantId: string | null) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const journalImportRef = useRef<HTMLInputElement>(null);
  const [journalImportResult, setJournalImportResult] = useState<{
    total: number; success: number; failed: number;
    results: { index: number; status: string; error?: string }[];
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/journals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch<JournalEntry>(`/journals/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journals"] }),
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiPatch<{ count: number }>("/journals/batch/status", { ids, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      setSelectedIds(new Set());
    },
  });

  const submitApprovalMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiPost("/approvals/submit", { tenantId, documentType: "JOURNAL", documentId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journals"] }),
  });

  const uploadAttachmentMut = useMutation({
    mutationFn: ({ journalId, file }: { journalId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<JournalAttachment>(`/journals/${journalId}/attachments`, formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journals"] }),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: ({ journalId, attachmentId }: { journalId: string; attachmentId: string }) =>
      apiDelete(`/journals/${journalId}/attachments/${attachmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journals"] }),
  });

  const journalImportMutation = useMutation({
    mutationFn: (journals: { date: string; description?: string; lines: { accountCode: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[] }[]) =>
      apiPost<{ total: number; success: number; failed: number; results: { index: number; status: string; error?: string }[] }>("/journals/batch", { tenantId: tenantId!, journals }),
    onSuccess: (data) => {
      setJournalImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      if (journalImportRef.current) journalImportRef.current.value = "";
    },
  });

  // 결재선 존재 여부
  const { data: approvalLines = [] } = useQuery({
    queryKey: ["approval-lines-journal"],
    queryFn: () => apiGet<{ id: string }[]>(`/approvals/lines?tenantId=${tenantId}&documentType=JOURNAL`),
    enabled: !!tenantId,
  });
  const hasApprovalLine = approvalLines.length > 0;

  const handleDelete = useCallback((id: string) => {
    if (confirm("이 전표를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const handleCopy = useCallback((id: string) => {
    apiPost<JournalEntry>(`/journals/${id}/copy`, {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    });
  }, [queryClient]);

  const handleReverse = useCallback((id: string) => {
    if (confirm("이 전표의 역분개 전표를 생성하시겠습니까?")) {
      apiPost<JournalEntry>(`/journals/${id}/reverse`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["journals"] });
      });
    }
  }, [queryClient]);

  const handleJournalImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseXlsx(file);
      const groups = new Map<string, typeof rows>();
      rows.forEach((r) => {
        const key = r["전표번호"] || `auto-${Math.random()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });
      const journals = Array.from(groups.values()).map((group) => {
        const first = group[0];
        return {
          date: first["날짜"] || new Date().toISOString().slice(0, 10),
          description: first["적요"] || undefined,
          lines: group.map((r) => ({
            accountCode: r["계정코드"] || "",
            vendorBizNo: r["사업자번호"] || undefined,
            vendorName: r["거래처명"] || undefined,
            debit: Number(r["차변"]) || 0,
            credit: Number(r["대변"]) || 0,
          })),
        };
      }).filter((j) => j.lines.some((l) => l.accountCode));
      if (journals.length === 0) { alert("유효한 전표 데이터가 없습니다."); return; }
      journalImportMutation.mutate(journals);
    } catch { alert("엑셀 파일 파싱에 실패했습니다."); }
  }, [journalImportMutation]);

  const nextStatus = useCallback((current: string): { label: string; next: string } | null => {
    switch (current) {
      case "DRAFT": return { label: "승인", next: "APPROVED" };
      case "APPROVED": return { label: "확정", next: "POSTED" };
      default: return null;
    }
  }, []);

  const toggleAll = useCallback((journals: JournalEntry[]) => {
    const selectable = journals.filter((j) => j.status !== "POSTED");
    const allChecked = selectable.length > 0 && selectable.every((j) => selectedIds.has(j.id));
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((j) => j.id)));
    }
  }, [selectedIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    selectedIds, setSelectedIds,
    expandedId, setExpandedId,
    focusedRowId, setFocusedRowId,
    journalImportRef, journalImportResult, setJournalImportResult,
    hasApprovalLine,
    deleteMutation, statusMutation, batchMutation,
    submitApprovalMutation, uploadAttachmentMut, deleteAttachmentMut,
    journalImportMutation,
    handleDelete, handleCopy, handleReverse, handleJournalImport,
    nextStatus, toggleAll, toggleOne,
  };
}
