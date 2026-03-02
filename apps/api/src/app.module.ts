import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { DocumentModule } from "./document/document.module";
import { JournalModule } from "./journal/journal.module";
import { ReportModule } from "./report/report.module";
import { AccountModule } from "./account/account.module";

@Module({
  imports: [PrismaModule, DocumentModule, JournalModule, ReportModule, AccountModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
