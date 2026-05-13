import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AccountService } from "./account.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard)
@ApiTags("계정과목")
@Controller("accounts")
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.accountService.findAll(tenantId);
  }
}
