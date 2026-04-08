export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string | null;
  position: string | null;
  joinDate: string;
  leaveDate: string | null;
  status: string;
  baseSalary: number;
}

export interface PayrollRecord {
  id: string;
  employeeNo: string;
  employeeName: string;
  department: string | null;
  position: string | null;
  period: string;
  baseSalary: number;
  overtimePay: number;
  bonusPay: number;
  grossPay: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  totalDeduction: number;
  netPay: number;
}

export interface PayrollSummary {
  period: string;
  employeeCount: number;
  totalGross: number;
  totalDeduction: number;
  totalNet: number;
  totalPension: number;
  totalHealth: number;
  totalLongTerm: number;
  totalEmployment: number;
  totalIncomeTax: number;
  totalLocalTax: number;
}

export interface ProcessResult {
  period: string;
  processedCount: number;
  totalGross: number;
  totalNet: number;
  details: { employeeId: string; employeeName: string; grossPay: number; netPay: number }[];
}

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export const now = new Date();
