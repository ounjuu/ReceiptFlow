import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JournalService } from "../journal/journal.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class JournalTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.journalTemplate.findMany({
      where: { tenantId },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            vendor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.journalTemplate.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            vendor: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!template) throw new NotFoundException("템플릿을 찾을 수 없습니다");
    return template;
  }

  async create(
    dto: {
      tenantId: string;
      name: string;
      description?: string;
      lines: { accountId: string; vendorId?: string; debit: number; credit: number }[];
    },
    userId?: string,
  ) {
    this.validateBalance(dto.lines);

    const template = await this.prisma.journalTemplate.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        description: dto.description,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            vendorId: l.vendorId || null,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lines: true },
    });

    if (userId) {
      await this.auditLogService.log({
        tenantId: dto.tenantId,
        userId,
        action: "TEMPLATE_CREATED",
        entityType: "JournalTemplate",
        entityId: template.id,
        description: `템플릿 생성: ${dto.name}`,
      });
    }

    return template;
  }

  async update(
    id: string,
    dto: { name?: string; description?: string; lines?: { accountId: string; vendorId?: string; debit: number; credit: number }[] },
    userId?: string,
  ) {
    const existing = await this.findOne(id);

    if (dto.lines) {
      this.validateBalance(dto.lines);
    }

    const template = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.journalTemplateLine.deleteMany({ where: { journalTemplateId: id } });
      }

      return tx.journalTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.lines && {
            lines: {
              create: dto.lines.map((l) => ({
                accountId: l.accountId,
                vendorId: l.vendorId || null,
                debit: l.debit,
                credit: l.credit,
              })),
            },
          }),
        },
        include: { lines: true },
      });
    });

    if (userId) {
      await this.auditLogService.log({
        tenantId: existing.tenantId,
        userId,
        action: "TEMPLATE_UPDATED",
        entityType: "JournalTemplate",
        entityId: id,
        description: `템플릿 수정: ${template.name}`,
      });
    }

    return template;
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id);

    await this.prisma.journalTemplate.delete({ where: { id } });

    if (userId) {
      await this.auditLogService.log({
        tenantId: existing.tenantId,
        userId,
        action: "TEMPLATE_DELETED",
        entityType: "JournalTemplate",
        entityId: id,
        description: `템플릿 삭제: ${existing.name}`,
      });
    }
  }

  async apply(id: string, tenantId: string, date: string, userId?: string) {
    const template = await this.findOne(id);

    const journal = await this.journalService.create(
      {
        tenantId,
        date,
        description: `[템플릿] ${template.name}`,
        lines: template.lines.map((l) => ({
          accountId: l.accountId,
          vendorId: l.vendorId || undefined,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      },
      userId,
    );

    return journal;
  }

  private validateBalance(lines: { debit: number; credit: number }[]) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException("차변과 대변의 합계가 일치하지 않습니다");
    }
    if (totalDebit === 0) {
      throw new BadRequestException("금액을 입력해주세요");
    }
  }
}
