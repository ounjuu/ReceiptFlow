export class CreateYearEndSettlementDto {
  employeeId!: string;
  year!: number;

  // 인적공제
  dependents?: number = 1;
  dependentsUnder20?: number = 0;
  dependentsOver70?: number = 0;

  // 보험료
  insurancePremium?: number = 0;

  // 의료비
  medicalExpense?: number = 0;
  medicalExpenseSevere?: number = 0;

  // 교육비
  educationExpense?: number = 0;
  educationExpenseChild?: number = 0;

  // 기부금
  donationPolitical?: number = 0;
  donationLegal?: number = 0;
  donationDesignated?: number = 0;

  // 신용카드 등
  creditCardUsage?: number = 0;
  debitCardUsage?: number = 0;
  cashReceiptUsage?: number = 0;
  traditionalMarket?: number = 0;
  publicTransport?: number = 0;

  // 주택/연금
  housingLoanInterest?: number = 0;
  housingRent?: number = 0;
  pensionSaving?: number = 0;
}
