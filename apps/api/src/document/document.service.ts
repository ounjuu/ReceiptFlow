import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JournalRuleService } from "../journal-rule/journal-rule.service";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { readFileSync } from "fs";
import { resolve } from "path";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalRuleService: JournalRuleService,
  ) {}

  // 영수증 이미지 업로드 → Document 생성
  async create(dto: UploadDocumentDto, file: Express.Multer.File) {
    const imageUrl = `/uploads/${file.filename}`;

    return this.prisma.document.create({
      data: {
        tenantId: dto.tenantId,
        imageUrl,
        status: "PENDING",
      },
    });
  }

  // 영수증 이미지 업로드 → OCR → AI 분류 → 자동 전표 생성
  async uploadWithOcr(dto: UploadDocumentDto, file: Express.Multer.File) {
    const imageUrl = `/uploads/${file.filename}`;

    // 1. AI OCR 호출
    const ocr = await this.ocrImage(file);

    // OCR 결과로 Document만 생성 (사업자번호 없으므로 전표는 수기 입력 시 생성)
    const txDate = ocr.transaction_date
      ? new Date(ocr.transaction_date)
      : null;

    const document = await this.prisma.document.create({
      data: {
        tenantId: dto.tenantId,
        imageUrl,
        vendorName: ocr.vendor_name,
        totalAmount: ocr.total_amount,
        transactionAt: txDate,
        ocrRaw: ocr as any,
        status: "OCR_DONE",
      },
      include: {
        journalEntry: { include: { lines: { include: { account: true } } } },
      },
    });

    return { document, journalEntry: null, classification: null, ocr };
  }

  // 영수증 일괄 업로드 (최대 10장)
  async batchUploadWithOcr(dto: UploadDocumentDto, files: Express.Multer.File[]) {
    const promises = files.map(async (file, index) => {
      try {
        const imageUrl = `/uploads/${file.filename}`;
        const ocr = await this.ocrImage(file);
        const txDate = ocr.transaction_date ? new Date(ocr.transaction_date) : null;

        const document = await this.prisma.document.create({
          data: {
            tenantId: dto.tenantId,
            imageUrl,
            vendorName: ocr.vendor_name,
            totalAmount: ocr.total_amount,
            transactionAt: txDate,
            ocrRaw: ocr as any,
            status: "OCR_DONE",
          },
          include: {
            journalEntry: { include: { lines: { include: { account: true } } } },
          },
        });

        return {
          index,
          filename: file.originalname,
          status: "success" as const,
          document,
          ocr,
        };
      } catch (err: any) {
        return {
          index,
          filename: file.originalname,
          status: "error" as const,
          error: err?.message || "처리 실패",
        };
      }
    });

    const results = await Promise.all(promises);
    const success = results.filter((r) => r.status === "success").length;

    return {
      total: files.length,
      success,
      failed: files.length - success,
      results,
    };
  }

  // AI OCR 호출
  private async ocrImage(
    file: Express.Multer.File,
  ): Promise<{
    raw_text: string;
    vendor_name: string | null;
    total_amount: number | null;
    transaction_date: string | null;
    confidence: number;
  }> {
    try {
      const filePath = resolve(file.path);
      const fileBuffer = readFileSync(filePath);
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: file.mimetype || "image/jpeg" });
      formData.append("file", new File([blob], file.originalname || "receipt.jpg", { type: file.mimetype || "image/jpeg" }));

      const res = await fetch(`${AI_SERVICE_URL}/ocr`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      console.error("OCR 서비스 연결 실패:", err?.message || err);
    }

    return {
      raw_text: "",
      vendor_name: null,
      total_amount: null,
      transaction_date: null,
      confidence: 0,
    };
  }

  // 영수증 수기 입력 → AI 분류 → 자동 전표 생성
  async createWithAutoJournal(dto: CreateDocumentDto) {
    if (!dto.vendorBizNo) {
      throw new BadRequestException("사업자등록번호는 필수입니다");
    }

    // 1. 규칙 매칭 우선 시도
    const ruleMatch = await this.journalRuleService.matchRule(
      dto.tenantId,
      dto.vendorName,
      dto.totalAmount,
    );

    let debitAccountId: string;
    let creditAccountId: string;
    let classification: { accountCode: string; accountName: string; confidence: number } | null = null;

    if (ruleMatch) {
      // 규칙 매칭 성공 → 규칙의 계정 사용
      debitAccountId = ruleMatch.debitAccountId;
      creditAccountId = ruleMatch.creditAccountId;
    } else {
      // 규칙 없음 → AI 분류 fallback
      classification = await this.classifyVendor(dto.vendorName);

      const expenseAccount = await this.prisma.account.findUnique({
        where: { tenantId_code: { tenantId: dto.tenantId, code: classification.accountCode } },
      });
      const finalAccount = expenseAccount ?? await this.prisma.account.findUnique({
        where: { tenantId_code: { tenantId: dto.tenantId, code: "51200" } },
      });
      const cashAccount = await this.prisma.account.findUnique({
        where: { tenantId_code: { tenantId: dto.tenantId, code: "10100" } },
      });

      debitAccountId = finalAccount!.id;
      creditAccountId = cashAccount!.id;
    }

    // 3. Document + JournalEntry + JournalLine 트랜잭션으로 생성
    const result = await this.prisma.$transaction(async (tx) => {
      // 사업자등록번호로 거래처 조회/생성
      let vendor = await tx.vendor.findFirst({
        where: { tenantId: dto.tenantId, bizNo: dto.vendorBizNo },
      });
      if (!vendor) {
        vendor = await tx.vendor.create({
          data: { tenantId: dto.tenantId, name: dto.vendorName, bizNo: dto.vendorBizNo },
        });
      }

      const document = await tx.document.create({
        data: {
          tenantId: dto.tenantId,
          vendorName: dto.vendorName,
          vendorId: vendor.id,
          totalAmount: dto.totalAmount,
          currency: dto.currency || "KRW",
          transactionAt: new Date(dto.transactionAt),
          status: "JOURNAL_CREATED",
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId: dto.tenantId,
          date: new Date(dto.transactionAt),
          description: `${dto.vendorName} 결제`,
          documentId: document.id,
          lines: {
            create: [
              {
                accountId: debitAccountId,
                vendorId: vendor.id,
                debit: dto.totalAmount,
                credit: 0,
              },
              {
                accountId: creditAccountId,
                vendorId: vendor.id,
                debit: 0,
                credit: dto.totalAmount,
              },
            ],
          },
        },
        include: { lines: { include: { account: true, vendor: true } } },
      });

      return { document, journalEntry, classification };
    });

    return result;
  }

  // AI 서비스 호출 — 거래처명 + OCR 텍스트 기반 계정 분류
  private async classifyVendor(
    vendorName: string,
    rawText?: string,
  ): Promise<{ accountCode: string; accountName: string; confidence: number }> {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: vendorName, raw_text: rawText }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          accountCode: data.account_code,
          accountName: data.account_name,
          confidence: data.confidence,
        };
      }
    } catch {
      // AI 서비스 연결 실패 시 기본값
    }

    return {
      accountCode: "51200",
      accountName: "지급수수료",
      confidence: 0,
    };
  }

  // 테넌트별 목록 조회 (기간 필터)
  async findAll(tenantId: string, startDate?: string, endDate?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (startDate || endDate) {
      where.transactionAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + "T23:59:59") }),
      };
    }
    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { journalEntry: { include: { lines: { include: { account: true } } } } },
    });
  }

  // 수정
  async update(id: string, dto: UpdateDocumentDto) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.vendorName !== undefined && { vendorName: dto.vendorName }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.transactionAt !== undefined && {
          transactionAt: new Date(dto.transactionAt),
        }),
      },
      include: {
        journalEntry: { include: { lines: { include: { account: true } } } },
      },
    });
  }

  // 삭제 (연결된 전표도 함께 삭제)
  async remove(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { journalEntry: true },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (document.journalEntry) {
        await tx.journalEntry.delete({
          where: { id: document.journalEntry.id },
        });
      }
      return tx.document.delete({ where: { id } });
    });
  }

  // 단건 조회
  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { journalEntry: { include: { lines: { include: { account: true } } } } },
    });

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }
}
