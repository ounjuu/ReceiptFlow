export class CreateBankAccountDto {
  tenantId!: string;
  bankName!: string;
  accountNumber!: string;
  accountHolder!: string;
  currency?: string;
  balance?: number;
  accountId!: string;
  memo?: string;
}
