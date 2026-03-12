import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ExchangeRateService } from "./exchange-rate.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("exchange-rates")
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.exchangeRateService.findAll(tenantId);
  }

  @Get("latest")
  async getLatest(
    @Query("tenantId") tenantId: string,
    @Query("currency") currency: string,
  ) {
    return this.exchangeRateService.getLatest(tenantId, currency);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(
    @Body() body: { tenantId: string; currency: string; rate: number; date: string },
  ) {
    return this.exchangeRateService.create(body);
  }

  @Delete(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async remove(@Param("id") id: string) {
    return this.exchangeRateService.remove(id);
  }
}
