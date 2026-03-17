export class UpdateExpenseClaimDto {
  title?: string;
  claimDate?: string;
  memo?: string;
  items?: {
    category: string;
    description: string;
    amount: number;
    expenseDate: string;
    receiptUrl?: string;
  }[];
}
