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
