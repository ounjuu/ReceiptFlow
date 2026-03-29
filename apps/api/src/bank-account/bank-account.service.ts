import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JournalService } from "../journal/journal.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";
import { CreateBankTxDto } from "./dto/create-bank-tx.dto";

@Injectable()
export class BankAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  // 자동 채번 (BA-YYYYMMDD-NNN)
  private async generateTxNo(tenantId: string, txDate: string): Promise<string> {
    const dateStr = txDate.replace(/-/g, "");
    const prefix = `BA-${dateStr}-`;

    const last = await this.prisma.bankTransaction.findFirst({
      where: { tenantId, txNo: { startsWith: prefix } },
      orderBy: { txNo: "desc" },
    });

    let seq = 1;
    if (last) {
      const lastSeq = parseInt(last.txNo.split("-").pop() || "0", 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  // 요약 통계
  async getSummary(tenantId: string) {
    const accounts = await this.prisma.bankAccount.findMany({ where: { tenantId } });

    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter((a) => a.status === "ACTIVE").length;
    const totalBalance = accounts
      .filter((a) => a.status === "ACTIVE")
      .reduce((sum, a) => sum + Number(a.balance), 0);

    // 이번 달 입출금 합계
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const txs = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        txDate: { gte: monthStart, lte: monthEnd },
      },
    });

    const totalDeposit = txs
      .filter((t) => t.txType === "DEPOSIT")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalWithdraw = txs
      .filter((t) => t.txType === "WITHDRAW")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return { totalAccounts, activeAccounts, totalBalance, totalDeposit, totalWithdraw };
  }

  // 계좌 목록
  async findAll(tenantId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId },
      include: { account: { select: { code: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return accounts.map((a) => ({
      ...a,
      balance: Number(a.balance),
    }));
  }

  // 계좌 상세
  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
      include: { account: { select: { code: true, name: true } } },
    });
    if (!account) throw new NotFoundException("계좌를 찾을 수 없습니다");
    return { ...account, balance: Number(account.balance) };
  }

  // 계좌 등록
  async create(dto: CreateBankAccountDto) {
    // 계정과목 존재 확인
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new BadRequestException("연결할 계정과목을 찾을 수 없습니다");

    const bankAccount = await this.prisma.bankAccount.create({
      data: {
        tenantId: dto.tenantId,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountHolder: dto.accountHolder,
        currency: dto.currency || "KRW",
        balance: dto.balance || 0,
        accountId: dto.accountId,
        memo: dto.memo,
      },
      include: { account: { select: { code: true, name: true } } },
    });

    return { ...bankAccount, balance: Number(bankAccount.balance) };
  }

  // 계좌 수정
  async update(id: string, dto: UpdateBankAccountDto) {
    const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("계좌를 찾을 수 없습니다");

    const data: Record<string, unknown> = {};
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.accountHolder !== undefined) data.accountHolder = dto.accountHolder;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.accountId !== undefined) data.accountId = dto.accountId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.memo !== undefined) data.memo = dto.memo;

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data,
      include: { account: { select: { code: true, name: true } } },
    });

    return { ...updated, balance: Number(updated.balance) };
  }

  // 계좌 삭제
  async remove(id: string) {
    const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("계좌를 찾을 수 없습니다");

    const txCount = await this.prisma.bankTransaction.count({ where: { bankAccountId: id } });
    if (txCount > 0) {
      throw new BadRequestException("거래 내역이 있는 계좌는 삭제할 수 없습니다. 비활성화 처리하세요");
    }

    await this.prisma.bankAccount.delete({ where: { id } });
    return { success: true };
  }

  // 거래 내역 조회
  async getTransactions(
    bankAccountId: string,
    filters: { txType?: string; startDate?: string; endDate?: string },
  ) {
    const where: Prisma.BankTransactionWhereInput = { bankAccountId };
    if (filters.txType) where.txType = filters.txType;
    if (filters.startDate || filters.endDate) {
      const txDate: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) txDate.gte = new Date(filters.startDate);
      if (filters.endDate) txDate.lte = new Date(filters.endDate);
      where.txDate = txDate;
    }

    const txs = await this.prisma.bankTransaction.findMany({
      where,
      orderBy: [{ txDate: "desc" }, { createdAt: "desc" }],
    });

    return txs.map((t) => ({
      ...t,
      amount: Number(t.amount),
      balance: Number(t.balance),
    }));
  }

  // 입금/출금/이체 등록
  async createTransaction(bankAccountId: string, dto: CreateBankTxDto) {
    if (!["DEPOSIT", "WITHDRAW", "TRANSFER"].includes(dto.txType)) {
      throw new BadRequestException("txType은 DEPOSIT, WITHDRAW, TRANSFER 중 하나여야 합니다");
    }
    if (dto.amount <= 0) {
      throw new BadRequestException("금액은 0보다 커야 합니다");
    }

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      include: { account: true },
    });
    if (!bankAccount) throw new NotFoundException("계좌를 찾을 수 없습니다");
    if (bankAccount.status !== "ACTIVE") {
      throw new BadRequestException("비활성 계좌에는 거래를 등록할 수 없습니다");
    }

    const txNo = await this.generateTxNo(dto.tenantId, dto.txDate);
    const currentBalance = Number(bankAccount.balance);

    if (dto.txType === "TRANSFER") {
      return this.createTransfer(bankAccount, dto, txNo, currentBalance);
    }

    // DEPOSIT / WITHDRAW
    const isDeposit = dto.txType === "DEPOSIT";
    if (!isDeposit && currentBalance < dto.amount) {
      throw new BadRequestException(
        `잔액 부족: 현재 ${currentBalance.toLocaleString()}원, 출금 요청 ${dto.amount.toLocaleString()}원`,
      );
    }

    const afterBalance = isDeposit
      ? currentBalance + dto.amount
      : currentBalance - dto.amount;

    // 전표 생성
    let journalEntryId: string | undefined;
    const defaultCounterCode = isDeposit ? "40900" : "50900";
    const counterCode = dto.counterAccountCode || defaultCounterCode;

    const counterAccount = await this.prisma.account.findFirst({
      where: { tenantId: dto.tenantId, code: counterCode },
    });

    if (counterAccount) {
      const debitId = isDeposit ? bankAccount.accountId : counterAccount.id;
      const creditId = isDeposit ? counterAccount.id : bankAccount.accountId;
      const desc = isDeposit
        ? `입금: ${dto.counterparty || ""} ${dto.description || ""} (${txNo})`
        : `출금: ${dto.counterparty || ""} ${dto.description || ""} (${txNo})`;

      const entry = await this.journalService.createEntry({
        tenantId: dto.tenantId,
        date: new Date(dto.txDate),
        description: desc.trim(),
        status: "POSTED",
        lines: [
          { accountId: debitId, debit: dto.amount, credit: 0 },
          { accountId: creditId, debit: 0, credit: dto.amount },
        ],
      });
      journalEntryId = entry.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const bankTx = await tx.bankTransaction.create({
        data: {
          tenantId: dto.tenantId,
          bankAccountId,
          txNo,
          txType: dto.txType,
          txDate: new Date(dto.txDate),
          amount: dto.amount,
          balance: afterBalance,
          counterparty: dto.counterparty,
          description: dto.description,
          paymentId: dto.paymentId,
          journalEntryId,
        },
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: afterBalance },
      });

      return {
        ...bankTx,
        amount: Number(bankTx.amount),
        balance: Number(bankTx.balance),
      };
    });
  }

  // 이체 처리
  private async createTransfer(
    sourceAccount: { id: string; balance: Prisma.Decimal; accountId: string; account: { id: string; code: string } },
    dto: CreateBankTxDto,
    txNo: string,
    currentBalance: number,
  ) {
    if (!dto.targetBankAccountId) {
      throw new BadRequestException("이체 시 대상 계좌를 지정해야 합니다");
    }
    if (dto.targetBankAccountId === sourceAccount.id) {
      throw new BadRequestException("같은 계좌로 이체할 수 없습니다");
    }
    if (currentBalance < dto.amount) {
      throw new BadRequestException(
        `잔액 부족: 현재 ${currentBalance.toLocaleString()}원, 이체 요청 ${dto.amount.toLocaleString()}원`,
      );
    }

    const targetAccount = await this.prisma.bankAccount.findUnique({
      where: { id: dto.targetBankAccountId },
      include: { account: true },
    });
    if (!targetAccount) throw new NotFoundException("대상 계좌를 찾을 수 없습니다");
    if (targetAccount.status !== "ACTIVE") {
      throw new BadRequestException("비활성 계좌로 이체할 수 없습니다");
    }

    const sourceAfter = currentBalance - dto.amount;
    const targetAfter = Number(targetAccount.balance) + dto.amount;

    // 이체 전표: DR 도착계좌계정 / CR 출발계좌계정
    const entry = await this.journalService.createEntry({
      tenantId: dto.tenantId,
      date: new Date(dto.txDate),
      description: `계좌 이체: ${sourceAccount.account.code} → ${targetAccount.account.code} (${txNo})`,
      status: "POSTED",
      lines: [
        { accountId: targetAccount.accountId, debit: dto.amount, credit: 0 },
        { accountId: sourceAccount.accountId, debit: 0, credit: dto.amount },
      ],
    });

    const targetTxNo = await this.generateTxNo(dto.tenantId, dto.txDate);

    return this.prisma.$transaction(async (tx) => {
      // 출발계좌 거래
      const sourceTx = await tx.bankTransaction.create({
        data: {
          tenantId: dto.tenantId,
          bankAccountId: sourceAccount.id,
          txNo,
          txType: "TRANSFER",
          txDate: new Date(dto.txDate),
          amount: dto.amount,
          balance: sourceAfter,
          counterparty: `→ ${targetAccount.bankName} ${targetAccount.accountNumber}`,
          description: dto.description || "계좌 이체",
          journalEntryId: entry.id,
        },
      });

      // 도착계좌 거래
      await tx.bankTransaction.create({
        data: {
          tenantId: dto.tenantId,
          bankAccountId: dto.targetBankAccountId!,
          txNo: targetTxNo,
          txType: "DEPOSIT",
          txDate: new Date(dto.txDate),
          amount: dto.amount,
          balance: targetAfter,
          counterparty: `← ${sourceAccount.account.code}`,
          description: dto.description || "계좌 이체 입금",
        },
      });

      // 잔액 업데이트
      await tx.bankAccount.update({
        where: { id: sourceAccount.id },
        data: { balance: sourceAfter },
      });
      await tx.bankAccount.update({
        where: { id: dto.targetBankAccountId! },
        data: { balance: targetAfter },
      });

      return {
        ...sourceTx,
        amount: Number(sourceTx.amount),
        balance: Number(sourceTx.balance),
      };
    });
  }

  // 거래 삭제 (최근 건만)
  async deleteTransaction(bankAccountId: string, txId: string) {
    const tx = await this.prisma.bankTransaction.findUnique({ where: { id: txId } });
    if (!tx) throw new NotFoundException("거래를 찾을 수 없습니다");
    if (tx.bankAccountId !== bankAccountId) {
      throw new BadRequestException("해당 계좌의 거래가 아닙니다");
    }

    // 최근 거래인지 확인
    const latest = await this.prisma.bankTransaction.findFirst({
      where: { bankAccountId },
      orderBy: { createdAt: "desc" },
    });
    if (latest && latest.id !== txId) {
      throw new BadRequestException("가장 최근 거래만 삭제할 수 있습니다");
    }

    const txAmount = Number(tx.amount);
    const priorBalance = tx.txType === "DEPOSIT"
      ? Number(tx.balance) - txAmount
      : Number(tx.balance) + txAmount;

    return this.prisma.$transaction(async (prisma) => {
      // 잔액 복원
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: priorBalance },
      });

      // 연결 전표 삭제
      if (tx.journalEntryId) {
        await prisma.journalEntry.delete({ where: { id: tx.journalEntryId } });
      }

      await prisma.bankTransaction.delete({ where: { id: txId } });

      return { success: true };
    });
  }
}
