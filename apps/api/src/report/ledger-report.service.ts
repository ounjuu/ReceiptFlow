import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TrialBalanceRow } from "./report.types";

@Injectable()
export class LedgerReportService {
  constructor(private readonly prisma: PrismaService) {}

  // 시산표: 계정별 차변/대변 합계 (기간 필터)
  async trialBalance(tenantId: string, startDate?: string, endDate?: string): Promise<{
    rows: TrialBalanceRow[];
    totalDebit: number;
    totalCredit: number;
  }> {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
          },
          include: {
            journalEntry: { select: { exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows: TrialBalanceRow[] = accounts.map((account) => {
      const debit = account.journalLines.reduce(
        (sum, l) => sum + Number(l.debit) * Number(l.journalEntry.exchangeRate),
        0,
      );
      const credit = account.journalLines.reduce(
        (sum, l) => sum + Number(l.credit) * Number(l.journalEntry.exchangeRate),
        0,
      );
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: debit - credit,
      };
    });

    // 잔액이 0인 계정 제외
    const filtered = rows.filter((r) => r.debit !== 0 || r.credit !== 0);

    return {
      rows: filtered,
      totalDebit: filtered.reduce((sum, r) => sum + r.debit, 0),
      totalCredit: filtered.reduce((sum, r) => sum + r.credit, 0),
    };
  }

  // 일계표: 특정 일자의 계정별 차변/대변 합계
  async dailySummary(tenantId: string, date: string) {
    const startOfDay = new Date(date);
    const endOfDay = new Date(date + "T23:59:59");

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              date: { gte: startOfDay, lte: endOfDay },
            },
          },
          include: {
            journalEntry: { select: { exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows = accounts
      .map((account) => {
        const debit = account.journalLines.reduce(
          (sum, l) => sum + Number(l.debit) * Number(l.journalEntry.exchangeRate),
          0,
        );
        const credit = account.journalLines.reduce(
          (sum, l) => sum + Number(l.credit) * Number(l.journalEntry.exchangeRate),
          0,
        );
        return {
          code: account.code,
          name: account.name,
          type: account.type,
          debit,
          credit,
        };
      })
      .filter((r) => r.debit !== 0 || r.credit !== 0);

    return {
      date,
      rows,
      totalDebit: rows.reduce((sum, r) => sum + r.debit, 0),
      totalCredit: rows.reduce((sum, r) => sum + r.credit, 0),
    };
  }

  // 월계표: 월별 계정별 차변/대변 합계 + 누적(1월~당월)
  async monthlySummary(tenantId: string, year: number, month: number) {
    // 당월 범위
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    // 누적 범위 (1월 1일 ~ 당월 말)
    const yearStart = new Date(year, 0, 1);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: "POSTED",
              tenantId,
              date: { gte: yearStart, lte: monthEnd },
            },
          },
          include: {
            journalEntry: { select: { date: true, exchangeRate: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const rows = accounts
      .map((account) => {
        let monthDebit = 0;
        let monthCredit = 0;
        let cumulativeDebit = 0;
        let cumulativeCredit = 0;

        for (const l of account.journalLines) {
          const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
          const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
          const lineDate = new Date(l.journalEntry.date);

          // 누적 (1월~당월)
          cumulativeDebit += debit;
          cumulativeCredit += credit;

          // 당월
          if (lineDate >= monthStart && lineDate <= monthEnd) {
            monthDebit += debit;
            monthCredit += credit;
          }
        }

        return {
          code: account.code,
          name: account.name,
          type: account.type,
          monthDebit,
          monthCredit,
          cumulativeDebit,
          cumulativeCredit,
        };
      })
      .filter(
        (r) =>
          r.monthDebit !== 0 ||
          r.monthCredit !== 0 ||
          r.cumulativeDebit !== 0 ||
          r.cumulativeCredit !== 0,
      );

    return {
      year,
      month,
      rows,
      totalMonthDebit: rows.reduce((sum, r) => sum + r.monthDebit, 0),
      totalMonthCredit: rows.reduce((sum, r) => sum + r.monthCredit, 0),
      totalCumulativeDebit: rows.reduce((sum, r) => sum + r.cumulativeDebit, 0),
      totalCumulativeCredit: rows.reduce((sum, r) => sum + r.cumulativeCredit, 0),
    };
  }

  // 총계정원장: 계정별 거래 내역 + 누적 잔액
  async generalLedger(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    accountId?: string,
  ) {
    // 계정 조회
    const accountFilter: Record<string, unknown> = { tenantId };
    if (accountId) accountFilter.id = accountId;

    const accounts = await this.prisma.account.findMany({
      where: accountFilter,
      orderBy: { code: "asc" },
    });

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const accountIds = accounts.map((a) => a.id);

    // 기초잔액용 라인 일괄 조회 (N+1 방지)
    type BalanceLine = { accountId: string; debit: any; credit: any; journalEntry: { exchangeRate: any } };
    const beforeLinesByAccount = new Map<string, BalanceLine[]>();
    let beforeLines: BalanceLine[] = [];
    if (startDate) {
      beforeLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: { in: accountIds },
          journalEntry: {
            status: "POSTED",
            tenantId,
            date: { lt: new Date(startDate) },
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });

      for (const l of beforeLines) {
        const arr = beforeLinesByAccount.get(l.accountId) || [];
        arr.push(l);
        beforeLinesByAccount.set(l.accountId, arr);
      }
    }

    // 기간 내 거래 라인 일괄 조회 (N+1 방지)
    const periodLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        journalEntry: {
          select: { id: true, date: true, description: true, exchangeRate: true },
        },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    // 계정별로 그룹핑
    const periodLinesByAccount = new Map<string, typeof periodLines>();
    for (const l of periodLines) {
      const arr = periodLinesByAccount.get(l.accountId) || [];
      arr.push(l);
      periodLinesByAccount.set(l.accountId, arr);
    }

    const result = [];

    for (const account of accounts) {
      // 기초잔액 계산
      let openingBalance = 0;
      if (startDate) {
        const accountBeforeLines = beforeLinesByAccount.get(account.id) || [];
        openingBalance = accountBeforeLines.reduce((sum, l) => {
          const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
          const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
          return account.normalBalance === "DEBIT"
            ? sum + debit - credit
            : sum + credit - debit;
        }, 0);
      }

      const lines = periodLinesByAccount.get(account.id) || [];

      // 거래가 없고 기초잔액도 없으면 스킵
      if (lines.length === 0 && openingBalance === 0) continue;

      let runningBalance = openingBalance;
      let totalDebit = 0;
      let totalCredit = 0;

      const entries = lines.map((l) => {
        const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
        const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
        totalDebit += debit;
        totalCredit += credit;

        if (account.normalBalance === "DEBIT") {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }

        return {
          date: new Date(l.journalEntry.date).toISOString().slice(0, 10),
          journalEntryId: l.journalEntry.id,
          description: l.journalEntry.description || "",
          debit,
          credit,
          balance: runningBalance,
        };
      });

      result.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        openingBalance,
        entries,
        closingBalance: runningBalance,
        totalDebit,
        totalCredit,
      });
    }

    return { accounts: result };
  }

