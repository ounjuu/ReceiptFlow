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

interface TradeItem {
  id: string;
  itemName: string;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  note: string | null;
}

interface PaymentRecord {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  note: string | null;
}

interface Trade {
  id: string;
  tradeType: string;
  tradeNo: string;
  tradeDate: string;
  dueDate: string | null;
  vendor: Vendor;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  description: string | null;
  note: string | null;
  items: TradeItem[];
  payments?: PaymentRecord[];
}

interface TradeSummary {
  sales: { count: number; total: number; paid: number; remaining: number };
  purchase: { count: number; total: number; paid: number; remaining: number };
}

interface AgingRow {
  id: string;
  tradeNo: string;
  vendorName: string;
  tradeDate: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  daysPast: number;
  bucket: string;
}

interface AgingReport {
  rows: AgingRow[];
  buckets: { current: number; days30: number; days60: number; days90: number };
  total: number;
}

interface ItemInput {
  itemName: string;
  specification: string;
  quantity: number;
  unitPrice: number;
}

const fmt = (n: number) => n.toLocaleString();

const statusLabel = (s: string) => {
  switch (s) {
    case "DRAFT": return { text: "임시", cls: styles.statusDraft };
    case "CONFIRMED": return { text: "확정", cls: styles.statusConfirmed };
    case "PARTIAL_PAID": return { text: "부분수금", cls: styles.statusPartialPaid };
    case "PAID": return { text: "수금완료", cls: styles.statusPaid };
    case "CANCELLED": return { text: "취소", cls: styles.statusCancelled };
    default: return { text: s, cls: "" };
  }
};

const methodLabel = (m: string) => {
  switch (m) {
    case "CASH": return "현금";
    case "BANK_TRANSFER": return "계좌이체";
    case "CARD": return "카드";
    case "NOTE": return "어음";
    default: return m;
  }
};

const emptyItem = (): ItemInput => ({
  itemName: "",
  specification: "",
  quantity: 1,
  unitPrice: 0,
});

