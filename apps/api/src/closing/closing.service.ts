import { Injectable, BadRequestException, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { JournalService } from "../journal/journal.service";

@Injectable()
export class ClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => JournalService))
    private readonly journalService: JournalService,
  ) {}

  // 마감 이력 조회
  async findAll(tenantId: string) {
    return this.prisma.accountingPeriod.findMany({
      where: { tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  // 특정 날짜가 마감된 기간인지 확인
  async isClosedPeriod(tenantId: string, date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = await this.prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    return period?.status === "CLOSED";
  }

  // 월 마감
  async close(tenantId: string, year: number, month: number, userId: string) {
    // 해당 월 범위
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 미처리 전표 확인 (DRAFT, PENDING_APPROVAL만 차단, APPROVED/POSTED는 허용)
    const pendingCount = await this.prisma.journalEntry.count({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
        status: { in: ["DRAFT", "PENDING_APPROVAL"] },
      },
    });

    if (pendingCount > 0) {
      throw new BadRequestException(
        `${year}년 ${month}월에 미처리 전표가 ${pendingCount}건 있습니다. 임시/결재중 전표를 처리한 후 마감하세요.`,
      );
    }

    // 기존 기간 조회 또는 생성
    const existing = await this.prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });

    if (existing?.status === "CLOSED") {
      throw new BadRequestException("이미 마감된 기간입니다");
    }

    let period;
    if (existing) {
      period = await this.prisma.accountingPeriod.update({
        where: { id: existing.id },
        data: { status: "CLOSED", closedAt: new Date(), closedBy: userId },
      });
    } else {
      period = await this.prisma.accountingPeriod.create({
        data: {
          tenantId,
          year,
          month,
          status: "CLOSED",
          closedAt: new Date(),
          closedBy: userId,
        },
      });
    }

    // 감사 로그
    await this.auditLogService.log({
      tenantId,
      userId,
      action: "PERIOD_CLOSED",
      entityType: "AccountingPeriod",
      entityId: period.id,
      description: `${year}년 ${month}월 마감`,
      newValue: { year, month, status: "CLOSED" },
    });

    return period;
  }

  // 마감 취소
  async reopen(id: string, userId: string) {
    const period = await this.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id },
    });

    if (period.status !== "CLOSED") {
      throw new BadRequestException("마감되지 않은 기간입니다");
    }

    const updated = await this.prisma.accountingPeriod.update({
      where: { id },
      data: { status: "OPEN", closedAt: null, closedBy: null },
    });

    // 감사 로그
    await this.auditLogService.log({
      tenantId: period.tenantId,
      userId,
      action: "PERIOD_REOPENED",
      entityType: "AccountingPeriod",
      entityId: id,
      description: `${period.year}년 ${period.month}월 마감 취소`,
      oldValue: { status: "CLOSED" },
      newValue: { status: "OPEN" },
    });

    return updated;
  }

  // 전기분 이월 (연도 결산)
  async carryForward(tenantId: string, fromYear: number, userId: string) {
    const toYear = fromYear + 1;

    // 1. fromYear 12월 마감 확인
    const decPeriod = await this.prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year: fromYear, month: 12 } },
    });
    if (decPeriod?.status !== "CLOSED") {
      throw new BadRequestException(
        `${fromYear}년 12월이 마감되지 않았습니다. 12월 마감 후 이월 처리하세요.`,
      );
    }

    // 2. 이미 이월 처리된 전표 확인
    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId,
        description: { contains: "전기이월" },
        date: new Date(`${toYear}-01-01`),
      },
    });
    if (existing) {
      throw new BadRequestException(
        `${fromYear}년 → ${toYear}년 전기이월이 이미 처리되었습니다.`,
      );
    }

    // 3. fromYear 전체 POSTED 전표의 JournalLine을 계정별로 집계
    const startDate = new Date(`${fromYear}-01-01`);
    const endDate = new Date(`${fromYear}-12-31T23:59:59`);

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: startDate, lte: endDate },
        },
      },
      include: { account: true },
    });

    // 계정별 집계
    const accountBalances = new Map<
      string,
      { accountId: string; code: string; name: string; type: string; debit: number; credit: number }
    >();

    for (const line of journalLines) {
      const key = line.accountId;
      if (!accountBalances.has(key)) {
        accountBalances.set(key, {
          accountId: line.accountId,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          debit: 0,
          credit: 0,
        });
      }
      const acc = accountBalances.get(key)!;
      acc.debit += Number(line.debit);
      acc.credit += Number(line.credit);
    }

    // 4. 계정 유형별 분류
    const carryForwardLines: { accountId: string; debit: number; credit: number }[] = [];
    const profitClosingLines: { accountId: string; debit: number; credit: number }[] = [];
    let assetBalance = 0;
    let liabilityBalance = 0;
    let equityBalance = 0;
    let revenueBalance = 0;
    let expenseBalance = 0;

    for (const acc of accountBalances.values()) {
      const { accountId, type } = acc;

      if (type === "ASSET") {
        // 차변 정상 잔액: debit - credit
        const balance = acc.debit - acc.credit;
        if (Math.abs(balance) > 0.01) {
          assetBalance += balance;
          carryForwardLines.push({
            accountId,
            debit: balance > 0 ? balance : 0,
            credit: balance < 0 ? Math.abs(balance) : 0,
          });
        }
      } else if (type === "LIABILITY") {
        // 대변 정상 잔액: credit - debit
        const balance = acc.credit - acc.debit;
        if (Math.abs(balance) > 0.01) {
          liabilityBalance += balance;
          carryForwardLines.push({
            accountId,
            debit: balance < 0 ? Math.abs(balance) : 0,
            credit: balance > 0 ? balance : 0,
          });
        }
      } else if (type === "EQUITY") {
        // 대변 정상 잔액: credit - debit
        const balance = acc.credit - acc.debit;
        if (Math.abs(balance) > 0.01) {
          equityBalance += balance;
          carryForwardLines.push({
            accountId,
            debit: balance < 0 ? Math.abs(balance) : 0,
            credit: balance > 0 ? balance : 0,
          });
        }
      } else if (type === "REVENUE") {
        // 대변 정상 잔액: credit - debit
        const balance = acc.credit - acc.debit;
        if (Math.abs(balance) > 0.01) {
          revenueBalance += balance;
          // 수익 계정 잔액을 제거 (차변으로)
          profitClosingLines.push({
            accountId,
            debit: balance > 0 ? balance : 0,
            credit: balance < 0 ? Math.abs(balance) : 0,
          });
        }
      } else if (type === "EXPENSE") {
        // 차변 정상 잔액: debit - credit
        const balance = acc.debit - acc.credit;
        if (Math.abs(balance) > 0.01) {
          expenseBalance += balance;
          // 비용 계정 잔액을 제거 (대변으로)
          profitClosingLines.push({
            accountId,
            debit: balance < 0 ? Math.abs(balance) : 0,
            credit: balance > 0 ? balance : 0,
          });
        }
      }
    }

    // 당기순이익 = 수익 - 비용
    const netIncome = revenueBalance - expenseBalance;

    // 이익잉여금 계정(30300) 조회
    const retainedEarningsAccount = await this.prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code: "30300" } },
    });
    if (!retainedEarningsAccount) {
      throw new BadRequestException(
        "이익잉여금 계정(30300)이 존재하지 않습니다. 계정과목을 먼저 등록하세요.",
      );
    }

    // 5. 이월 전표 생성 (toYear-01-01)
    let carryForwardEntry = null;
    if (carryForwardLines.length > 0) {
      carryForwardEntry = await this.journalService.createEntry({
        tenantId,
        date: new Date(`${toYear}-01-01`),
        description: `전기이월 (${fromYear} → ${toYear})`,
        status: "POSTED",
        lines: carryForwardLines,
      });
    }

    // 6. 손익 대체 전표 생성 (fromYear-12-31)
    let profitClosingEntry = null;
    if (profitClosingLines.length > 0) {
      // 이익잉여금 대체 라인 추가
      // netIncome > 0 → 이익잉여금 대변 (순이익)
      // netIncome < 0 → 이익잉여금 차변 (순손실)
      if (Math.abs(netIncome) > 0.01) {
        profitClosingLines.push({
          accountId: retainedEarningsAccount.id,
          debit: netIncome < 0 ? Math.abs(netIncome) : 0,
          credit: netIncome > 0 ? netIncome : 0,
        });
      }

      profitClosingEntry = await this.journalService.createEntry({
        tenantId,
        date: new Date(`${fromYear}-12-31`),
        description: `손익 마감 (${fromYear})`,
        status: "POSTED",
        lines: profitClosingLines,
        skipClosedPeriodCheck: true,
      });
    }

    // 감사 로그
    await this.auditLogService.log({
      tenantId,
      userId,
      action: "CARRY_FORWARD",
      entityType: "JournalEntry",
      entityId: carryForwardEntry?.id || "N/A",
      description: `전기이월 실행: ${fromYear} → ${toYear}`,
      newValue: { fromYear, toYear, assetBalance, liabilityBalance, equityBalance, netIncome },
    });

    return {
      carryForwardEntry,
      profitClosingEntry,
      summary: {
        assetBalance,
        liabilityBalance,
        equityBalance,
        netIncome,
      },
    };
  }

  // 특정 월의 전표 현황 (마감 페이지용)
  async getPeriodSummary(tenantId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [total, posted, draft, approved] = await Promise.all([
      this.prisma.journalEntry.count({
        where: { tenantId, date: { gte: startDate, lte: endDate } },
      }),
      this.prisma.journalEntry.count({
        where: { tenantId, date: { gte: startDate, lte: endDate }, status: "POSTED" },
      }),
      this.prisma.journalEntry.count({
        where: { tenantId, date: { gte: startDate, lte: endDate }, status: "DRAFT" },
      }),
      this.prisma.journalEntry.count({
        where: { tenantId, date: { gte: startDate, lte: endDate }, status: "APPROVED" },
      }),
    ]);

    return { total, posted, draft, approved, unposted: draft + approved };
  }
}
