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
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
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
  async create(@CurrentTenant() tenantId: string, @Body() dto: CreateJournalDto, @Req() req: { user: { sub: string } }) {
    dto.tenantId = tenantId;
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

  @Post("batch")
  @Roles("ADMIN", "ACCOUNTANT")
  async batchCreate(
    @CurrentTenant() tenantId: string,
    @Body() body: {
      journals: {
        date: string;
        description?: string;
        currency?: string;
        lines: { accountCode: string; vendorBizNo?: string; vendorName?: string; debit: number; credit: number }[];
      }[];
    },
    @Req() req: { user: { sub: string } },
  ) {
    return this.journalService.batchCreate(tenantId, body.journals, req.user.sub);
  }

  // 전표 복사
  @Post(":id/copy")
  @Roles("ADMIN", "ACCOUNTANT")
  async copy(@Param("id") id: string, @Body() body: { date?: string }) {
    return this.journalService.copy(id, body.date);
  }

  // 역분개
  @Post(":id/reverse")
  @Roles("ADMIN", "ACCOUNTANT")
  async reverse(@Param("id") id: string, @Body() body: { date?: string }) {
    return this.journalService.reverse(id, body.date);
  }

  // 일괄 상태 변경 (`:id` 라우트보다 먼저 선언)
  @Patch("batch/status")
  @Roles("ADMIN", "ACCOUNTANT")
  async batchUpdateStatus(@Body() body: { ids: string[]; status: string }, @Req() req: { user: { sub: string } }) {
    return this.journalService.batchUpdateStatus(body.ids, body.status, req.user.sub);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("journalType") journalType?: string,
  ) {
    return this.journalService.findAll(tenantId, startDate, endDate, journalType);
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

  @Post(":id/attachments")
  @Roles("ADMIN", "ACCOUNTANT")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/journal-attachments",
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async addAttachment(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.journalService.addAttachment(id, file);
  }

  @Delete(":id/attachments/:attachmentId")
  @Roles("ADMIN", "ACCOUNTANT")
  async removeAttachment(@Param("attachmentId") attachmentId: string) {
    return this.journalService.removeAttachment(attachmentId);
  }
}
