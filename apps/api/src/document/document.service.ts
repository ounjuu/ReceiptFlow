import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UploadDocumentDto } from "./dto/upload-document.dto";

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  // 영수증 업로드 → Document 생성
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

  // 테넌트별 목록 조회
  async findAll(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  // 단건 조회
  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { journalEntry: { include: { lines: true } } },
    });

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }
}
