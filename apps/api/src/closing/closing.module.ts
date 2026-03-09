import { Module } from "@nestjs/common";
import { ClosingController } from "./closing.controller";
import { ClosingService } from "./closing.service";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [ClosingController],
  providers: [ClosingService],
  exports: [ClosingService],
})
export class ClosingModule {}
