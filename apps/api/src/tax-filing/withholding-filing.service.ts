import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FilingExportService } from "./filing-export.service";
import { formatYearMonth } from "../common/date.util";

// 사업주 부담 보험 요율
const EMPLOYER_RATES = {
  nationalPension: 0.045,       // 국민연금 4.5%
  healthInsurance: 0.03545,     // 건강보험 3.545%
  longTermCareRate: 0.1281,     // 장기요양 = 건강보험의 12.81%
  employmentInsurance: 0.009,   // 고용보험 0.9%
  industrialAccident: 0.007,    // 산재보험 0.7%
};

@Injectable()
export class WithholdingFilingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: FilingExportService,
  ) {}

  // 원천징수이행상황신고서 생성
  async generate(tenantId: string, year: number, month: number) {
    const period = formatYearMonth(year, month);

    // 해당 월 급여 레코드 조회
    const records = await this.prisma.payrollRecord.findMany({
      where: {
        period,
        employee: { tenantId },
      },
      include: {
        employee: { select: { id: true, employeeNo: true, name: true, department: true } },
      },
    });

    const employeeCount = records.length;
    const totalGrossPay = records.reduce((s, r) => s + Number(r.grossPay), 0);
    const totalIncomeTax = records.reduce((s, r) => s + Number(r.incomeTax), 0);
    const totalLocalIncomeTax = records.reduce((s, r) => s + Number(r.localIncomeTax), 0);
    const totalWithholdingTax = totalIncomeTax + totalLocalIncomeTax;

    // 사업주 부담 4대보험 추정
    const employerNationalPension = Math.round(totalGrossPay * EMPLOYER_RATES.nationalPension);
    const employerHealthInsurance = Math.round(totalGrossPay * EMPLOYER_RATES.healthInsurance);
    const employerLongTermCare = Math.round(employerHealthInsurance * EMPLOYER_RATES.longTermCareRate);
    const employerEmploymentInsurance = Math.round(totalGrossPay * EMPLOYER_RATES.employmentInsurance);
    const employerIndustrialAccident = Math.round(totalGrossPay * EMPLOYER_RATES.industrialAccident);

    const employerInsurance = {
      nationalPension: employerNationalPension,
      healthInsurance: employerHealthInsurance,
      longTermCare: employerLongTermCare,
      employmentInsurance: employerEmploymentInsurance,
      industrialAccident: employerIndustrialAccident,
      total: employerNationalPension + employerHealthInsurance + employerLongTermCare + employerEmploymentInsurance + employerIndustrialAccident,
    };

    // 직원별 상세
    const details = records.map((r) => ({
      employeeId: r.employee.id,
      employeeNo: r.employee.employeeNo,
      name: r.employee.name,
      department: r.employee.department,
      grossPay: Number(r.grossPay),
      incomeTax: Number(r.incomeTax),
      localIncomeTax: Number(r.localIncomeTax),
      nationalPension: Number(r.nationalPension),
      healthInsurance: Number(r.healthInsurance),
      longTermCare: Number(r.longTermCare),
      employmentInsurance: Number(r.employmentInsurance),
    }));

    const filingData = {
      period,
      employeeCount,
      totalGrossPay,
      totalIncomeTax,
      totalLocalIncomeTax,
      totalWithholdingTax,
      employerInsurance,
      details,
    };

    // Upsert
    const filing = await this.prisma.taxFiling.upsert({
      where: {
        tenantId_filingType_year_period: {
          tenantId,
          filingType: "WITHHOLDING",
          year,
          period,
        },
      },
      update: {
        filingData,
        taxableAmount: totalGrossPay,
        taxAmount: totalWithholdingTax,
        status: "GENERATED",
        generatedAt: new Date(),
      },
      create: {
        tenantId,
        filingType: "WITHHOLDING",
        year,
        period,
        filingData,
        taxableAmount: totalGrossPay,
        taxAmount: totalWithholdingTax,
        status: "GENERATED",
        generatedAt: new Date(),
      },
    });

    return {
      ...filing,
      taxableAmount: Number(filing.taxableAmount),
      taxAmount: Number(filing.taxAmount),
    };
  }

  // 원천징수이행상황신고서 CSV
  exportCsv(filingData: Record<string, unknown>): string {
    const headers = ["귀속연월", "소득구분", "인원", "총지급액", "소득세", "지방소득세"];
    const rows: string[][] = [];

    rows.push([
      String(filingData.period),
      "근로소득",
      String(filingData.employeeCount),
      String(filingData.totalGrossPay),
      String(filingData.totalIncomeTax),
      String(filingData.totalLocalIncomeTax),
    ]);

    return this.exportService.generateCsv(headers, rows);
  }
}