export default function TradesPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"sales" | "purchase" | "payment" | "report">("sales");
  const [showForm, setShowForm] = useState(false);

  // 거래 등록 폼
  const [formVendorId, setFormVendorId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDueDate, setFormDueDate] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formItems, setFormItems] = useState<ItemInput[]>([emptyItem()]);
  const [formError, setFormError] = useState("");

  // 입금/출금 폼
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentNote, setPaymentNote] = useState("");

  // 현황 탭
  const [agingType, setAgingType] = useState<"SALES" | "PURCHASE">("SALES");

  // 거래처 목록
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiGet<Vendor[]>(`/vendors?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 거래 목록
  const tradeType = tab === "sales" ? "SALES" : tab === "purchase" ? "PURCHASE" : undefined;
  const { data: trades = [] } = useQuery({
    queryKey: ["trades", tradeType],
    queryFn: () => {
      let url = `/trades?tenantId=${tenantId}`;
      if (tradeType) url += `&tradeType=${tradeType}`;
      return apiGet<Trade[]>(url);
    },
    enabled: !!tenantId && (tab === "sales" || tab === "purchase"),
  });

  // 입금/출금 탭: 미수/미지급 거래만
  const { data: unpaidTrades = [] } = useQuery({
    queryKey: ["trades-unpaid"],
    queryFn: () =>
      apiGet<Trade[]>(`/trades?tenantId=${tenantId}`).then((all) =>
        all.filter((t) => ["CONFIRMED", "PARTIAL_PAID"].includes(t.status)),
      ),
    enabled: !!tenantId && tab === "payment",
  });

  // 선택된 거래 상세 (입금 내역 포함)
  const { data: selectedTrade } = useQuery({
    queryKey: ["trade-detail", selectedTradeId],
    queryFn: () => apiGet<Trade>(`/trades/${selectedTradeId}`),
    enabled: !!selectedTradeId && tab === "payment",
  });

  // 요약
  const { data: summary } = useQuery({
    queryKey: ["trade-summary"],
    queryFn: () => apiGet<TradeSummary>(`/trades/summary?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 연령 분석
  const { data: aging } = useQuery({
    queryKey: ["trade-aging", agingType],
    queryFn: () =>
      apiGet<AgingReport>(
        `/trades/aging?tenantId=${tenantId}&tradeType=${agingType}`,
      ),
    enabled: !!tenantId && tab === "report",
  });

  // 거래 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/trades", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["trade-summary"] });
      resetForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // 확정
  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/trades/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["trade-summary"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  // 취소
  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/trades/${id}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["trade-summary"] });
    },
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/trades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["trade-summary"] });
    },
  });

  // 입금/출금
  const paymentMutation = useMutation({
    mutationFn: ({ tradeId, data }: { tradeId: string; data: Record<string, unknown> }) =>
      apiPost(`/trades/${tradeId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["trades-unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["trade-detail"] });
      queryClient.invalidateQueries({ queryKey: ["trade-summary"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      setPaymentAmount("");
      setPaymentNote("");
    },
  });

  // 입금/출금 삭제
  const deletePaymentMutation = useMutation({
    mutationFn: ({ tradeId, paymentId }: { tradeId: string; paymentId: string }) =>
      apiDelete(`/trades/${tradeId}/payments/${paymentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["trades-unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["trade-detail"] });
      queryClient.invalidateQueries({ queryKey: ["trade-summary"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setFormVendorId("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDueDate("");
    setFormDesc("");
    setFormNote("");
    setFormItems([emptyItem()]);
    setFormError("");
  };

  const handleSubmit = () => {
    setFormError("");
    if (!formVendorId) { setFormError("거래처를 선택하세요"); return; }
    if (formItems.some((i) => !i.itemName)) { setFormError("품목명을 입력하세요"); return; }
    if (formItems.some((i) => i.unitPrice <= 0)) { setFormError("단가를 입력하세요"); return; }

    createMutation.mutate({
      tenantId,
      tradeType: tab === "sales" ? "SALES" : "PURCHASE",
      tradeDate: formDate,
      dueDate: formDueDate || undefined,
      vendorId: formVendorId,
      description: formDesc || undefined,
      note: formNote || undefined,
      items: formItems.map((i) => ({
        itemName: i.itemName,
        specification: i.specification || undefined,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    });
  };

  const handlePayment = () => {
    if (!selectedTradeId || !paymentAmount) return;
    paymentMutation.mutate({
      tradeId: selectedTradeId,
      data: {
        paymentDate,
        amount: Number(paymentAmount),
        paymentMethod,
        note: paymentNote || undefined,
      },
    });
  };

  const supplyTotal = formItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxTotal = Math.round(supplyTotal * 0.1);

  // 거래 목록 테이블 (매출/매입 공통)
  const renderTradeTable = (list: Trade[], type: string) => (
    <table>
      <thead>
        <tr>
          <th>거래번호</th>
          <th>거래일</th>
          <th>거래처</th>
          <th>설명</th>
          <th>상태</th>
          <th style={{ textAlign: "right" }}>공급가</th>
          <th style={{ textAlign: "right" }}>세액</th>
          <th style={{ textAlign: "right" }}>합계</th>
          <th style={{ textAlign: "right" }}>수금액</th>
          <th style={{ textAlign: "right" }}>잔액</th>
          {(canEdit || canDelete) && <th>관리</th>}
        </tr>
      </thead>
      <tbody>
        {list.map((t) => {
          const s = statusLabel(t.status);
          const remaining = t.totalAmount - t.paidAmount;
          return (
            <tr key={t.id}>
              <td>{t.tradeNo}</td>
              <td>{new Date(t.tradeDate).toLocaleDateString("ko-KR")}</td>
              <td>{t.vendor.name}</td>
              <td>{t.description || "-"}</td>
              <td><span className={`${styles.status} ${s.cls}`}>{s.text}</span></td>
              <td style={{ textAlign: "right" }}>{fmt(t.supplyAmount)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.taxAmount)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.totalAmount)}</td>
              <td style={{ textAlign: "right" }}>{fmt(t.paidAmount)}</td>
              <td style={{ textAlign: "right", color: remaining > 0 ? "var(--danger)" : "inherit" }}>
                {fmt(remaining)}
              </td>
              {(canEdit || canDelete) && (
                <td>
                  <div className={styles.actions}>
                    {canEdit && t.status === "DRAFT" && (
                      <button
                        className={styles.confirmBtn}
                        onClick={() => {
                          if (confirm("거래를 확정하시겠습니까? 자동으로 전표가 생성됩니다.")) {
                            confirmMutation.mutate(t.id);
                          }
                        }}
                      >
                        확정
                      </button>
                    )}
                    {canEdit && !["PAID", "CANCELLED"].includes(t.status) && t.status !== "DRAFT" && (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => {
                          if (confirm("거래를 취소하시겠습니까?")) {
                            cancelMutation.mutate(t.id);
                          }
                        }}
                      >
                        취소
                      </button>
                    )}
                    {canDelete && t.status === "DRAFT" && (
                      <button
                        className={styles.dangerBtn}
                        onClick={() => {
                          if (confirm("거래를 삭제하시겠습니까?")) {
                            deleteMutation.mutate(t.id);
                          }
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          );
        })}
        {list.length === 0 && (
          <tr>
            <td colSpan={(canEdit || canDelete) ? 11 : 10} style={{ textAlign: "center", color: "var(--text-muted)" }}>
              {type} 거래가 없습니다
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  // 거래 등록 폼 (매출/매입 공통)
  const renderForm = () => (
    <>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>거래처 *</label>
          <select className={styles.formSelect} value={formVendorId} onChange={(e) => setFormVendorId(e.target.value)}>
            <option value="">선택</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.bizNo ? `[${v.bizNo}] ` : ""}{v.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>거래일 *</label>
          <input className={styles.formInput} type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>결제 예정일</label>
          <input className={styles.formInput} type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>설명</label>
          <input className={styles.formInput} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="거래 설명" />
        </div>
      </div>

      {/* 품목 */}
      <div className={styles.itemsHeader}>
        <span>품목명 *</span>
        <span>규격</span>
        <span>수량</span>
        <span>단가 *</span>
        <span>금액</span>
        <span></span>
      </div>
      {formItems.map((item, i) => (
        <div key={i} className={styles.itemRow}>
          <input className={styles.formInput} value={item.itemName} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, itemName: e.target.value } : it))} placeholder="품목명" />
          <input className={styles.formInput} value={item.specification} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, specification: e.target.value } : it))} placeholder="규격" />
          <input className={styles.formInput} type="number" min={1} value={item.quantity} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, quantity: Number(e.target.value) || 1 } : it))} />
          <input className={styles.formInput} type="number" min={0} value={item.unitPrice || ""} onChange={(e) => setFormItems((prev) => prev.map((it, j) => j === i ? { ...it, unitPrice: Number(e.target.value) || 0 } : it))} placeholder="0" />
          <span style={{ padding: "8px 12px", fontSize: "0.9rem" }}>{fmt(item.quantity * item.unitPrice)}</span>
          <button type="button" className={styles.removeBtn} onClick={() => setFormItems((prev) => prev.filter((_, j) => j !== i))} disabled={formItems.length <= 1}>X</button>
        </div>
      ))}
      <div className={styles.itemFooter}>
        <button type="button" className={styles.addItemBtn} onClick={() => setFormItems((prev) => [...prev, emptyItem()])}>+ 품목 추가</button>
        <div>
          <span>공급가: {fmt(supplyTotal)}원</span>
          <span style={{ margin: "0 12px" }}>세액: {fmt(taxTotal)}원</span>
          <span style={{ fontWeight: 700 }}>합계: {fmt(supplyTotal + taxTotal)}원</span>
        </div>
      </div>

      {formError && <p className={styles.error}>{formError}</p>}

      <div className={styles.formActions}>
        <button className={styles.secondaryBtn} onClick={resetForm}>취소</button>
        <button className={styles.primaryBtn} onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? "저장 중..." : "등록"}
        </button>
      </div>
    </>
  );

  const selectedTradeRemaining = selectedTrade
    ? selectedTrade.totalAmount - selectedTrade.paidAmount
    : 0;

  return (
    <div>
      <h1 className={styles.title}>매출/매입 관리</h1>
      <p className={styles.subtitle}>
        거래명세서 발행, 미수금/미지급금 관리, 입금/출금 처리
      </p>

      {/* 요약 카드 */}
      {summary && (
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 매출</div>
            <div className={`${styles.summaryValue} ${styles.summaryPositive}`}>
              {fmt(summary.sales.total)}원
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매출 미수금</div>
            <div className={`${styles.summaryValue} ${summary.sales.remaining > 0 ? styles.summaryNegative : ""}`}>
              {fmt(summary.sales.remaining)}원
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>총 매입</div>
            <div className={styles.summaryValue}>{fmt(summary.purchase.total)}원</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>매입 미지급금</div>
            <div className={`${styles.summaryValue} ${summary.purchase.remaining > 0 ? styles.summaryNegative : ""}`}>
              {fmt(summary.purchase.remaining)}원
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "sales" ? styles.tabActive : ""}`} onClick={() => setTab("sales")}>매출</button>
        <button className={`${styles.tab} ${tab === "purchase" ? styles.tabActive : ""}`} onClick={() => setTab("purchase")}>매입</button>
        <button className={`${styles.tab} ${tab === "payment" ? styles.tabActive : ""}`} onClick={() => setTab("payment")}>입금/출금</button>
        <button className={`${styles.tab} ${tab === "report" ? styles.tabActive : ""}`} onClick={() => setTab("report")}>현황</button>
      </div>

      {/* 매출 탭 */}
      {tab === "sales" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>매출 거래</h2>
            {canEdit && (
              <button className={styles.primaryBtn} onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
                {showForm ? "취소" : "매출 등록"}
              </button>
            )}
          </div>
          {showForm && renderForm()}
          {renderTradeTable(trades, "매출")}
        </div>
      )}

      {/* 매입 탭 */}
      {tab === "purchase" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>매입 거래</h2>
            {canEdit && (
              <button className={styles.primaryBtn} onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
                {showForm ? "취소" : "매입 등록"}
              </button>
            )}
          </div>
          {showForm && renderForm()}
          {renderTradeTable(trades, "매입")}
        </div>
      )}

      {/* 입금/출금 탭 */}
      {tab === "payment" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>입금/출금 처리</h2>
          </div>

          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>거래 선택 *</label>
              <select
                className={styles.formSelect}
                value={selectedTradeId}
                onChange={(e) => setSelectedTradeId(e.target.value)}
              >
                <option value="">거래를 선택하세요</option>
                {unpaidTrades.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.tradeType === "SALES" ? "매출" : "매입"}] {t.tradeNo} - {t.vendor.name} (잔액: {fmt(t.totalAmount - t.paidAmount)}원)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedTrade && (
            <div className={styles.paymentSection}>
              <div className={styles.remainingAmount}>
                잔액: <span style={{ color: selectedTradeRemaining > 0 ? "var(--danger)" : "#166534" }}>
                  {fmt(selectedTradeRemaining)}원
                </span>
                <span className={styles.unit} style={{ marginLeft: 8 }}>
                  (총액 {fmt(selectedTrade.totalAmount)}원 / 수금 {fmt(selectedTrade.paidAmount)}원)
                </span>
              </div>

              {/* 기존 입금/출금 내역 */}
              {selectedTrade.payments && selectedTrade.payments.length > 0 && (
                <div className={styles.paymentList}>
                  <h3 className={styles.sectionTitle} style={{ marginBottom: 8 }}>입금/출금 내역</h3>
                  {selectedTrade.payments.map((p) => (
                    <div key={p.id} className={styles.paymentItem}>
                      <span>{new Date(p.paymentDate).toLocaleDateString("ko-KR")}</span>
                      <span>{methodLabel(p.paymentMethod)}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(p.amount)}원</span>
                      <span style={{ color: "var(--text-muted)" }}>{p.note || ""}</span>
                      {canDelete && (
                        <button
                          className={styles.dangerBtn}
                          onClick={() => {
                            if (confirm("이 입금/출금 내역을 삭제하시겠습니까?")) {
                              deletePaymentMutation.mutate({
                                tradeId: selectedTrade.id,
                                paymentId: p.id,
                              });
                            }
                          }}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 입금/출금 등록 */}
              {canEdit && selectedTradeRemaining > 0 && (
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>날짜 *</label>
                    <input
                      className={styles.formInput}
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>금액 *</label>
                    <input
                      className={styles.formInput}
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`최대 ${fmt(selectedTradeRemaining)}`}
                      max={selectedTradeRemaining}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>결제수단 *</label>
                    <select
                      className={styles.formSelect}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="BANK_TRANSFER">계좌이체</option>
                      <option value="CASH">현금</option>
                      <option value="CARD">카드</option>
                      <option value="NOTE">어음</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>메모</label>
                    <input
                      className={styles.formInput}
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="선택사항"
                    />
                  </div>
                  <div className={styles.formActions}>
                    <button
                      className={styles.primaryBtn}
                      onClick={handlePayment}
                      disabled={paymentMutation.isPending || !paymentAmount}
                    >
                      {paymentMutation.isPending ? "처리 중..." : selectedTrade.tradeType === "SALES" ? "입금 처리" : "출금 처리"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 현황 탭 */}
      {tab === "report" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>채권/채무 연령 분석</h2>
            <div className={styles.sectionHeaderRight}>
              <select
                className={styles.controlSelect}
                value={agingType}
                onChange={(e) => setAgingType(e.target.value as "SALES" | "PURCHASE")}
              >
                <option value="SALES">매출채권 (미수금)</option>
                <option value="PURCHASE">매입채무 (미지급금)</option>
              </select>
              <button
                className={styles.downloadBtn}
                onClick={() => {
                  if (!aging || aging.rows.length === 0) return;
                  const label = agingType === "SALES" ? "매출채권" : "매입채무";
                  exportToXlsx(
                    `${label}_연령분석`,
                    "연령분석",
                    ["거래번호", "거래처", "거래일", "결제예정일", "총액", "수금액", "잔액", "경과일"],
                    aging.rows.map((r) => [
                      r.tradeNo,
                      r.vendorName,
                      new Date(r.tradeDate).toLocaleDateString("ko-KR"),
                      r.dueDate ? new Date(r.dueDate).toLocaleDateString("ko-KR") : "-",
                      r.totalAmount,
                      r.paidAmount,
                      r.remaining,
                      r.daysPast,
                    ]),
                  );
                }}
                disabled={!aging || aging.rows.length === 0}
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          {/* 연령 버킷 */}
          {aging && (
            <>
              <div className={styles.agingBuckets}>
                <div className={styles.agingBucket}>
                  <div className={styles.agingBucketLabel}>30일 이내</div>
                  <div className={styles.agingBucketValue}>{fmt(aging.buckets.current)}원</div>
                </div>
                <div className={styles.agingBucket}>
                  <div className={styles.agingBucketLabel}>30~60일</div>
                  <div className={styles.agingBucketValue} style={{ color: aging.buckets.days30 > 0 ? "#b45309" : "inherit" }}>
                    {fmt(aging.buckets.days30)}원
                  </div>
                </div>
                <div className={styles.agingBucket}>
                  <div className={styles.agingBucketLabel}>60~90일</div>
                  <div className={styles.agingBucketValue} style={{ color: aging.buckets.days60 > 0 ? "#dc2626" : "inherit" }}>
                    {fmt(aging.buckets.days60)}원
                  </div>
                </div>
                <div className={styles.agingBucket}>
                  <div className={styles.agingBucketLabel}>90일 초과</div>
                  <div className={styles.agingBucketValue} style={{ color: aging.buckets.days90 > 0 ? "#991b1b" : "inherit" }}>
                    {fmt(aging.buckets.days90)}원
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>거래번호</th>
                    <th>거래처</th>
                    <th>거래일</th>
                    <th>결제예정일</th>
                    <th style={{ textAlign: "right" }}>총액</th>
                    <th style={{ textAlign: "right" }}>수금액</th>
                    <th style={{ textAlign: "right" }}>잔액</th>
                    <th style={{ textAlign: "right" }}>경과일</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.tradeNo}</td>
                      <td>{r.vendorName}</td>
                      <td>{new Date(r.tradeDate).toLocaleDateString("ko-KR")}</td>
                      <td>{r.dueDate ? new Date(r.dueDate).toLocaleDateString("ko-KR") : "-"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(r.totalAmount)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(r.paidAmount)}</td>
                      <td style={{ textAlign: "right", color: "var(--danger)" }}>{fmt(r.remaining)}</td>
                      <td style={{ textAlign: "right", color: r.daysPast > 90 ? "#991b1b" : r.daysPast > 60 ? "#dc2626" : r.daysPast > 30 ? "#b45309" : "inherit" }}>
                        {r.daysPast}일
                      </td>
                    </tr>
                  ))}
                  {aging.rows.length > 0 && (
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={6}>합계</td>
                      <td style={{ textAlign: "right", color: "var(--danger)" }}>{fmt(aging.total)}</td>
                      <td></td>
                    </tr>
                  )}
                  {aging.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        미수/미지급 거래가 없습니다
                      </td>
                    </tr>
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
