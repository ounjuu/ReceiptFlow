export interface InvoiceItem {
  id: string;
  invoiceNo: string | null;
  invoiceDate: string;
  bizNo: string;
  name: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
}

export { fmt } from "@/lib/formatters";

export function vatFmt(n: number | null | undefined) {
  return `₩${(n ?? 0).toLocaleString()}`;
}

export interface VatReturn {
  year: number;
  quarter: number;
  periodStart: string;
  periodEnd: string;
  sales: {
    invoiceCount: number;
    supplyAmount: number;
    taxAmount: number;
    invoices: InvoiceItem[];
  };
  purchase: {
    invoiceCount: number;
    supplyAmount: number;
    taxAmount: number;
    invoices: InvoiceItem[];
  };
  outputTax: number;
  inputTax: number;
  netTax: number;
  isRefund: boolean;
  journalValidation: {
    vatPayable: number;
    vatReceivable: number;
    isMatched: boolean;
  };
}
