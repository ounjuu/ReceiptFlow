export class CreateDocumentDto {
  tenantId!: string;
  vendorName!: string;
  totalAmount!: number;
  transactionAt!: string; // ISO 날짜
}
