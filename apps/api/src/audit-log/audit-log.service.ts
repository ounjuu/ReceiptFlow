import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // 감사 로그 기록
  async log(data: {
    tenantId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    description?: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  // 감사 로그 조회 (필터 + 페이지네이션)
  async findAll(
    tenantId: string,
    filters?: {
      action?: string;
      entityType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (filters?.action) where.action = filters.action;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: new Date(filters.startDate) }),
        ...(filters.endDate && { lte: new Date(filters.endDate + "T23:59:59") }),
      };
    }

    const take = filters?.limit || 50;
    const skip = filters?.offset || 0;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }
}
