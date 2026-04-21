import {
  Controller, Post, Get, Patch, Delete,
  Param, Query, Body, UseGuards,
} from "@nestjs/common";
import { BomService } from "./bom.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("bom")
export class BomController {
  constructor(private readonly bomService: BomService) {}

  // 조립품 목록
  @Get("assemblies")
  async getAssemblies(@CurrentTenant() tenantId: string) {
    return this.bomService.getAssemblyProducts(tenantId);
  }

  // 특정 제품의 BOM 조회
  @Get(":parentId")
  async getBom(@Param("parentId") parentId: string) {
    return this.bomService.getBom(parentId);
  }

  // BOM 항목 추가
  @Post(":parentId/items")
  @Roles("ADMIN", "ACCOUNTANT")
  async addItem(
    @Param("parentId") parentId: string,
    @Body() body: { childId: string; quantity: number; unit?: string; note?: string },
  ) {
    return this.bomService.addItem(parentId, body);
  }

  // BOM 항목 수정
  @Patch("items/:itemId")
  @Roles("ADMIN", "ACCOUNTANT")
  async updateItem(
    @Param("itemId") itemId: string,
    @Body() body: { quantity?: number; unit?: string; note?: string },
  ) {
    return this.bomService.updateItem(itemId, body);
  }

  // BOM 항목 삭제
  @Delete("items/:itemId")
  @Roles("ADMIN", "ACCOUNTANT")
  async removeItem(@Param("itemId") itemId: string) {
    return this.bomService.removeItem(itemId);
  }

  // 자재소요량 계산
  @Get(":parentId/requirement")
  async calculateRequirement(
    @Param("parentId") parentId: string,
    @Query("qty") qty: string,
  ) {
    return this.bomService.calculateRequirement(parentId, Number(qty) || 1);
  }
}
