import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  // 프로젝트 목록
  async getProjects(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    return projects.map((p) => ({
      ...p,
      budget: p.budget ? Number(p.budget) : null,
    }));
  }

  // 프로젝트 상세
  async getProject(id: string) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
    });
    return { ...project, budget: project.budget ? Number(project.budget) : null };
  }

  // 프로젝트 등록
  async createProject(dto: CreateProjectDto) {
    const exists = await this.prisma.project.findFirst({
      where: { tenantId: dto.tenantId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException("이미 등록된 프로젝트 코드입니다");
    }

    return this.prisma.project.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        manager: dto.manager,
        budget: dto.budget,
      },
    });
  }

  // 프로젝트 수정
  async updateProject(id: string, dto: UpdateProjectDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.manager !== undefined) data.manager = dto.manager;
    if (dto.budget !== undefined) data.budget = dto.budget;

    return this.prisma.project.update({ where: { id }, data });
  }

  // 프로젝트 삭제
  async deleteProject(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }

  // 프로젝트별 손익
  async getProjectPnL(
    tenantId: string,
    projectId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    // 해당 프로젝트에 배정된 JournalLine 조회 (POSTED 전표만)
    const lines = await this.prisma.journalLine.findMany({
      where: {
        projectId,
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

  // 전체 프로젝트 손익 비교
  async getProjectComparison(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    const results = await Promise.all(
      projects.map(async (p) => {
        const pnl = await this.getProjectPnL(tenantId, p.id);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          budget: p.budget ? Number(p.budget) : null,
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
