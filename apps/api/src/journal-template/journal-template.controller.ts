import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JournalTemplateService } from "./journal-template.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

interface AuthedRequest {
  user: { userId: string };
}

interface TemplateLineInput {
  accountId: string;
  vendorId?: string;
  debit: number;
  credit: number;
}

interface CreateTemplateBody {
  tenantId: string;
  name: string;
  description?: string;
  lines: TemplateLineInput[];
}

interface UpdateTemplateBody {
  name?: string;
  description?: string;
  lines?: TemplateLineInput[];
}

@ApiTags("전표템플릿")
@Controller("journal-templates")
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalTemplateController {
  constructor(private readonly service: JournalTemplateService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  create(@Body() body: CreateTemplateBody, @Req() req: AuthedRequest) {
    return this.service.create(body, req.user?.userId);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  update(@Param("id") id: string, @Body() body: UpdateTemplateBody, @Req() req: AuthedRequest) {
    return this.service.update(id, body, req.user?.userId);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.service.remove(id, req.user?.userId);
  }

  @Post(":id/apply")
  @Roles("ADMIN", "ACCOUNTANT")
  apply(
    @Param("id") id: string,
    @CurrentTenant() tenantId: string,
    @Body() body: { date: string },
    @Req() req: AuthedRequest,
  ) {
    return this.service.apply(id, tenantId, body.date, req.user?.userId);
  }
}
