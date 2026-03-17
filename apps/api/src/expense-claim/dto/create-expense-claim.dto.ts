export class CreateExpenseClaimDto {
  tenantId!: string;
  employeeId!: string;
  title!: string;
  claimDate!: string; // YYYY-MM-DD
  memo?: string;
  items!: {
    category: string;
    description: string;
    amount: number;
    expenseDate: string; // YYYY-MM-DD
    receiptUrl?: string;
  }[];
}
