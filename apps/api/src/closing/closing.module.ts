import { Module, forwardRef } from "@nestjs/common";
import { ClosingController } from "./closing.controller";
import { ClosingService } from "./closing.service";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [AuditLogModule, forwardRef(() => JournalModule)],
  controllers: [ClosingController],
  providers: [ClosingService],
  exports: [ClosingService],
})
export class ClosingModule {}
