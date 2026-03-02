export class JournalLineDto {
  accountId!: string;
  debit!: number;
  credit!: number;
}

export class CreateJournalDto {
  tenantId!: string;
  date!: string; // ISO 날짜 문자열
  description?: string;
  documentId?: string; // 영수증 연결 시
  lines!: JournalLineDto[];
}
