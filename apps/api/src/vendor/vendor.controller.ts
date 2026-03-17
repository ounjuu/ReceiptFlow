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
import { VendorService } from "./vendor.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("vendors")
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.vendorService.findAll(tenantId);
  }

  @Get("search")
  async searchByBizNo(
    @Query("tenantId") tenantId: string,
    @Query("bizNo") bizNo: string,
  ) {
    const vendor = await this.vendorService.findByBizNo(tenantId, bizNo);
    return vendor || null;
  }

  // 사업자번호 부분검색 (자동완성)
  @Get("autocomplete")
  async autocomplete(
    @Query("tenantId") tenantId: string,
    @Query("q") query: string,
  ) {
    if (!query || query.length < 1) return [];
    return this.vendorService.searchByBizNoPartial(tenantId, query);
  }

  @Get("balance-summary")
  async balanceSummary(@Query("tenantId") tenantId: string) {
    return this.vendorService.getBalanceSummary(tenantId);
  }

  @Get(":id/ledger")
  async vendorLedger(
    @Param("id") id: string,
    @Query("tenantId") tenantId: string,
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
  async batchCreate(@Body() body: { tenantId: string; items: { name: string; bizNo?: string }[] }) {
    return this.vendorService.batchCreate(body.tenantId, body.items);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(@Body() dto: CreateVendorDto) {
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
