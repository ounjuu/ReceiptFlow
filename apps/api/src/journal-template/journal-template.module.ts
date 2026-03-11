import { Module } from "@nestjs/common";
import { JournalTemplateController } from "./journal-template.controller";
import { JournalTemplateService } from "./journal-template.service";
import { JournalModule } from "../journal/journal.module";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [JournalModule, AuditLogModule],
  controllers: [JournalTemplateController],
  providers: [JournalTemplateService],
})
export class JournalTemplateModule {}
