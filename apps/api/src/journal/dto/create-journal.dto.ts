import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class JournalLineDto {
  @IsString()
  accountId!: string;

  @IsOptional() @IsString()
  vendorId?: string;

  @IsOptional() @IsString()
  vendorBizNo?: string;

  @IsOptional() @IsString()
  vendorName?: string;

  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsNumber()
  debit!: number;

  @IsNumber()
  credit!: number;
}

export class CreateJournalDto {
  @IsString()
  tenantId!: string;

  @IsOptional() @IsString()
  journalType?: string; // GENERAL(일반), PURCHASE(매입), SALES(매출), CASH(자금)

  @IsOptional() @IsString()
  evidenceType?: string; // TAX_INVOICE(세금계산서), CARD(카드), CASH_RECEIPT(현금영수증), NONE(없음)

  @IsOptional() @IsNumber()
  supplyAmount?: number; // 공급가액

  @IsOptional() @IsNumber()
  vatAmount?: number; // 부가세액

  @IsString()
  date!: string; // ISO 날짜 문자열

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  documentId?: string; // 영수증 연결 시

  @IsOptional() @IsString()
  currency?: string; // ISO 4217, 기본 KRW

  @IsOptional() @IsNumber()
  exchangeRate?: number; // 1 외화 = rate 기준통화, 기본 1

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}
