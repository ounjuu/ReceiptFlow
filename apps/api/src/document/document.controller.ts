import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { DocumentService } from "./document.service";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

@Controller("documents")
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads",
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.uploadWithOcr(dto, file);
  }

  @Post()
  async createWithAutoJournal(@Body() dto: CreateDocumentDto) {
    return this.documentService.createWithAutoJournal(dto);
  }

  @Get()
  async findAll(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.documentService.findAll(tenantId, startDate, endDate);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.documentService.findOne(id);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentService.update(id, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.documentService.remove(id);
  }
}
