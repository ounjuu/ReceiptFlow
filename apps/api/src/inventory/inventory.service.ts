import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JournalService } from "../journal/journal.service";
import { CreateInventoryTxDto } from "./dto/create-inventory-tx.dto";
import { nextSequenceNumber } from "../common/sequence.util";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  // 자동 채번 (IV-YYYYMMDD-NNN)
  private async generateTxNo(tenantId: string, txDate: string): Promise<string> {
    const prefix = `IV-${txDate.replace(/-/g, "")}-`;

    const last = await this.prisma.inventoryTransaction.findFirst({
      where: { tenantId, txNo: { startsWith: prefix } },
      orderBy: { txNo: "desc" },
    });

    return nextSequenceNumber(prefix, last?.txNo, 3);
  }

  // 요약 통계
  async getSummary(tenantId: string) {
    const products = await this.prisma.product.findMany({ where: { tenantId } });

    const totalProducts = products.length;
    const totalStockValue = products.reduce(
      (sum, p) => sum + p.currentStock * Number(p.avgCost),
      0,
    );
    const lowStockCount = products.filter(
      (p) => p.safetyStock > 0 && p.currentStock < p.safetyStock,
    ).length;
    const zeroStockCount = products.filter((p) => p.currentStock === 0).length;

    return { totalProducts, totalStockValue, lowStockCount, zeroStockCount };
  }

  // 현재 재고 목록
  async getStock(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      unit: p.unit,
      currentStock: p.currentStock,
      avgCost: Number(p.avgCost),
      stockValue: p.currentStock * Number(p.avgCost),
      safetyStock: p.safetyStock,
      isLow: p.safetyStock > 0 && p.currentStock < p.safetyStock,
    }));
  }

  // 안전재고 미달 목록
  async getStockLow(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        safetyStock: { gt: 0 },
      },
      orderBy: { code: "asc" },
    });

    return products
      .filter((p) => p.currentStock < p.safetyStock)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        currentStock: p.currentStock,
        safetyStock: p.safetyStock,
        shortage: p.safetyStock - p.currentStock,
        avgCost: Number(p.avgCost),
      }));
  }

  // 재고 평가 (품목별 수량 × 이동평균단가)
  async getValuation(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    const items = products
      .filter((p) => p.currentStock > 0)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        currentStock: p.currentStock,
        avgCost: Number(p.avgCost),
        valuationAmount: p.currentStock * Number(p.avgCost),
      }));

    const totalValuation = items.reduce((sum, i) => sum + i.valuationAmount, 0);

    return { items, totalValuation };
  }

  // 입출고 이력 조회
  async getTransactions(
    tenantId: string,
    filters: { productId?: string; txType?: string; startDate?: string; endDate?: string },
  ) {
    const where: Prisma.InventoryTransactionWhereInput = { tenantId };
    if (filters.productId) where.productId = filters.productId;
    if (filters.txType) where.txType = filters.txType;
    if (filters.startDate || filters.endDate) {
      const txDate: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) txDate.gte = new Date(filters.startDate);
      if (filters.endDate) txDate.lte = new Date(filters.endDate);
      where.txDate = txDate;
    }

    const txs = await this.prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return txs.map((t) => ({
      ...t,
      unitCost: Number(t.unitCost),
      totalCost: Number(t.totalCost),
    }));
  }

  // 수동 입고/출고/조정 등록
  async createTransaction(dto: CreateInventoryTxDto) {
    if (!["IN", "OUT", "ADJUST"].includes(dto.txType)) {
      throw new BadRequestException("txType은 IN, OUT, ADJUST 중 하나여야 합니다");
    }
    if (dto.quantity <= 0 && dto.txType !== "ADJUST") {
      throw new BadRequestException("수량은 0보다 커야 합니다");
    }

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("품목을 찾을 수 없습니다");

    const txNo = await this.generateTxNo(dto.tenantId, dto.txDate);
    const beforeStock = product.currentStock;
    const currentAvgCost = Number(product.avgCost);
    const totalCost = dto.quantity * dto.unitCost;

    let afterStock: number;
    let newAvgCost: number;

    if (dto.txType === "IN") {
      // 입고: 이동평균법 재계산
      afterStock = beforeStock + dto.quantity;
      if (afterStock > 0) {
        newAvgCost =
          (beforeStock * currentAvgCost + dto.quantity * dto.unitCost) / afterStock;
      } else {
        newAvgCost = dto.unitCost;
      }
    } else if (dto.txType === "OUT") {
      // 출고: 재고 부족 검사
      if (beforeStock < dto.quantity) {
        throw new BadRequestException(
          `재고 부족: 현재 ${beforeStock}개, 출고 요청 ${dto.quantity}개`,
        );
      }
      afterStock = beforeStock - dto.quantity;
      newAvgCost = currentAvgCost; // 출고 시 평균단가 변동 없음
    } else {
      // 조정: 실사 반영 (quantity = 실사 수량)
      afterStock = dto.quantity;
      newAvgCost = dto.unitCost > 0 ? dto.unitCost : currentAvgCost;
    }

    // 전표 자동 생성
    let journalEntryId: string | undefined;
    const inventoryAccount = await this.prisma.account.findFirst({
      where: { tenantId: dto.tenantId, code: "14100" },
    });

    if (inventoryAccount && dto.txType !== "ADJUST") {
      let debitAccountId: string;
      let creditAccountId: string;

      if (dto.txType === "IN") {
        // 입고: DR 상품(14100) / CR 매입채무(21100) or 현금
        const creditAccount = await this.prisma.account.findFirst({
          where: { tenantId: dto.tenantId, code: "21100" },
        });
        if (creditAccount) {
          debitAccountId = inventoryAccount.id;
          creditAccountId = creditAccount.id;
        } else {
          debitAccountId = inventoryAccount.id;
          creditAccountId = inventoryAccount.id; // fallback
        }
      } else {
        // 출고: DR 매출원가(50200) / CR 상품(14100)
        const debitAccount = await this.prisma.account.findFirst({
          where: { tenantId: dto.tenantId, code: "50200" },
        });
        if (debitAccount) {
          debitAccountId = debitAccount.id;
          creditAccountId = inventoryAccount.id;
        } else {
          debitAccountId = inventoryAccount.id;
          creditAccountId = inventoryAccount.id; // fallback
        }
      }

      if (debitAccountId !== creditAccountId) {
        const costAmount = dto.txType === "OUT" ? dto.quantity * currentAvgCost : totalCost;
        const entry = await this.journalService.createEntry({
          tenantId: dto.tenantId,
          date: new Date(dto.txDate),
          description: `재고 ${dto.txType === "IN" ? "입고" : "출고"}: ${product.name} ${dto.quantity}${product.unit || "개"} (${txNo})`,
          status: "POSTED",
          lines: [
            { accountId: debitAccountId, debit: costAmount, credit: 0 },
            { accountId: creditAccountId, debit: 0, credit: costAmount },
          ],
        });
        journalEntryId = entry.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const invTx = await tx.inventoryTransaction.create({
        data: {
          tenantId: dto.tenantId,
          txNo,
          txType: dto.txType,
          txDate: new Date(dto.txDate),
          productId: dto.productId,
          quantity: dto.txType === "ADJUST" ? dto.quantity - beforeStock : dto.quantity,
          unitCost: dto.unitCost,
          totalCost,
          reason: dto.reason,
          tradeId: dto.tradeId,
          journalEntryId,
          beforeStock,
          afterStock,
        },
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: {
          currentStock: afterStock,
          avgCost: Math.round(newAvgCost * 100) / 100,
        },
      });

      return {
        ...invTx,
        unitCost: Number(invTx.unitCost),
        totalCost: Number(invTx.totalCost),
      };
    });
  }

  // 삭제 (최근 건만)
  async deleteTransaction(id: string) {
    const tx = await this.prisma.inventoryTransaction.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!tx) throw new NotFoundException("입출고 내역을 찾을 수 없습니다");

    // 최근 거래인지 확인 (해당 품목의 가장 최근 거래)
    const latest = await this.prisma.inventoryTransaction.findFirst({
      where: { productId: tx.productId },
      orderBy: { createdAt: "desc" },
    });
    if (latest && latest.id !== id) {
      throw new BadRequestException("가장 최근 거래만 삭제할 수 있습니다");
    }

    return this.prisma.$transaction(async (prisma) => {
      // 재고 복원
      await prisma.product.update({
        where: { id: tx.productId },
        data: { currentStock: tx.beforeStock },
      });

      // 연결 전표 삭제
      if (tx.journalEntryId) {
        await prisma.journalEntry.delete({ where: { id: tx.journalEntryId } });
      }

      await prisma.inventoryTransaction.delete({ where: { id } });

      return { success: true };
    });
  }
}
