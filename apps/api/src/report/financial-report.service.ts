import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TrialBalanceRow } from "./report.types";
import { LedgerReportService } from "./ledger-report.service";

@Injectable()
export class FinancialReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerReport: LedgerReportService,
  ) {}

  // 손익계산서: 수익 - 비용 = 당기순이익
  async incomeStatement(tenantId: string, startDate?: string, endDate?: string) {
    const { rows } = await this.ledgerReport.trialBalance(tenantId, startDate, endDate);

    const revenue = rows
      .filter((r) => r.type === "REVENUE")
      .map((r) => ({ ...r, amount: r.credit - r.debit }));

    const expense = rows
      .filter((r) => r.type === "EXPENSE")
      .map((r) => ({ ...r, amount: r.debit - r.credit }));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expense.reduce((sum, r) => sum + r.amount, 0);

    return {
      revenue,
      totalRevenue,
      expense,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
    };
  }

  // 재무상태표: 자산 = 부채 + 자본 (유동/비유동 소분류 포함)
  async balanceSheet(tenantId: string, startDate?: string, endDate?: string) {
    const { rows } = await this.ledgerReport.trialBalance(tenantId, startDate, endDate);
    const income = await this.incomeStatement(tenantId, startDate, endDate);

    const toAmount = (r: TrialBalanceRow, isDebit: boolean) => ({
      ...r,
      amount: isDebit ? r.debit - r.credit : r.credit - r.debit,
    });

    // 자산: 유동(코드 < 13000) / 비유동(코드 >= 13000)
    const allAssets = rows.filter((r) => r.type === "ASSET");
    const currentAssets = allAssets
      .filter((r) => Number(r.code) < 13000)
      .map((r) => toAmount(r, true));
    const nonCurrentAssets = allAssets
      .filter((r) => Number(r.code) >= 13000)
      .map((r) => toAmount(r, true));
    const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0);
    const totalNonCurrentAssets = nonCurrentAssets.reduce((s, r) => s + r.amount, 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    // 부채: 유동(코드 < 23000) / 비유동(코드 >= 23000)
    const allLiabilities = rows.filter((r) => r.type === "LIABILITY");
    const currentLiabilities = allLiabilities
      .filter((r) => Number(r.code) < 23000)
      .map((r) => toAmount(r, false));
    const nonCurrentLiabilities = allLiabilities
      .filter((r) => Number(r.code) >= 23000)
      .map((r) => toAmount(r, false));
    const totalCurrentLiabilities = currentLiabilities.reduce((s, r) => s + r.amount, 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

    // 자본
    const equity = rows
      .filter((r) => r.type === "EQUITY")
      .map((r) => toAmount(r, false));
    const totalEquity = equity.reduce((s, r) => s + r.amount, 0);

    return {
      currentAssets,
      totalCurrentAssets,
      nonCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      currentLiabilities,
      totalCurrentLiabilities,
      nonCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      equity,
      totalEquity,
      retainedEarnings: income.netIncome,
      totalLiabilitiesAndEquity:
        totalLiabilities + totalEquity + income.netIncome,
      isBalanced:
        Math.abs(
          totalAssets - (totalLiabilities + totalEquity + income.netIncome),
        ) < 0.01,
    };
  }

  // 비교 손익계산서: 전기 vs 당기
  async comparativeIncomeStatement(
    tenantId: string,
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string,
  ) {
    const [current, previous] = await Promise.all([
      this.incomeStatement(tenantId, currentStart, currentEnd),
      this.incomeStatement(tenantId, previousStart, previousEnd),
    ]);

    // 계정별 병합 (코드 기준)
    const accountMap = new Map<string, {
      type: string; code: string; name: string;
      currentAmount: number; previousAmount: number;
    }>();

    for (const r of current.revenue) {
      accountMap.set(r.code, {
        type: "REVENUE", code: r.code, name: r.name,
        currentAmount: r.amount, previousAmount: 0,
      });
    }
    for (const r of current.expense) {
      accountMap.set(r.code, {
        type: "EXPENSE", code: r.code, name: r.name,
        currentAmount: r.amount, previousAmount: 0,
      });
    }
    for (const r of previous.revenue) {
      const existing = accountMap.get(r.code);
      if (existing) {
        existing.previousAmount = r.amount;
      } else {
        accountMap.set(r.code, {
          type: "REVENUE", code: r.code, name: r.name,
          currentAmount: 0, previousAmount: r.amount,
        });
      }
    }
    for (const r of previous.expense) {
      const existing = accountMap.get(r.code);
      if (existing) {
        existing.previousAmount = r.amount;
      } else {
        accountMap.set(r.code, {
          type: "EXPENSE", code: r.code, name: r.name,
          currentAmount: 0, previousAmount: r.amount,
        });
      }
    }

    const rows = Array.from(accountMap.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((r) => ({
        ...r,
        difference: r.currentAmount - r.previousAmount,
        changeRate: r.previousAmount !== 0
          ? Math.round(((r.currentAmount - r.previousAmount) / Math.abs(r.previousAmount)) * 10000) / 100
          : null,
      }));

    return {
      rows,
      currentTotal: {
        revenue: current.totalRevenue,
        expense: current.totalExpense,
        netIncome: current.netIncome,
      },
      previousTotal: {
        revenue: previous.totalRevenue,
        expense: previous.totalExpense,
        netIncome: previous.netIncome,
      },
    };
  }

  // 비교 대차대조표: 전기 vs 당기
  async comparativeBalanceSheet(
    tenantId: string,
    currentEnd: string,
    previousEnd: string,
  ) {
    const [current, previous] = await Promise.all([
      this.balanceSheet(tenantId, undefined, currentEnd),
      this.balanceSheet(tenantId, undefined, previousEnd),
    ]);

    // 계정별 병합 헬퍼
    const mergeRows = (
      currentRows: { code: string; name: string; amount: number }[],
      previousRows: { code: string; name: string; amount: number }[],
      section: string,
    ) => {
      const map = new Map<string, {
        section: string; code: string; name: string;
        currentAmount: number; previousAmount: number;
      }>();

      for (const r of currentRows) {
        map.set(r.code, {
          section, code: r.code, name: r.name,
          currentAmount: r.amount, previousAmount: 0,
        });
      }
      for (const r of previousRows) {
        const existing = map.get(r.code);
        if (existing) {
          existing.previousAmount = r.amount;
        } else {
          map.set(r.code, {
            section, code: r.code, name: r.name,
            currentAmount: 0, previousAmount: r.amount,
          });
        }
      }

      return Array.from(map.values())
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((r) => ({
          ...r,
          difference: r.currentAmount - r.previousAmount,
          changeRate: r.previousAmount !== 0
            ? Math.round(((r.currentAmount - r.previousAmount) / Math.abs(r.previousAmount)) * 10000) / 100
            : null,
        }));
    };

    const calcTotal = (
      currentVal: number,
      previousVal: number,
    ) => ({
      current: currentVal,
      previous: previousVal,
      difference: currentVal - previousVal,
      changeRate: previousVal !== 0
        ? Math.round(((currentVal - previousVal) / Math.abs(previousVal)) * 10000) / 100
        : null,
    });

    return {
      currentAssets: mergeRows(current.currentAssets, previous.currentAssets, "currentAssets"),
      nonCurrentAssets: mergeRows(current.nonCurrentAssets, previous.nonCurrentAssets, "nonCurrentAssets"),
      currentLiabilities: mergeRows(current.currentLiabilities, previous.currentLiabilities, "currentLiabilities"),
      nonCurrentLiabilities: mergeRows(current.nonCurrentLiabilities, previous.nonCurrentLiabilities, "nonCurrentLiabilities"),
      equity: mergeRows(current.equity, previous.equity, "equity"),
      totals: {
        totalCurrentAssets: calcTotal(current.totalCurrentAssets, previous.totalCurrentAssets),
        totalNonCurrentAssets: calcTotal(current.totalNonCurrentAssets, previous.totalNonCurrentAssets),
        totalAssets: calcTotal(current.totalAssets, previous.totalAssets),
        totalCurrentLiabilities: calcTotal(current.totalCurrentLiabilities, previous.totalCurrentLiabilities),
        totalNonCurrentLiabilities: calcTotal(current.totalNonCurrentLiabilities, previous.totalNonCurrentLiabilities),
        totalLiabilities: calcTotal(current.totalLiabilities, previous.totalLiabilities),
        totalEquity: calcTotal(current.totalEquity, previous.totalEquity),
        retainedEarnings: calcTotal(current.retainedEarnings, previous.retainedEarnings),
        totalLiabilitiesAndEquity: calcTotal(current.totalLiabilitiesAndEquity, previous.totalLiabilitiesAndEquity),
      },
    };
  }

  // 자금 일보: 현금성 계정의 일별 입출금 현황
  async getDailyCashReport(tenantId: string, startDate?: string, endDate?: string) {
    const cashCodes = ["10100", "10300"]; // 현금, 보통예금

    // 현금 계정 조회
    const cashAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: cashCodes } },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    if (cashAccountIds.length === 0) {
      return { days: [], totalDeposit: 0, totalWithdraw: 0, openingBalance: 0, closingBalance: 0 };
    }

    // 기간 이전 잔액 (기초잔액)
    const beforeFilter: Record<string, unknown> = {};
    if (startDate) {
      beforeFilter.lt = new Date(startDate);
    }

    const beforeLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
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
        sum +
        (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
      0,
    );

    // 기간 내 거래 조회
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
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

    // 날짜별 그룹핑
    const dayMap = new Map<string, { deposit: number; withdraw: number; details: { description: string; account: string; deposit: number; withdraw: number }[] }>();

    for (const l of lines) {
      const dateKey = new Date(l.journalEntry.date).toISOString().slice(0, 10);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { deposit: 0, withdraw: 0, details: [] });
      }
      const day = dayMap.get(dateKey)!;
      const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
      const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
      day.deposit += debit;
      day.withdraw += credit;
      day.details.push({
        description: l.journalEntry.description || "",
        account: l.account.name,
        deposit: debit,
        withdraw: credit,
      });
    }

    // 일별 잔액 누적 계산
    const sortedDates = [...dayMap.keys()].sort();
    let runningBalance = openingBalance;
    const days = sortedDates.map((date) => {
      const d = dayMap.get(date)!;
      const prevBalance = runningBalance;
      runningBalance += d.deposit - d.withdraw;
      return {
        date,
        prevBalance,
        deposit: d.deposit,
        withdraw: d.withdraw,
        balance: runningBalance,
        details: d.details,
      };
    });

    return {
      days,
      openingBalance,
      closingBalance: runningBalance,
      totalDeposit: days.reduce((s, d) => s + d.deposit, 0),
      totalWithdraw: days.reduce((s, d) => s + d.withdraw, 0),
    };
  }

  // 현금 흐름표 (간접법)
  async getCashFlowStatement(tenantId: string, startDate?: string, endDate?: string) {
    // 당기순이익
    const income = await this.incomeStatement(tenantId, startDate, endDate);
    const netIncome = income.netIncome;

    // 현금흐름표에 필요한 모든 계정코드를 일괄 조회 (N+1 방지)
    const cfCodes = ["50900", "10500", "11300", "20100", "20300", "20700", "23100", "30100", "10100", "10300"];
    const cfAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: cfCodes } },
    });
    const cfAccountMap = new Map(cfAccounts.map((a) => [a.code, a]));

    // 고정자산 계정 (13xxx) 조회
    const fixedAssetAccounts = await this.prisma.account.findMany({
      where: { tenantId, code: { gte: "13000", lt: "14000" } },
    });

    // 모든 관련 계정의 ID를 모아서 기간 내 라인 일괄 조회
    const allCfAccountIds = [
      ...cfAccounts.map((a) => a.id),
      ...fixedAssetAccounts.map((a) => a.id),
    ];

    const dateFilter2: Record<string, unknown> = {};
    if (startDate) dateFilter2.gte = new Date(startDate);
    if (endDate) dateFilter2.lte = new Date(endDate + "T23:59:59");

    const allCfLines = allCfAccountIds.length > 0
      ? await this.prisma.journalLine.findMany({
          where: {
            accountId: { in: allCfAccountIds },
            journalEntry: {
              status: "POSTED",
              tenantId,
              ...(Object.keys(dateFilter2).length > 0 && { date: dateFilter2 }),
            },
          },
          include: { journalEntry: { select: { exchangeRate: true } } },
        })
      : [];

    // 계정별로 그룹핑 후 변동액 계산
    const cfLinesByAccountId = new Map<string, typeof allCfLines>();
    for (const l of allCfLines) {
      const arr = cfLinesByAccountId.get(l.accountId) || [];
      arr.push(l);
      cfLinesByAccountId.set(l.accountId, arr);
    }

    const calcChange = (accountId: string | undefined) => {
      if (!accountId) return 0;
      const lines = cfLinesByAccountId.get(accountId) || [];
      return lines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
        0,
      );
    };

    const getAccountChange = (code: string) => calcChange(cfAccountMap.get(code)?.id);

    // 고정자산 변동 합산
    const fixedAssetChange = fixedAssetAccounts.reduce(
      (sum, a) => sum + calcChange(a.id), 0,
    );

    // 영업활동 항목
    const depreciation = getAccountChange("50900"); // 감가상각비 (비현금 비용, 가산)
    const arChange = getAccountChange("10500");     // 매출채권 변동
    const inventoryChange = getAccountChange("11300"); // 재고 변동
    const apChange = getAccountChange("20100");     // 매입채무 변동
    const accruedChange = getAccountChange("20300"); // 미지급금 변동

    const operatingItems = [
      { name: "당기순이익", amount: netIncome },
      { name: "감가상각비", amount: depreciation },
      { name: "매출채권 변동", amount: -arChange },
      { name: "재고자산 변동", amount: -inventoryChange },
      { name: "매입채무 변동", amount: apChange },
      { name: "미지급금 변동", amount: accruedChange },
    ];
    const operatingTotal = operatingItems.reduce((s, i) => s + i.amount, 0);

    // 투자활동
    const investingItems = [
      { name: "유형자산 취득/처분", amount: -fixedAssetChange },
    ];
    const investingTotal = investingItems.reduce((s, i) => s + i.amount, 0);

    // 재무활동
    const shortDebtChange = getAccountChange("20700"); // 단기차입금
    const longDebtChange = getAccountChange("23100");  // 장기차입금
    const capitalChange = getAccountChange("30100");   // 자본금
    const financingItems = [
      { name: "단기차입금 변동", amount: shortDebtChange },
      { name: "장기차입금 변동", amount: longDebtChange },
      { name: "자본금 변동", amount: capitalChange },
    ];
    const financingTotal = financingItems.reduce((s, i) => s + i.amount, 0);

    // 현금 증감
    const netCashChange = operatingTotal + investingTotal + financingTotal;

    // 기초 현금 잔액
    const cashCodes = ["10100", "10300"];
    const cashAccountIds = cashCodes
      .map((c) => cfAccountMap.get(c)?.id)
      .filter((id): id is string => !!id);

    let openingCash = 0;
    if (startDate && cashAccountIds.length > 0) {
      const beforeLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: { in: cashAccountIds },
          journalEntry: {
            status: "POSTED",
            tenantId,
            date: { lt: new Date(startDate) },
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });
      openingCash = beforeLines.reduce(
        (sum, l) =>
          sum +
          (Number(l.debit) - Number(l.credit)) * Number(l.journalEntry.exchangeRate),
        0,
      );
    }

    const closingCash = openingCash + netCashChange;

    return {
      operating: { items: operatingItems, total: operatingTotal },
      investing: { items: investingItems, total: investingTotal },
      financing: { items: financingItems, total: financingTotal },
      netCashChange,
      openingCash,
      closingCash,
    };
  }

  // 거래처별 매출/매입 현황
  async vendorSummary(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    // POSTED 상태이며 vendorId가 있는 JournalLine 조회
    const lines = await this.prisma.journalLine.findMany({
      where: {
        vendorId: { not: null },
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        journalEntry: { select: { exchangeRate: true } },
        account: { select: { type: true } },
        vendor: { select: { id: true, name: true, bizNo: true } },
      },
    });

    // 거래처별 집계
    const vendorMap = new Map<string, {
      vendorId: string;
      vendorName: string;
      bizNo: string | null;
      salesAmount: number;
      purchaseAmount: number;
      transactionCount: number;
      journalEntryIds: Set<string>;
    }>();

    for (const line of lines) {
      if (!line.vendor) continue;

      const vid = line.vendor.id;
      if (!vendorMap.has(vid)) {
        vendorMap.set(vid, {
          vendorId: vid,
          vendorName: line.vendor.name,
          bizNo: line.vendor.bizNo,
          salesAmount: 0,
          purchaseAmount: 0,
          transactionCount: 0,
          journalEntryIds: new Set(),
        });
      }

      const entry = vendorMap.get(vid)!;
      const rate = Number(line.journalEntry.exchangeRate);

      if (line.account.type === "REVENUE") {
        // 매출: 대변(credit) 합계
        entry.salesAmount += Number(line.credit) * rate;
      } else if (line.account.type === "EXPENSE") {
        // 매입: 차변(debit) 합계
        entry.purchaseAmount += Number(line.debit) * rate;
      }

      entry.journalEntryIds.add(line.journalEntryId);
    }

    const vendors = Array.from(vendorMap.values()).map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      bizNo: v.bizNo,
      salesAmount: v.salesAmount,
      purchaseAmount: v.purchaseAmount,
      netAmount: v.salesAmount - v.purchaseAmount,
      transactionCount: v.journalEntryIds.size,
    }));

    // 매출 내림차순 정렬
    vendors.sort((a, b) => b.salesAmount - a.salesAmount);

    return {
      vendors,
      totalSales: vendors.reduce((sum, v) => sum + v.salesAmount, 0),
      totalPurchase: vendors.reduce((sum, v) => sum + v.purchaseAmount, 0),
      totalNet: vendors.reduce((sum, v) => sum + v.netAmount, 0),
    };
  }

  // 감가상각 명세서
  async depreciationSchedule(tenantId: string, year: number) {
    // ACTIVE + FULLY_DEPRECIATED 자산 조회
    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId,
        status: { in: ["ACTIVE", "FULLY_DEPRECIATED"] },
      },
      include: {
        assetAccount: { select: { code: true, name: true } },
        depreciationRecords: { orderBy: { period: "asc" } },
      },
      orderBy: { acquisitionDate: "asc" },
    });

    const yearStr = String(year);
    const prevYearEnd = `${year - 1}-12`; // 전기말 기준

    const assetRows = assets.map((asset) => {
      const acquisitionCost = Number(asset.acquisitionCost);
      const residualValue = Number(asset.residualValue);
      const usefulLifeMonths = asset.usefulLifeMonths;
      const method = asset.depreciationMethod;

      // 전기말 상각누계액: year 이전 마지막 record의 accumulatedAmount
      const prevRecords = asset.depreciationRecords.filter(
        (r) => r.period <= prevYearEnd,
      );
      const lastPrevRecord = prevRecords.length > 0 ? prevRecords[prevRecords.length - 1] : null;
      const prevAccumulatedDep = lastPrevRecord
        ? Number(lastPrevRecord.accumulatedAmount)
        : 0;

      // 전기말 장부가액
      const prevBookValue = acquisitionCost - prevAccumulatedDep;

      // 당기 상각액: 해당 year의 DepreciationRecord amount 합계
      const currentYearRecords = asset.depreciationRecords.filter(
        (r) => r.period >= `${year}-01` && r.period <= `${year}-12`,
      );
      const currentYearDep = currentYearRecords.reduce(
        (sum, r) => sum + Number(r.amount),
        0,
      );

      // 당기말 상각누계액 = 전기말 + 당기
      const currentAccumulatedDep = prevAccumulatedDep + currentYearDep;

      // 당기말 장부가액
      const currentBookValue = acquisitionCost - currentAccumulatedDep;

      // 상각률 계산
      let depRate = 0;
      if (method === "STRAIGHT_LINE" && usefulLifeMonths > 0) {
        depRate = Math.round((12 / usefulLifeMonths) * 10000) / 100; // %
      } else if (method === "DECLINING_BALANCE" && usefulLifeMonths > 0) {
        const usefulLifeYears = usefulLifeMonths / 12;
        const safeResidual = Math.max(residualValue, acquisitionCost * 0.05);
        depRate =
          Math.round(
            (1 - Math.pow(safeResidual / acquisitionCost, 1 / usefulLifeYears)) * 10000,
          ) / 100;
      }

      return {
        id: asset.id,
        name: asset.name,
        assetAccountCode: asset.assetAccount.code,
        assetAccountName: asset.assetAccount.name,
        acquisitionDate: asset.acquisitionDate.toISOString().split("T")[0],
        acquisitionCost,
        usefulLifeMonths,
        depreciationMethod: method,
        residualValue,
        prevAccumulatedDep,
        prevBookValue,
        currentYearDep,
        currentAccumulatedDep,
        currentBookValue,
        depRate,
        status: asset.status,
      };
    });

    // 합계
    const totals = {
      acquisitionCost: assetRows.reduce((s, a) => s + a.acquisitionCost, 0),
      prevAccumulatedDep: assetRows.reduce((s, a) => s + a.prevAccumulatedDep, 0),
      prevBookValue: assetRows.reduce((s, a) => s + a.prevBookValue, 0),
      currentYearDep: assetRows.reduce((s, a) => s + a.currentYearDep, 0),
      currentAccumulatedDep: assetRows.reduce((s, a) => s + a.currentAccumulatedDep, 0),
      currentBookValue: assetRows.reduce((s, a) => s + a.currentBookValue, 0),
    };

    return {
      year,
      assets: assetRows,
      totals,
    };
  }
}
