import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards,
} from "@nestjs/common";
import { CostService } from "./cost.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("cost-management")
export class CostController {
  constructor(private readonly service: CostService) {}

  // ─── 정적 경로 먼저 ───

  @Get("analysis/by-item")
  async analysisByItem(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.analysisByItem(tenantId, startDate, endDate);
  }

  @Get("analysis/by-vendor")
  async analysisByVendor(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.analysisByVendor(tenantId, startDate, endDate);
  }

  @Get("analysis/by-project")
  async analysisByProject(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.analysisByProject(tenantId, startDate, endDate);
  }

  @Get("analysis/by-department")
  async analysisByDepartment(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.analysisByDepartment(tenantId, startDate, endDate);
  }

  @Get("analysis/variance")
  async analysisVariance(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.analysisVariance(tenantId, startDate, endDate);
  }

  // ─── 품목 CRUD ───

  @Get("products")
  async listProducts(@CurrentTenant() tenantId: string) {
    return this.service.getProducts(tenantId);
  }

  @Post("products")
  @Roles("ADMIN", "ACCOUNTANT")
  async createProduct(@CurrentTenant() tenantId: string, @Body() dto: CreateProductDto) {
    dto.tenantId = tenantId;
    return this.service.createProduct(dto);
  }

  @Post("products/batch")
  @Roles("ADMIN", "ACCOUNTANT")
  async batchCreateProducts(
    @CurrentTenant() tenantId: string,
    @Body() body: {
      items: { code: string; name: string; category?: string; unit?: string; standardCost?: number; safetyStock?: number }[];
    },
  ) {
    return this.service.batchCreateProducts(tenantId, body.items);
  }

  @Patch("products/:id")
  @Roles("ADMIN", "ACCOUNTANT")
  async updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(id, dto);
  }

  @Delete("products/:id")
  @Roles("ADMIN")
  async deleteProduct(@Param("id") id: string) {
    return this.service.deleteProduct(id);
  }
}
