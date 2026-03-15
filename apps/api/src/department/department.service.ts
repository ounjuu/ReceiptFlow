import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  // 부서 목록
  async getDepartments(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    return departments.map((d) => ({
      ...d,
      budget: d.budget ? Number(d.budget) : null,
    }));
  }

  // 부서 상세
  async getDepartment(id: string) {
    const dept = await this.prisma.department.findUniqueOrThrow({
      where: { id },
    });
    return { ...dept, budget: dept.budget ? Number(dept.budget) : null };
  }

  // 부서 등록
  async createDepartment(dto: CreateDepartmentDto) {
    const exists = await this.prisma.department.findFirst({
      where: { tenantId: dto.tenantId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException("이미 등록된 부서 코드입니다");
    }

    return this.prisma.department.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        manager: dto.manager,
        budget: dto.budget,
      },
    });
  }

  // 부서 수정
  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.manager !== undefined) data.manager = dto.manager;
    if (dto.budget !== undefined) data.budget = dto.budget;

    return this.prisma.department.update({ where: { id }, data });
  }

  // 부서 삭제
  async deleteDepartment(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }

  // 부서별 손익
  async getDepartmentPnL(
    tenantId: string,
    departmentId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    // 해당 부서에 배정된 JournalLine 조회 (POSTED 전표만)
    const lines = await this.prisma.journalLine.findMany({
      where: {
        departmentId,
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        journalEntry: { select: { exchangeRate: true } },
      },
    });

    // 계정별 집계
    const accountMap = new Map<
      string,
      { code: string; name: string; type: string; debit: number; credit: number }
    >();

    for (const line of lines) {
      const key = line.accountId;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          debit: 0,
          credit: 0,
        });
      }
      const acc = accountMap.get(key)!;
      const rate = Number(line.journalEntry.exchangeRate);
      acc.debit += Number(line.debit) * rate;
      acc.credit += Number(line.credit) * rate;
    }

    // 수익/비용 분류
    const revenue = [...accountMap.values()]
      .filter((a) => a.type === "REVENUE")
      .map((a) => ({ code: a.code, name: a.name, amount: a.credit - a.debit }))
      .filter((a) => a.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));

    const expense = [...accountMap.values()]
      .filter((a) => a.type === "EXPENSE")
      .map((a) => ({ code: a.code, name: a.name, amount: a.debit - a.credit }))
      .filter((a) => a.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expense.reduce((s, r) => s + r.amount, 0);
    const netIncome = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0
      ? Math.round((netIncome / totalRevenue) * 1000) / 10
      : 0;

    return {
      revenue,
      totalRevenue,
      expense,
      totalExpense,
      netIncome,
      profitMargin,
    };
  }

  // 전체 부서 손익 비교
  async getDepartmentComparison(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    const results = await Promise.all(
      departments.map(async (d) => {
        const pnl = await this.getDepartmentPnL(tenantId, d.id);
        return {
          id: d.id,
          code: d.code,
          name: d.name,
          manager: d.manager,
          budget: d.budget ? Number(d.budget) : null,
          totalRevenue: pnl.totalRevenue,
          totalExpense: pnl.totalExpense,
          netIncome: pnl.netIncome,
          profitMargin: pnl.profitMargin,
        };
      }),
    );

    return results;
  }
}
