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

  // 일계표: 특정 일자의 계정별 차변/대변 합계
  async dailySummary(tenantId: string, date: string) {
    const startOfDay = new Date(date);
    const endOfDay = new Date(date + "T23:59:59");

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              date: { gte: startOfDay, lte: endOfDay },
            },
          },
          include: {
            journalEntry: { select: { exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows = accounts
      .map((account) => {
        const debit = account.journalLines.reduce(
          (sum, l) => sum + Number(l.debit) * Number(l.journalEntry.exchangeRate),
          0,
        );
        const credit = account.journalLines.reduce(
          (sum, l) => sum + Number(l.credit) * Number(l.journalEntry.exchangeRate),
          0,
        );
        return {
          code: account.code,
          name: account.name,
          type: account.type,
          debit,
          credit,
        };
      })
      .filter((r) => r.debit !== 0 || r.credit !== 0);

    return {
      date,
      rows,
      totalDebit: rows.reduce((sum, r) => sum + r.debit, 0),
      totalCredit: rows.reduce((sum, r) => sum + r.credit, 0),
    };
  }

  // 월계표: 월별 계정별 차변/대변 합계 + 누적(1월~당월)
  async monthlySummary(tenantId: string, year: number, month: number) {
    // 당월 범위
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    // 누적 범위 (1월 1일 ~ 당월 말)
    const yearStart = new Date(year, 0, 1);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              date: { gte: yearStart, lte: monthEnd },
            },
          },
          include: {
            journalEntry: { select: { date: true, exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows = accounts
      .map((account) => {
        let monthDebit = 0;
        let monthCredit = 0;
        let cumulativeDebit = 0;
        let cumulativeCredit = 0;

        for (const l of account.journalLines) {
          const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
          const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
          const lineDate = new Date(l.journalEntry.date);

          // 누적 (1월~당월)
          cumulativeDebit += debit;
          cumulativeCredit += credit;

          // 당월
          if (lineDate >= monthStart && lineDate <= monthEnd) {
            monthDebit += debit;
            monthCredit += credit;
          }
        }

        return {
          code: account.code,
          name: account.name,
          type: account.type,
          monthDebit,
          monthCredit,
          cumulativeDebit,
          cumulativeCredit,
        };
      })
      .filter(
        (r) =>
          r.monthDebit !== 0 ||
          r.monthCredit !== 0 ||
          r.cumulativeDebit !== 0 ||
          r.cumulativeCredit !== 0,
      );

    return {
      year,
      month,
      rows,
      totalMonthDebit: rows.reduce((sum, r) => sum + r.monthDebit, 0),
      totalMonthCredit: rows.reduce((sum, r) => sum + r.monthCredit, 0),
      totalCumulativeDebit: rows.reduce((sum, r) => sum + r.cumulativeDebit, 0),
      totalCumulativeCredit: rows.reduce((sum, r) => sum + r.cumulativeCredit, 0),
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

    const accountIds = accounts.map((a) => a.id);

    // 기초잔액용 라인 일괄 조회 (N+1 방지)
    type BalanceLine = { accountId: string; debit: any; credit: any; journalEntry: { exchangeRate: any } };
    const beforeLinesByAccount = new Map<string, BalanceLine[]>();
    let beforeLines: BalanceLine[] = [];
    if (startDate) {
      beforeLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: { in: accountIds },
          journalEntry: {
            status: "POSTED",
            tenantId,
            date: { lt: new Date(startDate) },
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });

      for (const l of beforeLines) {
        const arr = beforeLinesByAccount.get(l.accountId) || [];
        arr.push(l);
        beforeLinesByAccount.set(l.accountId, arr);
      }
    }

    // 기간 내 거래 라인 일괄 조회 (N+1 방지)
    const periodLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
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

    // 계정별로 그룹핑
    const periodLinesByAccount = new Map<string, typeof periodLines>();
    for (const l of periodLines) {
      const arr = periodLinesByAccount.get(l.accountId) || [];
      arr.push(l);
      periodLinesByAccount.set(l.accountId, arr);
    }

    const result = [];

    for (const account of accounts) {
      // 기초잔액 계산
      let openingBalance = 0;
      if (startDate) {
        const accountBeforeLines = beforeLinesByAccount.get(account.id) || [];
        openingBalance = accountBeforeLines.reduce((sum, l) => {
          const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
          const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
          return account.normalBalance === "DEBIT"
            ? sum + debit - credit
            : sum + credit - debit;
        }, 0);
      }

      const lines = periodLinesByAccount.get(account.id) || [];

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

  // 계정별원장: 특정 계정의 거래 내역 + 상대계정 정보
  async accountLedger(
    tenantId: string,
    accountId: string,
    startDate?: string,
    endDate?: string,
  ) {
    // 계정 조회
    const account = await this.prisma.account.findFirstOrThrow({
      where: { id: accountId, tenantId },
    });

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

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

    // 기간 내 거래 조회 (거래처 정보 포함)
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
        vendor: { select: { name: true } },
        journalEntry: {
          select: {
            id: true,
            date: true,
            description: true,
            exchangeRate: true,
            lines: {
              select: {
                debit: true,
                credit: true,
                account: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

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

      // 상대계정 찾기: 같은 전표에서 반대 방향의 다른 계정
      const isDebitSide = debit > 0;
      const counterparts = l.journalEntry.lines.filter((ol) => {
        if (ol.account.code === account.code) return false;
        return isDebitSide ? Number(ol.credit) > 0 : Number(ol.debit) > 0;
      });

      let counterpartCode = "";
      let counterpartName = "";
      if (counterparts.length === 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = counterparts[0].account.name;
      } else if (counterparts.length > 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = "제";
      }

      return {
        date: new Date(l.journalEntry.date).toISOString().slice(0, 10),
        journalEntryId: l.journalEntry.id,
        description: l.journalEntry.description || "",
        counterpartCode,
        counterpartName,
        vendorName: l.vendor?.name || null,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      openingBalance,
      entries,
      closingBalance: runningBalance,
      totalDebit,
      totalCredit,
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

    // 현금흐름표에 필요한 모든 계정코드를 일괄 조회 (N+1 방지)
    const cfCodes = ["50900", "10500", "11300", "20100", "20300", "20700", "23100", "30100", "10100", "10300"];
    const cfAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: cfCodes } },
    });
    const cfAccountMap = new Map(cfAccounts.map((a) => [a.code, a]));

    // 고정자산 계정 (13xxx) 조회
    const fixedAssetAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { gte: "13000", lt: "14000" } },
    });

    // 모든 관련 계정의 ID를 모아서 기간 내 라인 일괄 조회
    const allCfAccountIds = [
      ...cfAccounts.map((a) => a.id),
      ...fixedAssetAccounts.map((a) => a.id),
    ];

    const dateFilter2: Record<string, unknown> = {};
    if (startDate) dateFilter2.gte = new Date(startDate);
    if (endDate) dateFilter2.lte = new Date(endDate + "T23:59:59");

    const allCfLines = allCfAccountIds.length > 0
      ? await this.prisma.journalLine.findMany({
          where: {
            accountId: { in: allCfAccountIds },
            journalEntry: {
              status: "POSTED",
              tenantId,
              ...(Object.keys(dateFilter2).length > 0 && { date: dateFilter2 }),
            },
          },
          include: { journalEntry: { select: { exchangeRate: true } } },
        })
      : [];

    // 계정별로 그룹핑 후 변동액 계산
    const cfLinesByAccountId = new Map<string, typeof allCfLines>();
    for (const l of allCfLines) {
      const arr = cfLinesByAccountId.get(l.accountId) || [];
      arr.push(l);
      cfLinesByAccountId.set(l.accountId, arr);
    }

    const calcChange = (accountId: string | undefined) => {
      if (!accountId) return 0;
      const lines = cfLinesByAccountId.get(accountId) || [];
      return lines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
        0,
      );
    };

    const getAccountChange = (code: string) => calcChange(cfAccountMap.get(code)?.id);

    // 고정자산 변동 합산
    const fixedAssetChange = fixedAssetAccounts.reduce(
      (sum, a) => sum + calcChange(a.id), 0,
    );

    // 영업활동 항목
    const depreciation = getAccountChange("50900"); // 감가상각비 (비현금 비용, 가산)
    const arChange = getAccountChange("10500");     // 매출채권 변동
    const inventoryChange = getAccountChange("11300"); // 재고 변동
    const apChange = getAccountChange("20100");     // 매입채무 변동
    const accruedChange = getAccountChange("20300"); // 미지급금 변동

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
    const investingItems = [
      { name: "유형자산 취득/처분", amount: -fixedAssetChange },
    ];
    const investingTotal = investingItems.reduce((s, i) => s + i.amount, 0);

    // 재무활동
    const shortDebtChange = getAccountChange("20700"); // 단기차입금
    const longDebtChange = getAccountChange("23100");  // 장기차입금
    const capitalChange = getAccountChange("30100");   // 자본금
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
    const cashAccountIds = cashCodes
      .map((c) => cfAccountMap.get(c)?.id)
      .filter((id): id is string => !!id);

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

  // 비교 손익계산서: 전기 vs 당기
  async comparativeIncomeStatement(
    tenantId: string,
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string,
  ) {
    const [current, previous] = await Promise.all([
      this.incomeStatement(tenantId, currentStart, currentEnd),
      this.incomeStatement(tenantId, previousStart, previousEnd),
    ]);

    // 계정별 병합 (코드 기준)
    const accountMap = new Map<string, {
      type: string; code: string; name: string;
      currentAmount: number; previousAmount: number;
    }>();

    for (const r of current.revenue) {
      accountMap.set(r.code, {
        type: "REVENUE", code: r.code, name: r.name,
        currentAmount: r.amount, previousAmount: 0,
      });
    }
    for (const r of current.expense) {
      accountMap.set(r.code, {
        type: "EXPENSE", code: r.code, name: r.name,
        currentAmount: r.amount, previousAmount: 0,
      });
    }
    for (const r of previous.revenue) {
      const existing = accountMap.get(r.code);
      if (existing) {
        existing.previousAmount = r.amount;
      } else {
        accountMap.set(r.code, {
          type: "REVENUE", code: r.code, name: r.name,
          currentAmount: 0, previousAmount: r.amount,
        });
      }
    }
    for (const r of previous.expense) {
      const existing = accountMap.get(r.code);
      if (existing) {
        existing.previousAmount = r.amount;
      } else {
        accountMap.set(r.code, {
          type: "EXPENSE", code: r.code, name: r.name,
          currentAmount: 0, previousAmount: r.amount,
        });
      }
    }

    const rows = Array.from(accountMap.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((r) => ({
        ...r,
        difference: r.currentAmount - r.previousAmount,
        changeRate: r.previousAmount !== 0
          ? Math.round(((r.currentAmount - r.previousAmount) / Math.abs(r.previousAmount)) * 10000) / 100
          : null,
      }));

    return {
      rows,
      currentTotal: {
        revenue: current.totalRevenue,
        expense: current.totalExpense,
        netIncome: current.netIncome,
      },
      previousTotal: {
        revenue: previous.totalRevenue,
        expense: previous.totalExpense,
        netIncome: previous.netIncome,
      },
    };
  }

  // 비교 대차대조표: 전기 vs 당기
  async comparativeBalanceSheet(
    tenantId: string,
    currentEnd: string,
    previousEnd: string,
  ) {
    const [current, previous] = await Promise.all([
      this.balanceSheet(tenantId, undefined, currentEnd),
      this.balanceSheet(tenantId, undefined, previousEnd),
    ]);

    // 계정별 병합 헬퍼
    const mergeRows = (
      currentRows: { code: string; name: string; amount: number }[],
      previousRows: { code: string; name: string; amount: number }[],
      section: string,
    ) => {
      const map = new Map<string, {
        section: string; code: string; name: string;
        currentAmount: number; previousAmount: number;
      }>();

      for (const r of currentRows) {
        map.set(r.code, {
          section, code: r.code, name: r.name,
          currentAmount: r.amount, previousAmount: 0,
        });
      }
      for (const r of previousRows) {
        const existing = map.get(r.code);
        if (existing) {
          existing.previousAmount = r.amount;
        } else {
          map.set(r.code, {
            section, code: r.code, name: r.name,
            currentAmount: 0, previousAmount: r.amount,
          });
        }
      }

      return Array.from(map.values())
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((r) => ({
          ...r,
          difference: r.currentAmount - r.previousAmount,
          changeRate: r.previousAmount !== 0
            ? Math.round(((r.currentAmount - r.previousAmount) / Math.abs(r.previousAmount)) * 10000) / 100
            : null,
        }));
    };

    const calcTotal = (
      currentVal: number,
      previousVal: number,
    ) => ({
      current: currentVal,
      previous: previousVal,
      difference: currentVal - previousVal,
      changeRate: previousVal !== 0
        ? Math.round(((currentVal - previousVal) / Math.abs(previousVal)) * 10000) / 100
        : null,
    });

    return {
      currentAssets: mergeRows(current.currentAssets, previous.currentAssets, "currentAssets"),
      nonCurrentAssets: mergeRows(current.nonCurrentAssets, previous.nonCurrentAssets, "nonCurrentAssets"),
      currentLiabilities: mergeRows(current.currentLiabilities, previous.currentLiabilities, "currentLiabilities"),
      nonCurrentLiabilities: mergeRows(current.nonCurrentLiabilities, previous.nonCurrentLiabilities, "nonCurrentLiabilities"),
      equity: mergeRows(current.equity, previous.equity, "equity"),
      totals: {
        totalCurrentAssets: calcTotal(current.totalCurrentAssets, previous.totalCurrentAssets),
        totalNonCurrentAssets: calcTotal(current.totalNonCurrentAssets, previous.totalNonCurrentAssets),
        totalAssets: calcTotal(current.totalAssets, previous.totalAssets),
        totalCurrentLiabilities: calcTotal(current.totalCurrentLiabilities, previous.totalCurrentLiabilities),
        totalNonCurrentLiabilities: calcTotal(current.totalNonCurrentLiabilities, previous.totalNonCurrentLiabilities),
        totalLiabilities: calcTotal(current.totalLiabilities, previous.totalLiabilities),
        totalEquity: calcTotal(current.totalEquity, previous.totalEquity),
        retainedEarnings: calcTotal(current.retainedEarnings, previous.retainedEarnings),
        totalLiabilitiesAndEquity: calcTotal(current.totalLiabilitiesAndEquity, previous.totalLiabilitiesAndEquity),
      },
    };
  }

  // 현금출납장: 현금 계정(10100) 입출금 내역
  async cashBook(tenantId: string, startDate?: string, endDate?: string) {
    // 현금 계정 자동 조회
    const account = await this.prisma.account.findFirstOrThrow({
      where: { tenantId, code: "10100" },
    });

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

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
        // 현금은 DEBIT normal balance: 차변 - 대변
        return sum + debit - credit;
      }, 0);
    }

    // 기간 내 거래 조회 (거래처 정보 포함)
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
        vendor: { select: { name: true } },
        journalEntry: {
          select: {
            id: true,
            date: true,
            description: true,
            exchangeRate: true,
            lines: {
              select: {
                debit: true,
                credit: true,
                account: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let runningBalance = openingBalance;
    let totalIncome = 0;
    let totalExpense = 0;

    const entries = lines.map((l) => {
      const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
      const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
      const income = debit;   // 차변 = 입금
      const expense = credit; // 대변 = 출금
      totalIncome += income;
      totalExpense += expense;
      runningBalance += income - expense;

      // 상대계정 찾기: 같은 전표에서 반대 방향의 다른 계정
      const isDebitSide = debit > 0;
      const counterparts = l.journalEntry.lines.filter((ol) => {
        if (ol.account.code === account.code) return false;
        return isDebitSide ? Number(ol.credit) > 0 : Number(ol.debit) > 0;
      });

      let counterpartCode = "";
      let counterpartName = "";
      if (counterparts.length === 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = counterparts[0].account.name;
      } else if (counterparts.length > 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = "제";
      }

      return {
        date: new Date(l.journalEntry.date).toISOString().slice(0, 10),
        journalEntryId: l.journalEntry.id,
        description: l.journalEntry.description || "",
        counterpartCode,
        counterpartName,
        vendorName: l.vendor?.name || null,
        income,
        expense,
        balance: runningBalance,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
      },
      openingBalance,
      entries,
      closingBalance: runningBalance,
      totalIncome,
      totalExpense,
    };
  }

  // 분개장: 모든 전표를 일자순으로 나열
  async journalBook(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        status: "POSTED",
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const entries = journalEntries.map((je) => {
      const lines = je.lines.map((l) => {
        const debit = Number(l.debit) * Number(je.exchangeRate);
        const credit = Number(l.credit) * Number(je.exchangeRate);
        return {
          accountCode: l.account.code,
          accountName: l.account.name,
          vendorName: l.vendor?.name ?? null,
          debit,
          credit,
        };
      });

      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
      grandTotalDebit += totalDebit;
      grandTotalCredit += totalCredit;

      return {
        id: je.id,
        date: je.date.toISOString().slice(0, 10),
        description: je.description ?? "",
        lines,
        totalDebit,
        totalCredit,
      };
    });

    return {
      entries,
      grandTotalDebit,
      grandTotalCredit,
      entryCount: entries.length,
    };
  }

  // 거래처별 매출/매입 현황
  async vendorSummary(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    // POSTED 상태이며 vendorId가 있는 JournalLine 조회
    const lines = await this.prisma.journalLine.findMany({
      where: {
        vendorId: { not: null },
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        journalEntry: { select: { exchangeRate: true } },
        account: { select: { type: true } },
        vendor: { select: { id: true, name: true, bizNo: true } },
      },
    });

    // 거래처별 집계
    const vendorMap = new Map<string, {
      vendorId: string;
      vendorName: string;
      bizNo: string | null;
      salesAmount: number;
      purchaseAmount: number;
      transactionCount: number;
      journalEntryIds: Set<string>;
    }>();

    for (const line of lines) {
      if (!line.vendor) continue;

      const vid = line.vendor.id;
      if (!vendorMap.has(vid)) {
        vendorMap.set(vid, {
          vendorId: vid,
          vendorName: line.vendor.name,
          bizNo: line.vendor.bizNo,
          salesAmount: 0,
          purchaseAmount: 0,
          transactionCount: 0,
          journalEntryIds: new Set(),
        });
      }

      const entry = vendorMap.get(vid)!;
      const rate = Number(line.journalEntry.exchangeRate);

      if (line.account.type === "REVENUE") {
        // 매출: 대변(credit) 합계
        entry.salesAmount += Number(line.credit) * rate;
      } else if (line.account.type === "EXPENSE") {
        // 매입: 차변(debit) 합계
        entry.purchaseAmount += Number(line.debit) * rate;
      }

      entry.journalEntryIds.add(line.journalEntryId);
    }

    const vendors = Array.from(vendorMap.values()).map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      bizNo: v.bizNo,
      salesAmount: v.salesAmount,
      purchaseAmount: v.purchaseAmount,
      netAmount: v.salesAmount - v.purchaseAmount,
      transactionCount: v.journalEntryIds.size,
    }));

    // 매출 내림차순 정렬
    vendors.sort((a, b) => b.salesAmount - a.salesAmount);

    return {
      vendors,
      totalSales: vendors.reduce((sum, v) => sum + v.salesAmount, 0),
      totalPurchase: vendors.reduce((sum, v) => sum + v.purchaseAmount, 0),
      totalNet: vendors.reduce((sum, v) => sum + v.netAmount, 0),
    };
  }

  // 감가상각 명세서
  async depreciationSchedule(tenantId: string, year: number) {
    // ACTIVE + FULLY_DEPRECIATED 자산 조회
    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId,
        status: { in: ["ACTIVE", "FULLY_DEPRECIATED"] },
      },
      include: {
        assetAccount: { select: { code: true, name: true } },
        depreciationRecords: { orderBy: { period: "asc" } },
      },
      orderBy: { acquisitionDate: "asc" },
    });

    const yearStr = String(year);
    const prevYearEnd = `${year - 1}-12`; // 전기말 기준

    const assetRows = assets.map((asset) => {
      const acquisitionCost = Number(asset.acquisitionCost);
      const residualValue = Number(asset.residualValue);
      const usefulLifeMonths = asset.usefulLifeMonths;
      const method = asset.depreciationMethod;

      // 전기말 상각누계액: year 이전 마지막 record의 accumulatedAmount
      const prevRecords = asset.depreciationRecords.filter(
        (r) => r.period <= prevYearEnd,
      );
      const lastPrevRecord = prevRecords.length > 0 ? prevRecords[prevRecords.length - 1] : null;
      const prevAccumulatedDep = lastPrevRecord
        ? Number(lastPrevRecord.accumulatedAmount)
        : 0;

      // 전기말 장부가액
      const prevBookValue = acquisitionCost - prevAccumulatedDep;

      // 당기 상각액: 해당 year의 DepreciationRecord amount 합계
      const currentYearRecords = asset.depreciationRecords.filter(
        (r) => r.period >= `${year}-01` && r.period <= `${year}-12`,
      );
      const currentYearDep = currentYearRecords.reduce(
        (sum, r) => sum + Number(r.amount),
        0,
      );

      // 당기말 상각누계액 = 전기말 + 당기
      const currentAccumulatedDep = prevAccumulatedDep + currentYearDep;

      // 당기말 장부가액
      const currentBookValue = acquisitionCost - currentAccumulatedDep;

      // 상각률 계산
      let depRate = 0;
      if (method === "STRAIGHT_LINE" && usefulLifeMonths > 0) {
        depRate = Math.round((12 / usefulLifeMonths) * 10000) / 100; // %
      } else if (method === "DECLINING_BALANCE" && usefulLifeMonths > 0) {
        const usefulLifeYears = usefulLifeMonths / 12;
        const safeResidual = Math.max(residualValue, acquisitionCost * 0.05);
        depRate =
          Math.round(
            (1 - Math.pow(safeResidual / acquisitionCost, 1 / usefulLifeYears)) * 10000,
          ) / 100;
      }

      return {
        id: asset.id,
        name: asset.name,
        assetAccountCode: asset.assetAccount.code,
        assetAccountName: asset.assetAccount.name,
        acquisitionDate: asset.acquisitionDate.toISOString().split("T")[0],
        acquisitionCost,
        usefulLifeMonths,
        depreciationMethod: method,
        residualValue,
        prevAccumulatedDep,
        prevBookValue,
        currentYearDep,
        currentAccumulatedDep,
        currentBookValue,
        depRate,
        status: asset.status,
      };
    });

    // 합계
    const totals = {
      acquisitionCost: assetRows.reduce((s, a) => s + a.acquisitionCost, 0),
      prevAccumulatedDep: assetRows.reduce((s, a) => s + a.prevAccumulatedDep, 0),
      prevBookValue: assetRows.reduce((s, a) => s + a.prevBookValue, 0),
      currentYearDep: assetRows.reduce((s, a) => s + a.currentYearDep, 0),
      currentAccumulatedDep: assetRows.reduce((s, a) => s + a.currentAccumulatedDep, 0),
      currentBookValue: assetRows.reduce((s, a) => s + a.currentBookValue, 0),
    };

    return {
      year,
      assets: assetRows,
      totals,
    };
  }
}
