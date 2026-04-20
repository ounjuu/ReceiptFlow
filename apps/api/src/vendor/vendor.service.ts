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

  // 일괄 등록
  async batchCreate(tenantId: string, items: { name: string; bizNo?: string }[]) {
    const results: { index: number; status: string; error?: string; data?: any }[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        if (!item.name) {
          results.push({ index: i, status: "error", error: `${i + 1}행: 거래처명은 필수입니다` });
          continue;
        }
        if (item.bizNo) {
          const exists = await this.prisma.vendor.findFirst({
            where: { tenantId, bizNo: item.bizNo },
          });
          if (exists) {
            results.push({ index: i, status: "error", error: `${i + 1}행: 사업자번호 ${item.bizNo} 이미 등록됨` });
            continue;
          }
        }
        const vendor = await this.prisma.vendor.create({
          data: { tenantId, name: item.name, bizNo: item.bizNo || null },
        });
        results.push({ index: i, status: "success", data: vendor });
      } catch (err: any) {
        results.push({ index: i, status: "error", error: `${i + 1}행: ${err?.message || "등록 실패"}` });
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    return { total: items.length, success, failed: items.length - success, results };
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
        creditRating: dto.creditRating,
        creditLimit: dto.creditLimit ?? 0,
        note: dto.note,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        address: dto.address,
        category: dto.category,
        tenantId: dto.tenantId,
      },
    });
  }

  // 신용한도 체크: 현재 채권잔액이 한도를 초과하는지 확인
  async checkCreditLimit(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || Number(vendor.creditLimit) === 0) {
      return { exceeded: false, balance: 0, limit: 0, available: 0 };
    }

    const lines = await this.prisma.journalLine.findMany({
      where: {
        vendorId,
        journalEntry: { status: "POSTED", tenantId },
      },
      select: { debit: true, credit: true },
    });

    const balance = lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    const limit = Number(vendor.creditLimit);
    return {
      exceeded: balance > limit,
      balance,
      limit,
      available: Math.max(0, limit - balance),
    };
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

  // ── CRM: 메모/활동 히스토리 ──

  async getMemos(vendorId: string) {
    return this.prisma.vendorMemo.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });
  }

  async addMemo(vendorId: string, data: { content: string; memoType?: string; userId?: string; userName?: string }) {
    return this.prisma.vendorMemo.create({
      data: {
        vendorId,
        content: data.content,
        memoType: data.memoType || "NOTE",
        userId: data.userId,
        userName: data.userName,
      },
    });
  }

  async deleteMemo(memoId: string) {
    return this.prisma.vendorMemo.delete({ where: { id: memoId } });
  }

  // 거래처 상세 (CRM 정보 + 최근 메모 + 거래 요약)
  async getDetail(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        memos: { orderBy: { createdAt: "desc" }, take: 20 },
        trades: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, tradeNo: true, tradeType: true, tradeDate: true, totalAmount: true, status: true } },
        taxInvoices: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, invoiceNo: true, invoiceType: true, invoiceDate: true, totalAmount: true } },
      },
    });
    return vendor;
  }
}
