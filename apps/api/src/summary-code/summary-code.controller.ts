import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { SummaryCodeService } from "./summary-code.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("summary-codes")
export class SummaryCodeController {
  constructor(private readonly service: SummaryCodeService) {}

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(
    @CurrentTenant() tenantId: string,
    @Body() body: { code: string; description: string; category?: string },
  ) {
    return this.service.create(tenantId, body);
  }

  @Post("batch")
  @Roles("ADMIN", "ACCOUNTANT")
  async batchCreate(
    @CurrentTenant() tenantId: string,
    @Body() body: { items: { code: string; description: string; category?: string }[] },
  ) {
    return this.service.batchCreate(tenantId, body.items);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("category") category?: string,
  ) {
    return this.service.findAll(tenantId, category);
  }

  @Get("search")
  async search(
    @CurrentTenant() tenantId: string,
    @Query("q") query: string,
    @Query("category") category?: string,
  ) {
    return this.service.search(tenantId, query || "", category);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(
    @Param("id") id: string,
    @Body() body: { description?: string; category?: string },
  ) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
