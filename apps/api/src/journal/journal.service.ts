import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ClosingService } from "../closing/closing.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateJournalDto, JournalLineDto } from "./dto/create-journal.dto";
import { UpdateJournalDto } from "./dto/update-journal.dto";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closingService: ClosingService,
    private readonly auditLogService: AuditLogService,
  ) {}

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

  // 전표 생성 (차대변 균형 검증 포함)
  async create(dto: CreateJournalDto, userId?: string) {
    // 마감 기간 체크
    await this.checkClosedPeriod(dto.tenantId, new Date(dto.date));

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException("전표 라인이 최소 1건 이상 필요합니다");
    }

    // 차변/대변 합계 검증
    const totalDebit = dto.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = dto.lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(
        `차변(${totalDebit})과 대변(${totalCredit})의 합계가 일치하지 않습니다`,
      );
    }

    // 모든 라인의 vendorId를 미리 확정
    const resolvedLines = await Promise.all(
      dto.lines.map(async (line) => ({
        accountId: line.accountId,
        vendorId: await this.resolveVendorId(dto.tenantId, line),
        debit: line.debit,
        credit: line.credit,
      })),
    );

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: dto.tenantId,
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

  // 테넌트별 전표 목록 조회 (기간 필터)
  async findAll(tenantId: string, startDate?: string, endDate?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (startDate || endDate) {
      where.date = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + "T23:59:59") }),
      };
    }
    return this.prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true, vendor: true } }, document: true, attachments: true },
      orderBy: { date: "desc" },
    });
  }

  // 단건 조회
  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true, vendor: true } }, document: true, attachments: true },
    });

    if (!entry) {
      throw new NotFoundException(`JournalEntry ${id} not found`);
    }

    return entry;
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

    // 상태 전이 검증 (DRAFT → APPROVED → POSTED)
    if (dto.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["APPROVED"],
        APPROVED: ["POSTED", "DRAFT"],
        POSTED: [],
      };
      const allowed = validTransitions[entry.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `상태를 ${entry.status}에서 ${dto.status}(으)로 변경할 수 없습니다`,
        );
      }
    }

    // 라인이 제공되면 차대변 균형 검증
    if (dto.lines && dto.lines.length > 0) {
      const totalDebit = dto.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = dto.lines.reduce((sum, l) => sum + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new BadRequestException(
          `차변(${totalDebit})과 대변(${totalCredit})의 합계가 일치하지 않습니다`,
        );
      }
    }

    // 라인이 제공되면 vendorId 확정
    let resolvedLines: { accountId: string; vendorId: string; debit: number; credit: number }[] | undefined;
    if (dto.lines && dto.lines.length > 0) {
      resolvedLines = await Promise.all(
        dto.lines.map(async (line) => ({
          accountId: line.accountId,
          vendorId: await this.resolveVendorId(entry.tenantId, line),
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
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["APPROVED"],
      APPROVED: ["POSTED", "DRAFT"],
      POSTED: [],
    };

    const entries = await this.prisma.journalEntry.findMany({
      where: { id: { in: ids } },
    });

    if (entries.length !== ids.length) {
      throw new BadRequestException("일부 전표를 찾을 수 없습니다");
    }

    // 각 전표별 검증
    for (const entry of entries) {
      await this.checkClosedPeriod(entry.tenantId, entry.date);
      const allowed = validTransitions[entry.status] || [];
      if (!allowed.includes(status)) {
        throw new BadRequestException(
          `전표(${entry.id})의 상태를 ${entry.status}에서 ${status}(으)로 변경할 수 없습니다`,
        );
      }
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
