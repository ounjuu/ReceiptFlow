import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.vendor.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  // 사업자등록번호로 거래처 검색 (정확 일치)
  async findByBizNo(tenantId: string, bizNo: string) {
    return this.prisma.vendor.findFirst({
      where: { tenantId, bizNo },
    });
  }

  // 사업자등록번호 부분검색 (자동완성용)
  async searchByBizNoPartial(tenantId: string, query: string) {
    return this.prisma.vendor.findMany({
      where: {
        tenantId,
        bizNo: { contains: query },
      },
      take: 10,
      orderBy: { name: "asc" },
    });
  }

  // 사업자등록번호로 조회 → 없으면 자동 생성
  async findOrCreate(tenantId: string, bizNo: string, name: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: { tenantId, bizNo },
    });
    if (existing) return existing;

    return this.prisma.vendor.create({
      data: { tenantId, bizNo, name },
    });
  }

  async findOne(id: string) {
    return this.prisma.vendor.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateVendorDto) {
    // 같은 테넌트 내 사업자번호 중복 체크
    if (dto.bizNo) {
      const exists = await this.prisma.vendor.findFirst({
        where: { tenantId: dto.tenantId, bizNo: dto.bizNo },
      });
      if (exists) {
        throw new ConflictException("이미 등록된 사업자등록번호입니다");
      }
    }

    return this.prisma.vendor.create({
      data: {
        name: dto.name,
        bizNo: dto.bizNo,
        tenantId: dto.tenantId,
      },
    });
  }

  async update(id: string, dto: UpdateVendorDto) {
    return this.prisma.vendor.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.vendor.delete({ where: { id } });
  }
}
