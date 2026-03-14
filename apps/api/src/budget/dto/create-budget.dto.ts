export class CreateBudgetDto {
  tenantId!: string;
  accountId!: string;
  year!: number;
  month!: number;
  amount!: number;
  note?: string;
}
