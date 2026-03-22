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
import { DepartmentService } from "./department.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("departments")
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  // 정적 경로 먼저
  @Get("pnl/comparison")
  async getComparison(@CurrentTenant() tenantId: string) {
    return this.service.getDepartmentComparison(tenantId);
  }

  @Get()
  async list(@CurrentTenant() tenantId: string) {
    return this.service.getDepartments(tenantId);
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.service.getDepartment(id);
  }

  @Get(":id/pnl")
  async getPnL(
    @Param("id") id: string,
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getDepartmentPnL(tenantId, id, startDate, endDate);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    dto.tenantId = tenantId;
    return this.service.createDepartment(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.updateDepartment(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    return this.service.deleteDepartment(id);
  }
}
