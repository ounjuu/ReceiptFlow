"use client";

import styles from "./BankAccounts.module.css";
import { AccountRef, BankAccount, TX_TYPE_LABEL, fmt } from "./types";

// --- 계좌 등록 폼 Props ---
export interface AccountCreateFormProps {
  showForm: boolean;
  formBankName: string;
  formAccountNumber: string;
  formAccountHolder: string;
  formCurrency: string;
  formBalance: string;
  formAccountId: string;
  formMemo: string;
  assetAccounts: AccountRef[];
  isPending: boolean;
  onFormBankNameChange: (v: string) => void;
  onFormAccountNumberChange: (v: string) => void;
  onFormAccountHolderChange: (v: string) => void;
  onFormCurrencyChange: (v: string) => void;
  onFormBalanceChange: (v: string) => void;
  onFormAccountIdChange: (v: string) => void;
  onFormMemoChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AccountCreateForm({
  showForm,
  formBankName,
  formAccountNumber,
  formAccountHolder,
  formCurrency,
  formBalance,
  formAccountId,
  formMemo,
  assetAccounts,
  isPending,
  onFormBankNameChange,
  onFormAccountNumberChange,
  onFormAccountHolderChange,
  onFormCurrencyChange,
  onFormBalanceChange,
  onFormAccountIdChange,
  onFormMemoChange,
  onSubmit,
  onCancel,
}: AccountCreateFormProps) {
  if (!showForm) return null;

  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>은행명 *</label>
        <input className={styles.formInput} value={formBankName} onChange={(e) => onFormBankNameChange(e.target.value)} placeholder="국민은행" />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>계좌번호 *</label>
        <input className={styles.formInput} value={formAccountNumber} onChange={(e) => onFormAccountNumberChange(e.target.value)} placeholder="123-456-789012" />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>예금주 *</label>
        <input className={styles.formInput} value={formAccountHolder} onChange={(e) => onFormAccountHolderChange(e.target.value)} placeholder="홍길동" />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>통화</label>
        <select className={styles.formSelect} value={formCurrency} onChange={(e) => onFormCurrencyChange(e.target.value)}>
          <option value="KRW">KRW</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="JPY">JPY</option>
        </select>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>초기 잔액</label>
        <input className={styles.formInput} type="number" value={formBalance} onChange={(e) => onFormBalanceChange(e.target.value)} placeholder="0" />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>연결 계정 *</label>
        <select className={styles.formSelect} value={formAccountId} onChange={(e) => onFormAccountIdChange(e.target.value)}>
          <option value="">선택</option>
          {assetAccounts.map((a) => (
            <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
          ))}
        </select>
      </div>
      <div className={styles.formGroupFull}>
        <label className={styles.formLabel}>메모</label>
        <input className={styles.formInput} value={formMemo} onChange={(e) => onFormMemoChange(e.target.value)} placeholder="메모 (선택)" />
      </div>
      <div className={styles.formActions}>
        <button className={styles.secondaryBtn} onClick={onCancel}>취소</button>
        <button className={styles.primaryBtn} onClick={onSubmit} disabled={isPending}>
          {isPending ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}

// --- 입출금 등록 폼 Props ---
export interface TransactionFormProps {
  txBankAccountId: string;
  txType: string;
  txDate: string;
  txAmount: string;
  txCounterparty: string;
  txDescription: string;
  txCounterAccountCode: string;
  txTargetAccountId: string;
  activeAccounts: BankAccount[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  onTxBankAccountIdChange: (v: string) => void;
  onTxTypeChange: (v: string) => void;
  onTxDateChange: (v: string) => void;
  onTxAmountChange: (v: string) => void;
  onTxCounterpartyChange: (v: string) => void;
  onTxDescriptionChange: (v: string) => void;
  onTxCounterAccountCodeChange: (v: string) => void;
  onTxTargetAccountIdChange: (v: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function TransactionForm({
  txBankAccountId,
  txType,
  txDate,
  txAmount,
  txCounterparty,
  txDescription,
  txCounterAccountCode,
  txTargetAccountId,
  activeAccounts,
  isPending,
  isError,
  errorMessage,
  onTxBankAccountIdChange,
  onTxTypeChange,
  onTxDateChange,
  onTxAmountChange,
  onTxCounterpartyChange,
  onTxDescriptionChange,
  onTxCounterAccountCodeChange,
  onTxTargetAccountIdChange,
  onSubmit,
  onReset,
}: TransactionFormProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>입출금 등록</h2>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>계좌 *</label>
          <select className={styles.formSelect} value={txBankAccountId} onChange={(e) => onTxBankAccountIdChange(e.target.value)}>
            <option value="">선택</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.bankName} {a.accountNumber} (잔액: {fmt(a.balance)})</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>유형 *</label>
          <select className={styles.formSelect} value={txType} onChange={(e) => onTxTypeChange(e.target.value)}>
            <option value="DEPOSIT">입금</option>
            <option value="WITHDRAW">출금</option>
            <option value="TRANSFER">이체</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>거래일 *</label>
          <input className={styles.formInput} type="date" value={txDate} onChange={(e) => onTxDateChange(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>금액 *</label>
          <input className={styles.formInput} type="number" value={txAmount} onChange={(e) => onTxAmountChange(e.target.value)} placeholder="0" min={0} />
        </div>
        {txType === "TRANSFER" ? (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>이체 대상 계좌 *</label>
            <select className={styles.formSelect} value={txTargetAccountId} onChange={(e) => onTxTargetAccountIdChange(e.target.value)}>
              <option value="">선택</option>
              {activeAccounts.filter((a) => a.id !== txBankAccountId).map((a) => (
                <option key={a.id} value={a.id}>{a.bankName} {a.accountNumber}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>상대 계정코드</label>
            <input className={styles.formInput} value={txCounterAccountCode} onChange={(e) => onTxCounterAccountCodeChange(e.target.value)} placeholder={txType === "DEPOSIT" ? "40900 (기타수입)" : "50900 (기타비용)"} />
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>상대방</label>
          <input className={styles.formInput} value={txCounterparty} onChange={(e) => onTxCounterpartyChange(e.target.value)} placeholder="입금처/출금처" />
        </div>
        <div className={styles.formGroupFull}>
          <label className={styles.formLabel}>적요</label>
          <input className={styles.formInput} value={txDescription} onChange={(e) => onTxDescriptionChange(e.target.value)} placeholder="거래 내용" />
        </div>
        <div className={styles.formActions}>
          <button className={styles.secondaryBtn} onClick={onReset}>초기화</button>
          <button
            className={styles.primaryBtn}
            onClick={onSubmit}
            disabled={isPending || !txBankAccountId || !txAmount}
          >
            {isPending ? "처리 중..." : `${TX_TYPE_LABEL[txType] || txType} 등록`}
          </button>
        </div>
      </div>
      {isError && (
        <div className={styles.errorMsg}>{errorMessage}</div>
      )}
    </div>
  );
}

// --- 수정 모달 Props ---
export interface EditModalProps {
  editBankName: string;
  editAccountHolder: string;
  editStatus: string;
  editMemo: string;
  isPending: boolean;
  onEditBankNameChange: (v: string) => void;
  onEditAccountHolderChange: (v: string) => void;
  onEditStatusChange: (v: string) => void;
  onEditMemoChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function EditModal({
  editBankName,
  editAccountHolder,
  editStatus,
  editMemo,
  isPending,
  onEditBankNameChange,
  onEditAccountHolderChange,
  onEditStatusChange,
  onEditMemoChange,
  onSubmit,
  onClose,
}: EditModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>계좌 수정</h3>
        <div className={styles.formGroup} style={{ marginBottom: 12 }}>
          <label className={styles.formLabel}>은행명</label>
          <input className={styles.formInput} value={editBankName} onChange={(e) => onEditBankNameChange(e.target.value)} />
        </div>
        <div className={styles.formGroup} style={{ marginBottom: 12 }}>
          <label className={styles.formLabel}>예금주</label>
          <input className={styles.formInput} value={editAccountHolder} onChange={(e) => onEditAccountHolderChange(e.target.value)} />
        </div>
        <div className={styles.formGroup} style={{ marginBottom: 12 }}>
          <label className={styles.formLabel}>상태</label>
          <select className={styles.formSelect} value={editStatus} onChange={(e) => onEditStatusChange(e.target.value)}>
            <option value="ACTIVE">활성</option>
            <option value="INACTIVE">비활성</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>메모</label>
          <input className={styles.formInput} value={editMemo} onChange={(e) => onEditMemoChange(e.target.value)} />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.secondaryBtn} onClick={onClose}>취소</button>
          <button className={styles.primaryBtn} onClick={onSubmit} disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
