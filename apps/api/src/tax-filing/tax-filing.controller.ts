import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, Res, NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import { TaxFilingService } from "./tax-filing.service";
import { VatFilingService } from "./vat-filing.service";
import { WithholdingFilingService } from "./withholding-filing.service";
import { CorporateFilingService } from "./corporate-filing.service";
import { FilingExportService } from "./filing-export.service";
import { UpdateTaxFilingDto } from "./dto/update-tax-filing.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tax-filing")
export class TaxFilingController {
  constructor(
    private readonly taxFilingService: TaxFilingService,
    private readonly vatFilingService: VatFilingService,
    private readonly withholdingFilingService: WithholdingFilingService,
    private readonly corporateFilingService: CorporateFilingService,
    private readonly exportService: FilingExportService,
  ) {}

  // === 정적 경로 (/:id 보다 먼저 선언) ===

  @Get("summary")
  async getSummary(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
  ) {
    return this.taxFilingService.getSummary(tenantId, Number(year));
  }

  @Post("vat/generate")
  @Roles("ADMIN", "ACCOUNTANT")
  async generateVat(
    @CurrentTenant() tenantId: string,
    @Body("year") year: number,
    @Body("quarter") quarter: number,
  ) {
    return this.vatFilingService.generate(tenantId, year, quarter);
  }

  @Post("withholding/generate")
  @Roles("ADMIN", "ACCOUNTANT")
  async generateWithholding(
    @CurrentTenant() tenantId: string,
    @Body("year") year: number,
    @Body("month") month: number,
  ) {
    return this.withholdingFilingService.generate(tenantId, year, month);
  }

  @Post("corporate/generate")
  @Roles("ADMIN", "ACCOUNTANT")
  async generateCorporate(
    @CurrentTenant() tenantId: string,
    @Body("year") year: number,
  ) {
    return this.corporateFilingService.generate(tenantId, year);
  }

  // === 동적 경로 ===

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("filingType") filingType?: string,
    @Query("year") year?: string,
    @Query("status") status?: string,
  ) {
    return this.taxFilingService.findAll(
      tenantId,
      filingType,
      year ? Number(year) : undefined,
      status,
    );
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.taxFilingService.findOne(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateTaxFilingDto) {
    return this.taxFilingService.update(id, dto);
  }

  @Patch(":id/status")
  @Roles("ADMIN", "ACCOUNTANT")
  async updateStatus(
    @Param("id") id: string,
    @Body("status") status: string,
    @Body("filingReference") filingReference?: string,
  ) {
    return this.taxFilingService.updateStatus(id, status, filingReference);
  }

  @Get(":id/export")
  async exportFile(
    @Param("id") id: string,
    @Query("format") format: string,
    @Res() res: Response,
  ) {
    const filing = await this.taxFilingService.findOne(id);
    const filingData = filing.filingData as Record<string, unknown>;

    if (!filingData) {
      throw new NotFoundException("내보낼 신고 데이터가 없습니다");
    }

    if (format === "xml") {
      // XML은 부가세만 지원
      if (filing.filingType !== "VAT") {
        throw new NotFoundException("XML 내보내기는 부가세 신고만 지원합니다");
      }
      const xml = this.exportService.generateVatXml(filingData);
      res.set({
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="vat-${filing.year}-${filing.period}.xml"`,
      });
      return res.send(xml);
    }

    // CSV 내보내기
    let csv: string;
    switch (filing.filingType) {
      case "VAT":
        csv = this.vatFilingService.exportCsv(filingData);
        break;
      case "WITHHOLDING":
        csv = this.withholdingFilingService.exportCsv(filingData);
        break;
      case "CORPORATE":
        csv = this.corporateFilingService.exportCsv(filingData);
        break;
      default:
        throw new NotFoundException("지원하지 않는 신고 유형입니다");
    }

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filing.filingType.toLowerCase()}-${filing.year}-${filing.period}.csv"`,
    });
    return res.send(csv);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    return this.taxFilingService.delete(id);
  }
}
