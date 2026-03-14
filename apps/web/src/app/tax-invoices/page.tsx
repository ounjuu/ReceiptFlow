"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./page.module.css";

interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

interface TaxInvoice {
  id: string;
  invoiceType: string;
  invoiceNo: string | null;
  invoiceDate: string;
  status: string;
  issuerBizNo: string;
  issuerName: string;
  recipientBizNo: string;
  recipientName: string;
  supplyAmount: string;
  taxAmount: string;
  totalAmount: string;
  approvalNo: string | null;
  description: string | null;
  vendor: Vendor | null;
}

interface TaxSummary {
  year: number;
  quarter: number;
  purchase: { count: number; supplyAmount: number; taxAmount: number };
  sales: { count: number; supplyAmount: number; taxAmount: number };
  netTaxAmount: number;
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "PENDING_APPROVAL": return { text: "결재중", cls: styles.statusPending };
    case "APPROVED": return { text: "승인", cls: styles.statusApproved };
    case "FINALIZED": return { text: "확정", cls: styles.statusFinalized };
    default: return { text: status, cls: "" };
  }
}

function typeLabel(type: string) {
  return type === "PURCHASE"
    ? { text: "매입", cls: styles.typePurchase }
    : { text: "매출", cls: styles.typeSales };
}

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

  const nextStatus = (current: string): { label: string; next: string } | null => {
    switch (current) {
      case "DRAFT": return { label: "승인", next: "APPROVED" };
      case "APPROVED": return { label: "확정", next: "FINALIZED" };
      default: return null;
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
        {formMode === "none" && canEdit && (
          <button className={styles.addBtn} onClick={() => setFormMode("create")}>
            세금계산서 등록
          </button>
        )}
      </div>

      {/* 부가세 신고 요약 */}
      <div className={styles.summaryControls}>
        <span className={styles.summaryTitle}>부가세 신고 요약</span>
        <select
          className={styles.summarySelect}
          value={summaryYear}
          onChange={(e) => setSummaryYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          className={styles.summarySelect}
          value={summaryQuarter}
          onChange={(e) => setSummaryQuarter(Number(e.target.value))}
        >
          <option value={1}>1분기 (1~3월)</option>
          <option value={2}>2분기 (4~6월)</option>
          <option value={3}>3분기 (7~9월)</option>
          <option value={4}>4분기 (10~12월)</option>
        </select>
      </div>

      {summary && (
        <div className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매출 공급가액</div>
            <div className={styles.summaryValue}>
              ₩{summary.sales.supplyAmount.toLocaleString()}
            </div>
            <div className={styles.summaryCount}>세액: ₩{summary.sales.taxAmount.toLocaleString()} / {summary.sales.count}건</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매입 공급가액</div>
            <div className={styles.summaryValue}>
              ₩{summary.purchase.supplyAmount.toLocaleString()}
            </div>
            <div className={styles.summaryCount}>세액: ₩{summary.purchase.taxAmount.toLocaleString()} / {summary.purchase.count}건</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매출세액</div>
            <div className={styles.summaryValue}>
              ₩{summary.sales.taxAmount.toLocaleString()}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>납부(환급)세액</div>
            <div className={`${styles.summaryValue} ${summary.netTaxAmount >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
              {summary.netTaxAmount >= 0 ? "" : "-"}₩{Math.abs(summary.netTaxAmount).toLocaleString()}
            </div>
            <div className={styles.summaryCount}>
              {summary.netTaxAmount >= 0 ? "납부" : "환급"}
            </div>
          </div>
        </div>
      )}

      {/* 등록/수정 폼 */}
      {formMode !== "none" && (
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            {formMode === "edit" ? "세금계산서 수정" : "세금계산서 등록"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <div className={styles.formRow}>
                <label className={styles.label}>유형</label>
                <select
                  className={styles.select}
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                  disabled={formMode === "edit"}
                >
                  <option value="PURCHASE">매입</option>
                  <option value="SALES">매출</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>세금계산서 번호</label>
                <input
                  className={styles.input}
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="선택 입력"
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>발행일</label>
                <input
                  className={styles.input}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>승인번호</label>
                <input
                  className={styles.input}
                  type="text"
                  value={approvalNo}
                  onChange={(e) => setApprovalNo(e.target.value)}
                  placeholder="선택 입력"
                />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formRow}>
                <label className={styles.label}>공급자 사업자등록번호</label>
                <input
                  className={styles.input}
                  type="text"
                  value={issuerBizNo}
                  onChange={(e) => setIssuerBizNo(e.target.value)}
                  placeholder="000-00-00000"
                  required
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>공급자 상호</label>
                <input
                  className={styles.input}
                  type="text"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="상호명"
                  required
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>공급받는자 사업자등록번호</label>
                <input
                  className={styles.input}
                  type="text"
                  value={recipientBizNo}
                  onChange={(e) => setRecipientBizNo(e.target.value)}
                  placeholder="000-00-00000"
                  required
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>공급받는자 상호</label>
                <input
                  className={styles.input}
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="상호명"
                  required
                />
              </div>
            </div>

            <div className={styles.amountRow}>
              <div className={styles.formRow}>
                <label className={styles.label}>공급가액</label>
                <input
                  className={styles.input}
                  type="number"
                  value={supplyAmount}
                  onChange={(e) => handleSupplyChange(e.target.value)}
                  placeholder="0"
                  min={0}
                  required
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>세액 (자동 10%)</label>
                <input
                  className={styles.input}
                  type="number"
                  value={taxAmount}
                  onChange={(e) => handleTaxChange(e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>합계</label>
                <input
                  className={styles.input}
                  type="number"
                  value={totalAmount}
                  readOnly
                  placeholder="0"
                />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formRowFull}>
                <label className={styles.label}>비고</label>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="메모 (선택)"
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isPending}
              >
                {isPending ? "저장 중..." : formMode === "edit" ? "수정 저장" : "등록"}
              </button>
              <button
                type="button"
                className={styles.cancelFormBtn}
                onClick={resetForm}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 탭 */}
      <div className={styles.tabs}>
        {(["ALL", "PURCHASE", "SALES"] as const).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "ALL" ? "전체" : tab === "PURCHASE" ? "매입" : "매출"}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.sectionTitle}>세금계산서 목록</h2>
          <div className={styles.filterRow}>
            <button
              className={styles.downloadBtn}
              onClick={handleExport}
              disabled={invoices.length === 0}
            >
              엑셀 다운로드
            </button>
          </div>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>상태</span>
            <select
              className={styles.filterInput}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">전체</option>
              <option value="DRAFT">임시</option>
              <option value="APPROVED">승인</option>
              <option value="FINALIZED">확정</option>
            </select>
            <span className={styles.filterLabel}>기간</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
            <span className={styles.filterSep}>~</span>
            <input
              className={styles.filterInput}
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
            {(filterStart || filterEnd || filterStatus) && (
              <button
                className={styles.filterClear}
                onClick={() => { setFilterStart(""); setFilterEnd(""); setFilterStatus(""); }}
              >
                초기화
              </button>
            )}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>유형</th>
              <th>번호</th>
              <th>일자</th>
              <th>공급자</th>
              <th>공급받는자</th>
              <th>공급가액</th>
              <th>세액</th>
              <th>합계</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const s = statusLabel(inv.status);
              const t = typeLabel(inv.invoiceType);
              return (
                <tr key={inv.id}>
                  <td>
                    <span className={`${styles.status} ${t.cls}`}>{t.text}</span>
                  </td>
                  <td>{inv.invoiceNo || "-"}</td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString("ko-KR")}</td>
                  <td title={inv.issuerBizNo}>{inv.issuerName}</td>
                  <td title={inv.recipientBizNo}>{inv.recipientName}</td>
                  <td>₩{Number(inv.supplyAmount).toLocaleString()}</td>
                  <td>₩{Number(inv.taxAmount).toLocaleString()}</td>
                  <td>₩{Number(inv.totalAmount).toLocaleString()}</td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {canEdit && inv.status === "DRAFT" && hasApprovalLine && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => submitApprovalMutation.mutate(inv.id)}
                          disabled={submitApprovalMutation.isPending}
                        >
                          결재요청
                        </button>
                      )}
                      {canEdit && nextStatus(inv.status) && !(inv.status === "DRAFT" && hasApprovalLine) && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => {
                            const ns = nextStatus(inv.status)!;
                            statusMutation.mutate({ id: inv.id, status: ns.next });
                          }}
                          disabled={statusMutation.isPending}
                        >
                          {nextStatus(inv.status)!.label}
                        </button>
                      )}
                      {inv.status !== "FINALIZED" && inv.status !== "PENDING_APPROVAL" && canEdit && (
                        <button
                          className={styles.editBtn}
                          onClick={() => startEdit(inv)}
                        >
                          수정
                        </button>
                      )}
                      {inv.status !== "FINALIZED" && canDelete && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(inv.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  세금계산서가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
