"use client";

import styles from "./BankAccounts.module.css";
import { BankAccount, BankTransaction, Summary, TX_TYPE_LABEL, TX_TYPE_STYLE, fmt } from "./types";

// --- 요약 카드 Props ---
export interface SummaryCardsProps {
  summary: Summary | undefined;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
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
  );
}

// --- 계좌 목록 테이블 Props ---
export interface AccountListTableProps {
  accounts: BankAccount[];
  canEdit: boolean;
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
  isDeletePending: boolean;
}

export function AccountListTable({ accounts, canEdit, onEdit, onDelete, isDeletePending }: AccountListTableProps) {
  return (
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
                  <button className={styles.editBtn} onClick={() => onEdit(a)}>수정</button>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => onDelete(a)}
                    disabled={isDeletePending}
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
  );
}

// --- 거래 내역 탭 Props ---
export interface TransactionHistoryProps {
  accounts: BankAccount[];
  transactions: BankTransaction[];
  canEdit: boolean;
  filterAccountId: string;
  filterTxType: string;
  filterStartDate: string;
  filterEndDate: string;
  isDeletePending: boolean;
  onFilterAccountIdChange: (v: string) => void;
  onFilterTxTypeChange: (v: string) => void;
  onFilterStartDateChange: (v: string) => void;
  onFilterEndDateChange: (v: string) => void;
  onDeleteTransaction: (accountId: string, txId: string) => void;
  onExport: () => void;
}

export function TransactionHistory({
  accounts,
  transactions,
  canEdit,
  filterAccountId,
  filterTxType,
  filterStartDate,
  filterEndDate,
  isDeletePending,
  onFilterAccountIdChange,
  onFilterTxTypeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onDeleteTransaction,
  onExport,
}: TransactionHistoryProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>거래 내역</h2>
        <button className={styles.downloadBtn} onClick={onExport} disabled={transactions.length === 0}>
          엑셀 다운로드
        </button>
      </div>

      <div className={styles.filterRow}>
        <select className={styles.filterSelect} value={filterAccountId} onChange={(e) => onFilterAccountIdChange(e.target.value)}>
          <option value="">계좌 선택</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.bankName} {a.accountNumber}</option>
          ))}
        </select>
        <select className={styles.filterSelect} value={filterTxType} onChange={(e) => onFilterTxTypeChange(e.target.value)}>
          <option value="">전체 유형</option>
          <option value="DEPOSIT">입금</option>
          <option value="WITHDRAW">출금</option>
          <option value="TRANSFER">이체</option>
        </select>
        <input className={styles.formInput} type="date" value={filterStartDate} onChange={(e) => onFilterStartDateChange(e.target.value)} style={{ width: 150 }} />
        <span className={styles.filterSep}>~</span>
        <input className={styles.formInput} type="date" value={filterEndDate} onChange={(e) => onFilterEndDateChange(e.target.value)} style={{ width: 150 }} />
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
                      onClick={() => { if (confirm("삭제하시겠습니까? (최근 건만 가능)")) onDeleteTransaction(filterAccountId, t.id); }}
                      disabled={isDeletePending}
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
  );
}

// --- 계좌 현황 탭 Props ---
export interface AccountStatusProps {
  activeAccounts: BankAccount[];
}

export function AccountStatus({ activeAccounts }: AccountStatusProps) {
  const maxBalance = Math.max(...activeAccounts.map((a) => a.balance), 1);

  return (
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
  );
}
