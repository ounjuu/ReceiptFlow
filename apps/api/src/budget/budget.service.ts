import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  // 연도별 예산 목록
  async getBudgets(tenantId: string, year: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { tenantId, year },
      include: {
        account: { select: { code: true, name: true, type: true } },
      },
      orderBy: [{ account: { code: "asc" } }, { month: "asc" }],
    });

    return budgets.map((b) => ({
      id: b.id,
      accountId: b.accountId,
      accountCode: b.account.code,
      accountName: b.account.name,
      accountType: b.account.type,
      year: b.year,
      month: b.month,
      amount: Number(b.amount),
      note: b.note,
    }));
  }

  // 예산 등록/수정 (upsert)
  async upsertBudget(dto: CreateBudgetDto) {
    const result = await this.prisma.budget.upsert({
      where: {
        tenantId_accountId_year_month: {
          tenantId: dto.tenantId,
          accountId: dto.accountId,
          year: dto.year,
          month: dto.month,
        },
      },
      update: {
        amount: dto.amount,
        note: dto.note,
      },
      create: {
        tenantId: dto.tenantId,
        accountId: dto.accountId,
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        note: dto.note,
      },
    });

    return { ...result, amount: Number(result.amount) };
  }

  // 예산 삭제
  async deleteBudget(id: string) {
    return this.prisma.budget.delete({ where: { id } });
  }

  // 예산 vs 실적 비교
  async getBudgetVsActual(tenantId: string, year: number, month?: number) {
    // 1. 예산 조회
    const budgetWhere: { tenantId: string; year: number; month?: number } = {
      tenantId,
      year,
    };
    if (month) budgetWhere.month = month;

    const budgets = await this.prisma.budget.findMany({
      where: budgetWhere,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    // 2. 실적 조회: POSTED 전표의 EXPENSE 계정 debit 합계
    const startDate = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const endDate = month
      ? new Date(year, month, 0, 23, 59, 59)
      : new Date(year, 11, 31, 23, 59, 59);

    const expenseAccounts = await this.prisma.account.findMany({
      where: { tenantId, type: "EXPENSE" },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              date: { gte: startDate, lte: endDate },
            },
          },
          include: {
            journalEntry: { select: { exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    // 계정별 실적 맵
    const actualMap = new Map<string, number>();
    for (const acc of expenseAccounts) {
      const actual = acc.journalLines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) *
            Number(l.journalEntry.exchangeRate),
        0,
      );
      if (actual !== 0) {
        actualMap.set(acc.id, actual);
      }
    }

    // 3. 예산 계정별 집계 (월 지정 시 해당 월, 미지정 시 연간 합계)
    const budgetMap = new Map<
      string,
      { accountId: string; code: string; name: string; budget: number }
    >();
    for (const b of budgets) {
      const key = b.accountId;
      const existing = budgetMap.get(key);
      if (existing) {
        existing.budget += Number(b.amount);
      } else {
        budgetMap.set(key, {
          accountId: b.accountId,
          code: b.account.code,
          name: b.account.name,
          budget: Number(b.amount),
        });
      }
    }

    // 4. 실적에만 있는 계정도 포함
    for (const acc of expenseAccounts) {
      if (!budgetMap.has(acc.id) && actualMap.has(acc.id)) {
        budgetMap.set(acc.id, {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          budget: 0,
        });
      }
    }

    // 5. 결과 생성
    const rows = [...budgetMap.values()]
      .map((b) => {
        const actual = actualMap.get(b.accountId) || 0;
        const variance = b.budget - actual;
        const rate = b.budget > 0 ? (actual / b.budget) * 100 : actual > 0 ? 100 : 0;
        return {
          accountId: b.accountId,
          accountCode: b.code,
          accountName: b.name,
          budget: b.budget,
          actual,
          variance,
          rate: Math.round(rate * 10) / 10,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    const totalVariance = totalBudget - totalActual;
    const totalRate =
      totalBudget > 0
        ? Math.round((totalActual / totalBudget) * 1000) / 10
        : 0;

    return { rows, totalBudget, totalActual, totalVariance, totalRate };
  }

  // 연간 요약
  async getAnnualSummary(tenantId: string, year: number) {
    const vsActual = await this.getBudgetVsActual(tenantId, year);
    return {
      year,
      totalBudget: vsActual.totalBudget,
      totalActual: vsActual.totalActual,
      totalVariance: vsActual.totalVariance,
      totalRate: vsActual.totalRate,
    };
  }
}
