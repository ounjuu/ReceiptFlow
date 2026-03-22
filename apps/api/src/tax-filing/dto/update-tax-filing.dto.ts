export class UpdateTaxFilingDto {
  filingData?: Record<string, unknown>; // 부분 JSON 업데이트
  note?: string;
  status?: string;
  filingReference?: string;
}
