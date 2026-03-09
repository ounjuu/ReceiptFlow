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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("closings")
export class ClosingController {
  constructor(private readonly closingService: ClosingService) {}

  // 마감 이력 조회
  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.closingService.findAll(tenantId);
  }

  // 특정 월 전표 현황
  @Get("summary")
  async periodSummary(
    @Query("tenantId") tenantId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.closingService.getPeriodSummary(tenantId, Number(year), Number(month));
  }

  // 마감 실행
  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async close(
    @Body() body: { tenantId: string; year: number; month: number },
    @Req() req: { user: { sub: string } },
  ) {
    return this.closingService.close(body.tenantId, body.year, body.month, req.user.sub);
  }

  // 마감 취소
  @Patch(":id/reopen")
  @Roles("ADMIN")
  async reopen(@Param("id") id: string, @Req() req: { user: { sub: string } }) {
    return this.closingService.reopen(id, req.user.sub);
  }
}
