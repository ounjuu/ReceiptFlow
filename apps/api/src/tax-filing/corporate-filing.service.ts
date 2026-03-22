import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FilingExportService } from "./filing-export.service";

// 2025 법인세 세율 구간
function calculateCorporateTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let remaining = taxableIncome;

  // 2억 이하: 9%
  const bracket1 = Math.min(remaining, 200_000_000);
  tax += bracket1 * 0.09;
  remaining -= bracket1;
  if (remaining <= 0) return Math.round(tax);

  // 2억 초과 ~ 200억 이하: 19%
  const bracket2 = Math.min(remaining, 20_000_000_000 - 200_000_000);
  tax += bracket2 * 0.19;
  remaining -= bracket2;
  if (remaining <= 0) return Math.round(tax);

  // 200억 초과 ~ 3000억 이하: 21%
  const bracket3 = Math.min(remaining, 300_000_000_000 - 20_000_000_000);
  tax += bracket3 * 0.21;
  remaining -= bracket3;
  if (remaining <= 0) return Math.round(tax);

  // 3000억 초과: 24%
  tax += remaining * 0.24;
  return Math.round(tax);
}

@Injectable()
export class CorporateFilingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: FilingExportService,
  ) {}

  // 법인세 신고서 생성
  async generate(tenantId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // POSTED 전표의 분개 라인 조회 (계정 정보 포함)
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: startDate, lte: endDate },
        },
      },
      include: {
        account: { select: { type: true, code: true, name: true } },
        journalEntry: { select: { exchangeRate: true } },
      },
    });

    // 수익: REVENUE 계정의 대변 순액
    let revenue = 0;
    // 비용: EXPENSE 계정의 차변 순액
    let expenses = 0;

    for (const line of journalLines) {
      const rate = Number(line.journalEntry.exchangeRate);
      if (line.account.type === "REVENUE") {
        revenue += (Number(line.credit) - Number(line.debit)) * rate;
      } else if (line.account.type === "EXPENSE") {
        expenses += (Number(line.debit) - Number(line.credit)) * rate;
      }
    }

    const operatingIncome = revenue - expenses;
    const nonOperatingIncome = 0;   // 수동 조정 가능
    const nonOperatingExpense = 0;  // 수동 조정 가능
    const incomeBeforeTax = operatingIncome + nonOperatingIncome - nonOperatingExpense;
    const taxableIncome = incomeBeforeTax; // 초기에는 조정 없음

    const calculatedTax = calculateCorporateTax(taxableIncome);
    const taxCredits = 0;           // 세액공제 (수동 조정 가능)
    const determinedTax = calculatedTax - taxCredits;
    const prepaidTax = 0;           // 중간예납 (수동 조정 가능)
    const finalTax = determinedTax - prepaidTax;

    const period = "ANNUAL";
    const filingData = {
      revenue,
      expenses,
      operatingIncome,
      nonOperatingIncome,
      nonOperatingExpense,
      incomeBeforeTax,
      taxableIncome,
      calculatedTax,
      taxCredits,
      determinedTax,
      prepaidTax,
      finalTax,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
    };

    // Upsert
    const filing = await this.prisma.taxFiling.upsert({
      where: {
        tenantId_filingType_year_period: {
          tenantId,
          filingType: "CORPORATE",
          year,
          period,
        },
      },
      update: {
        filingData,
        taxableAmount: taxableIncome,
        taxAmount: finalTax,
        status: "GENERATED",
        generatedAt: new Date(),
      },
      create: {
        tenantId,
        filingType: "CORPORATE",
        year,
        period,
        filingData,
        taxableAmount: taxableIncome,
        taxAmount: finalTax,
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

  // 법인세 과세표준 CSV
  exportCsv(filingData: Record<string, unknown>): string {
    const headers = ["항목", "금액"];
    const rows: string[][] = [
      ["매출액(수익)", String(filingData.revenue)],
      ["비용", String(filingData.expenses)],
      ["영업이익", String(filingData.operatingIncome)],
      ["영업외수익", String(filingData.nonOperatingIncome)],
      ["영업외비용", String(filingData.nonOperatingExpense)],
      ["법인세차감전순이익", String(filingData.incomeBeforeTax)],
      ["과세표준", String(filingData.taxableIncome)],
      ["산출세액", String(filingData.calculatedTax)],
      ["세액공제", String(filingData.taxCredits)],
      ["결정세액", String(filingData.determinedTax)],
      ["기납부세액", String(filingData.prepaidTax)],
      ["납부할세액", String(filingData.finalTax)],
    ];

    return this.exportService.generateCsv(headers, rows);
  }
}
