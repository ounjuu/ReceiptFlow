export class JournalLineDto {
  accountId!: string;
  vendorId?: string;
  vendorBizNo?: string;
  vendorName?: string;
  projectId?: string;
  departmentId?: string;
  debit!: number;
  credit!: number;
}

export class CreateJournalDto {
  tenantId!: string;
  journalType?: string; // GENERAL(일반), PURCHASE(매입), SALES(매출), CASH(자금)
  date!: string; // ISO 날짜 문자열
  description?: string;
  documentId?: string; // 영수증 연결 시
  currency?: string; // ISO 4217, 기본 KRW
  exchangeRate?: number; // 1 외화 = rate 기준통화, 기본 1
  lines!: JournalLineDto[];
}
