import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  // 조립품의 BOM 조회
  async getBom(parentId: string) {
    const parent = await this.prisma.product.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new NotFoundException("제품을 찾을 수 없습니다");

    const items = await this.prisma.bomItem.findMany({
      where: { parentId },
      include: { child: { select: { id: true, code: true, name: true, unit: true, currentStock: true, avgCost: true } } },
      orderBy: { createdAt: "asc" },
    });

    const totalCost = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.child.avgCost),
      0,
    );

    return { parent, items, totalCost };
  }

  // BOM 항목 추가
  async addItem(parentId: string, data: { childId: string; quantity: number; unit?: string; note?: string }) {
    if (parentId === data.childId) {
      throw new BadRequestException("자기 자신을 부품으로 등록할 수 없습니다");
    }

    const existing = await this.prisma.bomItem.findUnique({
      where: { parentId_childId: { parentId, childId: data.childId } },
    });
    if (existing) {
      throw new BadRequestException("이미 등록된 부품입니다");
    }

    return this.prisma.bomItem.create({
      data: {
        parentId,
        childId: data.childId,
        quantity: data.quantity,
        unit: data.unit,
        note: data.note,
      },
      include: { child: { select: { id: true, code: true, name: true, unit: true, currentStock: true, avgCost: true } } },
    });
  }

  // BOM 항목 수정 (수량/메모)
  async updateItem(itemId: string, data: { quantity?: number; unit?: string; note?: string }) {
    return this.prisma.bomItem.update({
      where: { id: itemId },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.note !== undefined && { note: data.note }),
      },
      include: { child: { select: { id: true, code: true, name: true, unit: true, currentStock: true, avgCost: true } } },
    });
  }

  // BOM 항목 삭제
  async removeItem(itemId: string) {
    return this.prisma.bomItem.delete({ where: { id: itemId } });
  }

  // 자재소요량 계산 (생산 수량 기준)
  async calculateRequirement(parentId: string, productionQty: number) {
    const items = await this.prisma.bomItem.findMany({
      where: { parentId },
      include: { child: { select: { id: true, code: true, name: true, unit: true, currentStock: true, avgCost: true } } },
    });

    return items.map((item) => {
      const requiredQty = Number(item.quantity) * productionQty;
      const currentStock = item.child.currentStock;
      const shortage = Math.max(0, requiredQty - currentStock);
      const cost = requiredQty * Number(item.child.avgCost);

      return {
        childId: item.child.id,
        code: item.child.code,
        name: item.child.name,
        unit: item.unit || item.child.unit,
        unitQty: Number(item.quantity),
        requiredQty,
        currentStock,
        shortage,
        unitCost: Number(item.child.avgCost),
        totalCost: cost,
      };
    });
  }

  // BOM이 있는 제품 목록 (조립품)
  async getAssemblyProducts(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, bomParent: { some: {} } },
      include: { _count: { select: { bomParent: true } } },
      orderBy: { code: "asc" },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      partCount: p._count.bomParent,
    }));
  }
}
