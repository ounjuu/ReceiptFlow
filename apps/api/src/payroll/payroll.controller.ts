import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { PayrollService } from "./payroll.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("payroll")
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  // --- 직원 ---

  @Get("employees")
  async getEmployees(@Query("tenantId") tenantId: string) {
    return this.service.getEmployees(tenantId);
  }

  // 급여 현황 (`:id` 라우트 충돌 방지 — 정적 경로 먼저)
  @Get("records")
  async getRecords(
    @Query("tenantId") tenantId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.service.getPayrollRecords(tenantId, Number(year), Number(month));
  }

  @Get("summary")
  async getSummary(
    @Query("tenantId") tenantId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.service.getPayrollSummary(tenantId, Number(year), Number(month));
  }

  @Get("employees/:id")
  async getEmployee(@Param("id") id: string) {
    return this.service.getEmployee(id);
  }

  @Post("employees")
  @Roles("ADMIN", "ACCOUNTANT")
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.service.createEmployee(dto);
  }

  @Patch("employees/:id")
  @Roles("ADMIN", "ACCOUNTANT")
  async updateEmployee(
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.updateEmployee(id, dto);
  }

  // --- 급여 처리 ---

  @Post("process")
  @Roles("ADMIN", "ACCOUNTANT")
  async runPayroll(
    @Body() body: { tenantId: string; year: number; month: number },
  ) {
    return this.service.runMonthlyPayroll(body.tenantId, body.year, body.month);
  }
}
