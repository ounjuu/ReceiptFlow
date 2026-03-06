import { Module } from "@nestjs/common";
import { JournalController } from "./journal.controller";
import { JournalService } from "./journal.service";
import { ClosingModule } from "../closing/closing.module";

@Module({
  imports: [ClosingModule],
  controllers: [JournalController],
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalModule {}
