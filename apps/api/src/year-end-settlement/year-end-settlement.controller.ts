import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { YearEndSettlementService } from "./year-end-settlement.service";
import { CreateYearEndSettlementDto } from "./dto/create-year-end-settlement.dto";
import { UpdateYearEndSettlementDto } from "./dto/update-year-end-settlement.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("year-end-settlement")
export class YearEndSettlementController {
  constructor(private readonly service: YearEndSettlementService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
  ) {
    return this.service.findAll(tenantId, Number(year));
  }

  @Get("summary")
  async getSummary(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
  ) {
    return this.service.getSummary(tenantId, Number(year));
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(@Body() dto: CreateYearEndSettlementDto) {
    return this.service.create(dto);
  }

  @Post("batch-create")
  @Roles("ADMIN")
  async batchCreate(
    @CurrentTenant() tenantId: string,
    @Body() body: { year: number },
  ) {
    return this.service.batchCreate(tenantId, body.year);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateYearEndSettlementDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/calculate")
  @Roles("ADMIN", "ACCOUNTANT")
  async calculate(@Param("id") id: string) {
    return this.service.calculate(id);
  }

  @Post(":id/finalize")
  @Roles("ADMIN")
  async finalize(@Param("id") id: string) {
    return this.service.finalize(id);
  }
}
