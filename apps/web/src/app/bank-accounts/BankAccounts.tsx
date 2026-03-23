"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./BankAccounts.module.css";

import { AccountRef, BankAccount, BankTransaction, Summary, TX_TYPE_LABEL, today } from "./types";
import { AccountCreateForm, TransactionForm, EditModal } from "./BankAccountForm";
import { SummaryCards, AccountListTable, TransactionHistory, AccountStatus } from "./BankAccountTable";

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

  const handleDeleteAccount = (a: BankAccount) => {
    if (confirm(`${a.bankName} ${a.accountNumber} 계좌를 삭제하시겠습니까?`)) {
      deleteAccountMutation.mutate(a.id);
    }
  };

  const handleDeleteTransaction = (accountId: string, txId: string) => {
    deleteTxMutation.mutate({ accountId, txId });
  };

  const activeAccounts = accounts.filter((a) => a.status === "ACTIVE");

  return (
    <div>
      <h1 className={styles.title}>은행/계좌 관리</h1>
      <p className={styles.subtitle}>계좌별 입출금 관리, 이체, 잔액 추적</p>

      {/* 요약 카드 */}
      <SummaryCards summary={summary} />

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

          <AccountCreateForm
            showForm={showForm}
            formBankName={formBankName}
            formAccountNumber={formAccountNumber}
            formAccountHolder={formAccountHolder}
            formCurrency={formCurrency}
            formBalance={formBalance}
            formAccountId={formAccountId}
            formMemo={formMemo}
            assetAccounts={assetAccounts}
            isPending={createAccountMutation.isPending}
            onFormBankNameChange={setFormBankName}
            onFormAccountNumberChange={setFormAccountNumber}
            onFormAccountHolderChange={setFormAccountHolder}
            onFormCurrencyChange={setFormCurrency}
            onFormBalanceChange={setFormBalance}
            onFormAccountIdChange={setFormAccountId}
            onFormMemoChange={setFormMemo}
            onSubmit={handleCreateAccount}
            onCancel={resetAccountForm}
          />

          <AccountListTable
            accounts={accounts}
            canEdit={canEdit}
            onEdit={openEditModal}
            onDelete={handleDeleteAccount}
            isDeletePending={deleteAccountMutation.isPending}
          />
        </div>
      )}

      {/* 입출금 등록 탭 */}
      {tab === "register" && canEdit && (
        <TransactionForm
          txBankAccountId={txBankAccountId}
          txType={txType}
          txDate={txDate}
          txAmount={txAmount}
          txCounterparty={txCounterparty}
          txDescription={txDescription}
          txCounterAccountCode={txCounterAccountCode}
          txTargetAccountId={txTargetAccountId}
          activeAccounts={activeAccounts}
          isPending={createTxMutation.isPending}
          isError={createTxMutation.isError}
          errorMessage={(createTxMutation.error as Error)?.message ?? ""}
          onTxBankAccountIdChange={setTxBankAccountId}
          onTxTypeChange={setTxType}
          onTxDateChange={setTxDate}
          onTxAmountChange={setTxAmount}
          onTxCounterpartyChange={setTxCounterparty}
          onTxDescriptionChange={setTxDescription}
          onTxCounterAccountCodeChange={setTxCounterAccountCode}
          onTxTargetAccountIdChange={setTxTargetAccountId}
          onSubmit={handleCreateTx}
          onReset={resetTxForm}
        />
      )}

      {/* 거래 내역 탭 */}
      {tab === "history" && (
        <TransactionHistory
          accounts={accounts}
          transactions={transactions}
          canEdit={canEdit}
          filterAccountId={filterAccountId}
          filterTxType={filterTxType}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          isDeletePending={deleteTxMutation.isPending}
          onFilterAccountIdChange={setFilterAccountId}
          onFilterTxTypeChange={setFilterTxType}
          onFilterStartDateChange={setFilterStartDate}
          onFilterEndDateChange={setFilterEndDate}
          onDeleteTransaction={handleDeleteTransaction}
          onExport={handleExport}
        />
      )}

      {/* 계좌 현황 탭 */}
      {tab === "status" && (
        <AccountStatus activeAccounts={activeAccounts} />
      )}

      {/* 수정 모달 */}
      {editModal && (
        <EditModal
          editBankName={editBankName}
          editAccountHolder={editAccountHolder}
          editStatus={editStatus}
          editMemo={editMemo}
          isPending={updateAccountMutation.isPending}
          onEditBankNameChange={setEditBankName}
          onEditAccountHolderChange={setEditAccountHolder}
          onEditStatusChange={setEditStatus}
          onEditMemoChange={setEditMemo}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
}
