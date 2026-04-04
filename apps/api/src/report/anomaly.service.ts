import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface AmountAnomaly {
  journalEntryId: string;
  date: string;
  description: string | null;
  accountCode: string;
  accountName: string;
  amount: number;
  average: number;
  stdDev: number;
  deviationRate: number;
}

interface VendorAnomaly {
  journalEntryId: string;
  date: string;
  vendorName: string;
  amount: number;
}

interface TimeAnomaly {
  journalEntryId: string;
  date: string;
  description: string | null;
  dayOfWeek: string;
}

interface DuplicateSuspect {
  journalEntryIds: string[];
  date: string;
  vendorName: string;
  amount: number;
  count: number;
}

export interface AnomalyResult {
  summary: {
    totalAnomalies: number;
    amountAnomalies: number;
    vendorAnomalies: number;
    timeAnomalies: number;
    duplicateSuspects: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  };
  amountAnomalies: AmountAnomaly[];
  vendorAnomalies: VendorAnomaly[];
  timeAnomalies: TimeAnomaly[];
  duplicateSuspects: DuplicateSuspect[];
  analyzedAt: string;
}

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

@Injectable()
export class AnomalyService {
  constructor(private readonly prisma: PrismaService) {}

  async detectAnomalies(tenantId: string): Promise<AnomalyResult> {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 병렬로 4가지 분석 실행
    const [amountAnomalies, vendorAnomalies, timeAnomalies, duplicateSuspects] =
      await Promise.all([
        this.detectAmountAnomalies(tenantId, now, oneMonthAgo, sixMonthsAgo),
        this.detectVendorAnomalies(tenantId, now, oneMonthAgo, sixMonthsAgo),
        this.detectTimeAnomalies(tenantId, now, oneMonthAgo),
        this.detectDuplicateSuspects(tenantId, now, oneMonthAgo),
      ]);

    const totalAnomalies =
      amountAnomalies.length +
      vendorAnomalies.length +
      timeAnomalies.length +
      duplicateSuspects.length;

    let riskLevel: "LOW" | "MEDIUM" | "HIGH";
    if (totalAnomalies >= 6) riskLevel = "HIGH";
    else if (totalAnomalies >= 3) riskLevel = "MEDIUM";
    else riskLevel = "LOW";

    return {
      summary: {
        totalAnomalies,
        amountAnomalies: amountAnomalies.length,
        vendorAnomalies: vendorAnomalies.length,
        timeAnomalies: timeAnomalies.length,
        duplicateSuspects: duplicateSuspects.length,
        riskLevel,
      },
      amountAnomalies,
      vendorAnomalies,
      timeAnomalies,
      duplicateSuspects,
      analyzedAt: now.toISOString(),
    };
  }

