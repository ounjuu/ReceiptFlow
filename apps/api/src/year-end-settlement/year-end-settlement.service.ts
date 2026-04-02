import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateYearEndSettlementDto } from "./dto/create-year-end-settlement.dto";
import { UpdateYearEndSettlementDto } from "./dto/update-year-end-settlement.dto";

@Injectable()
export class YearEndSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  // 연말정산 목록 조회
  async findAll(tenantId: string, year: number) {
    const settlements = await this.prisma.yearEndSettlement.findMany({
      where: {
        year,
        employee: { tenantId },
      },
      include: {
        employee: { select: { employeeNo: true, name: true, department: true } },
      },
      orderBy: { employee: { employeeNo: "asc" } },
    });

    return settlements.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      employeeNo: s.employee.employeeNo,
      employeeName: s.employee.name,
      department: s.employee.department,
      year: s.year,
      annualGrossPay: Number(s.annualGrossPay),
      determinedTax: Number(s.determinedTax),
      alreadyPaidTax: Number(s.alreadyPaidTax),
      finalTax: Number(s.finalTax),
      status: s.status,
    }));
  }

  // 단일 조회
  async findOne(id: string) {
    const s = await this.prisma.yearEndSettlement.findUniqueOrThrow({
      where: { id },
      include: {
        employee: { select: { employeeNo: true, name: true, department: true, position: true } },
      },
    });

    return {
      ...this.toNumberFields(s),
      employee: s.employee,
    };
  }

  // 일괄 생성: 해당 연도 모든 ACTIVE 직원에 대해 연말정산 생성
  async batchCreate(tenantId: string, year: number) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: "ACTIVE" },
    });

    // 모든 직원의 해당 연도 급여 레코드를 일괄 조회 (N+1 방지)
    const allPayrollRecords = await this.prisma.payrollRecord.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        period: { startsWith: `${year}-` },
      },
    });

    // 직원별 연간 총급여 맵 생성
    const grossPayByEmployee = new Map<string, number>();
    for (const r of allPayrollRecords) {
      const current = grossPayByEmployee.get(r.employeeId) || 0;
      grossPayByEmployee.set(r.employeeId, current + Number(r.grossPay));
    }

    const results: { employeeId: string; employeeName: string; annualGrossPay: number }[] = [];

    for (const emp of employees) {
      const annualGrossPay = grossPayByEmployee.get(emp.id) || 0;

      await this.prisma.yearEndSettlement.upsert({
        where: { employeeId_year: { employeeId: emp.id, year } },
        create: {
          employeeId: emp.id,
          year,
          annualGrossPay,
        },
        update: {
          annualGrossPay,
        },
      });

      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        annualGrossPay,
      });
    }

    return {
      year,
      processedCount: results.length,
      details: results,
    };
  }

  // 단건 생성
  async create(dto: CreateYearEndSettlementDto) {
    const annualGrossPay = await this.getAnnualGrossPay(dto.employeeId, dto.year);

    return this.prisma.yearEndSettlement.create({
      data: {
        employeeId: dto.employeeId,
        year: dto.year,
        annualGrossPay,
        dependents: dto.dependents ?? 1,
        dependentsUnder20: dto.dependentsUnder20 ?? 0,
        dependentsOver70: dto.dependentsOver70 ?? 0,
        insurancePremium: dto.insurancePremium ?? 0,
        medicalExpense: dto.medicalExpense ?? 0,
        medicalExpenseSevere: dto.medicalExpenseSevere ?? 0,
        educationExpense: dto.educationExpense ?? 0,
        educationExpenseChild: dto.educationExpenseChild ?? 0,
        donationPolitical: dto.donationPolitical ?? 0,
        donationLegal: dto.donationLegal ?? 0,
        donationDesignated: dto.donationDesignated ?? 0,
        creditCardUsage: dto.creditCardUsage ?? 0,
        debitCardUsage: dto.debitCardUsage ?? 0,
        cashReceiptUsage: dto.cashReceiptUsage ?? 0,
        traditionalMarket: dto.traditionalMarket ?? 0,
        publicTransport: dto.publicTransport ?? 0,
        housingLoanInterest: dto.housingLoanInterest ?? 0,
        housingRent: dto.housingRent ?? 0,
        pensionSaving: dto.pensionSaving ?? 0,
      },
    });
  }

  // 공제 입력 수정
  async update(id: string, dto: UpdateYearEndSettlementDto) {
    const data: Record<string, unknown> = {};
    const fields = [
      "dependents", "dependentsUnder20", "dependentsOver70",
      "insurancePremium", "medicalExpense", "medicalExpenseSevere",
      "educationExpense", "educationExpenseChild",
      "donationPolitical", "donationLegal", "donationDesignated",
      "creditCardUsage", "debitCardUsage", "cashReceiptUsage",
      "traditionalMarket", "publicTransport",
      "housingLoanInterest", "housingRent", "pensionSaving",
    ];

    for (const field of fields) {
      if ((dto as Record<string, unknown>)[field] !== undefined) {
        data[field] = (dto as Record<string, unknown>)[field];
      }
    }

    return this.prisma.yearEndSettlement.update({ where: { id }, data });
  }

  // 연말정산 계산 (핵심 메서드)
  async calculate(id: string) {
    const settlement = await this.prisma.yearEndSettlement.findUniqueOrThrow({
      where: { id },
    });

    const annualGrossPay = Number(settlement.annualGrossPay);

    // Step 2: 근로소득공제
    const earnedIncomeDeduction = this.calcEarnedIncomeDeduction(annualGrossPay);

    // Step 3: 근로소득금액
    const earnedIncome = annualGrossPay - earnedIncomeDeduction;

    // Step 4: 인적공제
    const dependents = settlement.dependents;
    const dependentsOver70 = settlement.dependentsOver70;
    const personalDeduction = dependents * 1_500_000 + dependentsOver70 * 1_000_000;

    // Step 5: 특별소득공제
    // 4대보험 본인부담분 (PayrollRecord에서 합산)
    const socialInsurance = await this.getAnnualSocialInsurance(settlement.employeeId, settlement.year);
    const insuranceDeduction = Math.min(Number(settlement.insurancePremium), 1_000_000);
    const specialDeduction = socialInsurance + insuranceDeduction;

    // Step 6: 그 외 소득공제
    const creditCardUsage = Number(settlement.creditCardUsage);
    const debitCardUsage = Number(settlement.debitCardUsage);
    const cashReceiptUsage = Number(settlement.cashReceiptUsage);
    const traditionalMarket = Number(settlement.traditionalMarket);
    const publicTransport = Number(settlement.publicTransport);
    const pensionSaving = Number(settlement.pensionSaving);
    const housingLoanInterest = Number(settlement.housingLoanInterest);
    const housingRent = Number(settlement.housingRent);

    // 신용카드 등 소득공제
    const cardDeduction = this.calcCardDeduction(
      annualGrossPay, creditCardUsage, debitCardUsage, cashReceiptUsage, traditionalMarket, publicTransport,
    );

    const pensionDeduction = Math.min(pensionSaving, 6_000_000);

    const otherDeduction = cardDeduction + pensionDeduction + housingLoanInterest + housingRent;

    // Step 7: 과세표준
    const taxableIncome = Math.max(0, earnedIncome - personalDeduction - specialDeduction - otherDeduction);

    // Step 8: 산출세액
    const calculatedTax = this.calcIncomeTax(taxableIncome);

    // Step 9: 세액공제
    const medicalExpense = Number(settlement.medicalExpense);
    const medicalExpenseSevere = Number(settlement.medicalExpenseSevere);
    const educationExpense = Number(settlement.educationExpense);
    const educationExpenseChild = Number(settlement.educationExpenseChild);
    const donationPolitical = Number(settlement.donationPolitical);
    const donationLegal = Number(settlement.donationLegal);
    const donationDesignated = Number(settlement.donationDesignated);
    const dependentsUnder20 = settlement.dependentsUnder20;

    const taxCredit = this.calcTaxCredit(
      calculatedTax, annualGrossPay, earnedIncome,
      dependentsUnder20, medicalExpense, medicalExpenseSevere,
      educationExpense, educationExpenseChild,
      donationPolitical, donationLegal, donationDesignated,
      housingRent,
    );

    // Step 10: 결정세액
    const determinedTax = Math.max(0, calculatedTax - taxCredit);

    // Step 11: 기납부세액
    const alreadyPaidTax = await this.getAlreadyPaidTax(settlement.employeeId, settlement.year);

    // Step 12: 최종 세액 (음수 = 환급)
    const finalTax = determinedTax - alreadyPaidTax;

    // 저장
    const updated = await this.prisma.yearEndSettlement.update({
      where: { id },
      data: {
        earnedIncomeDeduction,
        earnedIncome,
        personalDeduction,
        specialDeduction,
        otherDeduction,
        taxableIncome,
        calculatedTax,
        taxCredit,
        determinedTax,
        alreadyPaidTax,
        finalTax,
        status: "CALCULATED",
      },
    });

    return this.toNumberFields(updated);
  }

  // 확정 처리
  async finalize(id: string) {
    const settlement = await this.prisma.yearEndSettlement.findUniqueOrThrow({
      where: { id },
    });

    if (settlement.status !== "CALCULATED") {
      throw new BadRequestException("계산 완료 상태에서만 확정할 수 있습니다");
    }

    return this.prisma.yearEndSettlement.update({
      where: { id },
      data: { status: "FINALIZED" },
    });
  }

  // 요약 통계
  async getSummary(tenantId: string, year: number) {
    const settlements = await this.prisma.yearEndSettlement.findMany({
      where: {
        year,
        employee: { tenantId },
      },
    });

    const totalEmployees = settlements.length;
    let totalRefund = 0;
    let totalPayment = 0;
    let sumFinalTax = 0;

    for (const s of settlements) {
      const ft = Number(s.finalTax);
      sumFinalTax += ft;
      if (ft < 0) totalRefund += Math.abs(ft);
      else totalPayment += ft;
    }

    return {
      year,
      totalEmployees,
      totalRefund,
      totalPayment,
      averageFinalTax: totalEmployees > 0 ? Math.round(sumFinalTax / totalEmployees) : 0,
    };
  }

  // ─── Private 계산 메서드 ───

  // 연간 총급여 조회
  private async getAnnualGrossPay(employeeId: string, year: number): Promise<number> {
    const records = await this.prisma.payrollRecord.findMany({
      where: {
        employeeId,
        period: { startsWith: `${year}-` },
      },
    });
    return records.reduce((sum, r) => sum + Number(r.grossPay), 0);
  }

  // 4대보험 본인부담분 연간 합계
  private async getAnnualSocialInsurance(employeeId: string, year: number): Promise<number> {
    const records = await this.prisma.payrollRecord.findMany({
      where: {
        employeeId,
        period: { startsWith: `${year}-` },
      },
    });
    return records.reduce(
      (sum, r) =>
        sum +
        Number(r.nationalPension) +
        Number(r.healthInsurance) +
        Number(r.longTermCare) +
        Number(r.employmentInsurance),
      0,
    );
  }

  // 기납부세액 (소득세 + 지방소득세)
  private async getAlreadyPaidTax(employeeId: string, year: number): Promise<number> {
    const records = await this.prisma.payrollRecord.findMany({
      where: {
        employeeId,
        period: { startsWith: `${year}-` },
      },
    });
    return records.reduce(
      (sum, r) => sum + Number(r.incomeTax) + Number(r.localIncomeTax),
      0,
    );
  }

  // 근로소득공제
  private calcEarnedIncomeDeduction(grossPay: number): number {
    if (grossPay <= 5_000_000) {
      return Math.round(grossPay * 0.7);
    } else if (grossPay <= 15_000_000) {
      return Math.round(3_500_000 + (grossPay - 5_000_000) * 0.4);
    } else if (grossPay <= 45_000_000) {
      return Math.round(7_500_000 + (grossPay - 15_000_000) * 0.15);
    } else if (grossPay <= 100_000_000) {
      return Math.round(12_000_000 + (grossPay - 45_000_000) * 0.05);
    } else {
      return Math.round(14_750_000 + (grossPay - 100_000_000) * 0.02);
    }
  }

  // 신용카드 등 소득공제
  private calcCardDeduction(
    annualGrossPay: number,
    creditCard: number,
    debitCard: number,
    cashReceipt: number,
    traditionalMarket: number,
    publicTransport: number,
  ): number {
    const threshold = annualGrossPay * 0.25;
    const totalCardUsage = creditCard + debitCard + cashReceipt + traditionalMarket + publicTransport;

    if (totalCardUsage <= threshold) return 0;

    const excess = totalCardUsage - threshold;

    // 각 항목별 공제율 적용 (초과분을 사용 비율에 따라 배분)
    // 간소화: 초과분에 대해 각 항목의 비율로 나누어 공제율 적용
    const ratio = excess / totalCardUsage;
    const creditCardPart = creditCard * ratio;
    const debitCardPart = debitCard * ratio;
    const cashReceiptPart = cashReceipt * ratio;
    const traditionalPart = traditionalMarket * ratio;
    const transportPart = publicTransport * ratio;

    const deduction =
      creditCardPart * 0.15 +
      debitCardPart * 0.30 +
      cashReceiptPart * 0.30 +
      traditionalPart * 0.40 +
      transportPart * 0.40;

    return Math.round(Math.min(deduction, 3_000_000));
  }

  // 종합소득세 산출 (2025 세율 구간)
  private calcIncomeTax(taxableIncome: number): number {
    if (taxableIncome <= 14_000_000) {
      return Math.round(taxableIncome * 0.06);
    } else if (taxableIncome <= 50_000_000) {
      return Math.round(840_000 + (taxableIncome - 14_000_000) * 0.15);
    } else if (taxableIncome <= 88_000_000) {
      return Math.round(6_240_000 + (taxableIncome - 50_000_000) * 0.24);
    } else if (taxableIncome <= 150_000_000) {
      return Math.round(15_360_000 + (taxableIncome - 88_000_000) * 0.35);
    } else if (taxableIncome <= 300_000_000) {
      return Math.round(37_060_000 + (taxableIncome - 150_000_000) * 0.38);
    } else if (taxableIncome <= 500_000_000) {
      return Math.round(94_060_000 + (taxableIncome - 300_000_000) * 0.40);
    } else if (taxableIncome <= 1_000_000_000) {
      return Math.round(174_060_000 + (taxableIncome - 500_000_000) * 0.42);
    } else {
      return Math.round(384_060_000 + (taxableIncome - 1_000_000_000) * 0.45);
    }
  }

  // 세액공제 합산
  private calcTaxCredit(
    calculatedTax: number,
    annualGrossPay: number,
    earnedIncome: number,
    dependentsUnder20: number,
    medicalExpense: number,
    medicalExpenseSevere: number,
    educationExpense: number,
    educationExpenseChild: number,
    donationPolitical: number,
    donationLegal: number,
    donationDesignated: number,
    housingRent: number,
  ): number {
    let totalCredit = 0;

    // 1) 근로소득세액공제
    if (calculatedTax <= 1_300_000) {
      totalCredit += Math.min(Math.round(calculatedTax * 0.55), 660_000);
    } else {
      // 총급여 5,500만원 초과 시 최대 50만원
      const extraCredit = Math.round((calculatedTax - 1_300_000) * 0.30);
      if (annualGrossPay > 55_000_000) {
        totalCredit += 660_000 + Math.min(extraCredit, 500_000);
      } else {
        totalCredit += 660_000 + extraCredit;
      }
    }

    // 2) 자녀세액공제
    if (dependentsUnder20 === 1) {
      totalCredit += 150_000;
    } else if (dependentsUnder20 === 2) {
      totalCredit += 300_000;
    } else if (dependentsUnder20 >= 3) {
      totalCredit += 300_000 + (dependentsUnder20 - 2) * 300_000;
    }

    // 3) 의료비 세액공제
    const medicalThreshold = earnedIncome * 0.03;
    const medicalGeneralCredit = Math.round(
      Math.min(Math.max(0, medicalExpense - medicalThreshold) * 0.15, 7_000_000),
    );
    const medicalSevereCredit = Math.round(
      Math.max(0, medicalExpenseSevere) * 0.15, // 난임/중증은 한도 없음
    );
    totalCredit += medicalGeneralCredit + medicalSevereCredit;

    // 4) 교육비 세액공제
    const educationChildLimit = 3_000_000 * dependentsUnder20;
    const educationCredit = Math.round(
      (educationExpense + Math.min(educationExpenseChild, educationChildLimit)) * 0.15,
    );
    totalCredit += educationCredit;

    // 5) 기부금 세액공제
    // 정치자금: 10만원까지 100/110, 초과분 15%
    let donationCredit = 0;
    if (donationPolitical <= 100_000) {
      donationCredit += Math.round(donationPolitical * 100 / 110);
    } else {
      donationCredit += Math.round(100_000 * 100 / 110 + (donationPolitical - 100_000) * 0.15);
    }
    donationCredit += Math.round(donationLegal * 0.15);
    donationCredit += Math.round(donationDesignated * 0.15);
    totalCredit += donationCredit;

    // 6) 월세 세액공제 (총급여 5,500만원 이하)
    if (annualGrossPay <= 55_000_000) {
      totalCredit += Math.round(Math.min(housingRent, 7_500_000) * 0.17);
    }

    return totalCredit;
  }

  // Decimal 필드를 number로 변환
  private toNumberFields(s: Record<string, unknown>) {
    const decimalFields = [
      "annualGrossPay", "insurancePremium",
      "medicalExpense", "medicalExpenseSevere",
      "educationExpense", "educationExpenseChild",
      "donationPolitical", "donationLegal", "donationDesignated",
      "creditCardUsage", "debitCardUsage", "cashReceiptUsage",
      "traditionalMarket", "publicTransport",
      "housingLoanInterest", "housingRent", "pensionSaving",
      "earnedIncomeDeduction", "earnedIncome", "personalDeduction",
      "specialDeduction", "otherDeduction", "taxableIncome",
      "calculatedTax", "taxCredit", "determinedTax",
      "alreadyPaidTax", "finalTax",
    ];

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(s)) {
      if (decimalFields.includes(key)) {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
