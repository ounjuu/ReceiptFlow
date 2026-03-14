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
import { FixedAssetService } from "./fixed-asset.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { UpdateFixedAssetDto } from "./dto/update-fixed-asset.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("fixed-assets")
export class FixedAssetController {
  constructor(private readonly service: FixedAssetService) {}

  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.service.findAll(tenantId);
  }

  // 월별 감가상각 실행 (`:id` 라우트보다 앞에 선언)
  @Post("depreciation")
  @Roles("ADMIN", "ACCOUNTANT")
  async runDepreciation(
    @Body() body: { tenantId: string; year: number; month: number },
  ) {
    return this.service.runMonthlyDepreciation(
      body.tenantId,
      body.year,
      body.month,
    );
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/schedule")
  async getSchedule(@Param("id") id: string) {
    return this.service.getDepreciationSchedule(id);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(@Body() dto: CreateFixedAssetDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateFixedAssetDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/dispose")
  @Roles("ADMIN")
  async dispose(
    @Param("id") id: string,
    @Body() body: { disposalDate: string; disposalAmount: number },
  ) {
    return this.service.dispose(id, body.disposalDate, body.disposalAmount);
  }
}
