export class CreateDocumentDto {
  tenantId!: string;
  vendorName!: string;
  vendorBizNo!: string; // 사업자등록번호 필수
  totalAmount!: number;
  transactionAt!: string; // ISO 날짜
}
