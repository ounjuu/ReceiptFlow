import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { DocumentModule } from "./document/document.module";
import { JournalModule } from "./journal/journal.module";
import { ReportModule } from "./report/report.module";
import { AccountModule } from "./account/account.module";

@Module({
  imports: [PrismaModule, AuthModule, DocumentModule, JournalModule, ReportModule, AccountModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
