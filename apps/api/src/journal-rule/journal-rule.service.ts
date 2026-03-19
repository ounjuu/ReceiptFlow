import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class JournalRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tenantId: string;
    name: string;
    vendorName?: string;
    keywords?: string;
    amountMin?: number;
    amountMax?: number;
    debitAccountId: string;
    creditAccountId: string;
    priority?: number;
  }) {
    return this.prisma.journalRule.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        vendorName: data.vendorName || null,
        keywords: data.keywords || null,
        amountMin: data.amountMin ?? null,
        amountMax: data.amountMax ?? null,
        debitAccountId: data.debitAccountId,
        creditAccountId: data.creditAccountId,
        priority: data.priority ?? 0,
      },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.journalRule.findMany({
      where: { tenantId },
      orderBy: { priority: "desc" },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });
  }

  async update(id: string, data: {
    name?: string;
    vendorName?: string;
    keywords?: string;
    amountMin?: number | null;
    amountMax?: number | null;
    debitAccountId?: string;
    creditAccountId?: string;
    priority?: number;
    enabled?: boolean;
  }) {
    const rule = await this.prisma.journalRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("규칙을 찾을 수 없습니다");

    return this.prisma.journalRule.update({
      where: { id },
      data,
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });
  }

  async remove(id: string) {
    const rule = await this.prisma.journalRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("규칙을 찾을 수 없습니다");

    await this.prisma.journalRule.delete({ where: { id } });
    return { success: true };
  }

  // 규칙 매칭: 거래처명 + 금액 + OCR 텍스트로 최우선 규칙 반환
  async matchRule(
    tenantId: string,
    vendorName?: string | null,
    amount?: number | null,
    ocrText?: string | null,
  ): Promise<{ debitAccountId: string; creditAccountId: string } | null> {
    const rules = await this.prisma.journalRule.findMany({
      where: { tenantId, enabled: true },
      orderBy: { priority: "desc" },
    });

    for (const rule of rules) {
      // 거래처명 매칭 (포함 검사)
      if (rule.vendorName && vendorName) {
        if (!vendorName.includes(rule.vendorName)) continue;
      } else if (rule.vendorName && !vendorName) {
        continue;
      }

      // 금액 범위 매칭
      if (amount != null) {
        if (rule.amountMin && new Decimal(amount).lessThan(rule.amountMin)) continue;
        if (rule.amountMax && new Decimal(amount).greaterThan(rule.amountMax)) continue;
      } else if (rule.amountMin || rule.amountMax) {
        continue;
      }

      // 키워드 매칭 (쉼표 구분, OCR 텍스트에 포함 여부)
      if (rule.keywords) {
        const kws = rule.keywords.split(",").map((k) => k.trim().toLowerCase());
        const text = (ocrText || vendorName || "").toLowerCase();
        const matched = kws.some((kw) => kw && text.includes(kw));
        if (!matched) continue;
      }

      return {
        debitAccountId: rule.debitAccountId,
        creditAccountId: rule.creditAccountId,
      };
    }

    return null;
  }
}
