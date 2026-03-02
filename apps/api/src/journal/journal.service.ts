import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateJournalDto } from "./dto/create-journal.dto";

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  // 전표 생성 (차대변 균형 검증 포함)
  async create(dto: CreateJournalDto) {
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

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: dto.tenantId,
          date: new Date(dto.date),
          description: dto.description,
          documentId: dto.documentId,
          lines: {
            create: dto.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        include: { lines: { include: { account: true } } },
      });

      // Document 연결 시 상태 업데이트
      if (dto.documentId) {
        await tx.document.update({
          where: { id: dto.documentId },
          data: { status: "JOURNAL_CREATED" },
        });
      }

      return entry;
    });
  }

  // 테넌트별 전표 목록 조회
  async findAll(tenantId: string) {
    return this.prisma.journalEntry.findMany({
      where: { tenantId },
      include: { lines: { include: { account: true } }, document: true },
      orderBy: { date: "desc" },
    });
  }

  // 단건 조회
  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } }, document: true },
    });

    if (!entry) {
      throw new NotFoundException(`JournalEntry ${id} not found`);
    }

    return entry;
  }

  // 영수증 → 전표 자동 생성
  async createFromDocument(documentId: string, accountId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    if (!document.totalAmount) {
      throw new BadRequestException("영수증에 금액 정보가 없습니다");
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
        { accountId, debit: amount, credit: 0 }, // 비용 계정
        { accountId: await this.getCashAccountId(document.tenantId), debit: 0, credit: amount }, // 현금
      ],
    });
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
