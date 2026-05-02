import { Injectable, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JournalService } from "../journal/journal.service";
import { CreateExpenseClaimDto } from "./dto/create-expense-claim.dto";
import { UpdateExpenseClaimDto } from "./dto/update-expense-claim.dto";
import { nextSequenceNumber } from "../common/sequence.util";
import { throwNotFound } from "../common/errors";

@Injectable()
export class ExpenseClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  // 자동 채번 (EC-YYYYMMDD-NNN)
  private async generateClaimNo(tenantId: string, claimDate: string): Promise<string> {
    const prefix = `EC-${claimDate.replace(/-/g, "")}-`;

    const last = await this.prisma.expenseClaim.findFirst({
      where: { tenantId, claimNo: { startsWith: prefix } },
      orderBy: { claimNo: "desc" },
    });

    return nextSequenceNumber(prefix, last?.claimNo, 3);
  }

  // 목록 조회
  async findAll(
    tenantId: string,
    filters: { status?: string; employeeId?: string; startDate?: string; endDate?: string },
  ) {
    const where: Prisma.ExpenseClaimWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.startDate || filters.endDate) {
      const claimDate: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) claimDate.gte = new Date(filters.startDate);
      if (filters.endDate) claimDate.lte = new Date(filters.endDate);
      where.claimDate = claimDate;
    }

    const claims = await this.prisma.expenseClaim.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeNo: true, department: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return claims.map((c) => ({
      ...c,
      totalAmount: Number(c.totalAmount),
      items: c.items.map((i) => ({ ...i, amount: Number(i.amount) })),
    }));
  }

  // 상세 조회
  async findOne(id: string) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true, department: true } },
        items: { orderBy: { expenseDate: "asc" } },
        journalEntry: { include: { lines: { include: { account: true } } } },
      },
    });

    if (!claim) throwNotFound("경비 정산을 찾을 수 없습니다");

    return {
      ...claim,
      totalAmount: Number(claim.totalAmount),
      items: claim.items.map((i) => ({ ...i, amount: Number(i.amount) })),
    };
  }

  // 생성 (DRAFT)
  async create(dto: CreateExpenseClaimDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("항목이 최소 1개 이상 필요합니다");
    }

    const claimNo = await this.generateClaimNo(dto.tenantId, dto.claimDate);
    const totalAmount = dto.items.reduce((sum, i) => sum + i.amount, 0);

    const claim = await this.prisma.expenseClaim.create({
      data: {
        tenantId: dto.tenantId,
        claimNo,
        employeeId: dto.employeeId,
        title: dto.title,
        claimDate: new Date(dto.claimDate),
        totalAmount,
        memo: dto.memo,
        items: {
          create: dto.items.map((i) => ({
            category: i.category,
            description: i.description,
            amount: i.amount,
            expenseDate: new Date(i.expenseDate),
            receiptUrl: i.receiptUrl,
          })),
        },
      },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        items: true,
      },
    });

    return {
      ...claim,
      totalAmount: Number(claim.totalAmount),
      items: claim.items.map((i) => ({ ...i, amount: Number(i.amount) })),
    };
  }

  // 수정 (DRAFT만)
  async update(id: string, dto: UpdateExpenseClaimDto) {
    const existing = await this.prisma.expenseClaim.findUnique({ where: { id } });
    if (!existing) throwNotFound("경비 정산을 찾을 수 없습니다");
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("임시저장 상태에서만 수정할 수 있습니다");
    }

    const totalAmount = dto.items
      ? dto.items.reduce((sum, i) => sum + i.amount, 0)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      // 항목 전체 교체
      if (dto.items) {
        await tx.expenseClaimItem.deleteMany({ where: { expenseClaimId: id } });
        await tx.expenseClaimItem.createMany({
          data: dto.items.map((i) => ({
            expenseClaimId: id,
            category: i.category,
            description: i.description,
            amount: i.amount,
            expenseDate: new Date(i.expenseDate),
            receiptUrl: i.receiptUrl,
          })),
        });
      }

      const data: Record<string, unknown> = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.claimDate !== undefined) data.claimDate = new Date(dto.claimDate);
      if (dto.memo !== undefined) data.memo = dto.memo;
      if (totalAmount !== undefined) data.totalAmount = totalAmount;

      await tx.expenseClaim.update({ where: { id }, data });

      return this.findOne(id);
    });
  }

  // 삭제 (DRAFT만)
  async remove(id: string) {
    const existing = await this.prisma.expenseClaim.findUnique({ where: { id } });
    if (!existing) throwNotFound("경비 정산을 찾을 수 없습니다");
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("임시저장 상태에서만 삭제할 수 있습니다");
    }

    await this.prisma.expenseClaim.delete({ where: { id } });
    return { success: true };
  }

  // 결재 요청 (DRAFT → PENDING_APPROVAL)
  async submit(id: string) {
    const existing = await this.prisma.expenseClaim.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throwNotFound("경비 정산을 찾을 수 없습니다");
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("임시저장 상태에서만 결재 요청할 수 있습니다");
    }
    if (existing.items.length === 0) {
      throw new BadRequestException("항목이 없으면 결재 요청할 수 없습니다");
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: "PENDING_APPROVAL" },
    });
  }

  // 정산 처리 (APPROVED → SETTLED, 전표 생성)
  async settle(
    id: string,
    debitAccountCode: string = "50800",
    creditAccountCode: string = "25300",
  ) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!claim) throwNotFound("경비 정산을 찾을 수 없습니다");
    if (claim.status !== "APPROVED") {
      throw new BadRequestException("승인 상태에서만 정산할 수 있습니다");
    }

    // 계정 조회
    const debitAccount = await this.prisma.account.findFirst({
      where: { tenantId: claim.tenantId, code: debitAccountCode },
    });
    if (!debitAccount) {
      throw new BadRequestException(`차변 계정(${debitAccountCode})을 찾을 수 없습니다`);
    }

    const creditAccount = await this.prisma.account.findFirst({
      where: { tenantId: claim.tenantId, code: creditAccountCode },
    });
    if (!creditAccount) {
      throw new BadRequestException(`대변 계정(${creditAccountCode})을 찾을 수 없습니다`);
    }

    const totalAmount = Number(claim.totalAmount);

    return this.prisma.$transaction(async (tx) => {
      // 전표 생성
      const entry = await this.journalService.createEntry({
        tenantId: claim.tenantId,
        date: new Date(),
        description: `경비 정산: ${claim.title} (${claim.claimNo})`,
        lines: [
          { accountId: debitAccount.id, debit: totalAmount, credit: 0 },
          { accountId: creditAccount.id, debit: 0, credit: totalAmount },
        ],
        tx,
      });

      // 경비 정산 상태 업데이트
      await tx.expenseClaim.update({
        where: { id },
        data: {
          status: "SETTLED",
          settledAt: new Date(),
          journalEntryId: entry.id,
        },
      });

      return this.findOne(id);
    });
  }

  // 요약 통계
  async getSummary(tenantId: string) {
    const claims = await this.prisma.expenseClaim.findMany({
      where: { tenantId },
    });

    const draft = claims.filter((c) => c.status === "DRAFT").length;
    const pending = claims.filter((c) => c.status === "PENDING_APPROVAL").length;
    const approved = claims.filter((c) => c.status === "APPROVED").length;
    const settled = claims.filter((c) => c.status === "SETTLED").length;
    const rejected = claims.filter((c) => c.status === "REJECTED").length;
    const totalSettled = claims
      .filter((c) => c.status === "SETTLED")
      .reduce((sum, c) => sum + Number(c.totalAmount), 0);
    const totalPending = claims
      .filter((c) => ["PENDING_APPROVAL", "APPROVED"].includes(c.status))
      .reduce((sum, c) => sum + Number(c.totalAmount), 0);

    return { draft, pending, approved, settled, rejected, totalSettled, totalPending };
  }
}
