import { Controller, Get, Query } from "@nestjs/common";
import { AccountService } from "./account.service";

@Controller("accounts")
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  async findAll(@Query("tenantId") tenantId: string) {
    return this.accountService.findAll(tenantId);
  }
}
