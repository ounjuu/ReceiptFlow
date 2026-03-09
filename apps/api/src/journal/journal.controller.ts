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
import { JournalService } from "./journal.service";
import { CreateJournalDto } from "./dto/create-journal.dto";
import { UpdateJournalDto } from "./dto/update-journal.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("journals")
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(@Body() dto: CreateJournalDto, @Req() req: { user: { sub: string } }) {
    return this.journalService.create(dto, req.user.sub);
  }

  @Post("from-document/:documentId")
  @Roles("ADMIN", "ACCOUNTANT")
  async createFromDocument(
    @Param("documentId") documentId: string,
    @Query("accountId") accountId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.journalService.createFromDocument(documentId, accountId, req.user.sub);
  }

  // 일괄 상태 변경 (`:id` 라우트보다 먼저 선언)
  @Patch("batch/status")
  @Roles("ADMIN", "ACCOUNTANT")
  async batchUpdateStatus(@Body() body: { ids: string[]; status: string }, @Req() req: { user: { sub: string } }) {
    return this.journalService.batchUpdateStatus(body.ids, body.status, req.user.sub);
  }

  @Get()
  async findAll(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.journalService.findAll(tenantId, startDate, endDate);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.journalService.findOne(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateJournalDto, @Req() req: { user: { sub: string } }) {
    return this.journalService.update(id, dto, req.user.sub);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async remove(@Param("id") id: string, @Req() req: { user: { sub: string } }) {
    return this.journalService.remove(id, req.user.sub);
  }
}
