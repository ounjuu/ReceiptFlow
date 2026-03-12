import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExchangeRateService {
  constructor(private readonly prisma: PrismaService) {}

  // 환율 목록 조회
  async findAll(tenantId: string) {
    return this.prisma.exchangeRate.findMany({
      where: { tenantId },
      orderBy: [{ currency: "asc" }, { date: "desc" }],
    });
  }

  // 환율 등록
  async create(data: { tenantId: string; currency: string; rate: number; date: string }) {
    const existing = await this.prisma.exchangeRate.findUnique({
      where: {
        tenantId_currency_date: {
          tenantId: data.tenantId,
          currency: data.currency,
          date: new Date(data.date),
        },
      },
    });

    if (existing) {
      // 같은 날짜, 같은 통화면 업데이트
      return this.prisma.exchangeRate.update({
        where: { id: existing.id },
        data: { rate: data.rate },
      });
    }

    return this.prisma.exchangeRate.create({
      data: {
        tenantId: data.tenantId,
        currency: data.currency,
        rate: data.rate,
        date: new Date(data.date),
      },
    });
  }

  // 환율 삭제
  async remove(id: string) {
    const rate = await this.prisma.exchangeRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException("환율 정보를 찾을 수 없습니다");
    return this.prisma.exchangeRate.delete({ where: { id } });
  }

  // 특정 통화의 최신 환율 조회
  async getLatest(tenantId: string, currency: string) {
    if (currency === "KRW") {
      return { currency: "KRW", rate: 1, date: new Date() };
    }

    const rate = await this.prisma.exchangeRate.findFirst({
      where: { tenantId, currency },
      orderBy: { date: "desc" },
    });

    if (!rate) {
      throw new NotFoundException(`${currency} 환율 정보가 없습니다. 환율을 먼저 등록해주세요.`);
    }

    return rate;
  }
}
