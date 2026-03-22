import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, Res, BadRequestException,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { Response } from "express";
import { readFileSync } from "fs";
import { TaxInvoiceService } from "./tax-invoice.service";
import { TaxInvoicePdfService } from "./tax-invoice-pdf.service";
import { HometaxXmlService } from "./hometax-xml.service";
import { CreateTaxInvoiceDto } from "./dto/create-tax-invoice.dto";
import { UpdateTaxInvoiceDto } from "./dto/update-tax-invoice.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

const xmlStorageOptions = {
  storage: diskStorage({
    destination: "./uploads/tax-invoices",
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, filename: string) => void) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tax-invoices")
export class TaxInvoiceController {
  constructor(
    private readonly taxInvoiceService: TaxInvoiceService,
    private readonly taxInvoicePdfService: TaxInvoicePdfService,
    private readonly hometaxXmlService: HometaxXmlService,
  ) {}

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTaxInvoiceDto,
  ) {
    dto.tenantId = tenantId;
    return this.taxInvoiceService.create(dto);
  }

  // ─── 정적 경로 (반드시 :id 라우트보다 먼저 선언) ───

  @Post("import/hometax-xml")
  @Roles("ADMIN", "ACCOUNTANT")
  @UseInterceptors(FileInterceptor("file", xmlStorageOptions))
  async importHometaxXml(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("invoiceType") invoiceType: string,
  ) {
    if (!file) throw new BadRequestException("XML 파일이 필요합니다");
    if (!invoiceType) throw new BadRequestException("invoiceType이 필요합니다 (PURCHASE 또는 SALES)");
    const xmlString = readFileSync(file.path, "utf-8");
    return this.taxInvoiceService.importFromXml(tenantId, xmlString, invoiceType);
  }

  @Post("import/hometax-bulk")
  @Roles("ADMIN", "ACCOUNTANT")
  @UseInterceptors(FilesInterceptor("files", 100, xmlStorageOptions))
  async importHometaxBulk(
    @CurrentTenant() tenantId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("invoiceType") invoiceType: string,
  ) {
    if (!files || files.length === 0) throw new BadRequestException("XML 파일이 필요합니다");
    if (!invoiceType) throw new BadRequestException("invoiceType이 필요합니다 (PURCHASE 또는 SALES)");
    const xmlStrings = files.map((f) => readFileSync(f.path, "utf-8"));
    return this.taxInvoiceService.importBatch(tenantId, xmlStrings, invoiceType);
  }

  @Get("report/vat-return")
  async getVatReturn(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
    @Query("quarter") quarter: string,
  ) {
    return this.taxInvoiceService.getVatReturn(
      tenantId,
      Number(year),
      Number(quarter),
    );
  }

  @Get("report/summary")
  async getTaxSummary(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
    @Query("quarter") quarter: string,
  ) {
    return this.taxInvoiceService.getTaxSummary(
      tenantId,
      Number(year),
      Number(quarter),
    );
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("invoiceType") invoiceType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("status") status?: string,
  ) {
    return this.taxInvoiceService.findAll(tenantId, invoiceType, startDate, endDate, status);
  }

  // ─── 동적 :id 경로 ─────────────────────────────

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.taxInvoiceService.findOne(id);
  }

  @Get(":id/export-pdf")
  async exportPdf(@Param("id") id: string, @Res() res: Response) {
    const invoice = await this.taxInvoiceService.findOne(id);
    const buffer = await this.taxInvoicePdfService.generatePdf(invoice);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tax-invoice-${invoice.invoiceNo || id}.pdf"`,
    });
    res.end(buffer);
  }

  @Get(":id/export-xml")
  async exportXml(@Param("id") id: string, @Res() res: Response) {
    const xml = await this.taxInvoiceService.exportXml(id);
    res.set({
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="tax-invoice-${id}.xml"`,
    });
    res.send(xml);
  }

  @Post(":id/verify-approval")
  @Roles("ADMIN", "ACCOUNTANT")
  async verifyApproval(@Param("id") id: string) {
    const invoice = await this.taxInvoiceService.findOne(id);
    if (!invoice.approvalNo) {
      throw new BadRequestException("승인번호가 없습니다");
    }
    const isValid = this.hometaxXmlService.validateApprovalNo(invoice.approvalNo);
    return { approvalNo: invoice.approvalNo, isValid };
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateTaxInvoiceDto) {
    return this.taxInvoiceService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async remove(@Param("id") id: string) {
    return this.taxInvoiceService.remove(id);
  }
}
