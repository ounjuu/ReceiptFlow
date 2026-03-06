import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ClosingService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 미확정 전표 확인
    const unpostedCount = await this.prisma.journalEntry.count({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
        status: { not: "POSTED" },
      },
    });

    if (unpostedCount > 0) {
      throw new BadRequestException(
        `${year}년 ${month}월에 미확정 전표가 ${unpostedCount}건 있습니다. 모든 전표를 확정한 후 마감하세요.`,
      );
    }

    // 기존 기간 조회 또는 생성
    const existing = await this.prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });

    if (existing?.status === "CLOSED") {
      throw new BadRequestException("이미 마감된 기간입니다");
    }

    if (existing) {
      return this.prisma.accountingPeriod.update({
        where: { id: existing.id },
        data: { status: "CLOSED", closedAt: new Date(), closedBy: userId },
      });
    }

    return this.prisma.accountingPeriod.create({
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

  // 마감 취소
  async reopen(id: string) {
    const period = await this.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id },
    });

    if (period.status !== "CLOSED") {
      throw new BadRequestException("마감되지 않은 기간입니다");
    }

    return this.prisma.accountingPeriod.update({
      where: { id },
      data: { status: "OPEN", closedAt: null, closedBy: null },
    });
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
