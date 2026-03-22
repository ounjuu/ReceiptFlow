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
import { InventoryService } from "./inventory.service";
import { CreateInventoryTxDto } from "./dto/create-inventory-tx.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get("summary")
  async getSummary(@CurrentTenant() tenantId: string) {
    return this.service.getSummary(tenantId);
  }

  @Get("stock")
  async getStock(@CurrentTenant() tenantId: string) {
    return this.service.getStock(tenantId);
  }

  @Get("stock-low")
  async getStockLow(@CurrentTenant() tenantId: string) {
    return this.service.getStockLow(tenantId);
  }

  @Get("valuation")
  async getValuation(@CurrentTenant() tenantId: string) {
    return this.service.getValuation(tenantId);
  }

  @Get("transactions")
  async getTransactions(
    @CurrentTenant() tenantId: string,
    @Query("productId") productId?: string,
    @Query("txType") txType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getTransactions(tenantId, { productId, txType, startDate, endDate });
  }

  @Post("transactions")
  async createTransaction(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateInventoryTxDto,
  ) {
    dto.tenantId = tenantId;
    return this.service.createTransaction(dto);
  }

  @Delete("transactions/:id")
  async deleteTransaction(@Param("id") id: string) {
    return this.service.deleteTransaction(id);
  }
}
