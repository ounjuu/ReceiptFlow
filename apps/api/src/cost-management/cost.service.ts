import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class CostService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 품목 CRUD ───

  async getProducts(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });
    return products.map((p) => ({
      ...p,
      standardCost: p.standardCost ? Number(p.standardCost) : null,
    }));
  }

  async createProduct(dto: CreateProductDto) {
    const exists = await this.prisma.product.findFirst({
      where: { tenantId: dto.tenantId, code: dto.code },
    });
    if (exists) throw new ConflictException("이미 등록된 품목 코드입니다");

    return this.prisma.product.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        standardCost: dto.standardCost,
        safetyStock: dto.safetyStock ?? 0,
        description: dto.description,
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.standardCost !== undefined) data.standardCost = dto.standardCost;
    if (dto.safetyStock !== undefined) data.safetyStock = dto.safetyStock;
    if (dto.description !== undefined) data.description = dto.description;

    return this.prisma.product.update({ where: { id }, data });
  }

  async deleteProduct(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }

  // ─── 원가 분석 ───

  private buildDateFilter(startDate?: string, endDate?: string) {
    const filter: Record<string, unknown> = {};
    if (startDate) filter.gte = new Date(startDate);
    if (endDate) filter.lte = new Date(endDate + "T23:59:59");
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  // 품목별 원가 분석 (매입 Trade의 TradeItem 기준)
  async analysisByItem(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const trades = await this.prisma.trade.findMany({
      where: {
        tenantId,
        tradeType: "PURCHASE",
        status: { not: "DRAFT" },
        ...(dateFilter && { tradeDate: dateFilter }),
      },
      include: { items: true, vendor: { select: { name: true } } },
    });

    // 품목명 기준 집계
    const itemMap = new Map<
      string,
      { itemName: string; totalQty: number; totalAmount: number; tradeCount: number }
    >();

    for (const trade of trades) {
      for (const item of trade.items) {
        const key = item.itemName;
        if (!itemMap.has(key)) {
          itemMap.set(key, { itemName: key, totalQty: 0, totalAmount: 0, tradeCount: 0 });
        }
        const entry = itemMap.get(key)!;
        entry.totalQty += item.quantity;
        entry.totalAmount += Number(item.amount);
        entry.tradeCount++;
      }
    }

    const items = [...itemMap.values()]
      .map((e) => ({
        ...e,
        avgUnitCost: e.totalQty > 0 ? Math.round(e.totalAmount / e.totalQty) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const totalAmount = items.reduce((s, i) => s + i.totalAmount, 0);

    return { items, totalAmount };
  }

  // 거래처별 원가 분석
  async analysisByVendor(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const trades = await this.prisma.trade.findMany({
      where: {
        tenantId,
        tradeType: "PURCHASE",
        status: { not: "DRAFT" },
        ...(dateFilter && { tradeDate: dateFilter }),
      },
      include: { vendor: { select: { id: true, name: true, bizNo: true } } },
    });

    const vendorMap = new Map<
      string,
      { vendorId: string; vendorName: string; bizNo: string | null; totalAmount: number; tradeCount: number }
    >();

    for (const trade of trades) {
      const key = trade.vendorId;
      if (!vendorMap.has(key)) {
        vendorMap.set(key, {
          vendorId: key,
          vendorName: trade.vendor.name,
          bizNo: trade.vendor.bizNo,
          totalAmount: 0,
          tradeCount: 0,
        });
      }
      const entry = vendorMap.get(key)!;
      entry.totalAmount += Number(trade.supplyAmount);
      entry.tradeCount++;
    }

    const vendors = [...vendorMap.values()].sort((a, b) => b.totalAmount - a.totalAmount);
    const totalAmount = vendors.reduce((s, v) => s + v.totalAmount, 0);

    return { vendors, totalAmount };
  }

  // 프로젝트별 원가 분석 (EXPENSE 계정 JournalLine 기준)
  async analysisByProject(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          ...(dateFilter && { date: dateFilter }),
        },
        account: { type: "EXPENSE" },
        projectId: { not: null },
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        journalEntry: { select: { exchangeRate: true } },
      },
    });

    const projectMap = new Map<
      string,
      { projectId: string; code: string; name: string; totalCost: number }
    >();

    for (const line of lines) {
      if (!line.project) continue;
      const key = line.project.id;
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          projectId: key,
          code: line.project.code,
          name: line.project.name,
          totalCost: 0,
        });
      }
      const rate = Number(line.journalEntry.exchangeRate);
      projectMap.get(key)!.totalCost += (Number(line.debit) - Number(line.credit)) * rate;
    }

    const projects = [...projectMap.values()].sort((a, b) => b.totalCost - a.totalCost);
    const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);

    return { projects, totalCost };
  }

  // 부서별 원가 분석
  async analysisByDepartment(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          ...(dateFilter && { date: dateFilter }),
        },
        account: { type: "EXPENSE" },
        departmentId: { not: null },
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        journalEntry: { select: { exchangeRate: true } },
      },
    });

    const deptMap = new Map<
      string,
      { departmentId: string; code: string; name: string; totalCost: number }
    >();

    for (const line of lines) {
      if (!line.department) continue;
      const key = line.department.id;
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          departmentId: key,
          code: line.department.code,
          name: line.department.name,
          totalCost: 0,
        });
      }
      const rate = Number(line.journalEntry.exchangeRate);
      deptMap.get(key)!.totalCost += (Number(line.debit) - Number(line.credit)) * rate;
    }

    const departments = [...deptMap.values()].sort((a, b) => b.totalCost - a.totalCost);
    const totalCost = departments.reduce((s, d) => s + d.totalCost, 0);

    return { departments, totalCost };
  }

  // 원가 차이 분석 (표준원가 vs 실제원가)
  async analysisVariance(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // 등록된 품목 조회
    const products = await this.prisma.product.findMany({
      where: { tenantId },
    });

    // 매입 거래 품목 조회
    const trades = await this.prisma.trade.findMany({
      where: {
        tenantId,
        tradeType: "PURCHASE",
        status: { not: "DRAFT" },
        ...(dateFilter && { tradeDate: dateFilter }),
      },
      include: { items: true },
    });

    // 품목명 → Product 매핑 (코드 또는 이름 기준)
    const productByName = new Map(products.map((p) => [p.name, p]));

    // 품목별 실적 집계
    const actualMap = new Map<
      string,
      { itemName: string; totalQty: number; totalAmount: number }
    >();

    for (const trade of trades) {
      for (const item of trade.items) {
        const key = item.itemName;
        if (!actualMap.has(key)) {
          actualMap.set(key, { itemName: key, totalQty: 0, totalAmount: 0 });
        }
        const entry = actualMap.get(key)!;
        entry.totalQty += item.quantity;
        entry.totalAmount += Number(item.amount);
      }
    }

    // 차이 분석
    const variances = [...actualMap.values()]
      .map((actual) => {
        const product = productByName.get(actual.itemName);
        const standardCost = product?.standardCost ? Number(product.standardCost) : null;
        const actualUnitCost = actual.totalQty > 0
          ? Math.round(actual.totalAmount / actual.totalQty)
          : 0;
        const standardTotal = standardCost != null ? standardCost * actual.totalQty : null;
        const variance = standardTotal != null ? actual.totalAmount - standardTotal : null;
        const varianceRate = standardTotal != null && standardTotal > 0
          ? Math.round(((actual.totalAmount - standardTotal) / standardTotal) * 1000) / 10
          : null;

        return {
          itemName: actual.itemName,
          productCode: product?.code || null,
          category: product?.category || null,
          unit: product?.unit || null,
          quantity: actual.totalQty,
          standardCost,
          actualUnitCost,
          standardTotal,
          actualTotal: actual.totalAmount,
          variance,
          varianceRate,
        };
      })
      .sort((a, b) => {
        // 차이가 큰 순서
        const av = Math.abs(a.variance ?? 0);
        const bv = Math.abs(b.variance ?? 0);
        return bv - av;
      });

    const totalActual = variances.reduce((s, v) => s + v.actualTotal, 0);
    const totalStandard = variances
      .filter((v) => v.standardTotal != null)
      .reduce((s, v) => s + v.standardTotal!, 0);
    const totalVariance = totalActual - totalStandard;

    return { variances, totalActual, totalStandard, totalVariance };
  }
}
