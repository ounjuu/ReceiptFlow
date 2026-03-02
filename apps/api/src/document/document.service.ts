import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { readFileSync } from "fs";
import { resolve } from "path";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

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

    // OCR에서 거래처명 또는 금액 추출 실패 → Document만 생성 (OCR_DONE)
    if (!ocr.total_amount || !ocr.vendor_name) {
      const document = await this.prisma.document.create({
        data: {
          tenantId: dto.tenantId,
          imageUrl,
          vendorName: ocr.vendor_name,
          transactionAt: ocr.transaction_date
            ? new Date(ocr.transaction_date)
            : null,
          ocrRaw: ocr as any,
          status: "OCR_DONE",
        },
        include: {
          journalEntry: { include: { lines: { include: { account: true } } } },
        },
      });
      return { document, journalEntry: null, classification: null, ocr };
    }

    // 2. AI 분류 (OCR 전체 텍스트도 함께 전달)
    const vendorName = ocr.vendor_name || "알수없음";
    const classification = await this.classifyVendor(vendorName, ocr.raw_text);

    // 3. 계정 조회
    const expenseAccount = await this.prisma.account.findUnique({
      where: {
        tenantId_code: {
          tenantId: dto.tenantId,
          code: classification.accountCode,
        },
      },
    });

    const finalAccount =
      expenseAccount ??
      (await this.prisma.account.findUnique({
        where: {
          tenantId_code: { tenantId: dto.tenantId, code: "51200" },
        },
      }));

    const cashAccount = await this.prisma.account.findUnique({
      where: {
        tenantId_code: { tenantId: dto.tenantId, code: "10100" },
      },
    });

    const txDate = ocr.transaction_date
      ? new Date(ocr.transaction_date)
      : new Date();

    // 4. Document + JournalEntry 트랜잭션
    const result = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId: dto.tenantId,
          imageUrl,
          vendorName,
          totalAmount: ocr.total_amount!,
          transactionAt: txDate,
          ocrRaw: ocr as any,
          status: "JOURNAL_CREATED",
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId: dto.tenantId,
          date: txDate,
          description: `${vendorName} 결제`,
          documentId: document.id,
          lines: {
            create: [
              {
                accountId: finalAccount!.id,
                debit: ocr.total_amount!,
                credit: 0,
              },
              {
                accountId: cashAccount!.id,
                debit: 0,
                credit: ocr.total_amount!,
              },
            ],
          },
        },
        include: { lines: { include: { account: true } } },
      });

      return { document, journalEntry, classification, ocr };
    });

    return result;
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
    } catch {
      // OCR 서비스 연결 실패
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
    // 1. AI 서비스에 계정 분류 요청
    const classification = await this.classifyVendor(dto.vendorName);

    // 2. 추천된 계정과목 조회
    const expenseAccount = await this.prisma.account.findUnique({
      where: {
        tenantId_code: {
          tenantId: dto.tenantId,
          code: classification.accountCode,
        },
      },
    });

    // 추천 계정이 없으면 지급수수료(51200)로 대체
    const finalAccount =
      expenseAccount ??
      (await this.prisma.account.findUnique({
        where: {
          tenantId_code: { tenantId: dto.tenantId, code: "51200" },
        },
      }));

    // 현금 계정 조회
    const cashAccount = await this.prisma.account.findUnique({
      where: {
        tenantId_code: { tenantId: dto.tenantId, code: "10100" },
      },
    });

    // 3. Document + JournalEntry + JournalLine 트랜잭션으로 생성
    const result = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId: dto.tenantId,
          vendorName: dto.vendorName,
          totalAmount: dto.totalAmount,
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
                accountId: finalAccount!.id,
                debit: dto.totalAmount,
                credit: 0,
              },
              {
                accountId: cashAccount!.id,
                debit: 0,
                credit: dto.totalAmount,
              },
            ],
          },
        },
        include: { lines: { include: { account: true } } },
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

  // 테넌트별 목록 조회
  async findAll(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
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
