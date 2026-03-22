import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { TradeService } from "./trade.service";
import { TradePdfService } from "./trade-pdf.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("trades")
export class TradeController {
  constructor(
    private readonly service: TradeService,
    private readonly tradePdfService: TradePdfService,
  ) {}

  // 정적 경로 먼저
  @Get("summary")
  async getSummary(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getSummary(tenantId, startDate, endDate);
  }

  @Get("aging")
  async getAging(
    @CurrentTenant() tenantId: string,
    @Query("tradeType") tradeType: string,
  ) {
    return this.service.getAgingReport(tenantId, tradeType);
  }

  @Get()
  async list(
    @CurrentTenant() tenantId: string,
    @Query("tradeType") tradeType?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getTrades(
      tenantId,
      tradeType,
      status,
      startDate,
      endDate,
    );
  }

  @Get(":id/export-pdf")
  async exportPdf(@Param("id") id: string, @Res() res: Response) {
    const trade = await this.service.getTrade(id);
    const buffer = await this.tradePdfService.generatePdf(trade);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="trade-${trade.tradeNo}.pdf"`,
    });
    res.end(buffer);
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.service.getTrade(id);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTradeDto,
  ) {
    dto.tenantId = tenantId;
    return this.service.createTrade(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateTradeDto) {
    return this.service.updateTrade(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    return this.service.deleteTrade(id);
  }

  @Post(":id/confirm")
  @Roles("ADMIN", "ACCOUNTANT")
  async confirm(@Param("id") id: string) {
    return this.service.confirmTrade(id);
  }

  @Post(":id/cancel")
  @Roles("ADMIN", "ACCOUNTANT")
  async cancel(@Param("id") id: string) {
    return this.service.cancelTrade(id);
  }

  @Post(":id/payments")
  @Roles("ADMIN", "ACCOUNTANT")
  async addPayment(
    @Param("id") id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.addPayment(id, dto);
  }

  @Delete(":id/payments/:paymentId")
  @Roles("ADMIN")
  async deletePayment(@Param("paymentId") paymentId: string) {
    return this.service.deletePayment(paymentId);
  }
}
