export class UpdateTaxInvoiceDto {
  invoiceNo?: string;
  invoiceDate?: string;
  status?: string;
  issuerBizNo?: string;
  issuerName?: string;
  recipientBizNo?: string;
  recipientName?: string;
  supplyAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  approvalNo?: string;
  description?: string;
}
