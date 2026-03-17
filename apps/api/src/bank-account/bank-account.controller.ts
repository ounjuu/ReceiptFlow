import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { BankAccountService } from "./bank-account.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";
import { CreateBankTxDto } from "./dto/create-bank-tx.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("bank-accounts")
export class BankAccountController {
  constructor(private readonly service: BankAccountService) {}

  // 정적 경로 먼저
  @Get("summary")
  async getSummary(@Query("tenantId") tenantId: string) {
    return this.service.getSummary(tenantId);
  }

  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateBankAccountDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateBankAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Get(":id/transactions")
  async getTransactions(
    @Param("id") id: string,
    @Query("txType") txType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getTransactions(id, { txType, startDate, endDate });
  }

  @Post(":id/transactions")
  async createTransaction(
    @Param("id") id: string,
    @Body() dto: CreateBankTxDto,
  ) {
    return this.service.createTransaction(id, dto);
  }

  @Delete(":id/transactions/:txId")
  async deleteTransaction(
    @Param("id") id: string,
    @Param("txId") txId: string,
  ) {
    return this.service.deleteTransaction(id, txId);
  }
}
