import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { VendorService } from "./vendor.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("vendors")
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.vendorService.findAll(tenantId);
  }

  @Get("search")
  async searchByBizNo(
    @CurrentTenant() tenantId: string,
    @Query("bizNo") bizNo: string,
  ) {
    const vendor = await this.vendorService.findByBizNo(tenantId, bizNo);
    return vendor || null;
  }

  // 사업자번호 부분검색 (자동완성)
  @Get("autocomplete")
  async autocomplete(
    @CurrentTenant() tenantId: string,
    @Query("q") query: string,
  ) {
    if (!query || query.length < 1) return [];
    return this.vendorService.searchByBizNoPartial(tenantId, query);
  }

  @Get("balance-summary")
  async balanceSummary(@CurrentTenant() tenantId: string) {
    return this.vendorService.getBalanceSummary(tenantId);
  }

  @Get(":id/credit-check")
  async creditCheck(
    @Param("id") id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.vendorService.checkCreditLimit(tenantId, id);
  }

  @Get(":id/detail")
  async getDetail(
    @Param("id") id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.vendorService.getDetail(tenantId, id);
  }

  @Get(":id/memos")
  async getMemos(@Param("id") id: string) {
    return this.vendorService.getMemos(id);
  }

  @Post(":id/memos")
  @Roles("ADMIN", "ACCOUNTANT")
  async addMemo(
    @Param("id") id: string,
    @Body() body: { content: string; memoType?: string },
    @Req() req: { user: { sub: string; name?: string } },
  ) {
    return this.vendorService.addMemo(id, {
      content: body.content,
      memoType: body.memoType,
      userId: req.user.sub,
      userName: req.user.name,
    });
  }

  @Delete("memos/:memoId")
  @Roles("ADMIN", "ACCOUNTANT")
  async deleteMemo(@Param("memoId") memoId: string) {
    return this.vendorService.deleteMemo(memoId);
  }

  @Get(":id/ledger")
  async vendorLedger(
    @Param("id") id: string,
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.vendorService.getVendorLedger(tenantId, id, startDate, endDate);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.vendorService.findOne(id);
  }

  @Post("batch")
  @Roles("ADMIN", "ACCOUNTANT")
  async batchCreate(
    @CurrentTenant() tenantId: string,
    @Body() body: { items: { name: string; bizNo?: string }[] },
  ) {
    return this.vendorService.batchCreate(tenantId, body.items);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(@CurrentTenant() tenantId: string, @Body() dto: CreateVendorDto) {
    dto.tenantId = tenantId;
    return this.vendorService.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async remove(@Param("id") id: string) {
    return this.vendorService.remove(id);
  }
}
