import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ExpenseClaimService } from "./expense-claim.service";
import { CreateExpenseClaimDto } from "./dto/create-expense-claim.dto";
import { UpdateExpenseClaimDto } from "./dto/update-expense-claim.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("expense-claims")
export class ExpenseClaimController {
  constructor(private readonly service: ExpenseClaimService) {}

  // 정적 경로 먼저
  @Get("summary")
  async getSummary(@CurrentTenant() tenantId: string) {
    return this.service.getSummary(tenantId);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("status") status?: string,
    @Query("employeeId") employeeId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.findAll(tenantId, { status, employeeId, startDate, endDate });
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateExpenseClaimDto,
  ) {
    dto.tenantId = tenantId;
    return this.service.create(dto);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateExpenseClaimDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string) {
    return this.service.submit(id);
  }

  @Post(":id/settle")
  @Roles("ADMIN", "ACCOUNTANT")
  async settle(
    @Param("id") id: string,
    @Body() body: { debitAccountCode?: string; creditAccountCode?: string },
  ) {
    return this.service.settle(id, body.debitAccountCode, body.creditAccountCode);
  }
}
