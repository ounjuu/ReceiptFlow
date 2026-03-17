"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./BankAccounts.module.css";

interface AccountRef {
  id: string;
  code: string;
  name: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  currency: string;
  balance: number;
  accountId: string;
  account: { code: string; name: string };
  status: string;
  memo: string | null;
  createdAt: string;
}

interface BankTransaction {
  id: string;
  txNo: string;
  txType: string;
  txDate: string;
  amount: number;
  balance: number;
  counterparty: string | null;
  description: string | null;
  createdAt: string;
}

interface Summary {
  totalAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
}

const TX_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "입금",
  WITHDRAW: "출금",
  TRANSFER: "이체",
};

const TX_TYPE_STYLE: Record<string, string> = {
  DEPOSIT: "badgeDeposit",
  WITHDRAW: "badgeWithdraw",
  TRANSFER: "badgeTransfer",
};

const fmt = (n: number) => n.toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

export default function BankAccountsPage() {
  const { tenantId, canEdit } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"accounts" | "register" | "history" | "status">("accounts");

  // 계좌 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [formBankName, setFormBankName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formAccountHolder, setFormAccountHolder] = useState("");
  const [formCurrency, setFormCurrency] = useState("KRW");
  const [formBalance, setFormBalance] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formMemo, setFormMemo] = useState("");

  // 입출금 등록 폼
  const [txBankAccountId, setTxBankAccountId] = useState("");
  const [txType, setTxType] = useState("DEPOSIT");
  const [txDate, setTxDate] = useState(today());
  const [txAmount, setTxAmount] = useState("");
  const [txCounterparty, setTxCounterparty] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txCounterAccountCode, setTxCounterAccountCode] = useState("");
  const [txTargetAccountId, setTxTargetAccountId] = useState("");

  // 거래 내역 필터
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterTxType, setFilterTxType] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // 수정 모달
  const [editModal, setEditModal] = useState<BankAccount | null>(null);
  const [editBankName, setEditBankName] = useState("");
  const [editAccountHolder, setEditAccountHolder] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // 데이터 조회
  const { data: summary } = useQuery({
    queryKey: ["bank-accounts-summary"],
    queryFn: () => apiGet<Summary>(`/bank-accounts/summary?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => apiGet<BankAccount[]>(`/bank-accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: coaAccounts = [] } = useQuery({
    queryKey: ["accounts-asset"],
    queryFn: () => apiGet<AccountRef[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const assetAccounts = coaAccounts.filter(
    (a) => a.code.startsWith("10") || a.code.startsWith("11"),
  );

  const { data: transactions = [] } = useQuery({
    queryKey: ["bank-transactions", filterAccountId, filterTxType, filterStartDate, filterEndDate],
    queryFn: () => {
      if (!filterAccountId) return Promise.resolve([]);
      let url = `/bank-accounts/${filterAccountId}/transactions?`;
      if (filterTxType) url += `txType=${filterTxType}&`;
      if (filterStartDate) url += `startDate=${filterStartDate}&`;
      if (filterEndDate) url += `endDate=${filterEndDate}&`;
      return apiGet<BankTransaction[]>(url);
    },
    enabled: !!tenantId && tab === "history" && !!filterAccountId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
    queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
  };

  // 계좌 등록
  const createAccountMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/bank-accounts", data),
    onSuccess: () => { invalidateAll(); resetAccountForm(); },
  });

  // 계좌 수정
  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPatch(`/bank-accounts/${id}`, data),
    onSuccess: () => { invalidateAll(); setEditModal(null); },
  });

  // 계좌 삭제
  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/bank-accounts/${id}`),
    onSuccess: invalidateAll,
  });

  // 거래 등록
  const createTxMutation = useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: Record<string, unknown> }) =>
      apiPost(`/bank-accounts/${accountId}/transactions`, data),
    onSuccess: () => { invalidateAll(); resetTxForm(); setTab("history"); },
  });

  // 거래 삭제
  const deleteTxMutation = useMutation({
    mutationFn: ({ accountId, txId }: { accountId: string; txId: string }) =>
      apiDelete(`/bank-accounts/${accountId}/transactions/${txId}`),
    onSuccess: invalidateAll,
  });

  const resetAccountForm = () => {
    setShowForm(false);
    setFormBankName("");
    setFormAccountNumber("");
    setFormAccountHolder("");
    setFormCurrency("KRW");
    setFormBalance("");
    setFormAccountId("");
    setFormMemo("");
  };

  const resetTxForm = () => {
    setTxBankAccountId("");
    setTxType("DEPOSIT");
    setTxDate(today());
    setTxAmount("");
    setTxCounterparty("");
    setTxDescription("");
    setTxCounterAccountCode("");
    setTxTargetAccountId("");
  };

  const handleCreateAccount = () => {
    if (!formBankName || !formAccountNumber || !formAccountHolder || !formAccountId) return;
    createAccountMutation.mutate({
      tenantId,
      bankName: formBankName,
      accountNumber: formAccountNumber,
      accountHolder: formAccountHolder,
      currency: formCurrency,
      balance: formBalance ? Number(formBalance) : 0,
      accountId: formAccountId,
      memo: formMemo || undefined,
    });
  };

  const openEditModal = (a: BankAccount) => {
    setEditModal(a);
    setEditBankName(a.bankName);
    setEditAccountHolder(a.accountHolder);
    setEditStatus(a.status);
    setEditMemo(a.memo || "");
  };

  const handleUpdateAccount = () => {
    if (!editModal) return;
    updateAccountMutation.mutate({
      id: editModal.id,
      data: {
        bankName: editBankName,
        accountHolder: editAccountHolder,
        status: editStatus,
        memo: editMemo || undefined,
      },
    });
  };

  const handleCreateTx = () => {
    if (!txBankAccountId || !txAmount) return;
    createTxMutation.mutate({
      accountId: txBankAccountId,
      data: {
        tenantId,
        txType,
        txDate,
        amount: Number(txAmount),
        counterparty: txCounterparty || undefined,
        description: txDescription || undefined,
        counterAccountCode: txCounterAccountCode || undefined,
        targetBankAccountId: txType === "TRANSFER" ? txTargetAccountId : undefined,
      },
    });
  };

  const handleExport = () => {
    const headers = ["거래번호", "유형", "일자", "입금", "출금", "잔액", "상대방", "적요"];
    const rows = transactions.map((t) => [
      t.txNo,
      TX_TYPE_LABEL[t.txType] || t.txType,
      new Date(t.txDate).toLocaleDateString("ko-KR"),
      t.txType === "DEPOSIT" ? t.amount : "",
      t.txType !== "DEPOSIT" ? t.amount : "",
      t.balance,
      t.counterparty || "",
      t.description || "",
    ]);
    exportToXlsx("은행거래내역", "거래내역", headers, rows);
  };

  const activeAccounts = accounts.filter((a) => a.status === "ACTIVE");
  const maxBalance = Math.max(...activeAccounts.map((a) => a.balance), 1);

  return (
    <div>
      <h1 className={styles.title}>은행/계좌 관리</h1>
      <p className={styles.subtitle}>계좌별 입출금 관리, 이체, 잔액 추적</p>

      {/* 요약 카드 */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>전체 계좌</div>
          <div className={styles.summaryValue}>{summary?.totalAccounts ?? 0}개</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>활성 계좌</div>
          <div className={styles.summaryValue}>{summary?.activeAccounts ?? 0}개</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>총 잔액</div>
          <div className={styles.summaryValue}>{fmt(summary?.totalBalance ?? 0)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>이번달 입금</div>
          <div className={`${styles.summaryValue} ${styles.amountDeposit}`}>{fmt(summary?.totalDeposit ?? 0)}원</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>이번달 출금</div>
          <div className={`${styles.summaryValue} ${styles.amountWithdraw}`}>{fmt(summary?.totalWithdraw ?? 0)}원</div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "accounts" ? styles.tabActive : ""}`} onClick={() => setTab("accounts")}>
          계좌 목록
        </button>
        {canEdit && (
          <button className={`${styles.tab} ${tab === "register" ? styles.tabActive : ""}`} onClick={() => setTab("register")}>
            입출금 등록
          </button>
        )}
        <button className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`} onClick={() => setTab("history")}>
          거래 내역
        </button>
        <button className={`${styles.tab} ${tab === "status" ? styles.tabActive : ""}`} onClick={() => setTab("status")}>
          계좌 현황
        </button>
      </div>

      {/* 계좌 목록 탭 */}
      {tab === "accounts" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>계좌 목록</h2>
            {canEdit && (
              <button className={styles.primaryBtn} onClick={() => { if (showForm) resetAccountForm(); else setShowForm(true); }}>
                {showForm ? "취소" : "계좌 등록"}
              </button>
            )}
          </div>

          {showForm && (
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>은행명 *</label>
                <input className={styles.formInput} value={formBankName} onChange={(e) => setFormBankName(e.target.value)} placeholder="국민은행" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>계좌번호 *</label>
                <input className={styles.formInput} value={formAccountNumber} onChange={(e) => setFormAccountNumber(e.target.value)} placeholder="123-456-789012" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>예금주 *</label>
                <input className={styles.formInput} value={formAccountHolder} onChange={(e) => setFormAccountHolder(e.target.value)} placeholder="홍길동" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>통화</label>
                <select className={styles.formSelect} value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>초기 잔액</label>
                <input className={styles.formInput} type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="0" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>연결 계정 *</label>
                <select className={styles.formSelect} value={formAccountId} onChange={(e) => setFormAccountId(e.target.value)}>
                  <option value="">선택</option>
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>메모</label>
                <input className={styles.formInput} value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="메모 (선택)" />
              </div>
              <div className={styles.formActions}>
                <button className={styles.secondaryBtn} onClick={resetAccountForm}>취소</button>
                <button className={styles.primaryBtn} onClick={handleCreateAccount} disabled={createAccountMutation.isPending}>
                  {createAccountMutation.isPending ? "등록 중..." : "등록"}
                </button>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>은행명</th>
                <th>계좌번호</th>
                <th>예금주</th>
                <th>통화</th>
                <th style={{ textAlign: "right" }}>잔액</th>
                <th>연결 계정</th>
                <th>상태</th>
                {canEdit && <th>관리</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.bankName}</td>
                  <td>{a.accountNumber}</td>
                  <td>{a.accountHolder}</td>
                  <td>{a.currency}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(a.balance)}원</td>
                  <td>[{a.account.code}] {a.account.name}</td>
                  <td>
                    <span className={`${styles.badge} ${a.status === "ACTIVE" ? styles.badgeActive : styles.badgeInactive}`}>
                      {a.status === "ACTIVE" ? "활성" : "비활성"}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => openEditModal(a)}>수정</button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => { if (confirm(`${a.bankName} ${a.accountNumber} 계좌를 삭제하시겠습니까?`)) deleteAccountMutation.mutate(a.id); }}
                          disabled={deleteAccountMutation.isPending}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={canEdit ? 8 : 7} style={{ textAlign: "center", color: "var(--text-muted)" }}>등록된 계좌가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 입출금 등록 탭 */}
      {tab === "register" && canEdit && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>입출금 등록</h2>
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>계좌 *</label>
              <select className={styles.formSelect} value={txBankAccountId} onChange={(e) => setTxBankAccountId(e.target.value)}>
                <option value="">선택</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.bankName} {a.accountNumber} (잔액: {fmt(a.balance)})</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>유형 *</label>
              <select className={styles.formSelect} value={txType} onChange={(e) => setTxType(e.target.value)}>
                <option value="DEPOSIT">입금</option>
                <option value="WITHDRAW">출금</option>
                <option value="TRANSFER">이체</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>거래일 *</label>
              <input className={styles.formInput} type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>금액 *</label>
              <input className={styles.formInput} type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0" min={0} />
            </div>
            {txType === "TRANSFER" ? (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이체 대상 계좌 *</label>
                <select className={styles.formSelect} value={txTargetAccountId} onChange={(e) => setTxTargetAccountId(e.target.value)}>
                  <option value="">선택</option>
                  {activeAccounts.filter((a) => a.id !== txBankAccountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.bankName} {a.accountNumber}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>상대 계정코드</label>
                <input className={styles.formInput} value={txCounterAccountCode} onChange={(e) => setTxCounterAccountCode(e.target.value)} placeholder={txType === "DEPOSIT" ? "40900 (기타수입)" : "50900 (기타비용)"} />
              </div>
            )}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>상대방</label>
              <input className={styles.formInput} value={txCounterparty} onChange={(e) => setTxCounterparty(e.target.value)} placeholder="입금처/출금처" />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>적요</label>
              <input className={styles.formInput} value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder="거래 내용" />
            </div>
            <div className={styles.formActions}>
              <button className={styles.secondaryBtn} onClick={resetTxForm}>초기화</button>
              <button
                className={styles.primaryBtn}
                onClick={handleCreateTx}
                disabled={createTxMutation.isPending || !txBankAccountId || !txAmount}
              >
                {createTxMutation.isPending ? "처리 중..." : `${TX_TYPE_LABEL[txType] || txType} 등록`}
              </button>
            </div>
          </div>
          {createTxMutation.isError && (
            <div className={styles.errorMsg}>{(createTxMutation.error as Error).message}</div>
          )}
        </div>
      )}

      {/* 거래 내역 탭 */}
      {tab === "history" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>거래 내역</h2>
            <button className={styles.downloadBtn} onClick={handleExport} disabled={transactions.length === 0}>
              엑셀 다운로드
            </button>
          </div>

          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
              <option value="">계좌 선택</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.bankName} {a.accountNumber}</option>
              ))}
            </select>
            <select className={styles.filterSelect} value={filterTxType} onChange={(e) => setFilterTxType(e.target.value)}>
              <option value="">전체 유형</option>
              <option value="DEPOSIT">입금</option>
              <option value="WITHDRAW">출금</option>
              <option value="TRANSFER">이체</option>
            </select>
            <input className={styles.formInput} type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} style={{ width: 150 }} />
            <span className={styles.filterSep}>~</span>
            <input className={styles.formInput} type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} style={{ width: 150 }} />
          </div>

          {!filterAccountId ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>계좌를 선택하세요</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>거래번호</th>
                  <th>유형</th>
                  <th>일자</th>
                  <th style={{ textAlign: "right" }}>입금</th>
                  <th style={{ textAlign: "right" }}>출금</th>
                  <th style={{ textAlign: "right" }}>잔액</th>
                  <th>상대방</th>
                  <th>적요</th>
                  {canEdit && <th>작업</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.txNo}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[TX_TYPE_STYLE[t.txType]] || ""}`}>
                        {TX_TYPE_LABEL[t.txType] || t.txType}
                      </span>
                    </td>
                    <td>{new Date(t.txDate).toLocaleDateString("ko-KR")}</td>
                    <td style={{ textAlign: "right" }}>
                      {t.txType === "DEPOSIT" ? <span className={styles.amountDeposit}>{fmt(t.amount)}</span> : ""}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {t.txType !== "DEPOSIT" ? <span className={styles.amountWithdraw}>{fmt(t.amount)}</span> : ""}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(t.balance)}원</td>
                    <td>{t.counterparty || "-"}</td>
                    <td>{t.description || "-"}</td>
                    {canEdit && (
                      <td>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => { if (confirm("삭제하시겠습니까? (최근 건만 가능)")) deleteTxMutation.mutate({ accountId: filterAccountId, txId: t.id }); }}
                          disabled={deleteTxMutation.isPending}
                        >
                          삭제
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={canEdit ? 9 : 8} style={{ textAlign: "center", color: "var(--text-muted)" }}>거래 내역이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 계좌 현황 탭 */}
      {tab === "status" && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>계좌별 잔액 현황</h2>
          {activeAccounts.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>활성 계좌가 없습니다</p>
          ) : (
            <>
              {activeAccounts.map((a) => (
                <div key={a.id} className={styles.balanceBarWrap}>
                  <div className={styles.balanceBarLabel}>
                    <span>{a.bankName} {a.accountNumber}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(a.balance)}원</span>
                  </div>
                  <div className={styles.balanceBar}>
                    <div
                      className={styles.balanceBarFill}
                      style={{ width: `${Math.max((a.balance / maxBalance) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 700 }}>
                  <span>총 잔액</span>
                  <span>{fmt(activeAccounts.reduce((s, a) => s + a.balance, 0))}원</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 수정 모달 */}
      {editModal && (
        <div className={styles.modalOverlay} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>계좌 수정</h3>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label className={styles.formLabel}>은행명</label>
              <input className={styles.formInput} value={editBankName} onChange={(e) => setEditBankName(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label className={styles.formLabel}>예금주</label>
              <input className={styles.formInput} value={editAccountHolder} onChange={(e) => setEditAccountHolder(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label className={styles.formLabel}>상태</label>
              <select className={styles.formSelect} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>메모</label>
              <input className={styles.formInput} value={editMemo} onChange={(e) => setEditMemo(e.target.value)} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setEditModal(null)}>취소</button>
              <button className={styles.primaryBtn} onClick={handleUpdateAccount} disabled={updateAccountMutation.isPending}>
                {updateAccountMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
