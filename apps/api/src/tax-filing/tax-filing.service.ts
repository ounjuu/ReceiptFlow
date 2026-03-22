import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTaxFilingDto } from "./dto/update-tax-filing.dto";

@Injectable()
export class TaxFilingService {
  constructor(private readonly prisma: PrismaService) {}

  // 신고 목록 조회 (필터)
  async findAll(tenantId: string, filingType?: string, year?: number, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (filingType) where.filingType = filingType;
    if (year) where.year = year;
    if (status) where.status = status;

    const filings = await this.prisma.taxFiling.findMany({
      where,
      orderBy: [{ year: "desc" }, { period: "desc" }],
    });

    return filings.map((f) => ({
      ...f,
      taxableAmount: Number(f.taxableAmount),
      taxAmount: Number(f.taxAmount),
    }));
  }

  // 단건 조회
  async findOne(id: string) {
    const filing = await this.prisma.taxFiling.findUnique({ where: { id } });
    if (!filing) throw new NotFoundException("신고 데이터를 찾을 수 없습니다");
    return {
      ...filing,
      taxableAmount: Number(filing.taxableAmount),
      taxAmount: Number(filing.taxAmount),
    };
  }

  // 신고 데이터 수정
  async update(id: string, dto: UpdateTaxFilingDto) {
    const existing = await this.prisma.taxFiling.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("신고 데이터를 찾을 수 없습니다");

    if (existing.status === "FILED" || existing.status === "ACCEPTED") {
      throw new BadRequestException("이미 신고 완료된 데이터는 수정할 수 없습니다");
    }

    const data: Record<string, unknown> = {};
    if (dto.filingData !== undefined) {
      // 기존 filingData와 병합
      const currentData = (existing.filingData as Record<string, unknown>) || {};
      data.filingData = { ...currentData, ...dto.filingData };
    }
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.filingReference !== undefined) data.filingReference = dto.filingReference;

    const updated = await this.prisma.taxFiling.update({ where: { id }, data });
    return {
      ...updated,
      taxableAmount: Number(updated.taxableAmount),
      taxAmount: Number(updated.taxAmount),
    };
  }

  // 상태 전이 (검증 포함)
  async updateStatus(id: string, status: string, filingReference?: string) {
    const existing = await this.prisma.taxFiling.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("신고 데이터를 찾을 수 없습니다");

    // 상태 전이 규칙
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["GENERATED"],
      GENERATED: ["EXPORTED", "DRAFT"],
      EXPORTED: ["FILED", "GENERATED"],
      FILED: ["ACCEPTED", "REJECTED"],
      ACCEPTED: [],
      REJECTED: ["GENERATED", "DRAFT"],
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `상태를 ${existing.status}에서 ${status}(으)로 변경할 수 없습니다`,
      );
    }

    const data: Record<string, unknown> = { status };
    if (status === "EXPORTED") data.exportedAt = new Date();
    if (status === "FILED") data.filedAt = new Date();
    if (filingReference) data.filingReference = filingReference;

    const updated = await this.prisma.taxFiling.update({ where: { id }, data });
    return {
      ...updated,
      taxableAmount: Number(updated.taxableAmount),
      taxAmount: Number(updated.taxAmount),
    };
  }

  // 연간 신고 요약
  async getSummary(tenantId: string, year: number) {
    const filings = await this.prisma.taxFiling.findMany({
      where: { tenantId, year },
      orderBy: [{ filingType: "asc" }, { period: "asc" }],
    });

    const vatFilings = filings.filter((f) => f.filingType === "VAT");
    const withholdingFilings = filings.filter((f) => f.filingType === "WITHHOLDING");
    const corporateFilings = filings.filter((f) => f.filingType === "CORPORATE");

    const summarize = (list: typeof filings) => ({
      count: list.length,
      totalTaxableAmount: list.reduce((s, f) => s + Number(f.taxableAmount), 0),
      totalTaxAmount: list.reduce((s, f) => s + Number(f.taxAmount), 0),
      filings: list.map((f) => ({
        id: f.id,
        period: f.period,
        status: f.status,
        taxableAmount: Number(f.taxableAmount),
        taxAmount: Number(f.taxAmount),
      })),
    });

    return {
      year,
      vat: summarize(vatFilings),
      withholding: summarize(withholdingFilings),
      corporate: summarize(corporateFilings),
    };
  }

  // DRAFT 상태만 삭제 가능
  async delete(id: string) {
    const existing = await this.prisma.taxFiling.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("신고 데이터를 찾을 수 없습니다");
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("DRAFT 상태의 신고만 삭제할 수 있습니다");
    }
    return this.prisma.taxFiling.delete({ where: { id } });
  }
}
