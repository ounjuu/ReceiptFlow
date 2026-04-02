import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ClosingService } from "./closing.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("closings")
export class ClosingController {
  constructor(private readonly closingService: ClosingService) {}

  // 마감 이력 조회
  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.closingService.findAll(tenantId);
  }

  // 특정 월 전표 현황
  @Get("summary")
  async periodSummary(
    @CurrentTenant() tenantId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.closingService.getPeriodSummary(tenantId, Number(year), Number(month));
  }

  // 마감 실행
  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async close(
    @CurrentTenant() tenantId: string,
    @Body() body: { year: number; month: number },
    @Req() req: { user: { sub: string } },
  ) {
    return this.closingService.close(tenantId, body.year, body.month, req.user.sub);
  }

  // 전기이월 실행
  @Post("carry-forward")
  @Roles("ADMIN")
  async carryForward(
    @CurrentTenant() tenantId: string,
    @Body() body: { year: number },
    @Req() req: { user: { sub: string } },
  ) {
    return this.closingService.carryForward(tenantId, body.year, req.user.sub);
  }

  // 마감 취소
  @Patch(":id/reopen")
  @Roles("ADMIN")
  async reopen(@Param("id") id: string, @Req() req: { user: { sub: string } }) {
    return this.closingService.reopen(id, req.user.sub);
  }
}
