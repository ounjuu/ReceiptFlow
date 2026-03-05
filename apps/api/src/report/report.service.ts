import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  // 시산표: 계정별 차변/대변 합계 (기간 필터)
  async trialBalance(tenantId: string, startDate?: string, endDate?: string): Promise<{
    rows: TrialBalanceRow[];
    totalDebit: number;
    totalCredit: number;
  }> {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows: TrialBalanceRow[] = accounts.map((account) => {
      const debit = account.journalLines.reduce(
        (sum, l) => sum + Number(l.debit),
        0,
      );
      const credit = account.journalLines.reduce(
        (sum, l) => sum + Number(l.credit),
        0,
      );
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: debit - credit,
      };
    });

    // 잔액이 0인 계정 제외
    const filtered = rows.filter((r) => r.debit !== 0 || r.credit !== 0);

    return {
      rows: filtered,
      totalDebit: filtered.reduce((sum, r) => sum + r.debit, 0),
      totalCredit: filtered.reduce((sum, r) => sum + r.credit, 0),
    };
  }

  // 손익계산서: 수익 - 비용 = 당기순이익
  async incomeStatement(tenantId: string, startDate?: string, endDate?: string) {
    const { rows } = await this.trialBalance(tenantId, startDate, endDate);

    const revenue = rows
      .filter((r) => r.type === "REVENUE")
      .map((r) => ({ ...r, amount: r.credit - r.debit }));

    const expense = rows
      .filter((r) => r.type === "EXPENSE")
      .map((r) => ({ ...r, amount: r.debit - r.credit }));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expense.reduce((sum, r) => sum + r.amount, 0);

    return {
      revenue,
      totalRevenue,
      expense,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
    };
  }

  // 대시보드 요약
  async dashboardSummary(tenantId: string) {
    // 최근 6개월 범위 계산
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // 1. 월별 지출 추이
    const monthlyExpense = await this.prisma.$queryRaw<
      { month: string; total: number }[]
    >(Prisma.sql`
      SELECT TO_CHAR("transactionAt", 'YYYY-MM') as month,
             SUM("totalAmount")::float as total
      FROM "Document"
      WHERE "tenantId" = ${tenantId}
        AND "transactionAt" >= ${sixMonthsAgo}
        AND "totalAmount" IS NOT NULL
      GROUP BY month
      ORDER BY month
    `);

    // 2. 영수증 상태별 건수
    const statusCounts = await this.prisma.document.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });

    // 3. 상위 5개 거래처 지출
    const topVendors = await this.prisma.$queryRaw<
      { name: string; total: number }[]
    >(Prisma.sql`
      SELECT v.name, SUM(d."totalAmount")::float as total
      FROM "Document" d
      JOIN "Vendor" v ON d."vendorId" = v.id
      WHERE d."tenantId" = ${tenantId}
        AND d."totalAmount" IS NOT NULL
      GROUP BY v.name
      ORDER BY total DESC
      LIMIT 5
    `);

    // 4. 당월 손익
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const income = await this.incomeStatement(
      tenantId,
      monthStart.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10),
    );

    return {
      monthlyExpense,
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      topVendors,
      totalRevenue: income.totalRevenue,
      totalExpense: income.totalExpense,
      netIncome: income.netIncome,
    };
  }

  // 재무상태표: 자산 = 부채 + 자본 (유동/비유동 소분류 포함)
  async balanceSheet(tenantId: string, startDate?: string, endDate?: string) {
    const { rows } = await this.trialBalance(tenantId, startDate, endDate);
    const income = await this.incomeStatement(tenantId, startDate, endDate);

    const toAmount = (r: TrialBalanceRow, isDebit: boolean) => ({
      ...r,
      amount: isDebit ? r.debit - r.credit : r.credit - r.debit,
    });

    // 자산: 유동(코드 < 13000) / 비유동(코드 >= 13000)
    const allAssets = rows.filter((r) => r.type === "ASSET");
    const currentAssets = allAssets
      .filter((r) => Number(r.code) < 13000)
      .map((r) => toAmount(r, true));
    const nonCurrentAssets = allAssets
      .filter((r) => Number(r.code) >= 13000)
      .map((r) => toAmount(r, true));
    const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0);
    const totalNonCurrentAssets = nonCurrentAssets.reduce((s, r) => s + r.amount, 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    // 부채: 유동(코드 < 23000) / 비유동(코드 >= 23000)
    const allLiabilities = rows.filter((r) => r.type === "LIABILITY");
    const currentLiabilities = allLiabilities
      .filter((r) => Number(r.code) < 23000)
      .map((r) => toAmount(r, false));
    const nonCurrentLiabilities = allLiabilities
      .filter((r) => Number(r.code) >= 23000)
      .map((r) => toAmount(r, false));
    const totalCurrentLiabilities = currentLiabilities.reduce((s, r) => s + r.amount, 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

    // 자본
    const equity = rows
      .filter((r) => r.type === "EQUITY")
      .map((r) => toAmount(r, false));
    const totalEquity = equity.reduce((s, r) => s + r.amount, 0);

    return {
      currentAssets,
      totalCurrentAssets,
      nonCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      currentLiabilities,
      totalCurrentLiabilities,
      nonCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      equity,
      totalEquity,
      retainedEarnings: income.netIncome,
      totalLiabilitiesAndEquity:
        totalLiabilities + totalEquity + income.netIncome,
      isBalanced:
        Math.abs(
          totalAssets - (totalLiabilities + totalEquity + income.netIncome),
        ) < 0.01,
    };
  }
}
