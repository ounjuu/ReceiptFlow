import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards,
} from "@nestjs/common";
import { TaxInvoiceService } from "./tax-invoice.service";
import { CreateTaxInvoiceDto } from "./dto/create-tax-invoice.dto";
import { UpdateTaxInvoiceDto } from "./dto/update-tax-invoice.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tax-invoices")
export class TaxInvoiceController {
  constructor(private readonly taxInvoiceService: TaxInvoiceService) {}

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTaxInvoiceDto,
  ) {
    dto.tenantId = tenantId;
    return this.taxInvoiceService.create(dto);
  }

  // 정적 경로는 :id 라우트보다 먼저 선언
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

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.taxInvoiceService.findOne(id);
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
