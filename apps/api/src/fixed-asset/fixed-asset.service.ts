import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";

@Injectable()
export class FixedAssetService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const assets = await this.prisma.fixedAsset.findMany({
      where: { tenantId },
      include: {
        assetAccount: { select: { code: true, name: true } },
        depreciationRecords: { orderBy: { period: "desc" }, take: 1 },
      },
      orderBy: { acquisitionDate: "desc" },
    });

    return assets.map((a) => {
      const lastRecord = a.depreciationRecords[0];
      const accumulatedDep = lastRecord
        ? Number(lastRecord.accumulatedAmount)
        : 0;
      const bookValue = Number(a.acquisitionCost) - accumulatedDep;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        assetAccountCode: a.assetAccount.code,
        assetAccountName: a.assetAccount.name,
        acquisitionDate: a.acquisitionDate,
        acquisitionCost: Number(a.acquisitionCost),
        usefulLifeMonths: a.usefulLifeMonths,
        residualValue: Number(a.residualValue),
        depreciationMethod: a.depreciationMethod,
        status: a.status,
        accumulatedDep,
        bookValue,
      };
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.fixedAsset.findUniqueOrThrow({
      where: { id },
      include: {
        assetAccount: { select: { code: true, name: true } },
        depreciationAccount: { select: { code: true, name: true } },
        accumulatedDepAccount: { select: { code: true, name: true } },
        depreciationRecords: { orderBy: { period: "asc" } },
      },
    });
    return {
      ...asset,
      acquisitionCost: Number(asset.acquisitionCost),
      residualValue: Number(asset.residualValue),
      disposalAmount: asset.disposalAmount
        ? Number(asset.disposalAmount)
        : null,
      depreciationRecords: asset.depreciationRecords.map((r) => ({
        id: r.id,
        period: r.period,
        amount: Number(r.amount),
        accumulatedAmount: Number(r.accumulatedAmount),
        bookValue: Number(r.bookValue),
        journalEntryId: r.journalEntryId,
      })),
    };
  }

  async create(dto: CreateFixedAssetDto) {
    return this.prisma.fixedAsset.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        description: dto.description,
        assetAccountId: dto.assetAccountId,
        depreciationAccountId: dto.depreciationAccountId,
        accumulatedDepAccountId: dto.accumulatedDepAccountId,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: dto.acquisitionCost,
        usefulLifeMonths: dto.usefulLifeMonths,
        residualValue: dto.residualValue || 0,
        depreciationMethod: dto.depreciationMethod,
      },
    });
  }

  async update(id: string, dto: UpdateFixedAssetDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.usefulLifeMonths !== undefined)
      data.usefulLifeMonths = dto.usefulLifeMonths;
    if (dto.residualValue !== undefined) data.residualValue = dto.residualValue;
    if (dto.depreciationMethod !== undefined)
      data.depreciationMethod = dto.depreciationMethod;

    return this.prisma.fixedAsset.update({ where: { id }, data });
  }

  async dispose(
    id: string,
    disposalDate: string,
    disposalAmount: number,
  ) {
    return this.prisma.fixedAsset.update({
      where: { id },
      data: {
        status: "DISPOSED",
        disposalDate: new Date(disposalDate),
        disposalAmount,
      },
    });
  }

  // 단일 자산 월 감가상각액 계산
  calculateMonthlyDepreciation(
    acquisitionCost: number,
    residualValue: number,
    usefulLifeMonths: number,
    method: string,
    currentBookValue: number,
  ): number {
    if (method === "STRAIGHT_LINE") {
      // 정액법: (취득원가 - 잔존가치) / 내용연수(월)
      return (acquisitionCost - residualValue) / usefulLifeMonths;
    }

    if (method === "DECLINING_BALANCE") {
      // 정률법: 기초 장부가액 × 월 상각률
      // 연 상각률 = 1 - (잔존가치/취득원가)^(1/내용연수년)
      const usefulLifeYears = usefulLifeMonths / 12;
      const safeResidual = Math.max(residualValue, acquisitionCost * 0.05);
      const annualRate =
        1 - Math.pow(safeResidual / acquisitionCost, 1 / usefulLifeYears);
      const monthlyRate = annualRate / 12;
      const dep = currentBookValue * monthlyRate;
      // 잔존가치 이하로 내려가지 않도록
      const minBookValue = residualValue;
      if (currentBookValue - dep < minBookValue) {
        return Math.max(currentBookValue - minBookValue, 0);
      }
      return dep;
    }

    throw new BadRequestException(`지원하지 않는 상각방법: ${method}`);
  }

  // 월별 일괄 감가상각 실행
  async runMonthlyDepreciation(
    tenantId: string,
    year: number,
    month: number,
  ) {
    const period = `${year}-${String(month).padStart(2, "0")}`;
    const periodEndDate = new Date(year, month, 0); // 해당 월 말일

    // ACTIVE 상태 자산 조회
    const assets = await this.prisma.fixedAsset.findMany({
      where: { tenantId, status: "ACTIVE" },
      include: {
        depreciationRecords: { orderBy: { period: "desc" } },
      },
    });

    const results: { assetId: string; assetName: string; amount: number }[] =
      [];

    for (const asset of assets) {
      // 이미 해당 월에 처리된 자산 제외
      const alreadyProcessed = asset.depreciationRecords.some(
        (r) => r.period === period,
      );
      if (alreadyProcessed) continue;

      // 취득일 이전 월은 건너뜀
      const acqDate = new Date(asset.acquisitionDate);
      const acqPeriod = `${acqDate.getFullYear()}-${String(acqDate.getMonth() + 1).padStart(2, "0")}`;
      if (period < acqPeriod) continue;

      const acquisitionCost = Number(asset.acquisitionCost);
      const residualValue = Number(asset.residualValue);
      const lastRecord = asset.depreciationRecords[0];
      const currentBookValue = lastRecord
        ? Number(lastRecord.bookValue)
        : acquisitionCost;
      const prevAccumulated = lastRecord
        ? Number(lastRecord.accumulatedAmount)
        : 0;

      // 이미 완전 상각
      if (currentBookValue <= residualValue + 0.01) {
        await this.prisma.fixedAsset.update({
          where: { id: asset.id },
          data: { status: "FULLY_DEPRECIATED" },
        });
        continue;
      }

      const depAmount = this.calculateMonthlyDepreciation(
        acquisitionCost,
        residualValue,
        asset.usefulLifeMonths,
        asset.depreciationMethod,
        currentBookValue,
      );

      if (depAmount <= 0) continue;

      const roundedAmount = Math.round(depAmount * 100) / 100;
      const newAccumulated = prevAccumulated + roundedAmount;
      const newBookValue = acquisitionCost - newAccumulated;

      // 전표 자동 생성 + DepreciationRecord 생성 (트랜잭션)
      await this.prisma.$transaction(async (tx) => {
        // 감가상각 전표 생성 (차변: 감가상각비, 대변: 감가상각누계액)
        const entry = await tx.journalEntry.create({
          data: {
            tenantId,
            date: periodEndDate,
            description: `${asset.name} ${period} 감가상각`,
            status: "POSTED",
            lines: {
              create: [
                {
                  accountId: asset.depreciationAccountId,
                  debit: roundedAmount,
                  credit: 0,
                },
                {
                  accountId: asset.accumulatedDepAccountId,
                  debit: 0,
                  credit: roundedAmount,
                },
              ],
            },
          },
        });

        // 감가상각 기록 생성
        await tx.depreciationRecord.create({
          data: {
            fixedAssetId: asset.id,
            period,
            amount: roundedAmount,
            accumulatedAmount: newAccumulated,
            bookValue: newBookValue,
            journalEntryId: entry.id,
          },
        });

        // 완전 상각 체크
        if (newBookValue <= residualValue + 0.01) {
          await tx.fixedAsset.update({
            where: { id: asset.id },
            data: { status: "FULLY_DEPRECIATED" },
          });
        }
      });

      results.push({
        assetId: asset.id,
        assetName: asset.name,
        amount: roundedAmount,
      });
    }

    return {
      period,
      processedCount: results.length,
      totalAmount: results.reduce((s, r) => s + r.amount, 0),
      details: results,
    };
  }

  // 감가상각 스케줄 (미래 예상 포함)
  async getDepreciationSchedule(assetId: string) {
    const asset = await this.prisma.fixedAsset.findUniqueOrThrow({
      where: { id: assetId },
      include: {
        depreciationRecords: { orderBy: { period: "asc" } },
      },
    });

    const acquisitionCost = Number(asset.acquisitionCost);
    const residualValue = Number(asset.residualValue);
    const usefulLifeMonths = asset.usefulLifeMonths;
    const method = asset.depreciationMethod;

    // 기존 기록
    const existingRecords = asset.depreciationRecords.map((r) => ({
      period: r.period,
      amount: Number(r.amount),
      accumulatedAmount: Number(r.accumulatedAmount),
      bookValue: Number(r.bookValue),
      isActual: true,
    }));

    // 미래 예상 스케줄 생성
    const lastRecord =
      existingRecords.length > 0
        ? existingRecords[existingRecords.length - 1]
        : null;

    let currentBookValue = lastRecord ? lastRecord.bookValue : acquisitionCost;
    let accumulated = lastRecord ? lastRecord.accumulatedAmount : 0;

    // 마지막 기록의 다음 월부터 시작
    let startDate: Date;
    if (lastRecord) {
      const [y, m] = lastRecord.period.split("-").map(Number);
      startDate = new Date(y, m, 1); // 다음 월
    } else {
      const acqDate = new Date(asset.acquisitionDate);
      startDate = new Date(acqDate.getFullYear(), acqDate.getMonth(), 1);
    }

    const projectedRecords: {
      period: string;
      amount: number;
      accumulatedAmount: number;
      bookValue: number;
      isActual: boolean;
    }[] = [];

    // 최대 내용연수만큼 예상 생성
    const maxMonths = usefulLifeMonths - existingRecords.length;
    for (let i = 0; i < maxMonths && currentBookValue > residualValue + 0.01; i++) {
      const year = startDate.getFullYear();
      const month = startDate.getMonth() + 1;
      const period = `${year}-${String(month).padStart(2, "0")}`;

      const depAmount = this.calculateMonthlyDepreciation(
        acquisitionCost,
        residualValue,
        usefulLifeMonths,
        method,
        currentBookValue,
      );

      if (depAmount <= 0) break;

      const roundedAmount = Math.round(depAmount * 100) / 100;
      accumulated += roundedAmount;
      currentBookValue = acquisitionCost - accumulated;

      projectedRecords.push({
        period,
        amount: roundedAmount,
        accumulatedAmount: accumulated,
        bookValue: Math.max(currentBookValue, residualValue),
        isActual: false,
      });

      startDate.setMonth(startDate.getMonth() + 1);
    }

    return {
      assetName: asset.name,
      acquisitionCost,
      residualValue,
      usefulLifeMonths,
      depreciationMethod: method,
      schedule: [...existingRecords, ...projectedRecords],
    };
  }
}
