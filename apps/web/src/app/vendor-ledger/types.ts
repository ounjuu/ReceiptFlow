export interface VendorBalance {
  vendorId: string;
  name: string;
  bizNo: string | null;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface BalanceSummary {
  vendors: VendorBalance[];
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
}

export interface LedgerEntry {
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface VendorLedgerData {
  openingBalance: number;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface Vendor {
  id: string;
  name: string;
  bizNo: string | null;
}

/** 숫자를 로케일 포맷 문자열로 변환 */
export const fmt = (n: number) => n.toLocaleString();
