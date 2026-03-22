import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { BudgetService } from "./budget.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("budgets")
export class BudgetController {
  constructor(private readonly service: BudgetService) {}

  // 정적 경로 먼저
  @Get("vs-actual")
  async getVsActual(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
    @Query("month") month?: string,
  ) {
    return this.service.getBudgetVsActual(
      tenantId,
      Number(year),
      month ? Number(month) : undefined,
    );
  }

  @Get("annual-summary")
  async getAnnualSummary(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
  ) {
    return this.service.getAnnualSummary(tenantId, Number(year));
  }

  @Get()
  async list(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
  ) {
    return this.service.getBudgets(tenantId, Number(year));
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async upsert(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    dto.tenantId = tenantId;
    return this.service.upsertBudget(dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    return this.service.deleteBudget(id);
  }
}
