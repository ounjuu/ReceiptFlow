export class UpdateYearEndSettlementDto {
  // 인적공제
  dependents?: number;
  dependentsUnder20?: number;
  dependentsOver70?: number;

  // 보험료
  insurancePremium?: number;

  // 의료비
  medicalExpense?: number;
  medicalExpenseSevere?: number;

  // 교육비
  educationExpense?: number;
  educationExpenseChild?: number;

  // 기부금
  donationPolitical?: number;
  donationLegal?: number;
  donationDesignated?: number;

  // 신용카드 등
  creditCardUsage?: number;
  debitCardUsage?: number;
  cashReceiptUsage?: number;
  traditionalMarket?: number;
  publicTransport?: number;

  // 주택/연금
  housingLoanInterest?: number;
  housingRent?: number;
  pensionSaving?: number;
}
