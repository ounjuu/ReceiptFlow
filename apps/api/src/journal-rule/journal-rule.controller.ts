import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { JournalRuleService } from "./journal-rule.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@Controller("journal-rules")
@UseGuards(JwtAuthGuard)
export class JournalRuleController {
  constructor(private readonly service: JournalRuleService) {}

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() body: {
      name: string;
      vendorName?: string;
      keywords?: string;
      amountMin?: number;
      amountMax?: number;
      debitAccountId: string;
      creditAccountId: string;
      priority?: number;
    },
  ) {
    return this.service.create({ ...body, tenantId });
  }

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: {
    name?: string;
    vendorName?: string;
    keywords?: string;
    amountMin?: number | null;
    amountMax?: number | null;
    debitAccountId?: string;
    creditAccountId?: string;
    priority?: number;
    enabled?: boolean;
  }) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