  // 계정별원장: 특정 계정의 거래 내역 + 상대계정 정보
  async accountLedger(
    tenantId: string,
    accountId: string,
    startDate?: string,
    endDate?: string,
  ) {
    // 계정 조회
    const account = await this.prisma.account.findFirstOrThrow({
      where: { id: accountId, tenantId },
    });

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    // 기초잔액: startDate 이전 POSTED 전표의 합계
    let openingBalance = 0;
    if (startDate) {
      const beforeLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            status: "POSTED",
            tenantId,
            date: { lt: new Date(startDate) },
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });

      openingBalance = beforeLines.reduce((sum, l) => {
        const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
        const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
        return account.normalBalance === "DEBIT"
          ? sum + debit - credit
          : sum + credit - debit;
      }, 0);
    }

    // 기간 내 거래 조회 (거래처 정보 포함)
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        vendor: { select: { name: true } },
        journalEntry: {
          select: {
            id: true,
            date: true,
            description: true,
            exchangeRate: true,
            lines: {
              select: {
                debit: true,
                credit: true,
                account: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = lines.map((l) => {
      const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
      const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
      totalDebit += debit;
      totalCredit += credit;

      if (account.normalBalance === "DEBIT") {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      // 상대계정 찾기: 같은 전표에서 반대 방향의 다른 계정
      const isDebitSide = debit > 0;
      const counterparts = l.journalEntry.lines.filter((ol) => {
        if (ol.account.code === account.code) return false;
        return isDebitSide ? Number(ol.credit) > 0 : Number(ol.debit) > 0;
      });

      let counterpartCode = "";
      let counterpartName = "";
      if (counterparts.length === 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = counterparts[0].account.name;
      } else if (counterparts.length > 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = "제";
      }

      return {
        date: new Date(l.journalEntry.date).toISOString().slice(0, 10),
        journalEntryId: l.journalEntry.id,
        description: l.journalEntry.description || "",
        counterpartCode,
        counterpartName,
        vendorName: l.vendor?.name || null,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      openingBalance,
      entries,
      closingBalance: runningBalance,
      totalDebit,
      totalCredit,
    };
  }

  // 분개장: 모든 전표를 일자순으로 나열
  async journalBook(tenantId: string, startDate?: string, endDate?: string) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        status: "POSTED",
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const entries = journalEntries.map((je) => {
      const lines = je.lines.map((l) => {
        const debit = Number(l.debit) * Number(je.exchangeRate);
        const credit = Number(l.credit) * Number(je.exchangeRate);
        return {
          accountCode: l.account.code,
          accountName: l.account.name,
          vendorName: l.vendor?.name ?? null,
          debit,
          credit,
        };
      });

      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
      grandTotalDebit += totalDebit;
      grandTotalCredit += totalCredit;

      return {
        id: je.id,
        date: je.date.toISOString().slice(0, 10),
        description: je.description ?? "",
        lines,
        totalDebit,
        totalCredit,
      };
    });

    return {
      entries,
      grandTotalDebit,
      grandTotalCredit,
      entryCount: entries.length,
    };
  }

  // 현금출납장: 현금 계정(10100) 입출금 내역
  async cashBook(tenantId: string, startDate?: string, endDate?: string) {
    // 현금 계정 자동 조회
    const account = await this.prisma.account.findFirstOrThrow({
      where: { tenantId, code: "10100" },
    });

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");

    // 기초잔액: startDate 이전 POSTED 전표의 합계
    let openingBalance = 0;
    if (startDate) {
      const beforeLines = await this.prisma.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            status: "POSTED",
            tenantId,
            date: { lt: new Date(startDate) },
          },
        },
        include: { journalEntry: { select: { exchangeRate: true } } },
      });

      openingBalance = beforeLines.reduce((sum, l) => {
        const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
        const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
        // 현금은 DEBIT normal balance: 차변 - 대변
        return sum + debit - credit;
      }, 0);
    }

    // 기간 내 거래 조회 (거래처 정보 포함)
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          status: "POSTED",
          tenantId,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
      },
      include: {
        vendor: { select: { name: true } },
        journalEntry: {
          select: {
            id: true,
            date: true,
            description: true,
            exchangeRate: true,
            lines: {
              select: {
                debit: true,
                credit: true,
                account: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let runningBalance = openingBalance;
    let totalIncome = 0;
    let totalExpense = 0;

    const entries = lines.map((l) => {
      const debit = Number(l.debit) * Number(l.journalEntry.exchangeRate);
      const credit = Number(l.credit) * Number(l.journalEntry.exchangeRate);
      const income = debit;   // 차변 = 입금
      const expense = credit; // 대변 = 출금
      totalIncome += income;
      totalExpense += expense;
      runningBalance += income - expense;

      // 상대계정 찾기: 같은 전표에서 반대 방향의 다른 계정
      const isDebitSide = debit > 0;
      const counterparts = l.journalEntry.lines.filter((ol) => {
        if (ol.account.code === account.code) return false;
        return isDebitSide ? Number(ol.credit) > 0 : Number(ol.debit) > 0;
      });

      let counterpartCode = "";
      let counterpartName = "";
      if (counterparts.length === 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = counterparts[0].account.name;
      } else if (counterparts.length > 1) {
        counterpartCode = counterparts[0].account.code;
        counterpartName = "제";
      }

      return {
        date: new Date(l.journalEntry.date).toISOString().slice(0, 10),
        journalEntryId: l.journalEntry.id,
        description: l.journalEntry.description || "",
        counterpartCode,
        counterpartName,
        vendorName: l.vendor?.name || null,
        income,
        expense,
        balance: runningBalance,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
      },
      openingBalance,
      entries,
      closingBalance: runningBalance,
      totalIncome,
      totalExpense,
    };
  }
}
