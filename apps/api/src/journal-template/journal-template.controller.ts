import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JournalTemplateService } from "./journal-template.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("journal-templates")
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalTemplateController {
  constructor(private readonly service: JournalTemplateService) {}

  @Get()
  findAll(@Query("tenantId") tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(body, req.user?.id);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  update(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, body, req.user?.id);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id") id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.id);
  }

  @Post(":id/apply")
  @Roles("ADMIN", "ACCOUNTANT")
  apply(
    @Param("id") id: string,
    @Body() body: { tenantId: string; date: string },
    @Req() req: any,
  ) {
    return this.service.apply(id, body.tenantId, body.date, req.user?.id);
  }
}
