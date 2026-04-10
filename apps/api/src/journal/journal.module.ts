import { Module, forwardRef } from "@nestjs/common";
import { JournalController } from "./journal.controller";
import { JournalService } from "./journal.service";
import { JournalPdfService } from "./journal-pdf.service";
import { ClosingModule } from "../closing/closing.module";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [forwardRef(() => ClosingModule), AuditLogModule],
  controllers: [JournalController],
  providers: [JournalService, JournalPdfService],
  exports: [JournalService],
})
export class JournalModule {}
