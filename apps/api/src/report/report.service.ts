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
          include: {
            journalEntry: { select: { exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows: TrialBalanceRow[] = accounts.map((account) => {
      const debit = account.journalLines.reduce(
        (sum, l) => sum + Number(l.debit) * Number(l.journalEntry.exchangeRate),
        0,
      );
      const credit = account.journalLines.reduce(
        (sum, l) => sum + Number(l.credit) * Number(l.journalEntry.exchangeRate),
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

  // 총계정원장: 계정별 거래 내역 + 누적 잔액
  async generalLedger(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    accountId?: string,
  ) {
    // 계정 조회
    const accountFilter: Record<string, unknown> = { tenantId };
    if (accountId) accountFilter.id = accountId;

    const accounts = await this.prisma.account.findMany({
      where: accountFilter,
      orderBy: { code: "asc" },
    });

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const result = [];

    for (const account of accounts) {
      // 기초잔액: startDate 이전 POSTED 전표의 합계
      let openingBalance = 0;
      if (startDate) {
        const beforeLines = await this.prisma.journalLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: {
              status: "POSTED",
              tenantId,
              date: { lt: new Date(startDate) },
            },
          },
          include: { journalEntry: { select: { exchangeRate: true } } },
        });

        openingBalance = beforeLines.reduce((sum, l) => {
          const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
          const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
          return account.normalBalance === "DEBIT"
            ? sum + debit - credit
            : sum + credit - debit;
        }, 0);
      }

      // 기간 내 거래 조회
      const lines = await this.prisma.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            status: "POSTED",
            tenantId,
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          },
        },
        include: {
          journalEntry: {
            select: { id: true, date: true, description: true, exchangeRate: true },
          },
        },
        orderBy: { journalEntry: { date: "asc" } },
      });

      // 거래가 없고 기초잔액도 없으면 스킵
      if (lines.length === 0 && openingBalance === 0) continue;

      let runningBalance = openingBalance;
      let totalDebit = 0;
      let totalCredit = 0;

      const entries = lines.map((l) => {
        const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
        const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
        totalDebit += debit;
        totalCredit += credit;

        if (account.normalBalance === "DEBIT") {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }

        return {
          date: new Date(l.journalEntry.date).toISOString().slice(0, 10),
          journalEntryId: l.journalEntry.id,
          description: l.journalEntry.description || "",
          debit,
          credit,
          balance: runningBalance,
        };
      });

      result.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        openingBalance,
        entries,
        closingBalance: runningBalance,
        totalDebit,
        totalCredit,
      });
    }

    return { accounts: result };
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

  // 대시보드 알림 데이터
  async getDashboardAlerts(tenantId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 1) 미승인 전표 수 (DRAFT 상태)
    const draftCount = await this.prisma.journalEntry.count({
      where: { tenantId, status: "DRAFT" },
    });

    // 2) 승인 대기 전표 수 (APPROVED 상태, 아직 POSTED 안됨)
    const approvedCount = await this.prisma.journalEntry.count({
      where: { tenantId, status: "APPROVED" },
    });

    // 3) 마감 임박 체크
    const closedPeriod = await this.prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    const isCurrentMonthClosed = closedPeriod?.status === "CLOSED";
    const lastDay = new Date(year, month, 0).getDate();
    const daysUntilMonthEnd = lastDay - now.getDate();

    // 4) 미처리 영수증 수 (PENDING 상태)
    const pendingDocCount = await this.prisma.document.count({
      where: { tenantId, status: "PENDING" },
    });

    // 5) 최근 활동 로그 (최근 10건) + 사용자명 조회
    const recentLogs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const userIds = [...new Set(recentLogs.map((l) => l.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const logsWithUser = recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description,
      createdAt: log.createdAt,
      userName: userMap.get(log.userId) || "알 수 없음",
    }));

    return {
      draftCount,
      approvedCount,
      pendingDocCount,
      closing: { year, month, isClosed: isCurrentMonthClosed, daysUntilMonthEnd },
      recentLogs: logsWithUser,
    };
  }

  // 대시보드 KPI (매출/매입, 은행잔고, 경비정산, 재고, 결재, 예산)
  async getDashboardKpi(tenantId: string) {
    const now = new Date();
    const year = now.getFullYear();

    const [
      salesTrades,
      purchaseTrades,
      bankAccounts,
      expensePending,
      inventorySummary,
      approvalPending,
      budgets,
    ] = await Promise.all([
      // 매출 합계
      this.prisma.trade.aggregate({
        where: { tenantId, tradeType: "SALES", status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // 매입 합계
      this.prisma.trade.aggregate({
        where: { tenantId, tradeType: "PURCHASE", status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // 은행 잔고 합계
      this.prisma.bankAccount.aggregate({
        where: { tenantId, status: "ACTIVE" },
        _sum: { balance: true },
      }),
      // 경비 정산 대기
      this.prisma.expenseClaim.findMany({
        where: { tenantId, status: { in: ["PENDING_APPROVAL", "APPROVED"] } },
        select: { totalAmount: true },
      }),
      // 재고 부족 품목 수
      this.prisma.product.count({
        where: {
          tenantId,
          currentStock: { lte: this.prisma.product.fields?.safetyStock as never },
        },
      }).catch(() => 0),
      // 결재 대기 건수
      this.prisma.approvalRequest.count({
        where: { tenantId, status: "PENDING" },
      }),
      // 예산 합계
      this.prisma.budget.aggregate({
        where: { tenantId, year },
        _sum: { amount: true },
      }),
    ]);

    // 재고 부족 (Prisma에서 필드 비교가 어려우므로 raw query)
    const lowStockProducts = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint as count FROM "Product"
        WHERE "tenantId" = ${tenantId}
          AND "currentStock" <= "safetyStock"
          AND "safetyStock" > 0
      `,
    );
    const lowStockCount = Number(lowStockProducts[0]?.count || 0);

    const salesTotal = Number(salesTrades._sum.totalAmount || 0);
    const salesPaid = Number(salesTrades._sum.paidAmount || 0);
    const purchaseTotal = Number(purchaseTrades._sum.totalAmount || 0);
    const purchasePaid = Number(purchaseTrades._sum.paidAmount || 0);

    const pendingAmount = expensePending.reduce(
      (sum, e) => sum + Number(e.totalAmount),
      0,
    );

    return {
      trades: {
        salesTotal,
        salesRemaining: salesTotal - salesPaid,
        purchaseTotal,
        purchaseRemaining: purchaseTotal - purchasePaid,
      },
      bankBalance: Number(bankAccounts._sum.balance || 0),
      expenseClaims: {
        pendingCount: expensePending.length,
        pendingAmount,
      },
      inventory: { lowStockCount },
      approvals: { pendingCount: approvalPending },
      budget: {
        year,
        totalBudget: Number(budgets._sum.amount || 0),
      },
    };
  }

  // 자금 일보: 현금성 계정의 일별 입출금 현황
  async getDailyCashReport(tenantId: string, startDate?: string, endDate?: string) {
    const cashCodes = ["10100", "10300"]; // 현금, 보통예금

    // 현금 계정 조회
    const cashAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: cashCodes } },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    if (cashAccountIds.length === 0) {
      return { days: [], totalDeposit: 0, totalWithdraw: 0, openingBalance: 0, closingBalance: 0 };
    }

    // 기간 이전 잔액 (기초잔액)
    const beforeFilter: Record<string, unknown> = {};
    if (startDate) {
      beforeFilter.lt = new Date(startDate);
    }

    const beforeLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(beforeFilter).length > 0 && { date: beforeFilter }),
        },
      },
      include: { journalEntry: { select: { exchangeRate: true } } },
    });

    const openingBalance = beforeLines.reduce(
      (sum, l) =>
        sum +
        (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
      0,
    );

    // 기간 내 거래 조회
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        journalEntry: { select: { date: true, description: true, exchangeRate: true } },
        account: { select: { code: true, name: true } },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    // 날짜별 그룹핑
    const dayMap = new Map<string, { deposit: number; withdraw: number; details: { description: string; account: string; deposit: number; withdraw: number }[] }>();

    for (const l of lines) {
      const dateKey = new Date(l.journalEntry.date).toISOString().slice(0, 10);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { deposit: 0, withdraw: 0, details: [] });
      }
      const day = dayMap.get(dateKey)!;
      const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
      const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
      day.deposit += debit;
      day.withdraw += credit;
      day.details.push({
        description: l.journalEntry.description || "",
        account: l.account.name,
        deposit: debit,
        withdraw: credit,
      });
    }

    // 일별 잔액 누적 계산
    const sortedDates = [...dayMap.keys()].sort();
    let runningBalance = openingBalance;
    const days = sortedDates.map((date) => {
      const d = dayMap.get(date)!;
      const prevBalance = runningBalance;
      runningBalance += d.deposit - d.withdraw;
      return {
        date,
        prevBalance,
        deposit: d.deposit,
        withdraw: d.withdraw,
        balance: runningBalance,
        details: d.details,
      };
    });

    return {
      days,
      openingBalance,
      closingBalance: runningBalance,
      totalDeposit: days.reduce((s, d) => s + d.deposit, 0),
      totalWithdraw: days.reduce((s, d) => s + d.withdraw, 0),
    };
  }

  // 현금 흐름표 (간접법)
  async getCashFlowStatement(tenantId: string, startDate?: string, endDate?: string) {
    // 당기순이익
    const income = await this.incomeStatement(tenantId, startDate, endDate);
    const netIncome = income.netIncome;

    // 계정 잔액 변동 계산 헬퍼
    const getAccountChange = async (code: string) => {
      const account = await this.prisma.account.findFirst({
        where: { tenantId, code },
      });
      if (!account) return 0;

      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

      const lines = await this.prisma.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            status: "POSTED",
            tenantId,
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });

      return lines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
        0,
      );
    };

    // 고정자산 계정 변동 (코드 13xxx)
    const getFixedAssetChange = async () => {
      const accounts = await this.prisma.account.findMany({
        where: { tenantId, code: { gte: "13000", lt: "14000" } },
      });
      if (accounts.length === 0) return 0;

      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

      const lines = await this.prisma.journalLine.findMany({
        where: {
          accountId: { in: accounts.map((a) => a.id) },
          journalEntry: {
            status: "POSTED",
            tenantId,
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });

      return lines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
        0,
      );
    };

    // 영업활동 항목
    const depreciation = await getAccountChange("50900"); // 감가상각비 (비현금 비용, 가산)
    const arChange = await getAccountChange("10500");     // 매출채권 변동
    const inventoryChange = await getAccountChange("11300"); // 재고 변동
    const apChange = await getAccountChange("20100");     // 매입채무 변동
    const accruedChange = await getAccountChange("20300"); // 미지급금 변동

    const operatingItems = [
      { name: "당기순이익", amount: netIncome },
      { name: "감가상각비", amount: depreciation },
      { name: "매출채권 변동", amount: -arChange },
      { name: "재고자산 변동", amount: -inventoryChange },
      { name: "매입채무 변동", amount: apChange },
      { name: "미지급금 변동", amount: accruedChange },
    ];
    const operatingTotal = operatingItems.reduce((s, i) => s + i.amount, 0);

    // 투자활동
    const fixedAssetChange = await getFixedAssetChange();
    const investingItems = [
      { name: "유형자산 취득/처분", amount: -fixedAssetChange },
    ];
    const investingTotal = investingItems.reduce((s, i) => s + i.amount, 0);

    // 재무활동
    const shortDebtChange = await getAccountChange("20700"); // 단기차입금
    const longDebtChange = await getAccountChange("23100");  // 장기차입금
    const capitalChange = await getAccountChange("30100");   // 자본금
    const financingItems = [
      { name: "단기차입금 변동", amount: shortDebtChange },
      { name: "장기차입금 변동", amount: longDebtChange },
      { name: "자본금 변동", amount: capitalChange },
    ];
    const financingTotal = financingItems.reduce((s, i) => s + i.amount, 0);

    // 현금 증감
    const netCashChange = operatingTotal + investingTotal + financingTotal;

    // 기초 현금 잔액
    const cashCodes = ["10100", "10300"];
    const cashAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: cashCodes } },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    let openingCash = 0;
    if (startDate && cashAccountIds.length > 0) {
      const beforeLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: { in: cashAccountIds },
          journalEntry: {
            status: "POSTED",
            tenantId,
            date: { lt: new Date(startDate) },
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });
      openingCash = beforeLines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
        0,
      );
    }

    const closingCash = openingCash + netCashChange;

    return {
      operating: { items: operatingItems, total: operatingTotal },
      investing: { items: investingItems, total: investingTotal },
      financing: { items: financingItems, total: financingTotal },
      netCashChange,
      openingCash,
      closingCash,
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
