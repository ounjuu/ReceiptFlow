import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AccountService } from "./account.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("accounts")
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.accountService.findAll(tenantId);
  }
}
