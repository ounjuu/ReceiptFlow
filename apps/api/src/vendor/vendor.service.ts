import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.vendor.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  // 사업자등록번호로 거래처 검색 (정확 일치)
  async findByBizNo(tenantId: string, bizNo: string) {
    return this.prisma.vendor.findFirst({
      where: { tenantId, bizNo },
    });
  }

  // 사업자등록번호 부분검색 (자동완성용)
  async searchByBizNoPartial(tenantId: string, query: string) {
    return this.prisma.vendor.findMany({
      where: {
        tenantId,
        bizNo: { contains: query },
      },
      take: 10,
      orderBy: { name: "asc" },
    });
  }

  // 사업자등록번호로 조회 → 없으면 자동 생성
  async findOrCreate(tenantId: string, bizNo: string, name: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: { tenantId, bizNo },
    });
    if (existing) return existing;

    return this.prisma.vendor.create({
      data: { tenantId, bizNo, name },
    });
  }

  // 거래처별 잔액 요약
  async getBalanceSummary(tenantId: string) {
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: { status: "POSTED", tenantId },
          },
          include: {
            journalEntry: { select: { exchangeRate: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const rows = vendors.map((v) => {
      const totalDebit = v.journalLines.reduce(
        (sum, l) => sum + Number(l.debit) * Number(l.journalEntry.exchangeRate),
        0,
      );
      const totalCredit = v.journalLines.reduce(
        (sum, l) => sum + Number(l.credit) * Number(l.journalEntry.exchangeRate),
        0,
      );
      return {
        vendorId: v.id,
        name: v.name,
        bizNo: v.bizNo,
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
      };
    });

    // 잔액이 0인 거래처 제외
    const filtered = rows.filter((r) => Math.abs(r.balance) >= 0.01);

    const totalReceivable = filtered
      .filter((r) => r.balance > 0)
      .reduce((s, r) => s + r.balance, 0);
    const totalPayable = filtered
      .filter((r) => r.balance < 0)
      .reduce((s, r) => s + Math.abs(r.balance), 0);

    return {
      vendors: filtered,
      totalReceivable,
      totalPayable,
      netBalance: totalReceivable - totalPayable,
    };
  }

  // 거래처 원장 (개별 거래처 거래 내역)
  async getVendorLedger(
    tenantId: string,
    vendorId: string,
    startDate?: string,
    endDate?: string,
  ) {
    // 기초잔액 (기간 이전)
    const beforeFilter: Record<string, unknown> = {};
    if (startDate) {
      beforeFilter.lt = new Date(startDate);
    }

    const beforeLines = await this.prisma.journalLine.findMany({
      where: {
        vendorId,
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(beforeFilter).length > 0 && { date: beforeFilter }),
        },
      },
      include: { journalEntry: { select: { exchangeRate: true } } },
    });

    const openingBalance = beforeLines.reduce(
      (sum, l) =>
        sum + (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
      0,
    );

    // 기간 내 거래
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const lines = await this.prisma.journalLine.findMany({
      where: {
        vendorId,
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        journalEntry: { select: { date: true, description: true, exchangeRate: true } },
        account: { select: { code: true, name: true } },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let runningBalance = openingBalance;
    const entries = lines.map((l) => {
      const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
      const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
      runningBalance += debit - credit;
      return {
        date: l.journalEntry.date,
        description: l.journalEntry.description || "",
        accountCode: l.account.code,
        accountName: l.account.name,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    return {
      openingBalance,
      entries,
      totalDebit,
      totalCredit,
      closingBalance: openingBalance + totalDebit - totalCredit,
    };
  }

  async findOne(id: string) {
    return this.prisma.vendor.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateVendorDto) {
    // 같은 테넌트 내 사업자번호 중복 체크
    if (dto.bizNo) {
      const exists = await this.prisma.vendor.findFirst({
        where: { tenantId: dto.tenantId, bizNo: dto.bizNo },
      });
      if (exists) {
        throw new ConflictException("이미 등록된 사업자등록번호입니다");
      }
    }

    return this.prisma.vendor.create({
      data: {
        name: dto.name,
        bizNo: dto.bizNo,
        tenantId: dto.tenantId,
      },
    });
  }

  async update(id: string, dto: UpdateVendorDto) {
    return this.prisma.vendor.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.vendor.delete({ where: { id } });
  }
}
