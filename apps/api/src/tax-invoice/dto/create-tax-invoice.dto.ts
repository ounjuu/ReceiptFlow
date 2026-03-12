export class CreateTaxInvoiceDto {
  tenantId!: string;
  invoiceType!: string; // PURCHASE, SALES
  invoiceNo?: string;
  invoiceDate!: string; // ISO 날짜
  issuerBizNo!: string;
  issuerName!: string;
  recipientBizNo!: string;
  recipientName!: string;
  supplyAmount!: number;
  taxAmount!: number;
  totalAmount!: number;
  approvalNo?: string;
  vendorId?: string;
  journalEntryId?: string;
  description?: string;
}
