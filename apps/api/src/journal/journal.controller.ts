import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from "@nestjs/common";
import { JournalService } from "./journal.service";
import { CreateJournalDto } from "./dto/create-journal.dto";
import { UpdateJournalDto } from "./dto/update-journal.dto";

@Controller("journals")
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  async create(@Body() dto: CreateJournalDto) {
    return this.journalService.create(dto);
  }

  // 영수증 → 전표 자동 생성
  @Post("from-document/:documentId")
  async createFromDocument(
    @Param("documentId") documentId: string,
    @Query("accountId") accountId: string,
  ) {
    return this.journalService.createFromDocument(documentId, accountId);
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
  async update(@Param("id") id: string, @Body() dto: UpdateJournalDto) {
    return this.journalService.update(id, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.journalService.remove(id);
  }
}
