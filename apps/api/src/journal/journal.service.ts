import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ClosingService } from "../closing/closing.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateJournalDto, JournalLineDto } from "./dto/create-journal.dto";
import { UpdateJournalDto } from "./dto/update-journal.dto";
import * as fs from "fs";
import * as path from "path";

// 상태 전이 규칙
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["APPROVED", "PENDING_APPROVAL"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT"],
  APPROVED: ["POSTED", "DRAFT"],
  POSTED: [],
};

// 전표 조회 시 공통 include
const ENTRY_INCLUDE = {
  lines: { include: { account: true, vendor: true, project: true, department: true } },
  document: true,
  attachments: true,
} as const;

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ClosingService))
    private readonly closingService: ClosingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // 전표유형 한글 접두사
  private static readonly TYPE_PREFIX: Record<string, string> = {
    GENERAL: "일반",
    PURCHASE: "매입",
    SALES: "매출",
    CASH: "자금",
  };

  // 전표번호 자동채번: 유형-YYYYMMDD-0001
  private async generateJournalNumber(
    tenantId: string,
    journalType: string,
    date: Date,
    tx?: any,
  ): Promise<string> {
    const db = tx || this.prisma;
    const prefix = JournalService.TYPE_PREFIX[journalType] || "일반";
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const pattern = `${prefix}-${dateStr}-`;

    // 같은 테넌트, 같은 유형, 같은 날짜의 마지막 번호 조회
    const last = await db.journalEntry.findFirst({
      where: {
        tenantId,
        journalNumber: { startsWith: pattern },
      },
      orderBy: { journalNumber: "desc" },
      select: { journalNumber: true },
    });

    let seq = 1;
    if (last?.journalNumber) {
      const lastSeq = parseInt(last.journalNumber.split("-").pop() || "0", 10);
      seq = lastSeq + 1;
    }

    return `${pattern}${String(seq).padStart(4, "0")}`;
  }

  // 차대변 균형 검증
  private validateBalance(lines: { debit: number; credit: number }[], tolerance = 0.01) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > tolerance) {
      throw new BadRequestException(
        `차변(${totalDebit})과 대변(${totalCredit})의 합계가 일치하지 않습니다`,
      );
    }
  }

  // 상태 전이 검증
  private validateStatusTransition(currentStatus: string, newStatus: string, entryId?: string) {
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      const prefix = entryId ? `전표(${entryId})의 ` : "";
      throw new BadRequestException(
        `${prefix}상태를 ${currentStatus}에서 ${newStatus}(으)로 변경할 수 없습니다`,
      );
    }
  }

  // 전표 조회 (없으면 예외)
  private async findEntryOrFail(id: string, include?: any) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: include || ENTRY_INCLUDE,
    });
    if (!entry) throw new NotFoundException(`JournalEntry ${id} not found`);
    return entry;
  }

  // 마감 기간 체크 헬퍼
  private async checkClosedPeriod(tenantId: string, date: Date) {
    const isClosed = await this.closingService.isClosedPeriod(tenantId, date);
    if (isClosed) {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      throw new BadRequestException(
        `${y}년 ${m}월은 마감된 기간입니다. 마감 취소 후 처리하세요.`,
      );
    }
  }

  // 라인의 vendorId를 확정 (bizNo로 조회/생성)
  private async resolveVendorId(
    tenantId: string,
    line: JournalLineDto,
  ): Promise<string> {
    if (line.vendorId) return line.vendorId;

    if (!line.vendorBizNo || !line.vendorName) {
      throw new BadRequestException(
        "거래처 정보가 필요합니다 (vendorId 또는 vendorBizNo+vendorName)",
      );
    }

    const existing = await this.prisma.vendor.findFirst({
      where: { tenantId, bizNo: line.vendorBizNo },
    });
    if (existing) return existing.id;

    const created = await this.prisma.vendor.create({
      data: { tenantId, bizNo: line.vendorBizNo, name: line.vendorName },
    });
    return created.id;
  }

  /**
   * 다른 서비스에서 호출하는 공통 전표 생성 메서드.
   * 차대변 균형 검증 + 마감 기간 체크 + 감사 로그를 자동 처리한다.
   * 트랜잭션 내부에서 사용 시 tx 파라미터를 전달한다.
   */
  async createEntry(params: {
    tenantId: string;
    date: Date;
    description: string;
    status?: string;
    journalType?: string;
    lines: { accountId: string; debit: number; credit: number; vendorId?: string; projectId?: string; departmentId?: string }[];
    tx?: any; // Prisma 트랜잭션 클라이언트
    skipClosedPeriodCheck?: boolean; // 결산 이월 등 관리자 작업 시 마감 체크 건너뜀
  }) {
    const { tenantId, date, description, status = "POSTED", journalType = "GENERAL", lines, tx, skipClosedPeriodCheck = false } = params;
    const db = tx || this.prisma;

    this.validateBalance(lines);

    // 마감 기간 체크
    if (!skipClosedPeriodCheck) {
      await this.checkClosedPeriod(tenantId, date);
    }

    const journalNumber = await this.generateJournalNumber(tenantId, journalType, date, db);

    const entry = await db.journalEntry.create({
      data: {
        tenantId,
        date,
        description,
        status,
        journalType,
        journalNumber,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            vendorId: l.vendorId || null,
            projectId: l.projectId || null,
            departmentId: l.departmentId || null,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    return entry;
  }

  // 전표 생성 (차대변 균형 검증 포함)
  async create(dto: CreateJournalDto, userId?: string) {
    // 마감 기간 체크
    await this.checkClosedPeriod(dto.tenantId, new Date(dto.date));

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException("전표 라인이 최소 1건 이상 필요합니다");
    }

    this.validateBalance(dto.lines);

    // 모든 라인의 vendorId를 미리 확정
    const resolvedLines = await Promise.all(
      dto.lines.map(async (line) => ({
        accountId: line.accountId,
        vendorId: await this.resolveVendorId(dto.tenantId, line),
        projectId: line.projectId || null,
        departmentId: line.departmentId || null,
        debit: line.debit,
        credit: line.credit,
      })),
    );

    const journalType = dto.journalType || "GENERAL";

    return this.prisma.$transaction(async (tx) => {
      const journalNumber = await this.generateJournalNumber(dto.tenantId, journalType, new Date(dto.date), tx);

      const entry = await tx.journalEntry.create({
        data: {
          tenantId: dto.tenantId,
          journalType,
          journalNumber,
          evidenceType: dto.evidenceType || null,
          supplyAmount: dto.supplyAmount || null,
          vatAmount: dto.vatAmount || null,
          date: new Date(dto.date),
          description: dto.description,
          documentId: dto.documentId,
          currency: dto.currency || "KRW",
          exchangeRate: dto.exchangeRate || 1,
          lines: {
            create: resolvedLines,
          },
        },
        include: { lines: { include: { account: true, vendor: true } } },
      });

      // Document 연결 시 상태 업데이트
      if (dto.documentId) {
        await tx.document.update({
          where: { id: dto.documentId },
          data: { status: "JOURNAL_CREATED" },
        });
      }

      // 감사 로그
      if (userId) {
        await this.auditLogService.log({
          tenantId: dto.tenantId,
          userId,
          action: "JOURNAL_CREATED",
          entityType: "JournalEntry",
          entityId: entry.id,
          description: `전표 생성: ${dto.description || new Date(dto.date).toLocaleDateString("ko-KR")}`,
          newValue: { date: dto.date, description: dto.description, lines: resolvedLines },
        });
      }

      return entry;
    });
  }

  // 전표 일괄 등록
  async batchCreate(
    tenantId: string,
    journals: {
      date: string;
      description?: string;
      currency?: string;
      lines: { accountCode: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[];
    }[],
    userId?: string,
  ) {
    const results: { index: number; status: string; error?: string; data?: any }[] = [];

    // 모든 전표에서 사용하는 계정코드를 일괄 조회 (N+1 방지)
    const allAccountCodes = new Set<string>();
    for (const j of journals) {
      if (j.lines) {
        for (const line of j.lines) {
          allAccountCodes.add(line.accountCode);
        }
      }
    }

    const accounts = await this.prisma.account.findMany({
      where: { tenantId, code: { in: [...allAccountCodes] } },
    });
    const accountCodeMap = new Map(accounts.map((a) => [a.code, a]));

    for (let i = 0; i < journals.length; i++) {
      try {
        const j = journals[i];
        if (!j.date || !j.lines || j.lines.length === 0) {
          results.push({ index: i, status: "error", error: `${i + 1}번 전표: 날짜와 라인이 필수입니다` });
          continue;
        }

        // 계정코드 → accountId 변환 (사전 조회된 맵 사용)
        const resolvedLines: JournalLineDto[] = [];
        for (const line of j.lines) {
          const account = accountCodeMap.get(line.accountCode);
          if (!account) {
            throw new BadRequestException(`계정코드 ${line.accountCode}을 찾을 수 없습니다`);
          }
          resolvedLines.push({
            accountId: account.id,
            vendorBizNo: line.vendorBizNo,
            vendorName: line.vendorName,
            debit: line.debit,
            credit: line.credit,
          });
        }

        const entry = await this.create(
          { tenantId, date: j.date, description: j.description, currency: j.currency, lines: resolvedLines },
          userId,
        );
        results.push({ index: i, status: "success", data: { id: entry.id, date: entry.date, description: entry.description } });
      } catch (err: any) {
        results.push({ index: i, status: "error", error: `${i + 1}번 전표: ${err?.message || "등록 실패"}` });
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    return { total: journals.length, success, failed: journals.length - success, results };
  }

  // 테넌트별 전표 목록 조회 (복합 검색 + 페이지네이션)
  async findAll(
    tenantId: string,
    opts?: {
      startDate?: string; endDate?: string; journalType?: string;
      accountId?: string; vendorId?: string;
      minAmount?: number; maxAmount?: number;
      keyword?: string; status?: string;
      page?: number; limit?: number;
    },
  ) {
    const { startDate, endDate, journalType, accountId, vendorId, minAmount, maxAmount, keyword, status, page = 1, limit = 20 } = opts || {};
    const where: Record<string, unknown> = { tenantId };
    if (startDate || endDate) {
      where.date = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + "T23:59:59") }),
      };
    }
    if (journalType) {
      where.journalType = journalType;
    }
    if (status) {
      where.status = status;
    }
    if (keyword) {
      where.description = { contains: keyword, mode: "insensitive" };
    }
    // 라인 기반 필터 (계정과목, 거래처, 금액범위)
    if (accountId || vendorId || minAmount !== undefined || maxAmount !== undefined) {
      const lineFilter: Record<string, unknown> = {};
      if (accountId) lineFilter.accountId = accountId;
      if (vendorId) lineFilter.vendorId = vendorId;
      if (minAmount !== undefined || maxAmount !== undefined) {
        lineFilter.debit = {
          ...(minAmount !== undefined && { gte: minAmount }),
          ...(maxAmount !== undefined && { lte: maxAmount }),
        };
      }
      where.lines = { some: lineFilter };
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: ENTRY_INCLUDE,
        orderBy: [{ date: "desc" }, { journalNumber: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // 원본 전표 기반 새 전표 생성 (복사/역분개 공통)
  private async duplicateEntry(
    id: string,
    opts: { prefix: string; swapDebitCredit?: boolean; date?: string },
  ) {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException("원본 전표를 찾을 수 없습니다");

    const newDate = opts.date ? new Date(opts.date) : new Date();

    return this.createEntry({
      tenantId: original.tenantId,
      date: newDate,
      description: `[${opts.prefix}] ${original.description || ""}`,
      status: "DRAFT",
      journalType: original.journalType,
      lines: original.lines.map((l) => ({
        accountId: l.accountId,
        debit: opts.swapDebitCredit ? Number(l.credit) : Number(l.debit),
        credit: opts.swapDebitCredit ? Number(l.debit) : Number(l.credit),
        vendorId: l.vendorId || undefined,
        projectId: l.projectId || undefined,
        departmentId: l.departmentId || undefined,
      })),
    });
  }

  // 전표 복사
  async copy(id: string, date?: string) {
    return this.duplicateEntry(id, { prefix: "복사", date });
  }

  // 역분개
  async reverse(id: string, date?: string) {
    return this.duplicateEntry(id, { prefix: "역분개", swapDebitCredit: true, date });
  }

  // 단건 조회
  async findOne(id: string) {
    return this.findEntryOrFail(id);
  }

  // 전표 수정
  async update(id: string, dto: UpdateJournalDto, userId?: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!entry) {
      throw new NotFoundException(`JournalEntry ${id} not found`);
    }

    // 마감 기간 체크
    await this.checkClosedPeriod(entry.tenantId, entry.date);
    if (dto.date) {
      await this.checkClosedPeriod(entry.tenantId, new Date(dto.date));
    }

    if (dto.status) {
      this.validateStatusTransition(entry.status, dto.status);
    }

    if (dto.lines && dto.lines.length > 0) {
      this.validateBalance(dto.lines);
    }

    // 라인이 제공되면 vendorId 확정
    let resolvedLines: { accountId: string; vendorId: string; projectId: string | null; departmentId: string | null; debit: number; credit: number }[] | undefined;
    if (dto.lines && dto.lines.length > 0) {
      resolvedLines = await Promise.all(
        dto.lines.map(async (line) => ({
          accountId: line.accountId,
          vendorId: await this.resolveVendorId(entry.tenantId, line),
          projectId: line.projectId || null,
          departmentId: line.departmentId || null,
          debit: line.debit,
          credit: line.credit,
        })),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 라인이 제공되면 기존 라인 삭제 후 새로 생성
      if (resolvedLines) {
        await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
      }

      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          ...(dto.date !== undefined && { date: new Date(dto.date) }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.exchangeRate !== undefined && { exchangeRate: dto.exchangeRate }),
          ...(resolvedLines && {
              lines: {
                create: resolvedLines,
              },
            }),
        },
        include: { lines: { include: { account: true, vendor: true } } },
      });

      // 감사 로그
      if (userId) {
        const action = dto.status && !dto.lines && !dto.date
          ? "JOURNAL_STATUS_CHANGED"
          : "JOURNAL_UPDATED";
        await this.auditLogService.log({
          tenantId: entry.tenantId,
          userId,
          action,
          entityType: "JournalEntry",
          entityId: id,
          description: dto.status
            ? `상태 변경: ${entry.status} → ${dto.status}`
            : `전표 수정`,
          oldValue: { status: entry.status, date: entry.date, description: entry.description },
          newValue: { status: updated.status, date: updated.date, description: updated.description },
        });
      }

      return updated;
    });
  }

  // 전표 삭제
  async remove(id: string, userId?: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { document: true },
    });

    if (!entry) {
      throw new NotFoundException(`JournalEntry ${id} not found`);
    }

    // 마감 기간 체크
    await this.checkClosedPeriod(entry.tenantId, entry.date);

    return this.prisma.$transaction(async (tx) => {
      // 연결된 Document가 있으면 상태를 PENDING으로 복원
      if (entry.documentId) {
        await tx.document.update({
          where: { id: entry.documentId },
          data: { status: "PENDING" },
        });
      }

      // JournalLine은 cascade로 자동 삭제
      const deleted = await tx.journalEntry.delete({ where: { id } });

      // 감사 로그
      if (userId) {
        await this.auditLogService.log({
          tenantId: entry.tenantId,
          userId,
          action: "JOURNAL_DELETED",
          entityType: "JournalEntry",
          entityId: id,
          description: `전표 삭제: ${entry.description || new Date(entry.date).toLocaleDateString("ko-KR")}`,
          oldValue: { status: entry.status, date: entry.date, description: entry.description },
        });
      }

      return deleted;
    });
  }

  // 영수증 → 전표 자동 생성
  async createFromDocument(documentId: string, accountId: string, userId?: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { vendor: true },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    if (!document.totalAmount) {
      throw new BadRequestException("영수증에 금액 정보가 없습니다");
    }

    // 거래처 확인: document에 연결된 vendor 또는 vendorName으로 조회/생성
    let vendorId = document.vendorId;
    if (!vendorId && document.vendorName) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { tenantId: document.tenantId, name: document.vendorName },
      });
      if (vendor) {
        vendorId = vendor.id;
      } else {
        const newVendor = await this.prisma.vendor.create({
          data: { tenantId: document.tenantId, name: document.vendorName },
        });
        vendorId = newVendor.id;
      }
    }

    if (!vendorId) {
      throw new BadRequestException("거래처 정보가 없습니다");
    }

    const amount = Number(document.totalAmount);

    return this.create({
      tenantId: document.tenantId,
      date: (document.transactionAt ?? document.createdAt).toISOString(),
      description: document.vendorName
        ? `${document.vendorName} 결제`
        : "영수증 자동 전표",
      documentId: document.id,
      lines: [
        { accountId, vendorId, debit: amount, credit: 0 },
        { accountId: await this.getCashAccountId(document.tenantId), vendorId, debit: 0, credit: amount },
      ],
    }, userId);
  }

  // 일괄 상태 변경
  async batchUpdateStatus(ids: string[], status: string, userId?: string) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { id: { in: ids } },
    });

    if (entries.length !== ids.length) {
      throw new BadRequestException("일부 전표를 찾을 수 없습니다");
    }

    for (const entry of entries) {
      await this.checkClosedPeriod(entry.tenantId, entry.date);
      this.validateStatusTransition(entry.status, status, entry.id);
    }

    const prevStatuses = entries.map((e) => e.status);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.journalEntry.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });

      // 감사 로그
      if (userId && entries.length > 0) {
        await this.auditLogService.log({
          tenantId: entries[0].tenantId,
          userId,
          action: "JOURNAL_BATCH_STATUS",
          entityType: "JournalEntry",
          entityId: ids.join(","),
          description: `일괄 상태 변경: ${[...new Set(prevStatuses)].join("/")} → ${status} (${result.count}건)`,
          oldValue: { ids, statuses: prevStatuses },
          newValue: { status, count: result.count },
        });
      }

      return { count: result.count };
    });
  }

  // 일괄 수정 (적요/날짜 변경)
  async batchUpdate(
    ids: string[],
    data: { description?: string; date?: string },
    userId?: string,
  ) {
    if (data.description === undefined && data.date === undefined) {
      throw new BadRequestException("수정할 필드가 없습니다");
    }

    const entries = await this.prisma.journalEntry.findMany({
      where: { id: { in: ids } },
    });

    if (entries.length !== ids.length) {
      throw new BadRequestException("일부 전표를 찾을 수 없습니다");
    }

    // POSTED 상태는 수정 불가, 마감 기간 체크
    for (const entry of entries) {
      if (entry.status === "POSTED") {
        throw new BadRequestException(`전표(${entry.journalNumber || entry.id})는 확정 상태라 수정할 수 없습니다`);
      }
      await this.checkClosedPeriod(entry.tenantId, entry.date);
      if (data.date) {
        await this.checkClosedPeriod(entry.tenantId, new Date(data.date));
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.journalEntry.updateMany({
        where: { id: { in: ids } },
        data: {
          ...(data.description !== undefined && { description: data.description }),
          ...(data.date !== undefined && { date: new Date(data.date) }),
        },
      });

      if (userId && entries.length > 0) {
        await this.auditLogService.log({
          tenantId: entries[0].tenantId,
          userId,
          action: "JOURNAL_BATCH_UPDATE",
          entityType: "JournalEntry",
          entityId: ids.join(","),
          description: `일괄 수정 (${result.count}건)`,
          oldValue: { ids },
          newValue: { ...data, count: result.count },
        });
      }

      return { count: result.count };
    });
  }

  // 첨부파일 추가
  async addAttachment(journalEntryId: string, file: { filename: string; originalname: string }) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id: journalEntryId } });
    if (!entry) throw new NotFoundException("전표를 찾을 수 없습니다");

    return this.prisma.journalAttachment.create({
      data: {
        journalEntryId,
        filename: file.originalname,
        url: `/uploads/journal-attachments/${file.filename}`,
      },
    });
  }

  // 첨부파일 삭제
  async removeAttachment(attachmentId: string) {
    const attachment = await this.prisma.journalAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException("첨부파일을 찾을 수 없습니다");

    // 파일 삭제
    const filePath = path.join(process.cwd(), attachment.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return this.prisma.journalAttachment.delete({ where: { id: attachmentId } });
  }

  // 테넌트의 현금 계정(1010) 조회
  private async getCashAccountId(tenantId: string): Promise<string> {
    const account = await this.prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code: "10100" } },
    });

    if (!account) {
      throw new BadRequestException("현금 계정(1010)이 존재하지 않습니다");
    }

    return account.id;
  }
}
