import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { throwNotFound } from "../common/errors";

@Injectable()
export class SummaryCodeService {
  constructor(private readonly prisma: PrismaService) {}

  // 적요 코드 생성
  async create(tenantId: string, data: { code: string; description: string; category?: string }) {
    const existing = await this.prisma.summaryCode.findUnique({
      where: { tenantId_code: { tenantId, code: data.code } },
    });
    if (existing) {
      throw new BadRequestException(`적요 코드 ${data.code}은(는) 이미 존재합니다`);
    }

    return this.prisma.summaryCode.create({
      data: {
        tenantId,
        code: data.code,
        description: data.description,
        category: data.category || "GENERAL",
      },
    });
  }

  // 적요 코드 목록 조회 (카테고리 필터)
  async findAll(tenantId: string, category?: string) {
    return this.prisma.summaryCode.findMany({
      where: {
        tenantId,
        ...(category && { category }),
      },
      orderBy: { code: "asc" },
    });
  }

  // 적요 코드 자동완성 (코드 또는 설명으로 검색)
  async search(tenantId: string, query: string, category?: string) {
    return this.prisma.summaryCode.findMany({
      where: {
        tenantId,
        ...(category && { category }),
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { code: "asc" },
      take: 20,
    });
  }

  // 적요 코드 수정
  async update(id: string, data: { description?: string; category?: string }) {
    const existing = await this.prisma.summaryCode.findUnique({ where: { id } });
    if (!existing) throwNotFound("적요 코드를 찾을 수 없습니다");

    return this.prisma.summaryCode.update({
      where: { id },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
      },
    });
  }

  // 적요 코드 삭제
  async remove(id: string) {
    const existing = await this.prisma.summaryCode.findUnique({ where: { id } });
    if (!existing) throwNotFound("적요 코드를 찾을 수 없습니다");

    return this.prisma.summaryCode.delete({ where: { id } });
  }

  // 일괄 등록 (초기 세팅용)
  async batchCreate(tenantId: string, items: { code: string; description: string; category?: string }[]) {
    const results: { code: string; status: string; error?: string }[] = [];

    for (const item of items) {
      try {
        await this.create(tenantId, item);
        results.push({ code: item.code, status: "success" });
      } catch (err: any) {
        results.push({ code: item.code, status: "error", error: err.message });
      }
    }

    return {
      total: items.length,
      success: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "error").length,
      results,
    };
  }
}