  /**
   * A) 금액 이상: 각 계정별 평균/표준편차 기반으로 이상 금액 감지
   */
  private async detectAmountAnomalies(
    tenantId: string,
    now: Date,
    oneMonthAgo: Date,
    sixMonthsAgo: Date,
  ): Promise<AmountAnomaly[]> {
    // 최근 6개월 POSTED 전표 라인 (계정별 집계용)
    const historicalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: sixMonthsAgo, lt: oneMonthAgo },
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true } },
        journalEntry: { select: { id: true, date: true, description: true } },
      },
    });

    // 계정별 금액 통계 계산
    const accountStats = new Map<
      string,
      { code: string; name: string; amounts: number[] }
    >();

    for (const line of historicalLines) {
      const amount = Math.max(Number(line.debit), Number(line.credit));
      if (amount === 0) continue;

      const existing = accountStats.get(line.accountId);
      if (existing) {
        existing.amounts.push(amount);
      } else {
        accountStats.set(line.accountId, {
          code: line.account.code,
          name: line.account.name,
          amounts: [amount],
        });
      }
    }

    // 평균/표준편차 계산
    const statsMap = new Map<
      string,
      { code: string; name: string; average: number; stdDev: number }
    >();

    for (const [accountId, stat] of accountStats) {
      if (stat.amounts.length < 3) continue; // 데이터가 3건 미만이면 skip
      const avg =
        stat.amounts.reduce((s, a) => s + a, 0) / stat.amounts.length;
      const variance =
        stat.amounts.reduce((s, a) => s + (a - avg) ** 2, 0) /
        stat.amounts.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;
      statsMap.set(accountId, {
        code: stat.code,
        name: stat.name,
        average: avg,
        stdDev,
      });
    }

    // 최근 1개월 전표에서 이상 금액 감지
    const recentLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: oneMonthAgo, lte: now },
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true } },
        journalEntry: { select: { id: true, date: true, description: true } },
      },
    });

    const anomalies: AmountAnomaly[] = [];

    for (const line of recentLines) {
      const stats = statsMap.get(line.accountId);
      if (!stats) continue;

      const amount = Math.max(Number(line.debit), Number(line.credit));
      if (amount === 0) continue;

      const deviation = Math.abs(amount - stats.average);
      if (deviation > 2 * stats.stdDev) {
        anomalies.push({
          journalEntryId: line.journalEntry.id,
          date: line.journalEntry.date.toISOString(),
          description: line.journalEntry.description,
          accountCode: stats.code,
          accountName: stats.name,
          amount,
          average: Math.round(stats.average),
          stdDev: Math.round(stats.stdDev),
          deviationRate: Math.round((deviation / stats.stdDev) * 100) / 100,
        });
      }
    }

    // 편차율 높은 순으로 정렬
    anomalies.sort((a, b) => b.deviationRate - a.deviationRate);
    return anomalies;
  }

  /**
   * B) 거래처 이상: 최근 1개월 내 처음 거래하는 거래처 감지
   */
  private async detectVendorAnomalies(
    tenantId: string,
    now: Date,
    oneMonthAgo: Date,
    sixMonthsAgo: Date,
  ): Promise<VendorAnomaly[]> {
    // 이전 6개월 거래처 목록
    const historicalVendors = await this.prisma.journalLine.findMany({
      where: {
        vendorId: { not: null },
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: sixMonthsAgo, lt: oneMonthAgo },
        },
      },
      select: { vendorId: true },
      distinct: ["vendorId"],
    });

    const knownVendorIds = new Set(historicalVendors.map((v) => v.vendorId));

    // 최근 1개월 전표 라인 (거래처 있는 것만)
    const recentLines = await this.prisma.journalLine.findMany({
      where: {
        vendorId: { not: null },
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: oneMonthAgo, lte: now },
        },
      },
      include: {
        vendor: { select: { name: true } },
        journalEntry: { select: { id: true, date: true } },
      },
    });

    const anomalies: VendorAnomaly[] = [];
    const seen = new Set<string>();

    for (const line of recentLines) {
      if (!line.vendorId || knownVendorIds.has(line.vendorId)) continue;
      // 같은 전표 중복 방지
      const key = `${line.journalEntry.id}-${line.vendorId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      anomalies.push({
        journalEntryId: line.journalEntry.id,
        date: line.journalEntry.date.toISOString(),
        vendorName: line.vendor?.name || "알 수 없음",
        amount: Math.max(Number(line.debit), Number(line.credit)),
      });
    }

    return anomalies;
  }

  /**
   * C) 시간 이상: 주말/공휴일에 생성된 전표 감지
   */
  private async detectTimeAnomalies(
    tenantId: string,
    now: Date,
    oneMonthAgo: Date,
  ): Promise<TimeAnomaly[]> {
    const recentEntries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        status: "POSTED",
        date: { gte: oneMonthAgo, lte: now },
      },
      select: { id: true, date: true, description: true },
    });

    const anomalies: TimeAnomaly[] = [];

    for (const entry of recentEntries) {
      const day = entry.date.getDay();
      // 0 = 일요일, 6 = 토요일
      if (day === 0 || day === 6) {
        anomalies.push({
          journalEntryId: entry.id,
          date: entry.date.toISOString(),
          description: entry.description,
          dayOfWeek: DAY_NAMES[day],
        });
      }
    }

    return anomalies;
  }

  /**
   * D) 중복 의심: 같은 날짜 + 같은 금액 + 같은 거래처의 전표가 2건 이상
   */
  private async detectDuplicateSuspects(
    tenantId: string,
    now: Date,
    oneMonthAgo: Date,
  ): Promise<DuplicateSuspect[]> {
    const recentLines = await this.prisma.journalLine.findMany({
      where: {
        vendorId: { not: null },
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: oneMonthAgo, lte: now },
        },
      },
      include: {
        vendor: { select: { name: true } },
        journalEntry: { select: { id: true, date: true } },
      },
    });

    // 날짜 + 거래처 + 금액으로 그룹핑
    const groups = new Map<
      string,
      { journalEntryIds: Set<string>; vendorName: string; amount: number; date: string }
    >();

    for (const line of recentLines) {
      const amount = Math.max(Number(line.debit), Number(line.credit));
      if (amount === 0) continue;

      const dateStr = line.journalEntry.date.toISOString().split("T")[0];
      const key = `${dateStr}-${line.vendorId}-${amount}`;

      const existing = groups.get(key);
      if (existing) {
        existing.journalEntryIds.add(line.journalEntry.id);
      } else {
        groups.set(key, {
          journalEntryIds: new Set([line.journalEntry.id]),
          vendorName: line.vendor?.name || "알 수 없음",
          amount,
          date: dateStr,
        });
      }
    }

    const duplicates: DuplicateSuspect[] = [];

    for (const group of groups.values()) {
      if (group.journalEntryIds.size >= 2) {
        duplicates.push({
          journalEntryIds: Array.from(group.journalEntryIds),
          date: group.date,
          vendorName: group.vendorName,
          amount: group.amount,
          count: group.journalEntryIds.size,
        });
      }
    }

    // 건수 많은 순으로 정렬
    duplicates.sort((a, b) => b.count - a.count);
    return duplicates;
  }
}
