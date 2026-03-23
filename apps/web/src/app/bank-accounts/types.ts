export interface AccountRef {
  id: string;
  code: string;
  name: string;
}

export interface BankAccount {
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

export interface BankTransaction {
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

export interface Summary {
  totalAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
}

export const TX_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "입금",
  WITHDRAW: "출금",
  TRANSFER: "이체",
};

export const TX_TYPE_STYLE: Record<string, string> = {
  DEPOSIT: "badgeDeposit",
  WITHDRAW: "badgeWithdraw",
  TRANSFER: "badgeTransfer",
};

export const fmt = (n: number) => n.toLocaleString();
export const today = () => new Date().toISOString().slice(0, 10);
