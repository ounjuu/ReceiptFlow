import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaxInvoiceDto } from "./dto/create-tax-invoice.dto";
import { UpdateTaxInvoiceDto } from "./dto/update-tax-invoice.dto";
import { HometaxXmlService } from "./hometax-xml.service";

@Injectable()
export class TaxInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hometaxXmlService: HometaxXmlService,
  ) {}

  async create(dto: CreateTaxInvoiceDto) {
    // 거래처 자동 매칭 (사업자등록번호 기준)
    let vendorId = dto.vendorId;
    if (!vendorId) {
      const bizNo = dto.invoiceType === "PURCHASE" ? dto.issuerBizNo : dto.recipientBizNo;
      const name = dto.invoiceType === "PURCHASE" ? dto.issuerName : dto.recipientName;
      const vendor = await this.prisma.vendor.findFirst({
        where: { tenantId: dto.tenantId, bizNo },
      });
      vendorId = vendor?.id;
      if (!vendorId) {
        const created = await this.prisma.vendor.create({
          data: { tenantId: dto.tenantId, bizNo, name },
        });
        vendorId = created.id;
      }
    }

    return this.prisma.taxInvoice.create({
      data: {
        tenantId: dto.tenantId,
        invoiceType: dto.invoiceType,
        invoiceNo: dto.invoiceNo,
        invoiceDate: new Date(dto.invoiceDate),
        issuerBizNo: dto.issuerBizNo,
        issuerName: dto.issuerName,
        recipientBizNo: dto.recipientBizNo,
        recipientName: dto.recipientName,
        supplyAmount: dto.supplyAmount,
        taxAmount: dto.taxAmount,
        totalAmount: dto.totalAmount,
        approvalNo: dto.approvalNo,
        vendorId,
        journalEntryId: dto.journalEntryId,
        description: dto.description,
      },
      include: { vendor: true },
    });
  }

  async findAll(
    tenantId: string,
    invoiceType?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (invoiceType) where.invoiceType = invoiceType;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.invoiceDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + "T23:59:59") }),
      };
    }

    return this.prisma.taxInvoice.findMany({
      where,
      include: { vendor: true, items: true },
      orderBy: { invoiceDate: "desc" },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.taxInvoice.findUnique({
      where: { id },
      include: { vendor: true, journalEntry: true, items: true },
    });
    if (!invoice) throw new NotFoundException("세금계산서를 찾을 수 없습니다");
    return invoice;
  }

  async update(id: string, dto: UpdateTaxInvoiceDto) {
    const existing = await this.prisma.taxInvoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("세금계산서를 찾을 수 없습니다");

    if (existing.status === "FINALIZED") {
      throw new BadRequestException("확정된 세금계산서는 수정할 수 없습니다");
    }

    if (existing.status === "PENDING_APPROVAL" && !dto.status) {
      throw new BadRequestException("결재 대기 중인 세금계산서는 수정할 수 없습니다");
    }

    // 상태 전이 검증
    if (dto.status) {
      const valid: Record<string, string[]> = {
        DRAFT: ["APPROVED", "PENDING_APPROVAL"],
        PENDING_APPROVAL: ["APPROVED", "DRAFT"],
        APPROVED: ["FINALIZED", "DRAFT"],
        FINALIZED: [],
      };
      if (!(valid[existing.status] || []).includes(dto.status)) {
        throw new BadRequestException(
          `상태를 ${existing.status}에서 ${dto.status}(으)로 변경할 수 없습니다`,
        );
      }
    }

    return this.prisma.taxInvoice.update({
      where: { id },
      data: {
        ...(dto.invoiceNo !== undefined && { invoiceNo: dto.invoiceNo }),
        ...(dto.invoiceDate !== undefined && { invoiceDate: new Date(dto.invoiceDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.issuerBizNo !== undefined && { issuerBizNo: dto.issuerBizNo }),
        ...(dto.issuerName !== undefined && { issuerName: dto.issuerName }),
        ...(dto.recipientBizNo !== undefined && { recipientBizNo: dto.recipientBizNo }),
        ...(dto.recipientName !== undefined && { recipientName: dto.recipientName }),
        ...(dto.supplyAmount !== undefined && { supplyAmount: dto.supplyAmount }),
        ...(dto.taxAmount !== undefined && { taxAmount: dto.taxAmount }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.approvalNo !== undefined && { approvalNo: dto.approvalNo }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { vendor: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.taxInvoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("세금계산서를 찾을 수 없습니다");
    if (existing.status === "FINALIZED") {
      throw new BadRequestException("확정된 세금계산서는 삭제할 수 없습니다");
    }
    return this.prisma.taxInvoice.delete({ where: { id } });
  }

  // 부가세 신고 요약 (분기별)
  async getTaxSummary(tenantId: string, year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth, 0, 23, 59, 59);

    const invoices = await this.prisma.taxInvoice.findMany({
      where: {
        tenantId,
        invoiceDate: { gte: startDate, lte: endDate },
      },
    });

    let purchaseSupply = 0, purchaseTax = 0, purchaseCount = 0;
    let salesSupply = 0, salesTax = 0, salesCount = 0;

    for (const inv of invoices) {
      if (inv.invoiceType === "PURCHASE") {
        purchaseSupply += Number(inv.supplyAmount);
        purchaseTax += Number(inv.taxAmount);
        purchaseCount++;
      } else {
        salesSupply += Number(inv.supplyAmount);
        salesTax += Number(inv.taxAmount);
        salesCount++;
      }
    }

    return {
      year,
      quarter,
      purchase: { count: purchaseCount, supplyAmount: purchaseSupply, taxAmount: purchaseTax },
      sales: { count: salesCount, supplyAmount: salesSupply, taxAmount: salesTax },
      netTaxAmount: salesTax - purchaseTax, // 납부세액
    };
  }

  // 부가세 신고서 상세 (분기별)
  async getVatReturn(tenantId: string, year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth, 0, 23, 59, 59);

    // 세금계산서 조회
    const invoices = await this.prisma.taxInvoice.findMany({
      where: {
        tenantId,
        invoiceDate: { gte: startDate, lte: endDate },
      },
      include: { vendor: true },
      orderBy: { invoiceDate: "asc" },
    });

    // 매출/매입 분류
    const salesInvoices = invoices
      .filter((inv) => inv.invoiceType === "SALES")
      .map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        bizNo: inv.recipientBizNo,
        name: inv.recipientName,
        supplyAmount: Number(inv.supplyAmount),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        status: inv.status,
      }));

    const purchaseInvoices = invoices
      .filter((inv) => inv.invoiceType === "PURCHASE")
      .map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        bizNo: inv.issuerBizNo,
        name: inv.issuerName,
        supplyAmount: Number(inv.supplyAmount),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        status: inv.status,
      }));

    const salesSupply = salesInvoices.reduce((s, i) => s + i.supplyAmount, 0);
    const salesTax = salesInvoices.reduce((s, i) => s + i.taxAmount, 0);
    const purchaseSupply = purchaseInvoices.reduce((s, i) => s + i.supplyAmount, 0);
    const purchaseTax = purchaseInvoices.reduce((s, i) => s + i.taxAmount, 0);
    const netTax = salesTax - purchaseTax;

    // 전표 부가세 계정 교차검증 (해당 분기 POSTED 전표)
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          status: "POSTED",
          date: { gte: startDate, lte: endDate },
        },
        account: { code: { in: ["25500", "13500"] } },
      },
      include: {
        account: { select: { code: true } },
        journalEntry: { select: { exchangeRate: true } },
      },
    });

    let vatPayable = 0; // 25500 부가세예수금 (대변잔액)
    let vatReceivable = 0; // 13500 부가세대급금 (차변잔액)

    for (const line of journalLines) {
      const rate = Number(line.journalEntry.exchangeRate);
      if (line.account.code === "25500") {
        vatPayable += (Number(line.credit) - Number(line.debit)) * rate;
      } else if (line.account.code === "13500") {
        vatReceivable += (Number(line.debit) - Number(line.credit)) * rate;
      }
    }

    const isMatched =
      Math.abs(vatPayable - salesTax) < 1 &&
      Math.abs(vatReceivable - purchaseTax) < 1;

    return {
      year,
      quarter,
      periodStart: startDate,
      periodEnd: endDate,
      sales: {
        invoiceCount: salesInvoices.length,
        supplyAmount: salesSupply,
        taxAmount: salesTax,
        invoices: salesInvoices,
      },
      purchase: {
        invoiceCount: purchaseInvoices.length,
        supplyAmount: purchaseSupply,
        taxAmount: purchaseTax,
        invoices: purchaseInvoices,
      },
      outputTax: salesTax,
      inputTax: purchaseTax,
      netTax,
      isRefund: netTax < 0,
      journalValidation: {
        vatPayable,
        vatReceivable,
        isMatched,
      },
    };
  }

  // ─── 홈택스 XML 가져오기/내보내기 ───────────────────

  /**
   * 단일 홈택스 XML을 파싱하여 세금계산서 생성
   */
  async importFromXml(tenantId: string, xmlString: string, invoiceType: string) {
    const parsed = this.hometaxXmlService.parseXml(xmlString);

    // 거래처 매칭 또는 생성
    const bizNo = invoiceType === "PURCHASE" ? parsed.issuerBizNo : parsed.recipientBizNo;
    const bizName = invoiceType === "PURCHASE" ? parsed.issuerName : parsed.recipientName;

    let vendor = await this.prisma.vendor.findFirst({
      where: { tenantId, bizNo },
    });
    if (!vendor) {
      vendor = await this.prisma.vendor.create({
        data: { tenantId, bizNo, name: bizName },
      });
    }

    // 세금계산서 + 품목 생성
    const invoice = await this.prisma.taxInvoice.create({
      data: {
        tenantId,
        invoiceType,
        invoiceDate: new Date(parsed.invoiceDate),
        issuerBizNo: parsed.issuerBizNo,
        issuerName: parsed.issuerName,
        recipientBizNo: parsed.recipientBizNo,
        recipientName: parsed.recipientName,
        supplyAmount: parsed.supplyAmount,
        taxAmount: parsed.taxAmount,
        totalAmount: parsed.totalAmount,
        approvalNo: parsed.approvalNo || undefined,
        vendorId: vendor.id,
        hometaxSyncStatus: "IMPORTED",
        hometaxImportedAt: new Date(),
        xmlRaw: xmlString,
        items: {
          create: parsed.items.map((item) => ({
            sequenceNo: item.sequenceNo,
            itemDate: item.itemDate ? new Date(item.itemDate) : null,
            itemName: item.itemName,
            specification: item.specification,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            supplyAmount: item.supplyAmount,
            taxAmount: item.taxAmount,
            remark: item.remark,
          })),
        },
      },
      include: { vendor: true, items: true },
    });

    return invoice;
  }

  /**
   * 복수 홈택스 XML 일괄 가져오기
   */
  async importBatch(tenantId: string, xmlStrings: string[], invoiceType: string) {
    const results: Array<{ success: boolean; data?: unknown; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const xmlString of xmlStrings) {
      try {
        const invoice = await this.importFromXml(tenantId, xmlString, invoiceType);
        results.push({ success: true, data: invoice });
        success++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "알 수 없는 오류";
        results.push({ success: false, error: message });
        failed++;
      }
    }

    return {
      total: xmlStrings.length,
      success,
      failed,
      results,
    };
  }

  /**
   * 세금계산서를 홈택스 표준 XML로 내보내기
   */
  async exportXml(id: string): Promise<string> {
    const invoice = await this.prisma.taxInvoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException("세금계산서를 찾을 수 없습니다");

    const xml = this.hometaxXmlService.generateXml({
      approvalNo: invoice.approvalNo,
      invoiceDate: invoice.invoiceDate,
      issuerBizNo: invoice.issuerBizNo,
      issuerName: invoice.issuerName,
      recipientBizNo: invoice.recipientBizNo,
      recipientName: invoice.recipientName,
      supplyAmount: invoice.supplyAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      items: invoice.items.map((item) => ({
        sequenceNo: item.sequenceNo,
        itemDate: item.itemDate,
        itemName: item.itemName,
        specification: item.specification,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        supplyAmount: item.supplyAmount,
        taxAmount: item.taxAmount,
        remark: item.remark,
      })),
    });

    // 동기 상태 업데이트
    await this.prisma.taxInvoice.update({
      where: { id },
      data: { hometaxSyncStatus: "EXPORTED" },
    });

    return xml;
  }
}
