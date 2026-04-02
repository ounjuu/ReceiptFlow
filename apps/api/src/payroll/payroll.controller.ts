import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { PayrollService } from "./payroll.service";
import { PayrollPdfService } from "./payroll-pdf.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("payroll")
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly pdfService: PayrollPdfService,
  ) {}

  // --- 직원 ---

  @Get("employees")
  async getEmployees(@CurrentTenant() tenantId: string) {
    return this.service.getEmployees(tenantId);
  }

  // 급여 현황 (`:id` 라우트 충돌 방지 — 정적 경로 먼저)
  @Get("records")
  async getRecords(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.service.getPayrollRecords(tenantId, Number(year), Number(month));
  }

  @Get("summary")
  async getSummary(
    @CurrentTenant() tenantId: string,
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
  async createEmployee(@CurrentTenant() tenantId: string, @Body() dto: CreateEmployeeDto) {
    dto.tenantId = tenantId;
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

  // --- 급여명세서 PDF ---

  @Get("records/:recordId/payslip-pdf")
  async payslipPdf(@Param("recordId") recordId: string, @Res() res: Response) {
    const record = await this.service.getPayrollRecordById(recordId);
    const buffer = await this.pdfService.generatePayslipPdf(record);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${record.employeeNo}-${record.period}.pdf"`,
    });
    res.end(buffer);
  }

  // --- 급여 처리 ---

  @Post("process")
  @Roles("ADMIN", "ACCOUNTANT")
  async runPayroll(
    @CurrentTenant() tenantId: string,
    @Body() body: { year: number; month: number },
  ) {
    return this.service.runMonthlyPayroll(tenantId, body.year, body.month);
  }
}
