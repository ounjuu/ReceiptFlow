"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./TaxInvoices.module.css";
import { TaxInvoice, TaxSummary } from "./types";
import TaxInvoiceForm from "./TaxInvoiceForm";
import TaxInvoiceTable from "./TaxInvoiceTable";
import HometaxImportModal from "./HometaxImportModal";

export default function TaxInvoicesPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"ALL" | "PURCHASE" | "SALES">("ALL");
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);

  // 폼 필드
  const [invoiceType, setInvoiceType] = useState("PURCHASE");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [issuerBizNo, setIssuerBizNo] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [recipientBizNo, setRecipientBizNo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [supplyAmount, setSupplyAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [approvalNo, setApprovalNo] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  // 홈택스 XML 가져오기 모달 상태
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("PURCHASE");
  const [importResult, setImportResult] = useState<string>("");

  // 필터
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // 부가세 요약 기간
  const now = new Date();
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryQuarter, setSummaryQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  // 목록 조회
  const typeParam = activeTab !== "ALL" ? `&invoiceType=${activeTab}` : "";
  const dateParams = [
    filterStart && `startDate=${filterStart}`,
    filterEnd && `endDate=${filterEnd}`,
    filterStatus && `status=${filterStatus}`,
  ].filter(Boolean).join("&");

  const { data: invoices = [] } = useQuery({
    queryKey: ["taxInvoices", activeTab, filterStart, filterEnd, filterStatus],
    queryFn: () =>
      apiGet<TaxInvoice[]>(
        `/tax-invoices?tenantId=${tenantId}${typeParam}${dateParams ? `&${dateParams}` : ""}`
      ),
    enabled: !!tenantId,
  });

  // 부가세 요약
  const { data: summary } = useQuery({
    queryKey: ["taxSummary", summaryYear, summaryQuarter],
    queryFn: () =>
      apiGet<TaxSummary>(
        `/tax-invoices/report/summary?tenantId=${tenantId}&year=${summaryYear}&quarter=${summaryQuarter}`
      ),
    enabled: !!tenantId,
  });

  // 공급가액 변경 시 세액/합계 자동 계산
  const handleSupplyChange = (val: string) => {
    setSupplyAmount(val);
    const supply = Number(val) || 0;
    const tax = Math.round(supply * 0.1);
    setTaxAmount(String(tax));
    setTotalAmount(String(supply + tax));
  };

  const handleTaxChange = (val: string) => {
    setTaxAmount(val);
    const supply = Number(supplyAmount) || 0;
    const tax = Number(val) || 0;
    setTotalAmount(String(supply + tax));
  };

  const resetForm = () => {
    setFormMode("none");
    setEditingId(null);
    setInvoiceType("PURCHASE");
    setInvoiceNo("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setIssuerBizNo("");
    setIssuerName("");
    setRecipientBizNo("");
    setRecipientName("");
    setSupplyAmount("");
    setTaxAmount("");
    setTotalAmount("");
    setApprovalNo("");
    setDescription("");
    setError("");
  };

  const startEdit = (inv: TaxInvoice) => {
    setFormMode("edit");
    setEditingId(inv.id);
    setInvoiceType(inv.invoiceType);
    setInvoiceNo(inv.invoiceNo || "");
    setInvoiceDate(new Date(inv.invoiceDate).toISOString().slice(0, 10));
    setIssuerBizNo(inv.issuerBizNo);
    setIssuerName(inv.issuerName);
    setRecipientBizNo(inv.recipientBizNo);
    setRecipientName(inv.recipientName);
    setSupplyAmount(String(Number(inv.supplyAmount)));
    setTaxAmount(String(Number(inv.taxAmount)));
    setTotalAmount(String(Number(inv.totalAmount)));
    setApprovalNo(inv.approvalNo || "");
    setDescription(inv.description || "");
    setError("");
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<TaxInvoice>("/tax-invoices", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["taxSummary"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch<TaxInvoice>(`/tax-invoices/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["taxSummary"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/tax-invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["taxSummary"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch<TaxInvoice>(`/tax-invoices/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["taxSummary"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!issuerBizNo || !issuerName || !recipientBizNo || !recipientName) {
      setError("공급자와 공급받는자 정보를 모두 입력해주세요");
      return;
    }
    if (!supplyAmount || Number(supplyAmount) <= 0) {
      setError("공급가액을 입력해주세요");
      return;
    }

    const body = {
      tenantId,
      invoiceType,
      invoiceNo: invoiceNo || undefined,
      invoiceDate,
      issuerBizNo,
      issuerName,
      recipientBizNo,
      recipientName,
      supplyAmount: Number(supplyAmount),
      taxAmount: Number(taxAmount) || 0,
      totalAmount: Number(totalAmount) || 0,
      approvalNo: approvalNo || undefined,
      description: description || undefined,
    };

    if (formMode === "edit" && editingId) {
      const { tenantId: _, ...updateBody } = body;
      updateMutation.mutate({ id: editingId, body: updateBody });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("이 세금계산서를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  // 결재 요청
  const submitApprovalMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiPost("/approvals/submit", {
        tenantId,
        documentType: "TAX_INVOICE",
        documentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-invoices"] });
    },
  });

  // 결재선 존재 여부
  const { data: approvalLines = [] } = useQuery({
    queryKey: ["approval-lines-tax-invoice"],
    queryFn: () =>
      apiGet<{ id: string }[]>(
        `/approvals/lines?tenantId=${tenantId}&documentType=TAX_INVOICE`,
      ),
    enabled: !!tenantId,
  });

  const hasApprovalLine = approvalLines.length > 0;

  // 홈택스 XML 가져오기
  const importMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiUpload<{ imported: number }>("/tax-invoices/import/hometax-xml", formData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["taxInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["taxSummary"] });
      setImportResult(`${data.imported}건 가져오기 완료`);
      setImportFile(null);
    },
    onError: (err: Error) => {
      setImportResult(`오류: ${err.message}`);
    },
  });

  const handleImportSubmit = () => {
    if (!importFile) return;
    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("invoiceType", importType);
    formData.append("tenantId", tenantId || "");
    setImportResult("");
    importMutation.mutate(formData);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportType("PURCHASE");
    setImportResult("");
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // 엑셀 내보내기
  const handleExport = () => {
    const statusText = (s: string) => {
      switch (s) {
        case "DRAFT": return "임시";
        case "APPROVED": return "승인";
        case "FINALIZED": return "확정";
        default: return s;
      }
    };
    exportToXlsx(
      "세금계산서목록",
      "세금계산서",
      ["유형", "계산서번호", "일자", "공급자(사업자번호)", "공급자(상호)", "공급받는자(사업자번호)", "공급받는자(상호)", "공급가액", "세액", "합계", "승인번호", "상태", "비고"],
      invoices.map((inv) => [
        inv.invoiceType === "PURCHASE" ? "매입" : "매출",
        inv.invoiceNo || "",
        new Date(inv.invoiceDate).toLocaleDateString("ko-KR"),
        inv.issuerBizNo,
        inv.issuerName,
        inv.recipientBizNo,
        inv.recipientName,
        Number(inv.supplyAmount),
        Number(inv.taxAmount),
        Number(inv.totalAmount),
        inv.approvalNo || "",
        statusText(inv.status),
        inv.description || "",
      ])
    );
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>세금계산서 관리</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && (
            <button
              className={styles.downloadBtn}
              onClick={() => setShowImportModal(true)}
            >
              홈택스 XML 가져오기
            </button>
          )}
          {formMode === "none" && canEdit && (
            <button className={styles.addBtn} onClick={() => setFormMode("create")}>
              세금계산서 등록
            </button>
          )}
        </div>
      </div>

      {/* 홈택스 XML 가져오기 모달 */}
      {showImportModal && (
        <HometaxImportModal
          importType={importType}
          setImportType={setImportType}
          importFile={importFile}
          setImportFile={setImportFile}
          importResult={importResult}
          importIsPending={importMutation.isPending}
          handleImportSubmit={handleImportSubmit}
          closeImportModal={closeImportModal}
        />
      )}

      {/* 등록/수정 폼 */}
      {formMode !== "none" && (
        <TaxInvoiceForm
          formMode={formMode}
          invoiceType={invoiceType}
          setInvoiceType={setInvoiceType}
          invoiceNo={invoiceNo}
          setInvoiceNo={setInvoiceNo}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          issuerBizNo={issuerBizNo}
          setIssuerBizNo={setIssuerBizNo}
          issuerName={issuerName}
          setIssuerName={setIssuerName}
          recipientBizNo={recipientBizNo}
          setRecipientBizNo={setRecipientBizNo}
          recipientName={recipientName}
          setRecipientName={setRecipientName}
          supplyAmount={supplyAmount}
          taxAmount={taxAmount}
          totalAmount={totalAmount}
          approvalNo={approvalNo}
          setApprovalNo={setApprovalNo}
          description={description}
          setDescription={setDescription}
          error={error}
          isPending={isPending}
          handleSupplyChange={handleSupplyChange}
          handleTaxChange={handleTaxChange}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
        />
      )}

      {/* 요약 + 탭 + 테이블 */}
      <TaxInvoiceTable
        invoices={invoices}
        summary={summary}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filterStart={filterStart}
        setFilterStart={setFilterStart}
        filterEnd={filterEnd}
        setFilterEnd={setFilterEnd}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        summaryYear={summaryYear}
        setSummaryYear={setSummaryYear}
        summaryQuarter={summaryQuarter}
        setSummaryQuarter={setSummaryQuarter}
        years={years}
        canEdit={canEdit}
        canDelete={canDelete}
        hasApprovalLine={hasApprovalLine}
        handleExport={handleExport}
        startEdit={startEdit}
        handleDelete={handleDelete}
        submitApprovalMutation={submitApprovalMutation}
        statusMutation={statusMutation}
      />
    </div>
  );
}
