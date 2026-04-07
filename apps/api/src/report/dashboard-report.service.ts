import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FinancialReportService } from "./financial-report.service";

@Injectable()
export class DashboardReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialReport: FinancialReportService,
  ) {}

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
    const income = await this.financialReport.incomeStatement(
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
}
