import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JournalService } from "../journal/journal.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@Injectable()
export class TradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  // 계정 코드로 계정 ID 조회
  private async getAccountId(tenantId: string, code: string): Promise<string> {
    const account = await this.prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!account) {
      throw new BadRequestException(`계정과목(${code})이 존재하지 않습니다`);
    }
    return account.id;
  }

  // 거래번호 자동 채번
  private async generateTradeNo(
    tenantId: string,
    tradeType: string,
  ): Promise<string> {
    const prefix = tradeType === "SALES" ? "SL" : "PU";
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const count = await this.prisma.trade.count({
      where: {
        tenantId,
        tradeNo: { startsWith: `${prefix}-${today}` },
      },
    });
    return `${prefix}-${today}-${String(count + 1).padStart(3, "0")}`;
  }

  // 목록 조회
  async getTrades(
    tenantId: string,
    tradeType?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (tradeType) where.tradeType = tradeType;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.tradeDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + "T23:59:59") }),
      };
    }

    const trades = await this.prisma.trade.findMany({
      where,
      include: {
        vendor: true,
        items: true,
        _count: { select: { payments: true } },
      },
      orderBy: { tradeDate: "desc" },
    });

    return trades.map((t) => ({
      ...t,
      supplyAmount: Number(t.supplyAmount),
      taxAmount: Number(t.taxAmount),
      totalAmount: Number(t.totalAmount),
      paidAmount: Number(t.paidAmount),
      items: t.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        amount: Number(i.amount),
      })),
    }));
  }

  // 상세 조회
  async getTrade(id: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!trade) throw new NotFoundException("거래를 찾을 수 없습니다");

    return {
      ...trade,
      supplyAmount: Number(trade.supplyAmount),
      taxAmount: Number(trade.taxAmount),
      totalAmount: Number(trade.totalAmount),
      paidAmount: Number(trade.paidAmount),
      items: trade.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        amount: Number(i.amount),
      })),
      payments: trade.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }

  // 거래 등록
  async createTrade(dto: CreateTradeDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("품목이 최소 1건 이상 필요합니다");
    }

    const tradeNo = await this.generateTradeNo(dto.tenantId, dto.tradeType);

    // 품목 금액 계산
    const itemsData = dto.items.map((item) => {
      const amount = item.quantity * item.unitPrice;
      return {
        itemName: item.itemName,
        specification: item.specification,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount,
        note: item.note,
      };
    });

    const supplyAmount = itemsData.reduce((s, i) => s + i.amount, 0);
    const taxAmount = Math.round(supplyAmount * 0.1); // 부가세 10%
    const totalAmount = supplyAmount + taxAmount;

    return this.prisma.trade.create({
      data: {
        tenantId: dto.tenantId,
        tradeType: dto.tradeType,
        tradeNo,
        tradeDate: new Date(dto.tradeDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        vendorId: dto.vendorId,
        supplyAmount,
        taxAmount,
        totalAmount,
        description: dto.description,
        note: dto.note,
        items: { create: itemsData },
      },
      include: { vendor: true, items: true },
    });
  }

  // 거래 수정 (DRAFT만)
  async updateTrade(id: string, dto: UpdateTradeDto) {
    const trade = await this.prisma.trade.findUnique({ where: { id } });
    if (!trade) throw new NotFoundException("거래를 찾을 수 없습니다");
    if (trade.status !== "DRAFT") {
      throw new BadRequestException("임시 상태의 거래만 수정할 수 있습니다");
    }

    const data: Record<string, unknown> = {};
    if (dto.tradeDate) data.tradeDate = new Date(dto.tradeDate);
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.note !== undefined) data.note = dto.note;

    // 품목 변경 시
    if (dto.items && dto.items.length > 0) {
      const itemsData = dto.items.map((item) => {
        const amount = item.quantity * item.unitPrice;
        return {
          itemName: item.itemName,
          specification: item.specification,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount,
          note: item.note,
        };
      });

      const supplyAmount = itemsData.reduce((s, i) => s + i.amount, 0);
      const taxAmount = Math.round(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;

      return this.prisma.$transaction(async (tx) => {
        await tx.tradeItem.deleteMany({ where: { tradeId: id } });
        return tx.trade.update({
          where: { id },
          data: {
            ...data,
            supplyAmount,
            taxAmount,
            totalAmount,
            items: { create: itemsData },
          },
          include: { vendor: true, items: true },
        });
      });
    }

    return this.prisma.trade.update({
      where: { id },
      data,
      include: { vendor: true, items: true },
    });
  }

  // 거래 삭제 (DRAFT만)
  async deleteTrade(id: string) {
    const trade = await this.prisma.trade.findUnique({ where: { id } });
    if (!trade) throw new NotFoundException("거래를 찾을 수 없습니다");
    if (trade.status !== "DRAFT") {
      throw new BadRequestException("임시 상태의 거래만 삭제할 수 있습니다");
    }
    return this.prisma.trade.delete({ where: { id } });
  }

  // 거래 확정 → 자동 전표 생성
  async confirmTrade(id: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!trade) throw new NotFoundException("거래를 찾을 수 없습니다");
    if (trade.status !== "DRAFT") {
      throw new BadRequestException("임시 상태의 거래만 확정할 수 있습니다");
    }

    const tenantId = trade.tenantId;
    const supplyAmount = Number(trade.supplyAmount);
    const taxAmount = Number(trade.taxAmount);
    const totalAmount = Number(trade.totalAmount);

    // 매출/매입 모두에 필요한 계정코드를 일괄 조회 (N+1 방지)
    const neededCodes = trade.tradeType === "SALES"
      ? ["10800", "40100", "25500"]  // 매출채권, 매출, 부가세예수금
      : ["50100", "13500", "20100"]; // 매입원가, 부가세대급금, 매입채무

    const neededAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: neededCodes } },
    });
    const acctMap = new Map(neededAccounts.map((a) => [a.code, a.id]));

    // 누락된 계정 체크
    for (const code of neededCodes) {
      if (!acctMap.has(code)) {
        throw new BadRequestException(`계정과목(${code})이 존재하지 않습니다`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let journalLines: {
        accountId: string;
        vendorId: string;
        debit: number;
        credit: number;
      }[];

      if (trade.tradeType === "SALES") {
        // 매출 확정: 차변 매출채권, 대변 매출+부가세예수금
        journalLines = [
          {
            accountId: acctMap.get("10800")!,
            vendorId: trade.vendorId,
            debit: totalAmount,
            credit: 0,
          },
          {
            accountId: acctMap.get("40100")!,
            vendorId: trade.vendorId,
            debit: 0,
            credit: supplyAmount,
          },
          {
            accountId: acctMap.get("25500")!,
            vendorId: trade.vendorId,
            debit: 0,
            credit: taxAmount,
          },
        ];
      } else {
        // 매입 확정: 차변 매입비용+부가세대급금, 대변 매입채무
        journalLines = [
          {
            accountId: acctMap.get("50100")!,
            vendorId: trade.vendorId,
            debit: supplyAmount,
            credit: 0,
          },
          {
            accountId: acctMap.get("13500")!,
            vendorId: trade.vendorId,
            debit: taxAmount,
            credit: 0,
          },
          {
            accountId: acctMap.get("20100")!,
            vendorId: trade.vendorId,
            debit: 0,
            credit: totalAmount,
          },
        ];
      }

      // 전표 생성
      const journal = await this.journalService.createEntry({
        tenantId,
        date: trade.tradeDate,
        description: `${trade.tradeType === "SALES" ? "매출" : "매입"} 확정 - ${trade.tradeNo} (${trade.vendor.name})`,
        lines: journalLines,
        tx,
      });

      // 거래 상태 변경
      const updated = await tx.trade.update({
        where: { id },
        data: { status: "CONFIRMED", journalEntryId: journal.id },
        include: { vendor: true, items: true },
      });

      return {
        ...updated,
        supplyAmount: Number(updated.supplyAmount),
        taxAmount: Number(updated.taxAmount),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
      };
    });
  }

  // 거래 취소
  async cancelTrade(id: string) {
    const trade = await this.prisma.trade.findUnique({ where: { id } });
    if (!trade) throw new NotFoundException("거래를 찾을 수 없습니다");
    if (trade.status === "CANCELLED") {
      throw new BadRequestException("이미 취소된 거래입니다");
    }
    if (trade.status === "PAID") {
      throw new BadRequestException(
        "완납된 거래는 취소할 수 없습니다. 입금/출금을 먼저 삭제하세요",
      );
    }

    return this.prisma.trade.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { vendor: true },
    });
  }

  // 입금/출금 추가
  async addPayment(tradeId: string, dto: CreatePaymentDto) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { vendor: true },
    });
    if (!trade) throw new NotFoundException("거래를 찾을 수 없습니다");
    if (!["CONFIRMED", "PARTIAL_PAID"].includes(trade.status)) {
      throw new BadRequestException(
        "확정 또는 부분수금 상태의 거래만 입금/출금 처리할 수 있습니다",
      );
    }

    const remaining = Number(trade.totalAmount) - Number(trade.paidAmount);
    if (dto.amount > remaining) {
      throw new BadRequestException(
        `입금/출금 금액(${dto.amount})이 잔액(${remaining})을 초과합니다`,
      );
    }

    const tenantId = trade.tenantId;

    // 결제수단에 따른 계정
    const paymentAccountCode =
      dto.paymentMethod === "CASH" ? "10100" : "10300"; // 현금 또는 보통예금

    // 필요한 계정코드를 일괄 조회 (N+1 방지)
    const paymentNeededCodes = trade.tradeType === "SALES"
      ? [paymentAccountCode, "10800"]  // 현금/예금, 매출채권
      : ["20100", paymentAccountCode]; // 매입채무, 현금/예금
    const paymentAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: [...new Set(paymentNeededCodes)] } },
    });
    const payAcctMap = new Map(paymentAccounts.map((a) => [a.code, a.id]));

    for (const code of paymentNeededCodes) {
      if (!payAcctMap.has(code)) {
        throw new BadRequestException(`계정과목(${code})이 존재하지 않습니다`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let journalLines: {
        accountId: string;
        vendorId: string;
        debit: number;
        credit: number;
      }[];

      if (trade.tradeType === "SALES") {
        // 매출 입금: 차변 현금/예금, 대변 매출채권
        journalLines = [
          {
            accountId: payAcctMap.get(paymentAccountCode)!,
            vendorId: trade.vendorId,
            debit: dto.amount,
            credit: 0,
          },
          {
            accountId: payAcctMap.get("10800")!,
            vendorId: trade.vendorId,
            debit: 0,
            credit: dto.amount,
          },
        ];
      } else {
        // 매입 출금: 차변 매입채무, 대변 현금/예금
        journalLines = [
          {
            accountId: payAcctMap.get("20100")!,
            vendorId: trade.vendorId,
            debit: dto.amount,
            credit: 0,
          },
          {
            accountId: payAcctMap.get(paymentAccountCode)!,
            vendorId: trade.vendorId,
            debit: 0,
            credit: dto.amount,
          },
        ];
      }

      const methodLabel =
        { CASH: "현금", BANK_TRANSFER: "계좌이체", CARD: "카드", NOTE: "어음" }[
          dto.paymentMethod
        ] || dto.paymentMethod;

      // 전표 생성
      const journal = await this.journalService.createEntry({
        tenantId,
        date: new Date(dto.paymentDate),
        description: `${trade.tradeType === "SALES" ? "매출 입금" : "매입 출금"} - ${trade.tradeNo} (${trade.vendor.name}, ${methodLabel})`,
        lines: journalLines,
        tx,
      });

      // 입금/출금 기록
      const payment = await tx.payment.create({
        data: {
          tenantId,
          tradeId,
          paymentDate: new Date(dto.paymentDate),
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          journalEntryId: journal.id,
          note: dto.note,
        },
      });

      // paidAmount 갱신 + 상태 변경
      const newPaidAmount = Number(trade.paidAmount) + dto.amount;
      const newStatus =
        Math.abs(newPaidAmount - Number(trade.totalAmount)) < 0.01
          ? "PAID"
          : "PARTIAL_PAID";

      await tx.trade.update({
        where: { id: tradeId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });

      return { ...payment, amount: Number(payment.amount) };
    });
  }

  // 입금/출금 삭제
  async deletePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { trade: true },
    });
    if (!payment) throw new NotFoundException("입금/출금 내역을 찾을 수 없습니다");

    return this.prisma.$transaction(async (tx) => {
      // 전표 삭제
      if (payment.journalEntryId) {
        await tx.journalEntry.delete({
          where: { id: payment.journalEntryId },
        });
      }

      // 입금/출금 삭제
      await tx.payment.delete({ where: { id: paymentId } });

      // paidAmount 갱신
      const newPaidAmount =
        Number(payment.trade.paidAmount) - Number(payment.amount);
      const newStatus =
        newPaidAmount <= 0 ? "CONFIRMED" : "PARTIAL_PAID";

      await tx.trade.update({
        where: { id: payment.tradeId },
        data: { paidAmount: Math.max(newPaidAmount, 0), status: newStatus },
      });

      return { success: true };
    });
  }

  // 매출/매입 요약
  async getSummary(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: Record<string, unknown> = {
      tenantId,
      status: { not: "CANCELLED" },
    };
    if (startDate || endDate) {
      where.tradeDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + "T23:59:59") }),
      };
    }

    const trades = await this.prisma.trade.findMany({ where });

    const sales = trades.filter((t) => t.tradeType === "SALES");
    const purchases = trades.filter((t) => t.tradeType === "PURCHASE");

    const totalSales = sales.reduce((s, t) => s + Number(t.totalAmount), 0);
    const salesPaid = sales.reduce((s, t) => s + Number(t.paidAmount), 0);
    const salesRemaining = totalSales - salesPaid;

    const totalPurchase = purchases.reduce(
      (s, t) => s + Number(t.totalAmount),
      0,
    );
    const purchasePaid = purchases.reduce(
      (s, t) => s + Number(t.paidAmount),
      0,
    );
    const purchaseRemaining = totalPurchase - purchasePaid;

    return {
      sales: {
        count: sales.length,
        total: totalSales,
        paid: salesPaid,
        remaining: salesRemaining,
      },
      purchase: {
        count: purchases.length,
        total: totalPurchase,
        paid: purchasePaid,
        remaining: purchaseRemaining,
      },
    };
  }

  // 채권/채무 연령 분석
  async getAgingReport(tenantId: string, tradeType: string) {
    const now = new Date();
    const trades = await this.prisma.trade.findMany({
      where: {
        tenantId,
        tradeType,
        status: { in: ["CONFIRMED", "PARTIAL_PAID"] },
      },
      include: { vendor: true },
    });

    const buckets = {
      current: 0, // 30일 이내
      days30: 0, // 30-60일
      days60: 0, // 60-90일
      days90: 0, // 90일 초과
    };

    const rows = trades.map((t) => {
      const remaining = Number(t.totalAmount) - Number(t.paidAmount);
      const dueDate = t.dueDate || t.tradeDate;
      const daysPast = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let bucket: string;
      if (daysPast <= 30) {
        bucket = "current";
        buckets.current += remaining;
      } else if (daysPast <= 60) {
        bucket = "days30";
        buckets.days30 += remaining;
      } else if (daysPast <= 90) {
        bucket = "days60";
        buckets.days60 += remaining;
      } else {
        bucket = "days90";
        buckets.days90 += remaining;
      }

      return {
        id: t.id,
        tradeNo: t.tradeNo,
        vendorName: t.vendor.name,
        tradeDate: t.tradeDate,
        dueDate: t.dueDate,
        totalAmount: Number(t.totalAmount),
        paidAmount: Number(t.paidAmount),
        remaining,
        daysPast,
        bucket,
      };
    });

    return {
      rows: rows.sort((a, b) => b.daysPast - a.daysPast),
      buckets,
      total: buckets.current + buckets.days30 + buckets.days60 + buckets.days90,
    };
  }
}
