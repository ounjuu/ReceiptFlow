export class CreateDocumentDto {
  tenantId!: string;
  vendorName!: string;
  vendorBizNo!: string; // 사업자등록번호 필수
  totalAmount!: number;
  currency?: string; // ISO 4217, 기본 KRW
  transactionAt!: string; // ISO 날짜
}
