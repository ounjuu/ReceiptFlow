export class CreateBankTxDto {
  tenantId!: string;
  txType!: string; // DEPOSIT | WITHDRAW | TRANSFER
  txDate!: string; // YYYY-MM-DD
  amount!: number;
  counterparty?: string;
  description?: string;
  counterAccountCode?: string; // 상대 계정 코드 (전표 생성용)
  targetBankAccountId?: string; // TRANSFER 시 대상 계좌
  paymentId?: string;
}
