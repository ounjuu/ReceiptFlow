import { Module } from "@nestjs/common";
import { JournalRuleController } from "./journal-rule.controller";
import { JournalRuleService } from "./journal-rule.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [JournalRuleController],
  providers: [JournalRuleService],
  exports: [JournalRuleService],
})
export class JournalRuleModule {}
