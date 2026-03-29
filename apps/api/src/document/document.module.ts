import { Module } from "@nestjs/common";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { JournalRuleModule } from "../journal-rule/journal-rule.module";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalRuleModule, JournalModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
