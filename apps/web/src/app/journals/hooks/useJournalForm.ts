import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { JournalEntry, LineInput, emptyLine } from "../types";

export function useJournalForm(tenantId: string | null, activeTab: string) {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [journalType, setJournalType] = useState("GENERAL");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [evidenceType, setEvidenceType] = useState("NONE");
  const [supplyAmount, setSupplyAmount] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [lines, setLines] = useState<LineInput[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const resetForm = useCallback(() => {
    setFormMode("none");
    setEditingId(null);
    setJournalType(activeTab || "GENERAL");
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setCurrency("KRW");
    setExchangeRate("1");
    setEvidenceType("NONE");
    setSupplyAmount("");
    setVatAmount("");
    setLines([emptyLine(), emptyLine()]);
    setError("");
  }, [activeTab]);

  const startEdit = useCallback((j: JournalEntry) => {
    setFormMode("edit");
    setEditingId(j.id);
    setJournalType(j.journalType || "GENERAL");
    setDate(new Date(j.date).toISOString().slice(0, 10));
    setDescription(j.description || "");
    setCurrency(j.currency || "KRW");
    setExchangeRate(String(Number(j.exchangeRate) || 1));
    setEvidenceType(j.evidenceType || "NONE");
    setSupplyAmount(j.supplyAmount ? String(Number(j.supplyAmount)) : "");
    setVatAmount(j.vatAmount ? String(Number(j.vatAmount)) : "");
    setLines(
      j.lines.map((l) => ({
        accountId: l.account.id,
        vendorBizNo: l.vendor?.bizNo || "",
        vendorName: l.vendor?.name || "",
        vendorId: l.vendor?.id || "",
        projectId: l.project?.id || "",
        departmentId: l.department?.id || "",
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    );
    setError("");
  }, []);

  const updateLine = useCallback((index: number, field: keyof LineInput, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        if (field === "debit" || field === "credit") {
          return { ...l, [field]: Number(value) || 0 };
        }
        if (field === "vendorBizNo") {
          return { ...l, vendorBizNo: value, vendorId: "", vendorName: "" };
        }
        return { ...l, [field]: value };
      }),
    );
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // 공급가액 변경 시 부가세 자동 계산 (10%)
  const handleSupplyAmountChange = useCallback((value: string) => {
    setSupplyAmount(value);
    const supply = Number(value) || 0;
    setVatAmount(String(Math.round(supply * 0.1)));
  }, []);

  const isTaxType = journalType === "PURCHASE" || journalType === "SALES";

  const handleCurrencyChange = useCallback(async (cur: string) => {
    setCurrency(cur);
    if (cur === "KRW") {
      setExchangeRate("1");
      return;
    }
    try {
      const res = await apiGet<{ rate: string }>(`/exchange-rates/latest?tenantId=${tenantId}&currency=${cur}`);
      setExchangeRate(String(Number(res.rate)));
    } catch {
      setExchangeRate("1");
    }
  }, [tenantId]);

  const createMutation = useMutation({
    mutationFn: (body: {
      tenantId: string;
      journalType: string;
      date: string;
      description: string;
      currency: string;
      exchangeRate: number;
      lines: { accountId: string; vendorId?: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[];
    }) => apiPost<JournalEntry>("/journals", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch<JournalEntry>(`/journals/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (lines.some((l) => !l.accountId)) {
      setError("모든 라인의 계정을 선택해주세요");
      return;
    }
    if (lines.some((l) => !l.vendorBizNo)) {
      setError("모든 라인의 사업자등록번호를 입력해주세요");
      return;
    }
    if (lines.some((l) => !l.vendorName)) {
      setError("모든 라인의 거래처명을 입력해주세요");
      return;
    }
    if (!isBalanced) {
      setError("차변과 대변의 합계가 일치하지 않습니다");
      return;
    }
    if (totalDebit === 0) {
      setError("금액을 입력해주세요");
      return;
    }

    const submitLines = lines.map((l) => ({
      accountId: l.accountId,
      ...(l.vendorId
        ? { vendorId: l.vendorId }
        : { vendorBizNo: l.vendorBizNo, vendorName: l.vendorName }),
      ...(l.projectId ? { projectId: l.projectId } : {}),
      ...(l.departmentId ? { departmentId: l.departmentId } : {}),
      debit: l.debit,
      credit: l.credit,
    }));

    if (formMode === "edit" && editingId) {
      updateMutation.mutate({
        id: editingId,
        body: { date, description, currency, exchangeRate: Number(exchangeRate), lines: submitLines },
      });
    } else {
      createMutation.mutate({
        tenantId: tenantId!,
        journalType,
        ...(isTaxType && { evidenceType, supplyAmount: Number(supplyAmount) || undefined, vatAmount: Number(vatAmount) || undefined }),
        date,
        description,
        currency,
        exchangeRate: Number(exchangeRate),
        lines: submitLines,
      });
    }
  }, [lines, isBalanced, totalDebit, formMode, editingId, date, description, currency, exchangeRate, journalType, tenantId, createMutation, updateMutation]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return {
    formMode, setFormMode,
    editingId,
    journalType, setJournalType,
    evidenceType, setEvidenceType,
    supplyAmount, vatAmount, setVatAmount,
    isTaxType, handleSupplyAmountChange,
    date, setDate,
    description, setDescription,
    currency, exchangeRate, setExchangeRate,
    lines, setLines,
    error,
    totalDebit, totalCredit, isBalanced, isPending,
    resetForm, startEdit, updateLine, addLine, removeLine,
    handleCurrencyChange, handleSubmit,
  };
}
